"""
Lemon Squeezy Payment & Subscription Routes for Optileno SaaS.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.db.models import User
from backend.core.security import get_current_user
from backend.app.config import settings
from .lemonsqueezy_service import lemonsqueezy_service, SUBSCRIPTION_PLANS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/plans")
async def get_plans():
    """
    Get available subscription plans.
    """
    return {
        "plans": SUBSCRIPTION_PLANS,
        "currency": "USD",
        "checkout_url": settings.LEMONSQUEEZY_CHECKOUT_URL,
        "message": "Explorer is 100% Free Forever. Ultra Pro unlocks agentic AI automation and burnout analytics.",
    }


@router.get("/checkout-url")
async def get_checkout_url(current_user: User = Depends(get_current_user)):
    """
    Get personalized Lemon Squeezy checkout link prefilled with current user account details.
    """
    checkout_url = lemonsqueezy_service.build_checkout_url(current_user)
    return {
        "checkout_url": checkout_url,
        "plan": "ultra",
    }


@router.get("/subscription")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's subscription status.
    """
    status = await lemonsqueezy_service.get_subscription_status(db, current_user)
    return status


@router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provides subscription management / cancellation details via Lemon Squeezy.
    """
    return {
        "success": True,
        "message": "You can manage or cancel your subscription anytime via your Lemon Squeezy receipt or customer portal.",
    }


@router.post("/webhook")
async def handle_lemonsqueezy_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Lemon Squeezy Webhook Handler.
    Automatically updates user tiers when subscriptions/orders are created, renewed, or cancelled.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Signature", "")

    if not lemonsqueezy_service.verify_webhook_signature(raw_body, signature):
        logger.warning("Lemon Squeezy webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to parse Lemon Squeezy webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_name = (
        payload.get("meta", {}).get("event_name")
        or request.headers.get("X-Event-Name", "")
        or ""
    )

    if not event_name:
        return JSONResponse(status_code=200, content={"status": "ignored", "reason": "no_event_name"})

    result = await lemonsqueezy_service.process_webhook_event(db, event_name, payload)
    return JSONResponse(status_code=200, content=result)
