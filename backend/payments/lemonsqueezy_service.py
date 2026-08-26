"""
Lemon Squeezy Payment & Subscription Service for Optileno SaaS.
"""

import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.config import settings
from backend.db.models import User
from backend.utils.owner import is_owner_email
from backend.services.entitlements_service import (
    PLAN_EXPLORER,
    PLAN_ULTRA,
    normalize_plan_tier,
)

logger = logging.getLogger(__name__)

SUBSCRIPTION_PLANS = {
    "explorer": {
        "name": "Free Plan",
        "tier": "explorer",
        "plan_type": "EXPLORER",
        "trial_days": 0,
        "monthly_price": 0,
        "annual_price": 0,
        "currency": "USD",
        "features": [
            "AI chat up to 15 requests/day",
            "Manual planner: tasks, habits, deep work, goals",
            "Mood tracker and productivity score",
            "Basic analytics dashboard",
            "Big Five test every 14 days",
            "Email support",
        ],
        "limits": {
            "ai_requests_per_day": 15,
            "goals": 5,
            "tasks": 100,
        },
    },
    "ultra": {
        "name": "Ultra Pro",
        "tier": "ultra",
        "plan_type": "ULTRA",
        "trial_days": 0,
        "monthly_price": 699,
        "annual_price": 4900,
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
            "goals": 100,
            "tasks": 10000,
        },
        "popular": True,
    },
}


class LemonSqueezyService:
    """Lemon Squeezy integration for subscription management and checkout."""

    def __init__(self):
        self.checkout_url = settings.LEMONSQUEEZY_CHECKOUT_URL
        self.webhook_secret = settings.LEMONSQUEEZY_WEBHOOK_SECRET

    def build_checkout_url(self, user: Optional[User] = None) -> str:
        """
        Builds personalized Lemon Squeezy checkout URL prefilling user email and custom user_id.
        """
        base = self.checkout_url
        if not user:
            return base

        try:
            parsed = urlparse(base)
            params = parse_qs(parsed.query)

            if user.email:
                params["checkout[email]"] = [user.email.strip()]
            if user.full_name:
                params["checkout[name]"] = [user.full_name.strip()]
            if user.id:
                params["checkout[custom][user_id]"] = [str(user.id)]

            # Flatten multi-dict for urlencode
            query_items = []
            for k, v_list in params.items():
                for v in v_list:
                    query_items.append((k, v))

            new_query = urlencode(query_items)
            return urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))
        except Exception as e:
            logger.warning(f"Error building Lemon Squeezy URL with user params: {e}")
            return base

    def verify_webhook_signature(self, raw_payload: bytes, signature_header: str) -> bool:
        """
        Verifies the Lemon Squeezy X-Signature HMAC-SHA256 header.
        """
        if not self.webhook_secret:
            logger.warning("LEMONSQUEEZY_WEBHOOK_SECRET is not configured; skipping signature verification")
            return True

        if not signature_header:
            return False

        try:
            computed_signature = hmac.new(
                self.webhook_secret.encode("utf-8"),
                raw_payload,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(computed_signature, signature_header)
        except Exception as e:
            logger.error(f"Error verifying Lemon Squeezy webhook signature: {e}")
            return False

    async def get_subscription_status(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """
        Gets current subscription status for a user.
        """
        if is_owner_email(user.email):
            return {
                "plan": "ultra",
                "tier": "ultra",
                "status": "active",
                "is_owner": True,
                "has_full_access": True,
                "message": "Owner account with permanent Ultra Pro access.",
                "plan_details": SUBSCRIPTION_PLANS["ultra"],
                "checkout_url": self.build_checkout_url(user),
            }

        plan_tier = normalize_plan_tier(
            tier=getattr(user, "tier", None),
            plan_type=getattr(user, "plan_type", None),
            role=getattr(user, "role", None),
            email=getattr(user, "email", None),
            subscription_status=getattr(user, "subscription_status", None),
        )
        is_ultra = plan_tier == PLAN_ULTRA

        return {
            "plan": plan_tier,
            "tier": plan_tier,
            "status": "active" if is_ultra else "explorer",
            "is_owner": False,
            "has_full_access": is_ultra,
            "plan_details": SUBSCRIPTION_PLANS.get(plan_tier, SUBSCRIPTION_PLANS["explorer"]),
            "checkout_url": self.build_checkout_url(user),
        }

    async def process_webhook_event(
        self,
        db: AsyncSession,
        event_name: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Processes Lemon Squeezy webhook payloads to automatically update user tiers.
        """
        logger.info(f"Processing Lemon Squeezy webhook event: {event_name}")

        data = payload.get("data", {})
        attributes = data.get("attributes", {})
        meta = payload.get("meta", {})
        custom_data = meta.get("custom_data", {})

        # Extract user attribution
        user_id_str = custom_data.get("user_id") or attributes.get("user_id")
        user_email = attributes.get("user_email") or attributes.get("customer_email")

        target_user: Optional[User] = None

        if user_id_str:
            try:
                user_id = int(user_id_str)
                stmt = select(User).where(User.id == user_id)
                res = await db.execute(stmt)
                target_user = res.scalars().first()
            except (ValueError, TypeError):
                pass

        if not target_user and user_email:
            stmt = select(User).where(User.email == user_email.strip().lower())
            res = await db.execute(stmt)
            target_user = res.scalars().first()

        if not target_user:
            logger.warning(f"Lemon Squeezy event {event_name}: No matching user found for id={user_id_str}, email={user_email}")
            return {"status": "ignored", "reason": "user_not_found"}

        now_utc = datetime.now(timezone.utc)

        # Handle subscription created / updated / order created
        if event_name in ("order_created", "subscription_created", "subscription_updated", "subscription_payment_success"):
            status_str = attributes.get("status", "active").lower()

            if status_str in ("active", "paid", "on_trial"):
                await db.execute(
                    update(User)
                    .where(User.id == target_user.id)
                    .values(
                        tier="ultra",
                        plan_type="ULTRA",
                        subscription_status="active",
                        updated_at=now_utc
                    )
                )
                await db.commit()
                logger.info(f"Upgraded user {target_user.email} (id={target_user.id}) to ULTRA via Lemon Squeezy {event_name}")
                return {"status": "success", "action": "upgraded_to_ultra", "user_id": target_user.id}

        # Handle subscription cancelled / expired
        elif event_name in ("subscription_expired", "subscription_cancelled"):
            status_str = attributes.get("status", "").lower()
            if status_str in ("expired", "unpaid") or event_name == "subscription_expired":
                await db.execute(
                    update(User)
                    .where(User.id == target_user.id)
                    .values(
                        tier="explorer",
                        plan_type="EXPLORER",
                        subscription_status="canceled",
                        updated_at=now_utc
                    )
                )
                await db.commit()
                logger.info(f"Downgraded user {target_user.email} (id={target_user.id}) to EXPLORER via Lemon Squeezy {event_name}")
                return {"status": "success", "action": "downgraded_to_explorer", "user_id": target_user.id}

        return {"status": "processed", "event": event_name}


lemonsqueezy_service = LemonSqueezyService()
