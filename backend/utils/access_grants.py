from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.services.entitlements_service import PLAN_EXPLORER, PLAN_ULTRA

ACCESS_GRANTS_FILE = Path("data/access_grants.json")


def _ensure_storage() -> None:
    ACCESS_GRANTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not ACCESS_GRANTS_FILE.exists():
        ACCESS_GRANTS_FILE.write_text(json.dumps({"version": 1, "grants": {}}, indent=2), encoding="utf-8")


def _load_payload() -> dict[str, Any]:
    _ensure_storage()
    try:
        raw = json.loads(ACCESS_GRANTS_FILE.read_text(encoding="utf-8") or "{}")
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    grants = raw.get("grants")
    if not isinstance(grants, dict):
        raw["grants"] = {}
    raw.setdefault("version", 1)
    return raw


def _save_payload(payload: dict[str, Any]) -> None:
    _ensure_storage()
    ACCESS_GRANTS_FILE.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _normalize_tier(tier: str) -> str:
    value = (tier or "").strip().lower()
    return PLAN_ULTRA if value == PLAN_ULTRA else PLAN_EXPLORER


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except Exception:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def upsert_access_grant(email: str, tier: str, expires_at: datetime | None = None) -> dict[str, Any]:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        raise ValueError("email is required")

    normalized_tier = _normalize_tier(tier)
    now = datetime.now(timezone.utc)

    payload = _load_payload()
    grants = payload["grants"]
    previous = grants.get(normalized_email) if isinstance(grants, dict) else None
    granted_at = previous.get("granted_at") if isinstance(previous, dict) else now.isoformat()

    grants[normalized_email] = {
        "email": normalized_email,
        "tier": normalized_tier,
        "active": True,
        "granted_at": granted_at,
        "updated_at": now.isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
    _save_payload(payload)
    return grants[normalized_email]


def revoke_access_grant(email: str) -> bool:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return False

    payload = _load_payload()
    grants = payload.get("grants", {})
    if not isinstance(grants, dict):
        return False

    record = grants.get(normalized_email)
    if not isinstance(record, dict):
        return False

    record["active"] = False
    record["updated_at"] = datetime.now(timezone.utc).isoformat()
    grants[normalized_email] = record
    _save_payload(payload)
    return True


def get_access_grant(email: str) -> dict[str, Any] | None:
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None

    payload = _load_payload()
    grants = payload.get("grants", {})
    if not isinstance(grants, dict):
        return None

    record = grants.get(normalized_email)
    if not isinstance(record, dict):
        return None

    return dict(record)


def get_active_access_grant(email: str) -> dict[str, Any] | None:
    record = get_access_grant(email)
    if not record:
        return None

    if not bool(record.get("active", True)):
        return None

    expires_at = _parse_iso_datetime(record.get("expires_at"))
    now = datetime.now(timezone.utc)
    if expires_at and expires_at <= now:
        return None

    record["tier"] = _normalize_tier(str(record.get("tier", PLAN_EXPLORER)))
    record["expires_at_dt"] = expires_at
    return record
