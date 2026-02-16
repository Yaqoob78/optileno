from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException


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
) -> str:
    role_value = (role or "").strip().lower()
    if role_value == "admin":
        return PLAN_ULTRA

    direct = (plan_tier or "").strip().lower()
    if direct in {PLAN_EXPLORER, PLAN_ULTRA}:
        return direct

    plan_type_value = (plan_type or "").strip().lower()
    if plan_type_value in PLAN_TYPE_TO_PLAN:
        return PLAN_TYPE_TO_PLAN[plan_type_value]

    tier_value = (tier or "").strip().lower()
    if tier_value in LEGACY_TO_PLAN:
        return LEGACY_TO_PLAN[tier_value]

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
    plan_tier = normalize_plan_tier(
        plan_tier=getattr(user, "plan_tier", None),
        plan_type=getattr(user, "plan_type", None),
        tier=getattr(user, "tier", None),
        role=getattr(user, "role", None),
    )
    return plan_tier == PLAN_ULTRA


def require_ultra_feature(user: Any, feature: str) -> None:
    if is_ultra_user(user):
        return
    raise HTTPException(
        status_code=403,
        detail={"code": "PLAN_UPGRADE_REQUIRED", "feature": feature},
    )
