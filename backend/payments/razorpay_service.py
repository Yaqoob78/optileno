# backend/payments/razorpay_service.py
"""
Razorpay Payment Service for Optileno SaaS.

Subscription Plans:
- Explorer: 7 days free trial, then ₹299/month or ₹2999/year
- Ultra: No free trial, ₹799/month or ₹7999/year (Premium features)

Owner accounts (identified by OWNER_EMAIL) have full access to everything.
"""

try:
    import razorpay
except Exception:
    razorpay = None
import hmac
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.config import settings
from backend.db.models import User

logger = logging.getLogger(__name__)


# ==================================================
# Subscription Plans
# ==================================================
SUBSCRIPTION_PLANS = {
    "explorer": {
        "name": "Explorer",
        "tier": "explorer",
        "plan_type": "EXPLORER",
        "trial_days": settings.EXPLORER_TRIAL_DAYS,  # 7 days
        "monthly_price": settings.EXPLORER_MONTHLY_PRICE,  # $2.00
        "annual_price": settings.EXPLORER_ANNUAL_PRICE,    # $20.00
        "currency": "USD",
        "features": [
            "Basic AI assistance",
            "Task management",
            "Goal tracking",
            "Basic analytics",
            "Email support",
        ],
        "limits": {
            "ai_requests_per_day": 50,
            "goals": 5,
            "tasks": 100,
        }
    },
    "ultra": {
        "name": "Ultra",
        "tier": "elite",
        "plan_type": "ULTRA",
        "trial_days": settings.ULTRA_TRIAL_DAYS,  # 0 days (no trial)
        "monthly_price": settings.ULTRA_MONTHLY_PRICE,  # $10.00
        "annual_price": settings.ULTRA_ANNUAL_PRICE,    # $80.00 (Save $40)
        "currency": "USD",
        "features": [
            "Unlimited AI assistance",
            "Advanced analytics",
            "Priority support",
            "Custom integrations",
            "Team collaboration",
            "Advanced insights",
            "API access",
        ],
        "limits": {
            "ai_requests_per_day": -1,  # Unlimited
            "goals": -1,  # Unlimited
            "tasks": -1,  # Unlimited
        }
    }
}


