from fastapi import APIRouter, Request, Header, HTTPException
import stripe
import logging
from backend.app.config import settings
from .stripe_service import stripe_service
from backend.db.database import AsyncSessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    """Handle Stripe webhooks to keep subscription status in sync."""
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    logger.info(f"Received stripe event: {event.type}")

    async with AsyncSessionLocal() as db:
        if event.type in ["customer.subscription.created", "customer.subscription.updated"]:
            await stripe_service.handle_subscription_change(db, event.data.object)
        
        elif event.type == "customer.subscription.deleted":
            # Accessing db.execute etc handled inside service
            await stripe_service.handle_subscription_change(db, event.data.object)
            
        elif event.type == "checkout.session.completed":
            # For one-time payments or ensuring immediate activation
            session = event.data.object
            if session.mode == "subscription":
                # Subscription created event will also fire, but we can double check here
                pass

    return {"status": "success"}
