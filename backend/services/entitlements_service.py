from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException

from backend.utils.owner import is_owner_email


PLAN_EXPLORER = "explorer"
PLAN_ULTRA = "ultra"

LEGACY_TO_PLAN = {
    "free": PLAN_EXPLORER,
    "basic": PLAN_EXPLORER,
    "trial": PLAN_EXPLORER,
    "explorer": PLAN_EXPLORER,
    "pro": PLAN_ULTRA,
    "premium": PLAN_ULTRA,
    "enterprise": PLAN_ULTRA,
    "elite": PLAN_ULTRA,
    "ultra": PLAN_ULTRA,
}

PLAN_TYPE_TO_PLAN = {
    "basic": PLAN_EXPLORER,
    "explorer": PLAN_EXPLORER,
    "pro": PLAN_ULTRA,
    "premium": PLAN_ULTRA,
    "enterprise": PLAN_ULTRA,
    "ultra": PLAN_ULTRA,
}


EXPLORER_ENTITLEMENTS: Dict[str, Any] = {
    "chat_requests_daily": 15,
    "agentic_planner": False,
    "advanced_analytics": False,
    "focus_heatmap": False,
    "burnout_risk": False,
    "ai_insights": False,
    "ai_intelligence": False,
    "goal_progress_detailed": False,
    "mood_tracker": True,
    "productivity_score": True,
    "big_five_interval_days": 14,
}

ULTRA_ENTITLEMENTS: Dict[str, Any] = {
    "chat_requests_daily": 150,
    "chat_overflow_model_enabled": True,
    "agentic_planner": True,
    "advanced_analytics": True,
    "focus_heatmap": True,
    "burnout_risk": True,
    "ai_insights": True,
    "ai_intelligence": True,
    "goal_progress_detailed": True,
    "mood_tracker": True,
    "productivity_score": True,
    "big_five_interval_days": 7,
}


def normalize_plan_tier(
    *,
    plan_tier: str | None = None,
    plan_type: str | None = None,
    tier: str | None = None,
    role: str | None = None,
    email: str | None = None,
    subscription_status: str | None = None,
) -> str:
    if is_owner_email(email):
        return PLAN_ULTRA

    role_value = (role or "").strip().lower() if isinstance(role, str) else ""
    if role_value == "admin":
        return PLAN_ULTRA

    status_val = (subscription_status or "").strip().lower() if isinstance(subscription_status, str) else ""
    if status_val in {"canceled", "cancelled", "payment_failed", "pending_payment", "expired"}:
        return PLAN_EXPLORER

    direct = (plan_tier or "").strip().lower() if isinstance(plan_tier, str) else ""
    if direct == PLAN_ULTRA:
        if not status_val or status_val in {"active", "trialing", "paid"}:
            return PLAN_ULTRA
        return PLAN_EXPLORER
    elif direct == PLAN_EXPLORER:
        return PLAN_EXPLORER

    plan_type_value = (plan_type or "").strip().lower() if isinstance(plan_type, str) else ""
    if plan_type_value in PLAN_TYPE_TO_PLAN:
        mapped = PLAN_TYPE_TO_PLAN[plan_type_value]
        if mapped == PLAN_ULTRA:
            if not status_val or status_val in {"active", "trialing", "paid"}:
                return PLAN_ULTRA
            return PLAN_EXPLORER
        return mapped

    tier_value = (tier or "").strip().lower() if isinstance(tier, str) else ""
    if tier_value in LEGACY_TO_PLAN:
        mapped = LEGACY_TO_PLAN[tier_value]
        if mapped == PLAN_ULTRA:
            if not status_val or status_val in {"active", "trialing", "paid"}:
                return PLAN_ULTRA
            return PLAN_EXPLORER
        return mapped

    return PLAN_EXPLORER


def canonical_plan_type(plan_tier: str) -> str:
    return "ULTRA" if plan_tier == PLAN_ULTRA else "EXPLORER"


def get_entitlements(plan_tier: str) -> Dict[str, Any]:
    return dict(ULTRA_ENTITLEMENTS if plan_tier == PLAN_ULTRA else EXPLORER_ENTITLEMENTS)


def get_limits(plan_tier: str) -> Dict[str, Any]:
    entitlements = get_entitlements(plan_tier)
    return {
        "chat_daily_limit": entitlements["chat_requests_daily"],
        "big_five_interval_days": entitlements["big_five_interval_days"],
    }


def is_ultra_user(user: Any) -> bool:
    sub_status = getattr(user, "subscription_status", None)
    if not isinstance(sub_status, str):
        sub_status = None

    plan_tier = normalize_plan_tier(
        plan_tier=getattr(user, "plan_tier", None) if isinstance(getattr(user, "plan_tier", None), str) else None,
        plan_type=getattr(user, "plan_type", None) if isinstance(getattr(user, "plan_type", None), str) else None,
        tier=getattr(user, "tier", None) if isinstance(getattr(user, "tier", None), str) else None,
        role=getattr(user, "role", None) if isinstance(getattr(user, "role", None), str) else None,
        email=getattr(user, "email", None) if isinstance(getattr(user, "email", None), str) else None,
        subscription_status=sub_status,
    )
    return plan_tier == PLAN_ULTRA


def require_ultra_feature(user: Any, feature: str) -> None:
    if is_ultra_user(user):
        return
    raise HTTPException(
        status_code=403,
        detail={"code": "PLAN_UPGRADE_REQUIRED", "feature": feature},
    )
