"""
Tests for the production-hardening pass:
- /subscriptions/upgrade must never grant a paid tier for free in production
- milestone normalization for per-milestone completion
- API key hashing / device description helpers
- export URL signing
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException


# ─────────────────────────────────────────────────────────────────────
# Subscription upgrade guard
# ─────────────────────────────────────────────────────────────────────

def _upgrade_mocks(monkeypatch, *, environment: str = "production"):
    from backend.api.v1.endpoints import subscriptions as subs

    monkeypatch.setattr(subs.settings, "ENVIRONMENT", environment)

    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    user = MagicMock()
    user.id = 123
    user.email = "test@example.com"
    user.full_name = "Test User"

    return subs, db, user


@pytest.mark.asyncio
async def test_upgrade_redirects_to_lemon_squeezy(monkeypatch):
    """Upgrade returns personalized Lemon Squeezy checkout redirect."""
    subs, db, user = _upgrade_mocks(monkeypatch, environment="production")

    result = await subs.upgrade_subscription(
        subs.UpgradeRequest(planId="ultra", billingCycle="monthly"),
        db=db,
        current_user=user,
    )

    assert result["status"] == "redirect"
    assert "checkout_url" in result
    assert "optileno.lemonsqueezy.com" in result["checkout_url"]
    assert "test%40example.com" in result["checkout_url"] or "test@example.com" in result["checkout_url"]


@pytest.mark.asyncio
async def test_upgrade_unknown_plan_never_grants_paid_tier(monkeypatch):
    """normalize_plan_tier maps unknown plan ids to explorer — garbage input
    must never resolve to a paid tier."""
    from backend.services.entitlements_service import PLAN_ULTRA, normalize_plan_tier

    assert normalize_plan_tier(tier="platinum", plan_type="platinum") != PLAN_ULTRA
    assert normalize_plan_tier(tier="", plan_type="") != PLAN_ULTRA
    assert normalize_plan_tier(tier="ULTRA'; DROP TABLE users;--", plan_type="") != PLAN_ULTRA


# ─────────────────────────────────────────────────────────────────────
# Milestone normalization
# ─────────────────────────────────────────────────────────────────────

def test_normalize_milestone_from_string():
    from backend.services.planner_service import PlannerService

    assert PlannerService._normalize_milestone("Read chapter 1") == {
        "title": "Read chapter 1",
        "completed": False,
    }


def test_normalize_milestone_from_object_variants():
    from backend.services.planner_service import PlannerService

    assert PlannerService._normalize_milestone({"title": "A", "completed": True}) == {
        "title": "A",
        "completed": True,
    }
    # AI cascade may emit "name"; legacy UI may emit "done"
    assert PlannerService._normalize_milestone({"name": "B", "done": 1}) == {
        "title": "B",
        "completed": True,
    }
    assert PlannerService._normalize_milestone(None) == {"title": "", "completed": False}


# ─────────────────────────────────────────────────────────────────────
# API key + device helpers
# ─────────────────────────────────────────────────────────────────────

def test_api_key_hash_is_deterministic_sha256():
    from backend.api.v1.endpoints.users import _hash_api_key

    key = "opk_" + "ab" * 20
    assert _hash_api_key(key) == _hash_api_key(key)
    assert len(_hash_api_key(key)) == 64  # sha256 hex


def test_describe_device_parses_common_user_agents():
    from backend.api.v1.endpoints.users import _describe_device

    chrome_win = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    assert _describe_device(chrome_win) == "Chrome on Windows"

    safari_ios = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    assert _describe_device(safari_ios) == "Safari on iOS"

    assert _describe_device(None) == "Unknown device"
    assert _describe_device("") == "Unknown device"


# ─────────────────────────────────────────────────────────────────────
# Export URL signing
# ─────────────────────────────────────────────────────────────────────

def test_export_signature_binds_user_and_timestamp():
    from backend.api.v1.endpoints.users import _export_signature

    sig = _export_signature(1, 1700000000)
    assert sig == _export_signature(1, 1700000000)
    # A different user or timestamp must not validate
    assert sig != _export_signature(2, 1700000000)
    assert sig != _export_signature(1, 1700000001)
