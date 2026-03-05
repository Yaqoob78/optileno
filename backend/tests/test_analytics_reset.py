import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from backend.db.models import RealTimeMetrics
from backend.services.analytics_service import analytics_service


class MockDbGen:
    """Async generator wrapper for analytics_service.get_db()."""

    def __init__(self, session):
        self.session = session
        self._done = False

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._done:
            raise StopAsyncIteration
        self._done = True
        return self.session


@pytest.mark.asyncio
async def test_daily_metrics_reset():
    """Daily metrics reset when the latest row is from a previous day."""
    user_id = 999
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)

    saved_metric = RealTimeMetrics(
        user_id=user_id,
        focus_score=80,
        focus_sessions_today=5,
        tasks_completed_today=10,
        habits_completed_today=3,
        current_habit_streak=5,
        planning_accuracy=90.0,
        updated_at=yesterday,
    )

    mock_db = AsyncMock()
    event_data = {
        "user_id": user_id,
        "event": "task_completed",
        "metadata": {"task_name": "Test Task"},
    }

    with patch("backend.services.analytics_service.get_db", return_value=MockDbGen(mock_db)):
        with patch.object(analytics_service, "get_realtime_metrics", new=AsyncMock(return_value=saved_metric)):
            with patch(
                "backend.services.enhanced_ai_intelligence_service.enhanced_ai_intelligence_service.update_score_realtime",
                new=AsyncMock(),
            ):
                with patch("backend.realtime.socket_manager.broadcast_analytics_update", new=AsyncMock()):
                    await analytics_service.update_realtime_metrics(user_id, event_data)

    # Daily counters are reset first, then the task_completed event increments tasks by 1.
    assert saved_metric.tasks_completed_today == 1
    assert saved_metric.focus_sessions_today == 0
    assert saved_metric.habits_completed_today == 0

    # Long-term counters remain unchanged for this event type.
    assert saved_metric.focus_score == 80
    assert saved_metric.current_habit_streak == 5
