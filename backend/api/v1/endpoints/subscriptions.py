from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from backend.app.config import settings
from backend.core.security import get_current_user
from backend.db.database import get_db
from backend.db.models import User
from backend.payments.stripe_service import stripe_service

router = APIRouter()


@router.get("/plans")
async def get_plans():
    return [
        {
            "id": "free",
            "name": "Explorer",
            "tier": "free",
            "price": {"monthly": 0, "yearly": 0},
            "features": ["basic-chat", "basic-analytics"],
            "limits": {
                "chatHistory": 1000,
                "fileUploads": 0,
                "aiModels": ["default"],
                "supportLevel": "basic",
            },
        },
        {
            "id": "pro",
            "name": "Ultra",
            "tier": "pro",
            "price": {"monthly": 9.99, "yearly": 99},
            "features": ["all-features"],
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
    plan_id = payload.get("planId")
    if settings.ENVIRONMENT == "production":
        if not settings.STRIPE_API_KEY or not settings.STRIPE_PRO_PRICE_ID:
            raise HTTPException(status_code=501, detail="Stripe not configured")
        checkout_url = await stripe_service.create_checkout_session(db, current_user)
        return {"status": "requires_payment", "checkoutUrl": checkout_url}

    if plan_id in {"pro", "ultra", "elite"}:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(tier="pro", plan_type="PRO", role="premium")
        )
        await db.commit()
        return {"status": "upgraded"}

    raise HTTPException(status_code=400, detail="Unknown plan")


@router.post("/cancel")
async def cancel_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=501, detail="Use Stripe portal to cancel")

    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(tier="free", plan_type="BASIC", role="user")
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
