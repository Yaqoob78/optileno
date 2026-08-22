"""
Subscription endpoints - unified with Cashfree payment gateway.

These endpoints are legacy compatibility wrappers. The primary payment
flow uses /payments/* endpoints from cashfree_routes.py.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from backend.app.config import settings
from backend.core.security import get_current_user
from backend.db.database import get_db
from backend.db.models import User
from backend.payments.cashfree_service import cashfree_service, SUBSCRIPTION_PLANS
from backend.services.entitlements_service import (
    PLAN_EXPLORER,
    PLAN_ULTRA,
    canonical_plan_type,
    normalize_plan_tier,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class UpgradeRequest(BaseModel):
    planId: str = Field(..., min_length=1)
    billingCycle: str = Field(default="monthly")


@router.get("/plans")
async def get_plans():
    """Get available subscription plans with Cashfree pricing."""
    return [
        {
            "id": "explorer",
            "name": "Free Plan",
            "tier": "explorer",
            "price": {
                "monthly": settings.EXPLORER_MONTHLY_PRICE / 100,
                "yearly": settings.EXPLORER_ANNUAL_PRICE / 100,
            },
            "trial_days": settings.EXPLORER_TRIAL_DAYS,
            "features": [
                "AI chat up to 15 requests/day",
                "Manual planner: tasks, habits, deep work, goals",
                "Mood tracker and productivity score",
                "Basic analytics",
                "Big Five test every 14 days",
                "Email support",
            ],
            "limits": {
                "chatHistory": 1000,
                "fileUploads": 0,
                "aiModels": ["default"],
                "supportLevel": "basic",
            },
        },
        {
            "id": "ultra",
            "name": "Ultra Pro",
            "tier": "ultra",
            "price": {
                "monthly": settings.ULTRA_MONTHLY_PRICE / 100,
                "yearly": settings.ULTRA_ANNUAL_PRICE / 100,
            },
            "trial_days": settings.ULTRA_TRIAL_DAYS,
            "features": [
                "AI chat up to 150 requests/day",
                "Agentic planner automation",
                "Advanced analytics (focus heatmap, burnout risk, AI insights)",
                "Detailed goal progress and AI intelligence",
                "Big Five test every 7 days",
                "Priority support",
            ],
            "limits": {
                "chatHistory": 10000,
                "fileUploads": 10,
                "aiModels": ["default"],
                "supportLevel": "priority",
            },
            "popular": True,
        },
    ]


@router.post("/upgrade")
async def upgrade_subscription(
    payload: UpgradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upgrade subscription via Cashfree.

    In production, this creates a Cashfree order and returns a payment_session_id.
    Outside production (local/dev/staging), with no gateway configured, it
    directly upgrades the user so the flow can be exercised without live keys.
    """
    plan_id = payload.planId.strip().lower()
    billing_cycle = payload.billingCycle.strip().lower()

    normalized = normalize_plan_tier(tier=plan_id, plan_type=plan_id)

    # Owner accounts have automatic full access
    if cashfree_service._is_owner(current_user):
        return {
            "status": "owner",
            "message": "Owner account — full access granted automatically.",
            "is_owner": True,
        }

    if normalized not in (PLAN_EXPLORER, PLAN_ULTRA):
        raise HTTPException(status_code=400, detail="Unknown plan")

    # Production: create Cashfree order
    if cashfree_service.is_configured():
        try:
            order = await cashfree_service.create_order(
                db=db,
                user=current_user,
                plan_name=normalized,
                billing_cycle=billing_cycle,
            )
            return {
                "status": "requires_payment",
                "payment_session_id": order.get("payment_session_id"),
                "order_id": order.get("order_id"),
                "order_amount": order.get("order_amount"),
                "trial_days": order.get("trial_days", 0),
            }
        except Exception as e:
            logger.exception("Cashfree order creation failed for user %s", current_user.id)
            raise HTTPException(status_code=502, detail="Payment order creation failed. Please try again shortly.")

    # Cashfree isn't configured. Never grant a paid tier for free in production —
    # a misconfigured/rotated key must fail loudly, not silently upgrade anyone who asks.
    if settings.ENVIRONMENT == "production":
        logger.error(
            "Subscription upgrade requested in production with Cashfree unconfigured (user %s)",
            current_user.id,
        )
        raise HTTPException(status_code=503, detail="Payments are temporarily unavailable. Please try again shortly.")

    # Development/staging fallback: direct upgrade so the flow is testable without live keys.
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(tier=normalized, plan_type=canonical_plan_type(normalized))
    )
    await db.commit()
    return {"status": "upgraded"}


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel subscription. Access continues until end of billing period."""
    if cashfree_service._is_owner(current_user):
        return {"status": "owner", "message": "Owner accounts cannot be downgraded"}

    success = await cashfree_service.cancel_subscription(db, current_user)
    if success:
        return {"status": "cancelled", "message": "Subscription cancelled. Access continues until end of billing period."}

    # Fallback: direct downgrade
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(tier=PLAN_EXPLORER, plan_type=canonical_plan_type(PLAN_EXPLORER))
    )
    await db.commit()
    return {"status": "cancelled"}


@router.post("/reactivate")
async def reactivate_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reactivate a cancelled subscription that is still within its paid period.
    Once the paid period has lapsed, the user must resubscribe via /upgrade.
    """
    status_value = (current_user.subscription_status or "").strip().lower()
    if status_value != "canceled":
        raise HTTPException(status_code=409, detail="Subscription is not cancelled.")

    from datetime import datetime, timezone

    subscription_ends_at = current_user.subscription_ends_at
    if subscription_ends_at is not None and subscription_ends_at.tzinfo is None:
        subscription_ends_at = subscription_ends_at.replace(tzinfo=timezone.utc)
    within_paid_period = bool(
        subscription_ends_at and subscription_ends_at > datetime.now(timezone.utc)
    )
    subscription_id = str(current_user.razorpay_subscription_id or "").strip()

    if not (within_paid_period and subscription_id):
        raise HTTPException(
            status_code=409,
            detail="This subscription can no longer be reactivated. Please resubscribe from the billing page.",
        )

    gateway_ok = await cashfree_service.manage_subscription(subscription_id, "ACTIVE")
    if not gateway_ok:
        raise HTTPException(
            status_code=502,
            detail="Could not reactivate with the payment provider. Please try again or resubscribe.",
        )

    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(subscription_status="active")
    )
    await db.commit()
    return {"status": "reactivated", "message": "Your subscription is active again."}


