# backend/payments/razorpay_routes.py
"""
Razorpay Payment API Routes for Optileno SaaS.

Endpoints:
- GET /payments/plans - Get available subscription plans
- POST /payments/create-order - Create payment order
- POST /payments/verify - Verify payment
- GET /payments/subscription - Get subscription status
- POST /payments/cancel - Cancel subscription
- POST /payments/webhook - Razorpay webhook handler
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.db.models import User
from backend.core.security import get_current_user
from backend.app.config import settings
from .razorpay_service import razorpay_service, SUBSCRIPTION_PLANS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ==================================================
# Request/Response Models
# ==================================================
class CreateOrderRequest(BaseModel):
    plan: str  # 'explorer' or 'ultra'
    billing_cycle: str = "monthly"  # 'monthly' or 'annual'


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


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
        "message": "Explorer starts at $2/month (7-day trial). Ultra is $10/month or $80/year.",
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
    status = await razorpay_service.get_subscription_status(db, current_user)
    return status


@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a Razorpay order for subscription payment.
    
    - Explorer: ₹299/month or ₹2999/year (7-day free trial for new users)
    - Ultra: ₹799/month or ₹7999/year (no trial)
    """
    # Check if user is owner - they don't need to pay
    if razorpay_service._is_owner(current_user):
        return JSONResponse(
            status_code=200,
            content={
                "message": "Owner account - full access already granted",
                "is_owner": True,
                "plan": "ultra",
            }
        )
    
    if request.plan.lower() not in ["explorer", "ultra"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid plan. Choose 'explorer' or 'ultra'."
        )
    
    if request.billing_cycle not in ["monthly", "annual"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid billing cycle. Choose 'monthly' or 'annual'."
        )
    
    if not razorpay_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Payment service not configured. Please contact support."
        )
    
    try:
        order = await razorpay_service.create_order(
            db=db,
            user=current_user,
            plan_name=request.plan,
            billing_cycle=request.billing_cycle
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
    Verify payment signature and activate subscription.
    """
    # Verify signature
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment signature"
        )
    
    # Get payment details from Razorpay
    try:
        if razorpay_service.client:
            payment = razorpay_service.client.payment.fetch(request.razorpay_payment_id)
            order = razorpay_service.client.order.fetch(request.razorpay_order_id)
            
            # Activate subscription
            user = await razorpay_service.handle_payment_success(
                db=db,
                payment_data={
                    "payment_id": request.razorpay_payment_id,
                    "order_id": request.razorpay_order_id,
                    "notes": order.get("notes", {}),
                }
            )
            
            if user:
                return {
                    "success": True,
                    "message": "Subscription activated successfully",
                    "plan": user.plan_type,
                    "tier": user.tier,
                }
    except Exception as e:
        logger.error(f"Failed to verify payment: {e}")
    
    raise HTTPException(
        status_code=500,
        detail="Failed to activate subscription"
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
    if razorpay_service._is_owner(current_user):
        return JSONResponse(
            status_code=200,
            content={
                "message": "Owner accounts cannot be downgraded",
                "is_owner": True,
            }
        )
    
    success = await razorpay_service.cancel_subscription(db, current_user)
    
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
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Razorpay webhooks.
    
    Events:
    - payment.captured: Payment successful
    - payment.failed: Payment failed
    - subscription.activated: Subscription started
    - subscription.cancelled: Subscription cancelled
    """
    # Get signature
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = await request.body()
    
    # Verify webhook signature
    if not razorpay_service.verify_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Parse event
    import json
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event_type = event.get("event")
    payload = event.get("payload", {})
    
    logger.info(f"Razorpay webhook: {event_type}")
    
    try:
        if event_type == "payment.captured":
            payment = payload.get("payment", {}).get("entity", {})
            await razorpay_service.handle_payment_success(db, payment)
            
        elif event_type == "payment.failed":
            payment = payload.get("payment", {}).get("entity", {})
            await razorpay_service.handle_payment_failure(db, payment)
            
        elif event_type == "subscription.cancelled":
            subscription = payload.get("subscription", {}).get("entity", {})
            notes = subscription.get("notes", {})
            user_id = notes.get("user_id")
            if user_id:
                from sqlalchemy import update as sql_update
                await db.execute(
                    sql_update(User)
                    .where(User.id == int(user_id))
                    .values(subscription_status="cancelled")
                )
                await db.commit()
    
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Return 200 anyway to prevent retries
    
    return {"status": "received"}
