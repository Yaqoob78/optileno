# backend/payments/cashfree_routes.py
"""
Cashfree Payment Gateway API Routes for Optileno SaaS.

Endpoints:
- GET  /payments/plans           - Get available subscription plans
- POST /payments/create-order    - Create payment order (returns payment_session_id)
- POST /payments/create-subscription - Create recurring subscription checkout (returns subscription_session_id)
- POST /payments/verify          - Verify payment after checkout
- POST /payments/verify-subscription - Verify recurring subscription mandate setup
- GET  /payments/subscription    - Get subscription status
- POST /payments/cancel          - Cancel subscription
- POST /payments/webhook         - Cashfree webhook handler
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.db.models import User
from backend.core.security import get_current_user
from backend.app.config import settings
from backend.auth.auth_service import auth_service
from backend.auth.auth_routes import set_auth_cookies
from backend.utils.user_profile import build_user_profile
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


class VerifySubscriptionRequest(BaseModel):
    subscription_id: str


class CompletePaymentReturnRequest(BaseModel):
    order_id: Optional[str] = None
    subscription_id: Optional[str] = None


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
    checkout_currency = (settings.CASHFREE_CURRENCY or "USD").strip().upper() or "USD"
    return {
        "plans": SUBSCRIPTION_PLANS,
        "currency": checkout_currency,
        "message": "Explorer starts at $2/month (3-day free trial). Ultra is $10/month or $80/year. Checkout converts from USD when needed.",
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


@router.post("/create-subscription")
async def create_subscription(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a recurring Cashfree subscription checkout session.
    """
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
        raise HTTPException(status_code=400, detail="Invalid plan. Choose 'explorer' or 'ultra'.")

    if normalized_cycle not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing cycle. Choose 'monthly' or 'annual'.")

    if normalized_plan == "explorer" and normalized_cycle != "monthly":
        raise HTTPException(status_code=400, detail="Explorer plan supports monthly billing only.")

    if not cashfree_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Payment service not configured. Please contact support."
        )

    try:
        subscription = await cashfree_service.create_subscription_checkout(
            db=db,
            user=current_user,
            plan_name=normalized_plan,
            billing_cycle=normalized_cycle
        )
        return subscription
    except Exception as e:
        logger.error(f"Failed to create subscription checkout: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create subscription checkout"
        )


