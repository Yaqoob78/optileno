# backend/payments/cashfree_service.py
"""
Cashfree Payment Gateway Service for Optileno SaaS.

Uses Cashfree PG API v2025-01-01 (REST, no SDK dependency).

Subscription Plans:
- Explorer: 3 days free trial, then $2/month
- Ultra: No free trial, $10/month or $80/year (Premium features)

Owner accounts (OWNER_EMAIL) have full access to everything.
"""

import hmac
import hashlib
import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.config import settings
from backend.db.models import User
from backend.utils.owner import is_owner_email

logger = logging.getLogger(__name__)

# Cashfree API endpoints
CASHFREE_SANDBOX_URL = "https://sandbox.cashfree.com/pg"
CASHFREE_PRODUCTION_URL = "https://api.cashfree.com/pg"
CASHFREE_API_VERSION = "2025-01-01"


# ==================================================
# Subscription Plans
# ==================================================
SUBSCRIPTION_PLANS = {
    "explorer": {
        "name": "Explorer",
        "tier": "explorer",
        "plan_type": "EXPLORER",
        "trial_days": settings.EXPLORER_TRIAL_DAYS,
        "monthly_price": settings.EXPLORER_MONTHLY_PRICE,  # in cents: 200 = $2.00
        "annual_price": settings.EXPLORER_ANNUAL_PRICE,
        "currency": "USD",
        "features": [
            "AI chat up to 15 requests/day",
            "Manual planner: tasks, habits, deep work, goals",
            "Mood tracker and productivity score",
            "Basic analytics",
            "Big Five test every 14 days",
            "Email support",
        ],
        "limits": {
            "ai_requests_per_day": 15,
            "goals": -1,
            "tasks": -1,
        }
    },
    "ultra": {
        "name": "Ultra",
        "tier": "ultra",
        "plan_type": "ULTRA",
        "trial_days": settings.ULTRA_TRIAL_DAYS,
        "monthly_price": settings.ULTRA_MONTHLY_PRICE,  # in cents: 1000 = $10.00
        "annual_price": settings.ULTRA_ANNUAL_PRICE,
        "currency": "USD",
        "features": [
            "AI chat up to 150 requests/day",
            "Agentic planner automation",
            "Advanced analytics (focus heatmap, burnout risk, AI insights)",
            "Detailed goal progress and AI intelligence",
            "Big Five test every 7 days",
            "Priority support",
        ],
        "limits": {
            "ai_requests_per_day": 150,
            "goals": -1,
            "tasks": -1,
        }
    }
}


