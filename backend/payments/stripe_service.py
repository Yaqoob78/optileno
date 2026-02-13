import stripe
from backend.app.config import settings
from backend.db.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

stripe.api_key = settings.STRIPE_API_KEY

class StripeService:
    async def get_or_create_customer(self, db: AsyncSession, user: User):
        """Ensure user has a stripe customer ID."""
        if user.stripe_customer_id:
            return user.stripe_customer_id
            
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"user_id": user.id}
        )
        
        user.stripe_customer_id = customer.id
        await db.commit()
        return customer.id

    async def create_checkout_session(self, db: AsyncSession, user: User):
        """Create a Stripe Checkout Session for subscription."""
        customer_id = await self.get_or_create_customer(db, user)
        
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': settings.STRIPE_PRO_PRICE_ID,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{settings.FRONTEND_URL}/dashboard?payment=success",
            cancel_url=f"{settings.FRONTEND_URL}/dashboard?payment=cancel",
            metadata={
                "user_id": str(user.id)
            }
        )
        
        return session.url

    async def create_portal_session(self, db: AsyncSession, user: User):
        """Create a Stripe Customer Portal session for billing management."""
        customer_id = await self.get_or_create_customer(db, user)
        
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.FRONTEND_URL}/settings"
        )
        
        return session.url

    async def handle_subscription_change(self, db: AsyncSession, subscription_data):
        """Update user tier based on stripe subscription event."""
        stripe_customer_id = subscription_data.customer
        stripe_subscription_id = subscription_data.id
        status = subscription_data.status
        
        # Map stripe status to app tier
        tier = "pro" if status in ["active", "trialing"] else "free"
        plan_type = "PRO" if tier == "pro" else "BASIC"
        
        await db.execute(
            update(User)
            .where(User.stripe_customer_id == stripe_customer_id)
            .values(
                tier=tier,
                plan_type=plan_type,
                stripe_subscription_id=stripe_subscription_id
            )
        )
        await db.commit()

stripe_service = StripeService()
