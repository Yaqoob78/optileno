from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db
from backend.core.security import get_current_user
from backend.db.models import User
from .stripe_service import stripe_service

router = APIRouter()

@router.post("/create-checkout-session")
async def create_checkout(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate a Stripe Checkout URL for the user."""
    try:
        url = await stripe_service.create_checkout_session(db, user)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-portal-session")
async def create_portal(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate a Stripe Customer Portal URL for billing management."""
    try:
        url = await stripe_service.create_portal_session(db, user)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
