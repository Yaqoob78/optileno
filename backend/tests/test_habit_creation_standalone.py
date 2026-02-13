
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.planner_service import planner_service
from datetime import datetime

@pytest.mark.asyncio
async def test_get_user_habits():
    """Test retrieving user habits."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    
    # Mock habit data with ISO formatted dates
    created_at = datetime.utcnow()
    mock_habit_row = (
        1, "Test Habit", "Description", 
        {"streak": 5, "frequency": "daily", "lastCompleted": "2024-01-01"}, 
        created_at
    )
    
    mock_result.fetchall.return_value = [mock_habit_row]
    mock_db.execute.return_value = mock_result
    
    with patch("backend.services.planner_service.get_db", return_value=iter([mock_db])):
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
    
    habit_data = {
        "name": "New Habit",
        "description": "Test habit",
        "frequency": "daily",
        "category": "Health",
        "goal_link": "100"
    }
    
    with patch("backend.services.planner_service.get_db", return_value=iter([mock_db])):
        with patch("backend.realtime.socket_manager.broadcast_habit_created", new_callable=AsyncMock) as mock_broadcast:
            result = await planner_service.create_habit(user_id="1", habit_data=habit_data)
            
            assert result["name"] == "New Habit"
            assert result["schedule"]["frequency"] == "daily"
            assert result["schedule"]["goal_link"] == "100"
            mock_broadcast.assert_called_once()
