"""
Subscription endpoints - unified with Lemon Squeezy Merchant of Record.
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
from backend.payments.lemonsqueezy_service import lemonsqueezy_service, SUBSCRIPTION_PLANS
from backend.utils.owner import is_owner_email
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
    """Get available subscription plans with Lemon Squeezy pricing."""
    return [
        {
            "id": "explorer",
            "name": "Free Plan",
            "tier": "explorer",
            "price": {
                "monthly": 0,
                "yearly": 0,
            },
            "trial_days": 0,
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
            "trial_days": 0,
            "checkout_url": settings.LEMONSQUEEZY_CHECKOUT_URL,
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
    Upgrade subscription via Lemon Squeezy checkout.
    """
    plan_id = payload.planId.strip().lower()

    if is_owner_email(current_user.email):
        return {
            "status": "owner",
            "message": "Owner account — full access granted automatically.",
            "is_owner": True,
        }

    checkout_url = lemonsqueezy_service.build_checkout_url(current_user)
    return {
        "status": "redirect",
        "checkout_url": checkout_url,
        "plan": plan_id,
    }


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel subscription info."""
    if is_owner_email(current_user.email):
        return {"status": "owner", "message": "Owner accounts cannot be downgraded"}

    return {
        "status": "cancelled",
        "message": "You can manage or cancel your subscription anytime via your Lemon Squeezy customer portal or receipt.",
    }


@router.get("/invoices")
async def list_invoices(
    current_user: User = Depends(get_current_user),
):
    """Invoices are managed and emailed directly by Lemon Squeezy merchant of record."""
    return []
