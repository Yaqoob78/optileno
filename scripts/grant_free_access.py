"""
Grant free Ultra access to an existing user by email.

Usage:
    python scripts/grant_free_access.py --email someone@example.com
    python scripts/grant_free_access.py --email someone@example.com --days 30
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from backend.db.database import AsyncSessionLocal
from backend.db.models import User
from backend.services.entitlements_service import PLAN_ULTRA, canonical_plan_type


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Grant free Ultra access to an existing user.")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--days",
        type=int,
        default=0,
        help="Optional access duration in days. 0 means no expiry is set.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without committing.",
    )
    return parser


async def _grant_free_access(email: str, days: int, dry_run: bool) -> int:
    normalized_email = email.strip().lower()
    if not normalized_email:
        print("Email is required.")
        return 2

    if days < 0:
        print("--days must be 0 or a positive number.")
        return 2

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User not found: {normalized_email}")
            return 1

        previous = {
            "tier": user.tier,
            "plan_type": user.plan_type,
            "subscription_status": user.subscription_status,
            "subscription_starts_at": user.subscription_starts_at,
            "subscription_ends_at": user.subscription_ends_at,
        }

        now_utc = datetime.now(timezone.utc)
        user.tier = PLAN_ULTRA
        user.plan_type = canonical_plan_type(PLAN_ULTRA)
        user.subscription_status = "active"
        user.subscription_starts_at = now_utc
        user.subscription_ends_at = now_utc + timedelta(days=days) if days > 0 else None

        if dry_run:
            await db.rollback()
            print("Dry run only. No changes committed.")
        else:
            await db.commit()

        print(f"Updated user: {normalized_email}")
        print(f"Before: {previous}")
        print(
            "After: "
            f"{{'tier': '{user.tier}', 'plan_type': '{user.plan_type}', "
            f"'subscription_status': '{user.subscription_status}', "
            f"'subscription_starts_at': '{user.subscription_starts_at}', "
            f"'subscription_ends_at': '{user.subscription_ends_at}'}}"
        )
        return 0


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_grant_free_access(args.email, args.days, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
