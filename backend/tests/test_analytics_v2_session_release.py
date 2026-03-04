import pytest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from backend.services.analytics_v2_service import RangeWindow, analytics_v2_service


class ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value


class AllResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class ScalarOneOrNoneResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


def _test_window() -> RangeWindow:
    return RangeWindow(
        time_range="daily",
        period_start=datetime(2026, 3, 4, 0, 0, tzinfo=timezone.utc),
        period_end=datetime(2026, 3, 4, 23, 59, 59, tzinfo=timezone.utc),
        timezone_name="UTC",
    )


@pytest.mark.asyncio
async def test_productivity_score_fetches_burnout_before_opening_db_session():
    state = {"open": False}
    user = SimpleNamespace(id=1, preferences={})
    mock_db = AsyncMock()

    async def tracked_get_db():
        state["open"] = True
        try:
            yield mock_db
        finally:
            state["open"] = False

    async def fake_burnout(*_args, **_kwargs):
        assert state["open"] is False
        return {"risk": 22.0}

    usage = {
        "tasks_created": 5,
        "tasks_completed": 4,
        "goal_linked_completed": 2,
        "high_energy_completed": 1,
        "on_time_completed": 3,
        "deep_work_minutes": 120,
        "habits_completed": 3,
        "habits_total": 4,
        "active_streaks": 2,
        "habits_missed": 0,
        "chat_requests": 6,
        "active_days": 6,
    }
    baseline_usage = {
        "tasks_created": 8,
        "tasks_completed": 5,
        "goal_linked_completed": 3,
        "high_energy_completed": 2,
        "on_time_completed": 4,
        "deep_work_minutes": 180,
        "habits_completed": 4,
        "habits_total": 4,
        "active_streaks": 3,
        "habits_missed": 1,
        "chat_requests": 5,
        "active_days": 7,
    }

    with patch.object(analytics_v2_service, "resolve_window", new=AsyncMock(return_value=_test_window())):
        with patch.object(analytics_v2_service, "burnout_risk", new=AsyncMock(side_effect=fake_burnout)):
            with patch.object(
                analytics_v2_service,
                "_usage_inputs",
                new=AsyncMock(side_effect=[usage, baseline_usage]),
            ):
                with patch.object(
                    analytics_v2_service,
                    "_goal_progress_summary",
                    new=AsyncMock(return_value={"score": 68.0, "overall_band": "on_track"}),
                ):
                    with patch("backend.services.analytics_v2_service.get_db", new=tracked_get_db):
                        result = await analytics_v2_service.productivity_score(user, "daily")

    assert result["score"] is not None
    assert result["goal_band"] == "on_track"


@pytest.mark.asyncio
async def test_ai_intelligence_fetches_burnout_before_opening_db_session():
    state = {"open": False}
    user = SimpleNamespace(id=1, preferences={})
    mock_db = AsyncMock()
    mock_db.execute.side_effect = [
        ScalarResult(0),
        AllResult([]),
        ScalarOneOrNoneResult(None),
    ]

    async def tracked_get_db():
        state["open"] = True
        try:
            yield mock_db
        finally:
            state["open"] = False

    async def fake_burnout(*_args, **_kwargs):
        assert state["open"] is False
        return {"risk": 34.0}

    usage = {
        "tasks_created": 6,
        "goal_linked_completed": 3,
        "tasks_completed": 4,
        "deep_work_minutes": 90,
        "chat_requests": 5,
        "deep_work_sessions": 2,
        "habits_total": 4,
        "habits_completed": 3,
        "active_days": 4,
    }

    with patch.object(analytics_v2_service, "resolve_window", new=AsyncMock(return_value=_test_window())):
        with patch.object(analytics_v2_service, "burnout_risk", new=AsyncMock(side_effect=fake_burnout)):
            with patch.object(
                analytics_v2_service,
                "_usage_inputs",
                new=AsyncMock(return_value=usage),
            ):
                with patch.object(
                    analytics_v2_service,
                    "_goal_progress_summary",
                    new=AsyncMock(return_value={"score": 64.0, "goals": []}),
                ):
                    with patch("backend.services.analytics_v2_service.get_db", new=tracked_get_db):
                        result = await analytics_v2_service.ai_intelligence(user, "daily")

    assert result["score"] is not None
    assert result["category"]
