#!/usr/bin/env python3
"""
CLI tool to grant, revoke, or inspect access for any user.

Usage examples:
  # Grant ULTRA access (no expiry)
  python -m backend.scripts.grant_free_access grant user@example.com ultra

  # Grant EXPLORER access
  python -m backend.scripts.grant_free_access grant user@example.com explorer

  # Grant ULTRA access that expires in 30 days
  python -m backend.scripts.grant_free_access grant user@example.com ultra --days 30

  # Revoke access
  python -m backend.scripts.grant_free_access revoke user@example.com

  # Check current access status
  python -m backend.scripts.grant_free_access check user@example.com

  # List all grants
  python -m backend.scripts.grant_free_access list
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure project root is on sys.path so imports work when run from anywhere.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.utils.access_grants import (  # noqa: E402
    ACCESS_GRANTS_FILE,
    _load_payload,
    get_access_grant,
    get_active_access_grant,
    revoke_access_grant,
    upsert_access_grant,
)


def _fmt_record(record: dict | None, label: str = "") -> str:
    if not record:
        return f"  {label}No record found."
    lines = [f"  {label}"]
    for key, value in record.items():
        lines.append(f"    {key}: {value}")
    return "\n".join(lines)


def cmd_grant(args: argparse.Namespace) -> None:
    email = args.email.strip().lower()
    tier = args.tier.strip().lower()

    expires_at = None
    if args.days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=args.days)

    record = upsert_access_grant(email, tier, expires_at)

    print("\n[OK] Access GRANTED successfully!")
    print(f"    Email    : {email}")
    print(f"    Tier     : {record['tier'].upper()}")
    print(f"    Active   : {record['active']}")
    print(f"    Expires  : {record.get('expires_at') or 'Never'}")
    print(f"    Saved to : {ACCESS_GRANTS_FILE.resolve()}")
    print()
    print("  The user can now register/login via the /api/v1/auth/access/register endpoint.")
    print()


def cmd_revoke(args: argparse.Namespace) -> None:
    email = args.email.strip().lower()
    success = revoke_access_grant(email)

    if success:
        print(f"\n[OK] Access REVOKED for {email}")
    else:
        print(f"\n[WARN] No active grant found for {email}")
    print()


def cmd_check(args: argparse.Namespace) -> None:
    email = args.email.strip().lower()

    raw_record = get_access_grant(email)
    active_record = get_active_access_grant(email)

    print(f"\n[INFO] Access check for: {email}")
    print()

    if not raw_record:
        print("  [X] No grant record exists for this email.")
        print()
        return

    print("  Stored record:")
    print(_fmt_record(raw_record))
    print()

    if active_record:
        print(f"  [OK] Access is ACTIVE - tier: {active_record['tier'].upper()}")
        expires = active_record.get("expires_at_dt")
        if expires:
            remaining = expires - datetime.now(timezone.utc)
            print(f"     Expires in: {remaining.days} days, {remaining.seconds // 3600} hours")
        else:
            print("     Expires: Never (lifetime)")
    else:
        print("  [X] Access is INACTIVE (revoked or expired)")
    print()


def cmd_list(_args: argparse.Namespace) -> None:
    payload = _load_payload()
    grants = payload.get("grants", {})

    if not grants:
        print("\n[INFO] No grants found.\n")
        return

    print(f"\n[INFO] All access grants ({len(grants)} total):\n")
    print(f"  {'Email':<35} {'Tier':<10} {'Active':<8} {'Expires':<25}")
    print(f"  {'-' * 35} {'-' * 10} {'-' * 8} {'-' * 25}")

    for email, record in sorted(grants.items()):
        if not isinstance(record, dict):
            continue
        tier = str(record.get("tier", "?")).upper()
        active = "Yes" if record.get("active", True) else "No"
        expires = record.get("expires_at") or "Never"
        print(f"  {email:<35} {tier:<10} {active:<8} {expires:<25}")

    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Optileno Access Grant Manager - grant, revoke, or inspect user access from the terminal.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_grant = sub.add_parser("grant", help="Grant access to a user")
    p_grant.add_argument("email", help="User email address")
    p_grant.add_argument("tier", choices=["explorer", "ultra"], help="Plan tier to grant")
    p_grant.add_argument("--days", type=int, default=None, help="Optional: expire after N days (omit for lifetime)")
    p_grant.set_defaults(func=cmd_grant)

    p_revoke = sub.add_parser("revoke", help="Revoke access for a user")
    p_revoke.add_argument("email", help="User email address")
    p_revoke.set_defaults(func=cmd_revoke)

    p_check = sub.add_parser("check", help="Check access status for a user")
    p_check.add_argument("email", help="User email address")
    p_check.set_defaults(func=cmd_check)

    p_list = sub.add_parser("list", help="List all grants")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
