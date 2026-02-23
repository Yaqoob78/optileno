# backend/tests/test_goal_progress_ultra_gate.py
"""
Tests proving Explorer users cannot access goal progress update paths,
even if called directly at the service level (bypass prevention).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException


# ─── Helpers ────────────────────────────────────────────────────────────

def _make_user(*, plan_tier: str = "explorer", user_id: int = 42):
    """Return a mock User object with the given plan tier."""
    user = MagicMock()
    user.id = user_id
    user.plan_tier = plan_tier
    user.plan_type = plan_tier.upper()
    user.tier = plan_tier
    user.role = "user"
    user.email = "test@example.com"
    return user


# ─── API-level tests (goals.py PATCH /{goal_id}/progress) ──────────────

class TestGoalsAPIUltraGate:
    """Ensure the goals.py PATCH endpoint rejects Explorer users."""

    def test_explorer_blocked_goals_endpoint(self):
        """require_ultra_feature raises 403 for Explorer users."""
        from backend.services.entitlements_service import require_ultra_feature

        explorer_user = _make_user(plan_tier="explorer")

        with pytest.raises(HTTPException) as exc_info:
            require_ultra_feature(explorer_user, "goal_progress_detailed")

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "PLAN_UPGRADE_REQUIRED"
        assert exc_info.value.detail["feature"] == "goal_progress_detailed"

    def test_ultra_allowed_goals_endpoint(self):
        """require_ultra_feature does NOT raise for ULTRA users."""
        from backend.services.entitlements_service import require_ultra_feature

        ultra_user = _make_user(plan_tier="ultra")
        # Should not raise
        require_ultra_feature(ultra_user, "goal_progress_detailed")


# ─── Service-level tests (bypass prevention) ───────────────────────────

class TestPlannerServiceUltraGate:
    """
    Prove that PlannerService.update_goal_progress and
    PlannerService.track_goal_progress block Explorer users at the
    service layer, preventing bypass via direct method calls.
    """

    @pytest.mark.asyncio
    async def test_update_goal_progress_blocks_explorer(self):
        """
        Calling update_goal_progress with an Explorer user_id must
        raise HTTPException 403 before any DB mutation.
        """
        from backend.services.planner_service import planner_service

        explorer_user = _make_user(plan_tier="explorer", user_id=99)

        with patch.object(
            planner_service,
            "_is_ultra_user_by_id",
            new_callable=AsyncMock,
            return_value=False,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await planner_service.update_goal_progress(
                    user_id="99", goal_id="1", progress=50,
                )

            assert exc_info.value.status_code == 403
            detail = exc_info.value.detail
            assert detail["code"] == "PLAN_UPGRADE_REQUIRED"
            assert detail["feature"] == "goal_progress_detailed"

    @pytest.mark.asyncio
    async def test_track_goal_progress_blocks_explorer(self):
        """
        Calling track_goal_progress with an Explorer user_id must
        raise HTTPException 403 before any DB mutation.
        """
        from backend.services.planner_service import planner_service

        with patch.object(
            planner_service,
            "_is_ultra_user_by_id",
            new_callable=AsyncMock,
            return_value=False,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await planner_service.track_goal_progress(
                    user_id="99", goal_id="1", old_progress=0, new_progress=50,
                )

            assert exc_info.value.status_code == 403
            detail = exc_info.value.detail
            assert detail["code"] == "PLAN_UPGRADE_REQUIRED"
            assert detail["feature"] == "goal_progress_detailed"

    @pytest.mark.asyncio
    async def test_update_goal_progress_allows_ultra(self):
        """
        Calling update_goal_progress with an ULTRA user_id must
        NOT raise the 403 gate (it proceeds to the normal flow).
        """
        from backend.services.planner_service import planner_service

        with patch.object(
            planner_service,
            "_is_ultra_user_by_id",
            new_callable=AsyncMock,
            return_value=True,
        ), patch.object(
            planner_service,
            "track_goal_progress",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_track:
            result = await planner_service.update_goal_progress(
                user_id="99", goal_id="1", progress=75,
            )
            assert result is True
            mock_track.assert_awaited_once_with("99", "1", 0, 75)

    @pytest.mark.asyncio
    async def test_track_goal_progress_allows_ultra(self):
        """
        Calling track_goal_progress with an ULTRA user_id must
        NOT raise the 403 gate (it proceeds to the normal DB flow).
        """
        from backend.services.planner_service import planner_service

        # We mock _is_ultra as True but let the rest fail gracefully
        # (no real DB). The point is the 403 is NOT raised.
        with patch.object(
            planner_service,
            "_is_ultra_user_by_id",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "backend.services.planner_service.get_db",
        ) as mock_db:
            # Simulate empty db session
            async def _fake_db():
                db = AsyncMock()
                result = MagicMock()
                result.scalar_one_or_none.return_value = None  # goal not found
                db.execute = AsyncMock(return_value=result)
                yield db

            mock_db.side_effect = _fake_db

            # Should return False (goal not found), NOT raise 403
            result = await planner_service.track_goal_progress(
                user_id="99", goal_id="1", old_progress=0, new_progress=50,
            )
            assert result is False