class CashfreeService:
    """
    Cashfree Payment Gateway service for subscription management.
    Uses REST API directly - no Python SDK needed.
    """

    def __init__(self):
        self.app_id = settings.CASHFREE_APP_ID
        self.secret_key = settings.CASHFREE_SECRET_KEY
        
        # Auto-detect environment from key prefix
        if self.app_id and self.app_id.startswith("TEST"):
            self.base_url = CASHFREE_SANDBOX_URL
        else:
            self.base_url = (
                CASHFREE_PRODUCTION_URL
                if settings.ENVIRONMENT == "production"
                else CASHFREE_SANDBOX_URL
            )

    def is_configured(self) -> bool:
        """Check if Cashfree is configured."""
        return bool(self.app_id and self.secret_key)

    def get_plans(self) -> Dict[str, Any]:
        """Get available subscription plans."""
        return SUBSCRIPTION_PLANS

    def get_plan(self, plan_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific plan by name."""
        return SUBSCRIPTION_PLANS.get(plan_name.lower())

    def _get_headers(self) -> Dict[str, str]:
        """Get standard Cashfree API headers."""
        return {
            "Content-Type": "application/json",
            "x-client-id": self.app_id,
            "x-client-secret": self.secret_key,
            "x-api-version": CASHFREE_API_VERSION,
        }

    async def create_order(
        self,
        db: AsyncSession,
        user: User,
        plan_name: str,
        billing_cycle: str = "monthly"
    ) -> Dict[str, Any]:
        """
        Create a Cashfree order for subscription.

        Args:
            db: Database session
            user: User object
            plan_name: 'explorer' or 'ultra'
            billing_cycle: 'monthly' or 'annual'

        Returns:
            Order details with payment_session_id for frontend checkout
        """
        if not self.is_configured():
            raise ValueError("Cashfree is not configured")

        plan = self.get_plan(plan_name)
        if not plan:
            raise ValueError(f"Invalid plan: {plan_name}")

        # Calculate amount (convert cents to dollars for Cashfree)
        if billing_cycle == "annual":
            amount_cents = plan["annual_price"]
        else:
            amount_cents = plan["monthly_price"]

        amount = amount_cents / 100  # Cashfree expects float amount (e.g., 2.00)

        # Check for trial eligibility
        is_trial_eligible = await self._is_trial_eligible(db, user, plan_name)
        trial_days = plan["trial_days"] if is_trial_eligible else 0

        # Generate unique order ID
        order_id = f"optileno_{user.id}_{plan_name}_{int(datetime.now().timestamp())}"

        # Build return URL
        return_url = f"{settings.APP_URL}/dashboard?payment=success&order_id={order_id}"

        # Create Cashfree order via API
        order_payload = {
            "order_id": order_id,
            "order_amount": amount,
            "order_currency": "USD",
            "customer_details": {
                "customer_id": f"user_{user.id}",
                "customer_email": user.email,
                "customer_phone": "9999999999",  # Required by Cashfree, using placeholder
                "customer_name": user.full_name or user.username or user.email.split("@")[0],
            },
            "order_meta": {
                "return_url": return_url + "&cf_id={order_id}",
                "notify_url": f"{settings.BASE_URL}/api/v1/payments/webhook",
            },
            "order_note": f"Optileno {plan['name']} Plan - {billing_cycle.capitalize()}",
            "order_tags": {
                "user_id": str(user.id),
                "plan": plan_name,
                "billing_cycle": billing_cycle,
                "trial_days": str(trial_days),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/orders",
                    json=order_payload,
                    headers=self._get_headers(),
                )

            if response.status_code not in (200, 201):
                error_data = response.json() if response.content else {}
                logger.error(
                    f"Cashfree order creation failed: {response.status_code} - {error_data}"
                )
                raise ValueError(
                    f"Cashfree order creation failed: {error_data.get('message', response.status_code)}"
                )

            order_data = response.json()
            logger.info(f"Cashfree order created: {order_data.get('order_id')}")

            return {
                "order_id": order_data.get("order_id"),
                "cf_order_id": order_data.get("cf_order_id"),
                "payment_session_id": order_data.get("payment_session_id"),
                "order_status": order_data.get("order_status"),
                "order_amount": amount,
                "order_currency": "USD",
                "plan": plan_name,
                "plan_details": plan,
                "billing_cycle": billing_cycle,
                "trial_days": trial_days,
                "environment": "sandbox" if "sandbox" in self.base_url else "production",
                "user": {
                    "email": user.email,
                    "name": user.full_name or user.username,
                },
            }
        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating Cashfree order: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to create Cashfree order: {e}")
            raise

    async def _is_trial_eligible(
        self,
        db: AsyncSession,
        user: User,
        plan_name: str
    ) -> bool:
        """Check if user is eligible for trial."""
        if self._is_owner(user):
            return False

        # User who previously had a paid subscription is not eligible
        if user.razorpay_subscription_id:  # Reusing existing field for backward compat
            return False

        # Only explorer plan has trial
        if plan_name.lower() != "explorer":
            return False

        return True

    def _is_owner(self, user: User) -> bool:
        """Check if user is the owner."""
        return is_owner_email(getattr(user, "email", None))

    def verify_webhook_signature(
        self,
        body: bytes,
        timestamp: str,
        signature: str
    ) -> bool:
        """
        Verify Cashfree webhook signature.
        
        Cashfree signs webhooks using HMAC-SHA256:
        signature = HMAC_SHA256(timestamp + raw_body, secret_key)
        """
        if not self.secret_key:
            logger.warning("Cashfree secret key not configured for webhook verification")
            return False

        try:
            # Cashfree webhook signature: HMAC-SHA256 of timestamp+body
            sign_data = timestamp.encode() + body
            expected = hmac.new(
                self.secret_key.encode(),
                sign_data,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False

    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Fetch order status from Cashfree API."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/orders/{order_id}",
                    headers=self._get_headers(),
                )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch order {order_id}: {response.status_code}")
                return {}
        except Exception as e:
            logger.error(f"Error fetching order status: {e}")
            return {}

    async def get_payments_for_order(self, order_id: str) -> list:
        """Get all payments for an order from Cashfree."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/orders/{order_id}/payments",
                    headers=self._get_headers(),
                )

            if response.status_code == 200:
                return response.json()
            return []
        except Exception as e:
            logger.error(f"Error fetching payments for order {order_id}: {e}")
            return []

    async def handle_payment_success(
        self,
        db: AsyncSession,
        order_data: Dict[str, Any]
    ) -> Optional[User]:
        """
        Handle successful payment and activate subscription.

        Args:
            db: Database session
            order_data: Order details from webhook or verification

        Returns:
            Updated user object
        """
        tags = order_data.get("order_tags", {})
        user_id = tags.get("user_id")
        plan_name = tags.get("plan")
        billing_cycle = tags.get("billing_cycle", "monthly")
        trial_days = int(tags.get("trial_days", 0))

        if not user_id or not plan_name:
            logger.error("Missing user_id or plan in order tags")
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
                    razorpay_customer_id=order_data.get("cf_order_id"),  # store CF order ID
                    razorpay_subscription_id=order_data.get("order_id"),  # store order ID
                    subscription_status="active" if trial_days == 0 else "trialing",
                    trial_ends_at=trial_end if trial_days > 0 else None,
                    subscription_starts_at=subscription_start,
                    subscription_ends_at=subscription_end,
                )
            )
            await db.commit()

            # Fetch and return updated user
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()

            if user:
                logger.info(
                    f"Subscription activated for user {user_id}: "
                    f"{plan_name} ({billing_cycle}), trial={trial_days} days"
                )
            return user

        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            await db.rollback()
            return None

    async def handle_payment_failure(
        self,
        db: AsyncSession,
        order_data: Dict[str, Any]
    ):
        """Handle failed payment."""
        tags = order_data.get("order_tags", {})
        user_id = tags.get("user_id")

        if not user_id:
            return

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

        # Update user - downgrade to free tier at end of period
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(subscription_status="canceled")
        )
        await db.commit()

        logger.info(f"Subscription cancelled for user {user.id}")
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
                "tier": "ultra",
                "is_owner": True,
                "has_full_access": True,
                "message": "Owner account with full access",
            }

        now = datetime.now(timezone.utc)

        return {
            "plan": user.plan_type.lower() if user.plan_type else "explorer",
            "plan_details": self.get_plan((user.plan_type or "").lower()) if user.plan_type else SUBSCRIPTION_PLANS["explorer"],
            "status": user.subscription_status or "explorer",
            "tier": user.tier,
            "is_owner": False,
            "has_full_access": user.is_superuser,
            "trial_ends_at": user.trial_ends_at.isoformat() if hasattr(user, 'trial_ends_at') and user.trial_ends_at else None,
            "subscription_ends_at": user.subscription_ends_at.isoformat() if hasattr(user, 'subscription_ends_at') and user.subscription_ends_at else None,
            "is_trial": user.subscription_status == "trialing" if hasattr(user, 'subscription_status') else False,
        }


# Global service instance
cashfree_service = CashfreeService()