class RazorpayService:
    """
    Razorpay payment service for subscription management.
    """
    
    def __init__(self):
        self.client = None
        if razorpay and settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            self.client = razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
    
    def is_configured(self) -> bool:
        """Check if Razorpay is configured."""
        return self.client is not None
    
    def get_plans(self) -> Dict[str, Any]:
        """Get available subscription plans."""
        return SUBSCRIPTION_PLANS
    
    def get_plan(self, plan_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific plan by name."""
        return SUBSCRIPTION_PLANS.get(plan_name.lower())
    
    async def create_order(
        self, 
        db: AsyncSession, 
        user: User, 
        plan_name: str,
        billing_cycle: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order for subscription.
        
        Args:
            db: Database session
            user: User object
            plan_name: 'explorer' or 'ultra'
            billing_cycle: 'monthly' or 'annual'
        
        Returns:
            Order details with order_id and payment_link
        """
        if not self.is_configured():
            raise ValueError("Razorpay is not configured")
        
        plan = self.get_plan(plan_name)
        if not plan:
            raise ValueError(f"Invalid plan: {plan_name}")
        
        # Calculate amount
        if billing_cycle == "annual":
            amount = plan["annual_price"]
        else:
            amount = plan["monthly_price"]
        
        # Check for trial eligibility
        is_trial_eligible = await self._is_trial_eligible(db, user, plan_name)
        trial_days = plan["trial_days"] if is_trial_eligible else 0
        
        # Create Razorpay order
        order_data = {
            "amount": amount,
            "currency": "USD",  # Explicitly set currency to USD
            "receipt": f"order_{user.id}_{plan_name}_{int(datetime.now().timestamp())}",
            "notes": {
                "user_id": str(user.id),
                "plan": plan_name,
                "billing_cycle": billing_cycle,
                "trial_days": str(trial_days),
            }
        }
        
        try:
            order = self.client.order.create(data=order_data)
            
            return {
                "order_id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "key_id": settings.RAZORPAY_KEY_ID,
                "plan": plan_name,
                "plan_details": plan,
                "billing_cycle": billing_cycle,
                "trial_days": trial_days,
                "user": {
                    "email": user.email,
                    "name": user.full_name or user.username,
                }
            }
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {e}")
            raise
    
    async def _is_trial_eligible(
        self, 
        db: AsyncSession, 
        user: User, 
        plan_name: str
    ) -> bool:
        """Check if user is eligible for trial."""
        # Owner never needs trial - they have full access
        if self._is_owner(user):
            return False
        
        # User who previously had a paid plan is not eligible for trial
        if user.razorpay_subscription_id:
            return False
        
        # Only explorer plan has trial
        if plan_name.lower() != "explorer":
            return False
        
        return True
    
    def _is_owner(self, user: User) -> bool:
        """Check if user is the owner."""
        return (
            settings.OWNER_EMAIL and 
            user.email.lower().strip() == settings.OWNER_EMAIL.lower().strip()
        )
    
    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """Verify Razorpay payment signature."""
        if not self.is_configured():
            return False
        
        try:
            self.client.utility.verify_payment_signature({
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            })
            return True
        except Exception:
            return False
    
    def verify_webhook_signature(
        self,
        body: bytes,
        signature: str
    ) -> bool:
        """Verify Razorpay webhook signature."""
        if not settings.RAZORPAY_WEBHOOK_SECRET:
            logger.warning("Razorpay webhook secret not configured")
            return False
        
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected, signature)
    
    async def handle_payment_success(
        self,
        db: AsyncSession,
        payment_data: Dict[str, Any]
    ) -> Optional[User]:
        """
        Handle successful payment and activate subscription.
        
        Args:
            db: Database session
            payment_data: Payment details from webhook/callback
        
        Returns:
            Updated user object
        """
        notes = payment_data.get("notes", {})
        user_id = notes.get("user_id")
        plan_name = notes.get("plan")
        billing_cycle = notes.get("billing_cycle", "monthly")
        trial_days = int(notes.get("trial_days", 0))
        
        if not user_id or not plan_name:
            logger.error("Missing user_id or plan in payment notes")
            return None
        
        plan = self.get_plan(plan_name)
        if not plan:
            logger.error(f"Invalid plan: {plan_name}")
            return None
        
        # Calculate subscription dates
        now = datetime.now(timezone.utc)
        
        if trial_days > 0:
            trial_end = now + timedelta(days=trial_days)
            subscription_start = trial_end
        else:
            subscription_start = now
        
        if billing_cycle == "annual":
            subscription_end = subscription_start + timedelta(days=365)
        else:
            subscription_end = subscription_start + timedelta(days=30)
        
        # Update user subscription
        try:
            await db.execute(
                update(User)
                .where(User.id == int(user_id))
                .values(
                    tier=plan["tier"],
                    plan_type=plan["plan_type"],
                    razorpay_customer_id=payment_data.get("customer_id"),
                    razorpay_subscription_id=payment_data.get("subscription_id"),
                    subscription_status="active" if trial_days == 0 else "trialing",
                    trial_ends_at=trial_end if trial_days > 0 else None,
                    subscription_starts_at=subscription_start,
                    subscription_ends_at=subscription_end,
                )
            )
            await db.commit()
            
            # Fetch and return updated user
            result = await db.execute(select(User).where(User.id == int(user_id)))
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            await db.rollback()
            return None
    
    async def handle_payment_failure(
        self,
        db: AsyncSession,
        payment_data: Dict[str, Any]
    ):
        """Handle failed payment."""
        notes = payment_data.get("notes", {})
        user_id = notes.get("user_id")
        
        if not user_id:
            return
        
        # Update subscription status
        await db.execute(
            update(User)
            .where(User.id == int(user_id))
            .values(subscription_status="payment_failed")
        )
        await db.commit()
        
        logger.warning(f"Payment failed for user {user_id}")
    
    async def cancel_subscription(
        self,
        db: AsyncSession,
        user: User
    ) -> bool:
        """Cancel user's subscription."""
        if not user.razorpay_subscription_id:
            return False
        
        try:
            if self.is_configured():
                self.client.subscription.cancel(user.razorpay_subscription_id)
        except Exception as e:
            logger.error(f"Failed to cancel on Razorpay: {e}")
        
        # Update user - downgrade to free tier at end of period
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(subscription_status="canceled")
        )
        await db.commit()
        
        return True
    
    async def get_subscription_status(
        self,
        db: AsyncSession,
        user: User
    ) -> Dict[str, Any]:
        """Get user's subscription status."""
        # Owner always has full access
        if self._is_owner(user):
            return {
                "plan": "ultra",
                "plan_details": SUBSCRIPTION_PLANS["ultra"],
                "status": "owner",
                "tier": "elite",
                "is_owner": True,
                "has_full_access": True,
                "message": "Owner account with full access",
            }
        
        now = datetime.now(timezone.utc)
        
        return {
            "plan": user.plan_type.lower() if user.plan_type else "free",
            "plan_details": self.get_plan(user.plan_type) if user.plan_type else None,
            "status": user.subscription_status or "free",
            "tier": user.tier,
            "is_owner": False,
            "has_full_access": user.is_superuser,
            "trial_ends_at": user.trial_ends_at.isoformat() if hasattr(user, 'trial_ends_at') and user.trial_ends_at else None,
            "subscription_ends_at": user.subscription_ends_at.isoformat() if hasattr(user, 'subscription_ends_at') and user.subscription_ends_at else None,
            "is_trial": user.subscription_status == "trialing" if hasattr(user, 'subscription_status') else False,
        }


# Global service instance
razorpay_service = RazorpayService()
