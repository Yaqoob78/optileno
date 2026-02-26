"""
Grant free plan access to an existing user by email.

Usage:
    python scripts/grant_free_access.py --email someone@example.com --action grant --tier ultra
    python scripts/grant_free_access.py --email someone@example.com --action grant --tier explorer --days 30
    python scripts/grant_free_access.py --email someone@example.com --action cancel
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from backend.db.database import AsyncSessionLocal
from backend.db.models import User
from backend.services.entitlements_service import PLAN_EXPLORER, PLAN_ULTRA, canonical_plan_type
from backend.utils.access_grants import get_access_grant, revoke_access_grant, upsert_access_grant
from backend.utils.owner import is_owner_email


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Grant/cancel manual plan access for an existing user.")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument(
        "--action",
        choices=["grant", "cancel", "revoke"],
        default="grant",
        help="Use grant to assign a plan, cancel/revoke to remove manual access.",
    )
    parser.add_argument(
        "--tier",
        choices=[PLAN_ULTRA, PLAN_EXPLORER],
        default=PLAN_ULTRA,
        help="Plan tier to grant when --action grant (default: ultra).",
    )
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


def _print_update(email: str, previous: dict, user: User, grant_record: dict | None) -> None:
    print(f"Updated user: {email}")
    print(f"Before: {previous}")
    print(
        "After: "
        f"{{'tier': '{user.tier}', 'plan_type': '{user.plan_type}', "
        f"'subscription_status': '{user.subscription_status}', "
        f"'subscription_starts_at': '{user.subscription_starts_at}', "
        f"'subscription_ends_at': '{user.subscription_ends_at}'}}"
    )
    print(f"Grant record: {grant_record}")


async def _apply_access_action(email: str, action: str, tier: str, days: int, dry_run: bool) -> int:
    normalized_email = email.strip().lower()
    if not normalized_email:
        print("Email is required.")
        return 2

    if days < 0:
        print("--days must be 0 or a positive number.")
        return 2

    normalized_action = "cancel" if action == "revoke" else action
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(days=days) if days > 0 else None

    if dry_run:
        next_grant = (
            {
                "email": normalized_email,
                "tier": tier,
                "active": True,
                "expires_at": expires_at.isoformat() if expires_at else None,
            }
            if normalized_action == "grant"
            else {**(get_access_grant(normalized_email) or {}), "active": False}
        )
        print("Dry run only. No file or database changes committed.")
        print(f"Grant preview: {next_grant}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user = result.scalar_one_or_none()

        if is_owner_email(normalized_email) and normalized_action == "cancel":
            print("Cancel/revoke is blocked for owner account.")
            return 2

        previous = {}
        if user:
            previous = {
                "tier": user.tier,
                "plan_type": user.plan_type,
                "subscription_status": user.subscription_status,
                "subscription_starts_at": user.subscription_starts_at,
                "subscription_ends_at": user.subscription_ends_at,
            }

        grant_record = get_access_grant(normalized_email)

        if normalized_action == "grant":
            if not dry_run:
                grant_record = upsert_access_grant(normalized_email, tier, expires_at=expires_at)

            if user:
                user.tier = tier
                user.plan_type = canonical_plan_type(tier)
                user.subscription_status = "active" if tier == PLAN_ULTRA else "explorer"
                user.subscription_starts_at = now_utc
                user.subscription_ends_at = expires_at
        else:
            if not dry_run:
                revoke_access_grant(normalized_email)
                grant_record = get_access_grant(normalized_email)

            if user:
                user.tier = PLAN_EXPLORER
                user.plan_type = canonical_plan_type(PLAN_EXPLORER)
                user.subscription_status = "explorer"
                user.subscription_starts_at = None
                user.subscription_ends_at = None

        if dry_run:
            await db.rollback()
            if not user:
                print(f"User not found in database: {normalized_email}")
                print("Grant change preview completed only.")
        else:
            if user:
                await db.commit()
            if not user and normalized_action == "grant":
                print(f"No user row yet for {normalized_email}.")
                print("Grant was saved; user can now use Get Access to create account without payment.")

        if user:
            _print_update(normalized_email, previous, user, grant_record)
        else:
            print(f"Grant record: {grant_record}")
        return 0


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(_apply_access_action(args.email, args.action, args.tier, args.days, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
