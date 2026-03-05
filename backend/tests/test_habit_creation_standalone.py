import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.planner_service import planner_service
from datetime import datetime, timezone


class MockDbGen:
    """Async generator wrapper for planner_service.get_db()."""

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
async def test_get_user_habits():
    """Test retrieving user habits."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    
    # Mock habit data with ISO formatted dates
    created_at = datetime.now(timezone.utc)
    mock_plan = MagicMock()
    mock_plan.id = 1
    mock_plan.name = "Test Habit"
    mock_plan.description = "Description"
    mock_plan.schedule = {"streak": 5, "frequency": "daily", "lastCompleted": "2024-01-01"}
    mock_plan.created_at = created_at

    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [mock_plan]
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute.return_value = mock_result

    with patch("backend.services.planner_service.get_db", return_value=MockDbGen(mock_db)):
        habits = await planner_service.get_user_habits(user_id="1")

        assert len(habits) == 1
        assert habits[0]["name"] == "Test Habit"
        assert habits[0]["currentStreak"] == 0  # Streak broken test
        assert habits[0]["frequency"] == "daily"
        assert habits[0]["createdAt"] == created_at.isoformat()

@pytest.mark.asyncio
async def test_create_habit():
    """Test creating a new habit."""
    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    def _refresh_side_effect(plan):
        plan.id = 55
        plan.created_at = datetime.now(timezone.utc)

    mock_db.refresh.side_effect = _refresh_side_effect
    
    habit_data = {
        "name": "New Habit",
        "description": "Test habit",
        "frequency": "daily",
        "category": "Health",
        "goal_link": "100"
    }
    
    with patch("backend.services.planner_service.get_db", return_value=MockDbGen(mock_db)):
        with patch("backend.realtime.socket_manager.broadcast_habit_created", new_callable=AsyncMock) as mock_broadcast:
            result = await planner_service.create_habit(user_id="1", habit_data=habit_data)

            assert result["name"] == "New Habit"
            assert result["schedule"]["frequency"] == "daily"
            assert result["schedule"]["goal_link"] == "100"
            mock_broadcast.assert_called_once()