@router.get("/invoices")
async def list_invoices(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    """Payment history for the user's subscription, fetched from the gateway."""
    limit = max(1, min(int(limit), 100))
    offset = max(0, int(offset))

    subscription_id = str(current_user.razorpay_subscription_id or "").strip()
    if not subscription_id or not cashfree_service.is_configured():
        return []

    payments = await cashfree_service.get_payments_for_subscription(subscription_id)

    invoices = []
    for payment in payments:
        if not isinstance(payment, dict):
            continue
        raw_status = str(
            payment.get("payment_status") or payment.get("status") or ""
        ).strip().upper()
        invoices.append({
            "id": str(
                payment.get("cf_payment_id")
                or payment.get("payment_id")
                or payment.get("id")
                or ""
            ),
            "date": payment.get("payment_time")
            or payment.get("payment_completion_time")
            or payment.get("created_at"),
            "amount": payment.get("payment_amount") or payment.get("amount") or 0,
            "currency": str(
                payment.get("payment_currency") or payment.get("currency") or "USD"
            ).upper(),
            "status": {
                "SUCCESS": "paid",
                "FAILED": "failed",
                "PENDING": "pending",
                "USER_DROPPED": "failed",
                "CANCELLED": "failed",
            }.get(raw_status, raw_status.lower() or "unknown"),
        })

    invoices.sort(key=lambda inv: str(inv.get("date") or ""), reverse=True)
    return invoices[offset:offset + limit]


@router.post("/payment-method")
async def update_payment_method():
    raise HTTPException(status_code=501, detail="Payment method updates not implemented")