@router.post("/verify-subscription")
async def verify_subscription(
    request: VerifySubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify recurring subscription mandate setup after checkout return.
    """
    subscription_id = str(request.subscription_id or "").strip()
    if not subscription_id:
        raise HTTPException(status_code=400, detail="subscription_id is required")

    try:
        subscription_data = await cashfree_service.get_subscription(subscription_id)
        if not subscription_data:
            raise HTTPException(status_code=404, detail="Subscription not found")

        tags = subscription_data.get("subscription_tags", {}) or {}
        subscription_user_id = str(tags.get("user_id") or "").strip()
        if not subscription_user_id:
            raise HTTPException(status_code=400, detail="Subscription metadata is incomplete")
        if subscription_user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Subscription does not belong to current user")

        status_value = str(subscription_data.get("subscription_status") or "").strip().upper()
        authorization = subscription_data.get("authorization_details", {}) or {}
        authorization_status = str(authorization.get("authorization_status") or "").strip().upper()

        success_states = {"ACTIVE", "BANK_APPROVAL_PENDING"}
        auth_success_states = {"SUCCESS", "ACTIVE"}
        verified_success = status_value in success_states or authorization_status in auth_success_states

        if not verified_success:
            payments = await cashfree_service.get_payments_for_subscription(subscription_id)
            verified_success = any(
                str(payment.get("payment_status") or "").strip().upper() in {"SUCCESS", "PAID"}
                for payment in payments
            )

        if verified_success:
            user = await cashfree_service.handle_subscription_success(db, subscription_data)
            if not user:
                raise HTTPException(
                    status_code=500,
                    detail="Subscription verified but failed to activate account state"
                )

            return {
                "success": True,
                "message": "Subscription mandate verified successfully",
                "plan": user.plan_type,
                "tier": user.tier,
                "subscription_status": status_value or "ACTIVE",
            }

        pending_states = {"INITIALIZED", "PENDING", "AUTHORIZATION_PENDING"}
        if status_value in pending_states:
            return {
                "success": False,
                "message": "Subscription verification is still pending",
                "subscription_status": status_value,
            }

        return {
            "success": False,
            "message": f"Subscription status: {status_value or 'UNKNOWN'}",
            "subscription_status": status_value or "UNKNOWN",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to verify subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify subscription")


@router.post("/complete-return")
async def complete_payment_return(
    request: CompletePaymentReturnRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete checkout return for users that lost auth cookies during provider redirect.

    Validates successful payment/subscription directly with Cashfree, activates the user state,
    then creates a fresh auth session and cookies.
    """
    order_id = str(request.order_id or "").strip()
    subscription_id = str(request.subscription_id or "").strip()

    if not order_id and not subscription_id:
        raise HTTPException(status_code=400, detail="order_id or subscription_id is required")

    try:
        user: Optional[User] = None
        resolved_user_id: Optional[int] = None
        verification_message = ""
        verification_status = ""

        if subscription_id:
            subscription_data = await cashfree_service.get_subscription(subscription_id)
            if not subscription_data:
                raise HTTPException(status_code=404, detail="Subscription not found")

            tags = subscription_data.get("subscription_tags", {}) or {}
            subscription_user_id = str(tags.get("user_id") or "").strip()
            if not subscription_user_id:
                raise HTTPException(status_code=400, detail="Subscription metadata is incomplete")
            if not subscription_user_id.isdigit():
                raise HTTPException(status_code=400, detail="Subscription metadata contains invalid user_id")
            resolved_user_id = int(subscription_user_id)

            status_value = str(subscription_data.get("subscription_status") or "").strip().upper()
            auth_details = subscription_data.get("authorization_details", {}) or {}
            auth_status = str(auth_details.get("authorization_status") or "").strip().upper()
            success_states = {"ACTIVE", "BANK_APPROVAL_PENDING"}
            auth_success_states = {"SUCCESS", "ACTIVE"}
            is_verified = status_value in success_states or auth_status in auth_success_states

            if not is_verified:
                payments = await cashfree_service.get_payments_for_subscription(subscription_id)
                is_verified = any(
                    str(payment.get("payment_status") or "").strip().upper() in {"SUCCESS", "PAID"}
                    for payment in payments
                )

            if not is_verified:
                verification_status = status_value or "PENDING"
                return {
                    "success": False,
                    "authenticated": False,
                    "message": "Subscription verification is still pending",
                    "subscription_status": verification_status,
                }

            user = await cashfree_service.handle_subscription_success(db, subscription_data)
            verification_message = "Subscription mandate verified successfully"
            verification_status = status_value or "ACTIVE"
        else:
            order_data = await cashfree_service.get_order_status(order_id)
            if not order_data:
                raise HTTPException(status_code=404, detail="Order not found")

            tags = order_data.get("order_tags", {}) or {}
            order_user_id = str(tags.get("user_id") or "").strip()
            if not order_user_id:
                raise HTTPException(status_code=400, detail="Order metadata is incomplete")
            if not order_user_id.isdigit():
                raise HTTPException(status_code=400, detail="Order metadata contains invalid user_id")
            resolved_user_id = int(order_user_id)

            order_status = str(order_data.get("order_status") or "").strip().upper()
            is_paid = order_status == "PAID"
            if not is_paid:
                payments = await cashfree_service.get_payments_for_order(order_id)
                is_paid = any(
                    str(payment.get("payment_status") or "").strip().upper() in {"SUCCESS", "PAID"}
                    for payment in payments
                )

            if not is_paid:
                verification_status = order_status or "PENDING"
                return {
                    "success": False,
                    "authenticated": False,
                    "message": "Payment is still pending",
                    "order_status": verification_status,
                }

            user = await cashfree_service.handle_payment_success(db, order_data)
            verification_message = "Payment verified successfully"
            verification_status = order_status or "PAID"

        if not user:
            # Defensive fallback if handler couldn't return hydrated user.
            if resolved_user_id is None:
                raise HTTPException(status_code=500, detail="Failed to resolve user for completed payment")

            result = await db.execute(select(User).where(User.id == int(resolved_user_id)))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=404, detail="User not found for completed payment")

        access_token, refresh_token, refresh_days = await auth_service.create_session(
            db, int(user.id), remember_me=False
        )
        refresh_max_age = refresh_days * 24 * 60 * 60
        set_auth_cookies(response, access_token, refresh_token, refresh_max_age=refresh_max_age)

        payload = {
            "success": True,
            "authenticated": True,
            "message": verification_message,
            "plan": user.plan_type,
            "tier": user.tier,
            "user": build_user_profile(user),
        }
        if subscription_id:
            payload["subscription_status"] = verification_status
        else:
            payload["order_status"] = verification_status
        return payload

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete payment return: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete payment return")


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
    - SUBSCRIPTION_AUTH_STATUS: Mandate authorization status update
    - SUBSCRIPTION_PAYMENT_SUCCESS: Recurring charge succeeded
    - SUBSCRIPTION_PAYMENT_FAILED: Recurring charge failed
    - SUBSCRIPTION_STATUS_CHANGED: Subscription lifecycle status changed
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
    order_data = event_data.get("order", {}) or {}
    payment_data = event_data.get("payment", {}) or {}
    subscription_data = event_data.get("subscription", {}) or {}
    subscription_id = (
        str(subscription_data.get("subscription_id") or "").strip()
        or str(payment_data.get("subscription_id") or "").strip()
        or str(event_data.get("subscription_id") or "").strip()
    )

    logger.info(
        "Cashfree webhook: %s | Order: %s | Subscription: %s",
        event_type,
        order_data.get("order_id"),
        subscription_id or subscription_data.get("subscription_id"),
    )

    try:
        if event_type == "PAYMENT_SUCCESS_WEBHOOK":
            await cashfree_service.handle_payment_success(db, order_data)
            logger.info(f"Payment success handled for order {order_data.get('order_id')}")

        elif event_type == "PAYMENT_FAILED_WEBHOOK":
            await cashfree_service.handle_payment_failure(db, order_data)
            logger.warning(f"Payment failed for order {order_data.get('order_id')}")

        elif event_type == "PAYMENT_USER_DROPPED_WEBHOOK":
            logger.info(f"User dropped off for order {order_data.get('order_id')}")

        elif event_type == "SUBSCRIPTION_AUTH_STATUS":
            if not subscription_data and subscription_id:
                subscription_data = await cashfree_service.get_subscription(subscription_id)
            await cashfree_service.handle_subscription_success(db, subscription_data)
            logger.info("Subscription auth synced for %s", subscription_id)

        elif event_type == "SUBSCRIPTION_PAYMENT_SUCCESS":
            if not subscription_data and subscription_id:
                subscription_data = await cashfree_service.get_subscription(subscription_id)
            await cashfree_service.handle_subscription_payment_success(
                db,
                subscription_id=subscription_id,
                subscription_data=subscription_data,
            )
            logger.info("Subscription payment success synced for %s", subscription_id)

        elif event_type == "SUBSCRIPTION_PAYMENT_FAILED":
            if not subscription_data and subscription_id:
                subscription_data = await cashfree_service.get_subscription(subscription_id)
            await cashfree_service.handle_subscription_payment_failure(
                db,
                subscription_id=subscription_id,
                subscription_data=subscription_data,
            )
            logger.warning("Subscription payment failure synced for %s", subscription_id)

        elif event_type == "SUBSCRIPTION_STATUS_CHANGED":
            if not subscription_data and subscription_id:
                subscription_data = await cashfree_service.get_subscription(subscription_id)
            await cashfree_service.handle_subscription_status_change(db, subscription_data)
            logger.info("Subscription status change synced for %s", subscription_id)

    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Return 200 anyway to prevent Cashfree retries

    return {"status": "received"}
