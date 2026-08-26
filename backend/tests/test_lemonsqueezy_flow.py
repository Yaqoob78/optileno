import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import User
from backend.services.entitlements_service import (
    normalize_plan_tier,
    is_ultra_user,
    PLAN_EXPLORER,
    PLAN_ULTRA,
)
from backend.auth.auth_service import auth_service
from backend.payments.lemonsqueezy_service import LemonSqueezyService
from backend.schemas.auth import UserRegister


def test_owner_always_gets_ultra_regardless_of_status():
    """Platform owner (khan011504@gmail.com) always receives Ultra tier."""
    owner_email = "khan011504@gmail.com"
    tier = normalize_plan_tier(
        tier="explorer",
        plan_type="EXPLORER",
        email=owner_email,
        subscription_status="explorer"
    )
    assert tier == PLAN_ULTRA

    owner_user = User(
        id=1,
        email=owner_email,
        role="admin",
        tier="ultra",
        plan_type="ULTRA",
        subscription_status="active",
    )
    assert is_ultra_user(owner_user) is True


def test_regular_user_unpaid_ultra_selection_resolves_to_explorer():
    """A regular user selecting Ultra without paid active status MUST resolve to Explorer."""
    unpaid_user = User(
        id=2,
        email="customer@example.com",
        role="user",
        tier="explorer",
        plan_type="EXPLORER",
        subscription_status="pending_payment",
    )
    assert is_ultra_user(unpaid_user) is False

    # Even if someone injects tier="ultra" in DB, pending_payment or non-active status is downgraded to explorer
    spoofed_user = User(
        id=3,
        email="attacker@example.com",
        role="user",
        tier="ultra",
        plan_type="ULTRA",
        subscription_status="pending_payment",
    )
    assert is_ultra_user(spoofed_user) is False

    cancelled_user = User(
        id=4,
        email="cancelled@example.com",
        role="user",
        tier="ultra",
        plan_type="ULTRA",
        subscription_status="canceled",
    )
    assert is_ultra_user(cancelled_user) is False


def test_regular_user_active_ultra_resolves_to_ultra():
    """A verified user with active subscription status correctly gets Ultra."""
    paid_user = User(
        id=5,
        email="paying_customer@example.com",
        role="user",
        tier="ultra",
        plan_type="ULTRA",
        subscription_status="active",
    )
    assert is_ultra_user(paid_user) is True


def test_lemonsqueezy_checkout_url_generation():
    """Check that personalized checkout URL includes prefilled email and user id."""
    service = LemonSqueezyService()
    test_user = User(id=42, email="buyer@test.com", full_name="Buyer Name")
    url = service.build_checkout_url(test_user)

    assert "https://optileno.lemonsqueezy.com/checkout/buy/" in url
    assert "checkout%5Bemail%5D=buyer%40test.com" in url or "checkout[email]=buyer@test.com" in url or "buyer%40test.com" in url
    assert "checkout%5Bcustom%5D%5Buser_id%5D=42" in url or "user_id" in url


@pytest.mark.asyncio
async def test_auth_service_normalize_plan_for_owner_and_regular():
    """AuthService._normalize_plan must give Ultra to owner and Explorer to regular users."""
    owner_plan, owner_tier = auth_service._normalize_plan("ULTRA", "khan011504@gmail.com")
    assert owner_plan == "ULTRA"
    assert owner_tier == "ultra"

    reg_plan, reg_tier = auth_service._normalize_plan("ULTRA", "stranger@gmail.com")
    assert reg_plan == "EXPLORER"
    assert reg_tier == "explorer"
