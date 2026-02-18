"""
Subscription endpoints - unified with Cashfree payment gateway.

These endpoints are legacy compatibility wrappers. The primary payment
flow uses /payments/* endpoints from cashfree_routes.py.
"""

from fastapi import APIRouter, Depends, HTTPException
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


@router.get("/plans")
async def get_plans():
    """Get available subscription plans with Cashfree pricing."""
    return [
        {
            "id": "explorer",
            "name": "Explorer",
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
            "name": "Ultra",
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
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upgrade subscription via Cashfree.
    
    In production, this creates a Cashfree order and returns a payment_session_id.
    In development, it directly upgrades the user.
    """
    plan_id = payload.get("planId", "").strip().lower()
    billing_cycle = payload.get("billingCycle", "monthly").strip().lower()

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
            raise HTTPException(status_code=500, detail=f"Payment order creation failed: {str(e)}")

    # Development fallback: direct upgrade
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
async def reactivate_subscription():
    raise HTTPException(status_code=501, detail="Subscription reactivation not implemented")


@router.get("/invoices")
async def list_invoices(limit: int = 20, offset: int = 0):
    return []


@router.post("/payment-method")
async def update_payment_method():
    raise HTTPException(status_code=501, detail="Payment method updates not implemented")
