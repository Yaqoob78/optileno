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
from typing import Optional, Dict, Any, Tuple
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
        return SUBSCRIPTION_PLANS.get((plan_name or "").strip().lower())

    def _get_headers(self) -> Dict[str, str]:
        """Get standard Cashfree API headers."""
        return {
            "Content-Type": "application/json",
            "x-client-id": self.app_id,
            "x-client-secret": self.secret_key,
            "x-api-version": CASHFREE_API_VERSION,
        }

    def _environment_label(self) -> str:
        return "sandbox" if "sandbox" in self.base_url else "production"

    def _safe_json(self, response: httpx.Response) -> Dict[str, Any]:
        if not response.content:
            return {}
        try:
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _normalize_plan_and_cycle(self, plan_name: str, billing_cycle: str) -> Tuple[str, str, Dict[str, Any]]:
        normalized_plan = (plan_name or "").strip().lower()
        plan = self.get_plan(normalized_plan)
        if not plan:
            raise ValueError(f"Invalid plan: {plan_name}")

        normalized_cycle = (billing_cycle or "monthly").strip().lower()
        if normalized_cycle in {"yearly", "year"}:
            normalized_cycle = "annual"
        if normalized_cycle not in {"monthly", "annual"}:
            raise ValueError("Invalid billing cycle")

        if normalized_plan == "explorer" and normalized_cycle != "monthly":
            raise ValueError("Explorer plan supports monthly billing only")

        return normalized_plan, normalized_cycle, plan

    def _billing_cycle_days(self, billing_cycle: str) -> int:
        return 365 if (billing_cycle or "").strip().lower() == "annual" else 30

    def _build_customer_details(self, user: User) -> Dict[str, str]:
        phone = str(getattr(user, "phone", "") or "").strip()
        if not phone:
            phone = "9999999999"
        return {
            "customer_id": f"user_{user.id}",
            "customer_email": user.email,
            "customer_phone": phone,
            "customer_name": user.full_name or user.username or user.email.split("@")[0],
        }

    def _format_datetime(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()

    def _parse_datetime(self, raw: Any) -> Optional[datetime]:
        if raw is None:
            return None
        value = str(raw).strip()
        if not value:
            return None
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

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

        normalized_plan, normalized_cycle, plan = self._normalize_plan_and_cycle(plan_name, billing_cycle)

        # Calculate amount (convert cents to dollars for Cashfree)
        if normalized_cycle == "annual":
            amount_cents = plan["annual_price"]
        else:
            amount_cents = plan["monthly_price"]

        amount = round(amount_cents / 100, 2)  # Cashfree expects decimal amount (e.g., 2.00)

        # Check for trial eligibility
        is_trial_eligible = await self._is_trial_eligible(db, user, normalized_plan)
        trial_days = plan["trial_days"] if is_trial_eligible else 0

        # Generate unique order ID
        order_id = f"optileno_{user.id}_{normalized_plan}_{int(datetime.now().timestamp())}"

        # Create Cashfree order via API
        order_payload = {
            "order_id": order_id,
            "order_amount": amount,
            "order_currency": plan.get("currency", "USD"),
            "customer_details": self._build_customer_details(user),
            "order_meta": {
                "return_url": f"{settings.APP_URL}/dashboard?payment=success&order_id={order_id}&cf_id={{order_id}}",
                "notify_url": f"{settings.BASE_URL}/api/v1/payments/webhook",
            },
            "order_note": f"Optileno {plan['name']} Plan - {normalized_cycle.capitalize()}",
            "order_tags": {
                "user_id": str(user.id),
                "plan": normalized_plan,
                "billing_cycle": normalized_cycle,
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
                error_data = self._safe_json(response)
                logger.error(
                    f"Cashfree order creation failed: {response.status_code} - {error_data}"
                )
                raise ValueError(
                    f"Cashfree order creation failed: {error_data.get('message', response.status_code)}"
                )

            order_data = self._safe_json(response)
            logger.info(f"Cashfree order created: {order_data.get('order_id')}")

            return {
                "order_id": order_data.get("order_id"),
                "cf_order_id": order_data.get("cf_order_id"),
                "payment_session_id": order_data.get("payment_session_id"),
                "order_status": order_data.get("order_status"),
                "order_amount": amount,
                "order_currency": plan.get("currency", "USD"),
                "plan": normalized_plan,
                "plan_details": plan,
                "billing_cycle": normalized_cycle,
                "trial_days": trial_days,
                "environment": self._environment_label(),
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

    async def create_subscription_checkout(
        self,
        db: AsyncSession,
        user: User,
        plan_name: str,
        billing_cycle: str = "monthly",
    ) -> Dict[str, Any]:
        """
        Create a recurring subscription checkout session.

        Explorer: schedules first charge after trial window.
        Ultra: first charge starts immediately (monthly/annual).
        """
        if not self.is_configured():
            raise ValueError("Cashfree is not configured")

        normalized_plan, normalized_cycle, plan = self._normalize_plan_and_cycle(plan_name, billing_cycle)
        amount_cents = plan["annual_price"] if normalized_cycle == "annual" else plan["monthly_price"]
        amount = round(amount_cents / 100, 2)

        is_trial_eligible = await self._is_trial_eligible(db, user, normalized_plan)
        trial_days = plan["trial_days"] if is_trial_eligible else 0

        now = datetime.now(timezone.utc)
        first_charge_at = now + timedelta(days=trial_days) if (normalized_plan == "explorer" and trial_days > 0) else now

        subscription_id = f"optileno_sub_{user.id}_{normalized_plan}_{int(now.timestamp())}"
        recurring_period = self._billing_cycle_days(normalized_cycle)
        max_cycles = 120 if normalized_cycle == "annual" else 1200

        payload = {
            "subscription_id": subscription_id,
            "customer_details": self._build_customer_details(user),
            "plan_details": {
                "plan_name": f"Optileno {plan['name']} {normalized_cycle.capitalize()}",
                "plan_type": "PERIODIC",
                "plan_max_amount": amount,
                "plan_max_cycles": max_cycles,
                "plan_recurring_amount": amount,
                "plan_recurring_period": recurring_period,
                "plan_currency": plan.get("currency", "USD"),
                "plan_notes": f"{plan['name']} recurring billing",
            },
            "subscription_meta": {
                "return_url": f"{settings.APP_URL}/dashboard?payment=success&subscription_id={{subscription_id}}",
                "notify_url": f"{settings.BASE_URL}/api/v1/payments/webhook",
                "notification_channel": "EMAIL",
            },
            "subscription_first_charge_time": self._format_datetime(first_charge_at),
            "subscription_expiry_time": self._format_datetime(now + timedelta(days=3650)),
            "subscription_tags": {
                "user_id": str(user.id),
                "plan": normalized_plan,
                "billing_cycle": normalized_cycle,
                "trial_days": str(trial_days),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/subscriptions",
                    json=payload,
                    headers=self._get_headers(),
                )

            if response.status_code not in (200, 201):
                error_data = self._safe_json(response)
                logger.error(
                    "Cashfree subscription creation failed: %s - %s",
                    response.status_code,
                    error_data,
                )
                raise ValueError(
                    f"Cashfree subscription creation failed: {error_data.get('message', response.status_code)}"
                )

            subscription_data = self._safe_json(response)
            logger.info("Cashfree subscription created: %s", subscription_data.get("subscription_id"))

            return {
                "subscription_id": subscription_data.get("subscription_id") or subscription_id,
                "cf_subscription_id": subscription_data.get("cf_subscription_id"),
                "subscription_session_id": subscription_data.get("subscription_session_id"),
                "subscription_status": subscription_data.get("subscription_status"),
                "plan": normalized_plan,
                "plan_details": plan,
                "billing_cycle": normalized_cycle,
                "trial_days": trial_days,
                "first_charge_at": self._format_datetime(first_charge_at),
                "environment": self._environment_label(),
                "user": {
                    "email": user.email,
                    "name": user.full_name or user.username,
                },
            }
        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating Cashfree subscription: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to create Cashfree subscription: {e}")
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

        # Only explorer plan has trial
        if plan_name.lower() != "explorer":
            return False

        # Prevent repeat trial access for any user with prior subscription lifecycle data.
        if user.razorpay_subscription_id:
            return False
        if getattr(user, "trial_ends_at", None) is not None:
            return False
        if getattr(user, "subscription_starts_at", None) is not None:
            return False
        if getattr(user, "subscription_ends_at", None) is not None:
            return False

        prior_status = (getattr(user, "subscription_status", "") or "").strip().lower()
        if prior_status in {"trialing", "active", "canceled", "payment_failed"}:
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
        signing_secret = settings.CASHFREE_WEBHOOK_SECRET or self.secret_key
        if not signing_secret:
            logger.warning("Cashfree signing secret not configured for webhook verification")
            return False

        try:
            # Cashfree webhook signature: HMAC-SHA256 of timestamp+body
            sign_data = timestamp.encode() + body
            expected = hmac.new(
                signing_secret.encode(),
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

    async def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Fetch subscription status from Cashfree API."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/subscriptions/{subscription_id}",
                    headers=self._get_headers(),
                )

            if response.status_code == 200:
                return self._safe_json(response)

            logger.error(
                "Failed to fetch subscription %s: %s",
                subscription_id,
                response.status_code,
            )
            return {}
        except Exception as e:
            logger.error(f"Error fetching subscription status: {e}")
            return {}

    async def get_payments_for_subscription(self, subscription_id: str) -> list:
        """Get payment attempts for a subscription."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/subscriptions/{subscription_id}/payments",
                    headers=self._get_headers(),
                )

            if response.status_code == 200:
                payload = response.json()
                return payload if isinstance(payload, list) else []
            return []
        except Exception as e:
            logger.error(f"Error fetching payments for subscription {subscription_id}: {e}")
            return []

    async def manage_subscription(self, subscription_id: str, target_status: str) -> bool:
        """
        Best-effort subscription management call (pause/cancel/state changes).
        """
        payload = {"subscription_status": target_status}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.base_url}/subscriptions/{subscription_id}/manage",
                    json=payload,
                    headers=self._get_headers(),
                )
            return response.status_code in (200, 201, 202)
        except Exception as e:
            logger.warning(f"Failed to manage subscription {subscription_id}: {e}")
            return False

    async def _resolve_user_for_subscription(
        self,
        db: AsyncSession,
        subscription_data: Dict[str, Any],
    ) -> Tuple[Optional[User], Dict[str, Any]]:
        tags = subscription_data.get("subscription_tags", {}) or {}
        subscription_id = str(subscription_data.get("subscription_id") or "").strip()

        user: Optional[User] = None
        if subscription_id:
            result = await db.execute(
                select(User).where(User.razorpay_subscription_id == subscription_id)
            )
            user = result.scalar_one_or_none()

        if not user:
            raw_user_id = str(tags.get("user_id") or "").strip()
            if raw_user_id.isdigit():
                result = await db.execute(select(User).where(User.id == int(raw_user_id)))
                user = result.scalar_one_or_none()

        return user, tags

    def _subscription_context(
        self,
        user: User,
        subscription_data: Dict[str, Any],
        tags: Dict[str, Any],
    ) -> Tuple[str, str, int]:
        plan_name = (tags.get("plan") or user.plan_type or "EXPLORER").strip().lower()
        if plan_name not in {"explorer", "ultra"}:
            plan_name = "explorer"

        billing_cycle = (tags.get("billing_cycle") or "monthly").strip().lower()
        if billing_cycle not in {"monthly", "annual"}:
            billing_cycle = "monthly"
        if plan_name == "explorer":
            billing_cycle = "monthly"

        try:
            trial_days = int(tags.get("trial_days", 0))
        except (TypeError, ValueError):
            trial_days = 0

        return plan_name, billing_cycle, max(0, trial_days)

    async def handle_subscription_success(
        self,
        db: AsyncSession,
        subscription_data: Dict[str, Any],
    ) -> Optional[User]:
        """
        Activate/sync local state once Cashfree mandate setup is successful.
        """
        user, tags = await self._resolve_user_for_subscription(db, subscription_data)
        if not user:
            logger.error(
                "User not found while syncing subscription %s",
                subscription_data.get("subscription_id"),
            )
            return None

        plan_name, billing_cycle, trial_days = self._subscription_context(user, subscription_data, tags)
        plan = self.get_plan(plan_name)
        if not plan:
            logger.error("Invalid plan in subscription data: %s", plan_name)
            return None

        now = datetime.now(timezone.utc)
        first_charge_at = self._parse_datetime(subscription_data.get("subscription_first_charge_time"))
        next_schedule_at = self._parse_datetime(subscription_data.get("next_schedule_date"))
        subscription_id = str(subscription_data.get("subscription_id") or "").strip()

        if plan_name == "explorer" and trial_days > 0:
            trial_end = first_charge_at or (now + timedelta(days=trial_days))
            subscription_start = trial_end
            local_status = "trialing" if trial_end > now else "active"
        else:
            trial_end = None
            subscription_start = first_charge_at or now
            local_status = "active"

        subscription_end = subscription_start + timedelta(days=self._billing_cycle_days(billing_cycle))
        if next_schedule_at and next_schedule_at > subscription_start:
            subscription_end = next_schedule_at

        try:
            user.tier = plan["tier"]
            user.plan_type = plan["plan_type"]
            user.razorpay_customer_id = (
                str(subscription_data.get("cf_subscription_id") or "").strip() or user.razorpay_customer_id
            )
            user.razorpay_subscription_id = subscription_id or user.razorpay_subscription_id
            user.subscription_status = local_status
            user.trial_ends_at = trial_end
            user.subscription_starts_at = subscription_start
            user.subscription_ends_at = subscription_end
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            logger.error(f"Failed to sync subscription activation for user {user.id}: {e}")
            await db.rollback()
            return None

    async def handle_subscription_payment_success(
        self,
        db: AsyncSession,
        subscription_id: str,
        subscription_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[User]:
        """
        Handle recurring charge success and extend entitlement window.
        """
        if not subscription_data:
            subscription_data = await self.get_subscription(subscription_id)
        if not subscription_data:
            return None

        user, tags = await self._resolve_user_for_subscription(db, subscription_data)
        if not user:
            return None

        plan_name, billing_cycle, _trial_days = self._subscription_context(user, subscription_data, tags)
        plan = self.get_plan(plan_name) or SUBSCRIPTION_PLANS["explorer"]

        now = datetime.now(timezone.utc)
        next_schedule_at = self._parse_datetime(subscription_data.get("next_schedule_date"))
        current_end = getattr(user, "subscription_ends_at", None)
        if not current_end or current_end < now:
            current_end = now

        new_end = current_end + timedelta(days=self._billing_cycle_days(billing_cycle))
        if next_schedule_at and next_schedule_at > now:
            new_end = next_schedule_at

        try:
            user.tier = plan["tier"]
            user.plan_type = plan["plan_type"]
            user.razorpay_subscription_id = (
                str(subscription_data.get("subscription_id") or "").strip() or user.razorpay_subscription_id
            )
            user.subscription_status = "active"
            if not user.subscription_starts_at:
                user.subscription_starts_at = now
            user.subscription_ends_at = new_end
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            logger.error(f"Failed to sync recurring payment success for user {user.id}: {e}")
            await db.rollback()
            return None

    async def handle_subscription_payment_failure(
        self,
        db: AsyncSession,
        subscription_id: str,
        subscription_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[User]:
        """
        Handle mandate authorization/renewal failure.
        """
        if not subscription_data:
            subscription_data = await self.get_subscription(subscription_id)
        if not subscription_data:
            return None

        user, _tags = await self._resolve_user_for_subscription(db, subscription_data)
        if not user:
            return None

        try:
            user.subscription_status = "payment_failed"
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            logger.error(f"Failed to mark subscription failure for user {user.id}: {e}")
            await db.rollback()
            return None

    async def handle_subscription_status_change(
        self,
        db: AsyncSession,
        subscription_data: Dict[str, Any],
    ) -> Optional[User]:
        """
        Handle generic subscription status transitions from webhook payloads.
        """
        status_value = str(subscription_data.get("subscription_status") or "").strip().upper()
        if not status_value:
            return None

        if status_value in {"ACTIVE", "BANK_APPROVAL_PENDING"}:
            return await self.handle_subscription_success(db, subscription_data)

        user, _tags = await self._resolve_user_for_subscription(db, subscription_data)
        if not user:
            return None

        mapped_status = None
        if "CANCEL" in status_value or "EXPIRED" in status_value:
            mapped_status = "canceled"
        elif "FAIL" in status_value or "PAUSE" in status_value or "INACTIVE" in status_value:
            mapped_status = "payment_failed"

        if not mapped_status:
            return user

        try:
            user.subscription_status = mapped_status
            await db.commit()
            await db.refresh(user)
            return user
        except Exception as e:
            logger.error(f"Failed to sync subscription status change for user {user.id}: {e}")
            await db.rollback()
            return None

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
        tags = order_data.get("order_tags", {}) or {}
        order_id = order_data.get("order_id")
        user_id = tags.get("user_id")
        plan_name = (tags.get("plan") or "").strip().lower()
        billing_cycle = (tags.get("billing_cycle") or "monthly").strip().lower()
        if billing_cycle not in {"monthly", "annual"}:
            billing_cycle = "monthly"
        if plan_name == "explorer":
            billing_cycle = "monthly"

        try:
            trial_days = int(tags.get("trial_days", 0))
        except (TypeError, ValueError):
            trial_days = 0

        if not user_id or not plan_name:
            logger.error("Missing user_id or plan in order tags")
            return None

        plan = self.get_plan(plan_name)
        if not plan:
            logger.error(f"Invalid plan: {plan_name}")
            return None

        # Load user first for idempotency checks.
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            logger.error(f"User not found for payment success: {user_id}")
            return None

        current_status = (getattr(user, "subscription_status", "") or "").strip().lower()
        if (
            order_id
            and str(getattr(user, "razorpay_subscription_id", "") or "") == str(order_id)
            and current_status in {"trialing", "active"}
        ):
            logger.info(f"Ignoring duplicate payment success event for order {order_id}")
            return user

        # Calculate subscription dates
        now = datetime.now(timezone.utc)
        trial_end = None
        if plan_name == "explorer" and trial_days > 0:
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
            user.tier = plan["tier"]
            user.plan_type = plan["plan_type"]
            user.razorpay_customer_id = order_data.get("cf_order_id")
            user.razorpay_subscription_id = order_id
            user.subscription_status = "trialing" if trial_end else "active"
            user.trial_ends_at = trial_end
            user.subscription_starts_at = subscription_start
            user.subscription_ends_at = subscription_end
            await db.commit()
            await db.refresh(user)

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
        subscription_id = str(user.razorpay_subscription_id or "").strip()
        if not subscription_id:
            return False

        # Best effort at gateway; local state remains source-of-truth for access gating.
        await self.manage_subscription(subscription_id, "CANCELLED")

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

        # Strict anti-bypass: once trial ends, require verified recurring status.
        status_value = (getattr(user, "subscription_status", "") or "").strip().lower()
        trial_ends_at = getattr(user, "trial_ends_at", None)
        if status_value == "trialing" and trial_ends_at and trial_ends_at <= now:
            subscription_id = str(getattr(user, "razorpay_subscription_id", "") or "").strip()
            gateway_subscription = await self.get_subscription(subscription_id) if subscription_id else {}
            gateway_status = str(gateway_subscription.get("subscription_status") or "").strip().upper()

            if gateway_status in {"ACTIVE", "BANK_APPROVAL_PENDING"}:
                synced_user = await self.handle_subscription_success(db, gateway_subscription)
                if synced_user:
                    user = synced_user
            elif gateway_status and ("CANCEL" in gateway_status or "EXPIRED" in gateway_status):
                await db.execute(
                    update(User)
                    .where(User.id == user.id)
                    .values(subscription_status="canceled")
                )
                await db.commit()
                await db.refresh(user)
            else:
                await db.execute(
                    update(User)
                    .where(User.id == user.id)
                    .values(subscription_status="payment_failed")
                )
                await db.commit()
                await db.refresh(user)

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
