# backend/payments/cashfree_routes.py
"""
Cashfree Payment Gateway API Routes for Optileno SaaS.

Endpoints:
- GET  /payments/plans           - Get available subscription plans
- POST /payments/create-order    - Create payment order (returns payment_session_id)
- POST /payments/verify          - Verify payment after checkout
- GET  /payments/subscription    - Get subscription status
- POST /payments/cancel          - Cancel subscription
- POST /payments/webhook         - Cashfree webhook handler
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.db.models import User
from backend.core.security import get_current_user
from backend.app.config import settings
from .cashfree_service import cashfree_service, SUBSCRIPTION_PLANS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ==================================================
# Request/Response Models
# ==================================================
class CreateOrderRequest(BaseModel):
    plan: str  # 'explorer' or 'ultra'
    billing_cycle: str = "monthly"  # 'monthly' or 'annual'


class VerifyPaymentRequest(BaseModel):
    order_id: str


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = None


# ==================================================
# Routes
# ==================================================
@router.get("/plans")
async def get_plans():
    """
    Get available subscription plans.

    Returns Explorer and Ultra plan details with pricing and features.
    """
    return {
        "plans": SUBSCRIPTION_PLANS,
        "currency": "USD",
        "message": "Explorer starts at $2/month (3-day free trial). Ultra is $10/month or $80/year.",
    }


@router.get("/subscription")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's subscription status.

    Owner accounts always show full access to Ultra plan.
    """
    status = await cashfree_service.get_subscription_status(db, current_user)
    return status


@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a Cashfree order for subscription payment.

    Returns payment_session_id for frontend Cashfree JS SDK checkout.
    """
    # Check if user is owner - they don't need to pay
    if cashfree_service._is_owner(current_user):
        return JSONResponse(
            status_code=200,
            content={
                "message": "Owner account - full access already granted",
                "is_owner": True,
                "plan": "ultra",
            }
        )

    normalized_plan = (request.plan or "").strip().lower()
    normalized_cycle = (request.billing_cycle or "monthly").strip().lower()

    if normalized_plan not in ["explorer", "ultra"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid plan. Choose 'explorer' or 'ultra'."
        )

    if normalized_cycle not in ["monthly", "annual"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid billing cycle. Choose 'monthly' or 'annual'."
        )

    if normalized_plan == "explorer" and normalized_cycle != "monthly":
        raise HTTPException(
            status_code=400,
            detail="Explorer plan supports monthly billing only.",
        )

    if not cashfree_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Payment service not configured. Please contact support."
        )

    try:
        order = await cashfree_service.create_order(
            db=db,
            user=current_user,
            plan_name=normalized_plan,
            billing_cycle=normalized_cycle
        )
        return order
    except Exception as e:
        logger.error(f"Failed to create order: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create payment order"
        )


@router.post("/verify")
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify payment by checking order status with Cashfree API.
    Called after user returns from checkout.
    """
    if not request.order_id:
        raise HTTPException(status_code=400, detail="order_id is required")

    try:
        # Fetch order status from Cashfree
        order_data = await cashfree_service.get_order_status(request.order_id)

        if not order_data:
            raise HTTPException(status_code=404, detail="Order not found")

        tags = order_data.get("order_tags", {}) or {}
        order_user_id = str(tags.get("user_id") or "").strip()
        if not order_user_id:
            raise HTTPException(status_code=400, detail="Order metadata is incomplete")
        if order_user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Order does not belong to current user")

        order_status = (order_data.get("order_status") or "").strip().upper()
        payment_success = order_status == "PAID"

        # Fallback to payment attempts list for eventual consistency cases.
        if not payment_success:
            payments = await cashfree_service.get_payments_for_order(request.order_id)
            payment_success = any(
                (payment.get("payment_status") or "").strip().upper() in {"SUCCESS", "PAID"}
                for payment in payments
            )

        if payment_success:
            # Activate subscription
            user = await cashfree_service.handle_payment_success(db, order_data)

            if user:
                return {
                    "success": True,
                    "message": "Subscription activated successfully",
                    "plan": user.plan_type,
                    "tier": user.tier,
                    "order_status": "PAID",
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Payment verified but failed to activate subscription"
                )

        elif order_status == "ACTIVE":
            return {
                "success": False,
                "message": "Payment is still pending",
                "order_status": "ACTIVE",
            }

        else:
            return {
                "success": False,
                "message": f"Order status: {order_status}",
                "order_status": order_status,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify payment: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to verify payment"
        )


@router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel current subscription.

    Access continues until the end of the billing period.
    """
    if cashfree_service._is_owner(current_user):
        return JSONResponse(
            status_code=200,
            content={
                "message": "Owner accounts cannot be downgraded",
                "is_owner": True,
            }
        )

    success = await cashfree_service.cancel_subscription(db, current_user)

    if success:
        return {
            "success": True,
            "message": "Subscription cancelled. Access continues until end of billing period.",
        }
    else:
        return {
            "success": False,
            "message": "No active subscription to cancel.",
        }


@router.post("/webhook")
async def cashfree_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Cashfree webhooks.

    Events:
    - PAYMENT_SUCCESS_WEBHOOK: Payment successful
    - PAYMENT_FAILED_WEBHOOK: Payment failed
    - PAYMENT_USER_DROPPED_WEBHOOK: User dropped off
    """
    body = await request.body()

    # Get signature headers
    timestamp = request.headers.get("x-webhook-timestamp", "")
    signature = request.headers.get("x-webhook-signature", "")

    # Verify webhook signature (if secret is configured)
    if settings.CASHFREE_WEBHOOK_SECRET:
        if not cashfree_service.verify_webhook_signature(body, timestamp, signature):
            logger.warning("Invalid Cashfree webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")

    # Parse event
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("type", "")
    event_data = event.get("data", {})
    order_data = event_data.get("order", {})
    payment_data = event_data.get("payment", {})

    logger.info(f"Cashfree webhook: {event_type} | Order: {order_data.get('order_id')}")

    try:
        if event_type == "PAYMENT_SUCCESS_WEBHOOK":
            await cashfree_service.handle_payment_success(db, order_data)
            logger.info(f"Payment success handled for order {order_data.get('order_id')}")

        elif event_type == "PAYMENT_FAILED_WEBHOOK":
            await cashfree_service.handle_payment_failure(db, order_data)
            logger.warning(f"Payment failed for order {order_data.get('order_id')}")

        elif event_type == "PAYMENT_USER_DROPPED_WEBHOOK":
            logger.info(f"User dropped off for order {order_data.get('order_id')}")

    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Return 200 anyway to prevent Cashfree retries

    return {"status": "received"}
