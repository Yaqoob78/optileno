from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict
from zoneinfo import ZoneInfo

from backend.db.models import User

DEFAULT_PREFERENCES: Dict[str, Any] = {
    "theme": "dark",
    "language": "en",
    "timezone": "UTC",
    "notifications": {
        "email": {
            "enabled": True,
            "frequency": "daily",
            "types": {
                "reminders": True,
                "summaries": True,
                "insights": True,
                "updates": False,
            },
        },
        "push": {
            "enabled": True,
            "quietHours": {"enabled": True, "start": "22:00", "end": "08:00"},
            "types": {"messages": True, "tasks": True, "goals": False, "system": True},
        },
        "sound": {
            "enabled": False,
            "volume": 50,
            "types": {"message": True, "completion": True, "alert": False},
        },
    },
    "aiBehavior": {
        "mode": "balanced",
        "personality": "professional",
        "responseStyle": {"length": "medium", "temperature": 0.7, "maxTokens": 1000},
        "context": {"useMemory": True, "memorySize": 10, "includeMetadata": False},
    },
}

DEFAULT_SECURITY: Dict[str, Any] = {
    "twoFactorEnabled": False,
    "loginAlerts": False,
    "sessionManagement": {"maxSessions": 5, "autoLogout": 1440},
    "trustedDevices": [],
}

def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_iso_date(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return str(value)
    except Exception:
        return None


def _usage_today_key(timezone_name: str | None) -> str:
    tz_name = timezone_name or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    return datetime.now(tz).date().isoformat()


def merge_usage_time(existing: Dict[str, Any] | None, incoming: Dict[str, Any] | None) -> Dict[str, Any]:
    existing = existing or {}
    incoming = incoming or {}

    existing_date = _safe_iso_date(existing.get("date"))
    incoming_date = _safe_iso_date(incoming.get("date"))
    date_value = incoming_date or existing_date

    existing_minutes = _coerce_int(existing.get("minutes"), 0)
    incoming_minutes = _coerce_int(incoming.get("minutes"), 0)

    existing_total = _coerce_int(existing.get("totalMinutes"), 0)
    incoming_total = _coerce_int(incoming.get("totalMinutes"), 0)

    if existing_date and incoming_date and existing_date == incoming_date:
        minutes_value = max(existing_minutes, incoming_minutes)
    else:
        minutes_value = incoming_minutes if incoming_date else existing_minutes

    total_value = max(existing_total, incoming_total)

    updated_at = incoming.get("updatedAt") or existing.get("updatedAt")

    return {
        "date": date_value,
        "minutes": minutes_value,
        "totalMinutes": total_value,
        "updatedAt": updated_at,
    }


def _deep_merge(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    result = deepcopy(base)
    for key, value in (overrides or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def merge_preferences(current: Dict[str, Any] | None, updates: Dict[str, Any] | None = None) -> Dict[str, Any]:
    merged = _deep_merge(DEFAULT_PREFERENCES, current or {})
    if updates:
        merged = _deep_merge(merged, updates)
    if "security" in (current or {}):
        merged["security"] = _deep_merge(DEFAULT_SECURITY, (current or {}).get("security", {}))
    return merged


def get_security_settings(prefs: Dict[str, Any]) -> Dict[str, Any]:
    security = prefs.get("security") if isinstance(prefs, dict) else None
    return _deep_merge(DEFAULT_SECURITY, security or {})


def set_security_settings(prefs: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    prefs = deepcopy(prefs or {})
    prefs["security"] = _deep_merge(get_security_settings(prefs), updates or {})
    return prefs


def _normalize_plan_type(plan_type: str | None) -> str:
    plan_raw = (plan_type or "BASIC").upper()
    plan_map = {
        "BASIC": "EXPLORER",
        "EXPLORER": "EXPLORER",
        "PRO": "ULTRA",
        "ULTRA": "ULTRA",
        "ENTERPRISE": "ULTRA",
    }
    return plan_map.get(plan_raw, "EXPLORER")


def _subscription_features(tier: str, role: str) -> list[str]:
    if role == "admin" or tier in {"elite", "pro", "enterprise"}:
        return ["all-features"]
    return ["basic-chat", "basic-analytics"]


def build_user_profile(user: User) -> Dict[str, Any]:
    prefs = merge_preferences(user.preferences or {})
    security = get_security_settings(prefs)
    usage_time = prefs.get("usageTime") if isinstance(prefs, dict) else None
    usage_time = usage_time if isinstance(usage_time, dict) else {}

    name = user.full_name or (user.email.split("@")[0] if user.email else "")
    plan_type = _normalize_plan_type(user.plan_type)
    tier = (user.tier or "free").lower()
    if user.role == "admin" and tier != "elite":
        tier = "elite"

    created_at = user.created_at or datetime.now(timezone.utc)
    updated_at = user.updated_at or created_at
    today_key = _usage_today_key(prefs.get("timezone", "UTC") if isinstance(prefs, dict) else "UTC")
    usage_date = _safe_iso_date(usage_time.get("date"))
    time_spent_today = _coerce_int(usage_time.get("minutes"), 0) if usage_date == today_key else 0
    total_time_spent = _coerce_int(usage_time.get("totalMinutes"), 0)
    last_activity_at = usage_time.get("updatedAt") or updated_at.isoformat()

    return {
        "id": str(user.id),
        "email": user.email,
        "name": name,
        "avatar": prefs.get("avatar", ""),
        "role": user.role,
        "planType": plan_type,
        "subscription": {
            "tier": tier,
            "expiresAt": None,
            "features": _subscription_features(tier, user.role),
        },
        "stats": {
            "totalSessions": 0,
            "totalTokens": 0,
            "avgRating": 0,
            "joinedAt": created_at.isoformat(),
            "lastActiveAt": updated_at.isoformat(),
            "timeSpentToday": time_spent_today,
            "totalTimeSpent": total_time_spent,
            "lastActivityAt": last_activity_at,
        },
        "metadata": {
            "emailVerified": bool(user.is_verified),
            "twoFactorEnabled": bool(security.get("twoFactorEnabled")),
            "accountStatus": "active" if user.is_active else "suspended",
            "timezone": prefs.get("timezone", "UTC"),
            "language": prefs.get("language", "en"),
        },
        "preferences": prefs,
    }
