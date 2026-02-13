
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.planner_service import planner_service
from datetime import datetime
import asyncio

# Setup mock database session
@pytest.fixture
def mock_db_session():
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    # Execute needs to return a result that can be awaited and then fetchall/fetchone called
    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result
    return mock_session

@pytest.mark.asyncio
async def test_get_user_habits(mock_db_session):
    """Test retrieving user habits."""
    
    # Mock habit data
    created_at = datetime.utcnow()
    # Row structure matches what planner_service expects from raw SQL
    mock_habit_row = (
        1, "Test Habit", "Description", 
        {"streak": 5, "frequency": "daily", "lastCompleted": "2024-01-01"}, 
        created_at
    )
    
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [mock_habit_row]
    
    # Setup the mock session to return our result
    mock_db_session.execute.return_value = mock_result
    
    # Patch get_db to return our mock session
    # We need to handle the async generator pattern of get_db
    class MockDbGen:
        def __init__(self, session):
            self.session = session
        def __aiter__(self):
            return self
        async def __anext__(self):
            if hasattr(self, 'done'):
                raise StopAsyncIteration
            self.done = True
            return self.session

    with patch("backend.services.planner_service.get_db", return_value=MockDbGen(mock_db_session)):
        habits = await planner_service.get_user_habits(user_id="1")
        
        assert len(habits) == 1
        assert habits[0]["name"] == "Test Habit"
        # Streak broken logic is complex, this just validates basic retrieval was successful
        assert habits[0]["frequency"] == "daily"
        assert habits[0]["createdAt"] == created_at.isoformat()

@pytest.mark.asyncio
async def test_create_habit(mock_db_session):
    """Test creating a new habit."""
    
    habit_data = {
        "name": "New Habit",
        "description": "Test habit",
        "frequency": "daily",
        "category": "Health",
        "goal_link": "100"
    }
    
    class MockDbGen:
        def __init__(self, session):
            self.session = session
        def __aiter__(self):
            return self
        async def __anext__(self):
            if hasattr(self, 'done'):
                raise StopAsyncIteration
            self.done = True
            return self.session

    with patch("backend.services.planner_service.get_db", return_value=MockDbGen(mock_db_session)):
        # Mock the broadcast function to avoid socket errors
        with patch("backend.realtime.socket_manager.broadcast_habit_created", new_callable=AsyncMock) as mock_broadcast:
            
            # Since we're mocking the DB, we need to ensure the ID is set on the object "added"
            def side_effect_add(obj):
                obj.id = 55
                obj.created_at = datetime.utcnow()
                return None
            mock_db_session.add.side_effect = side_effect_add
            
            result = await planner_service.create_habit(user_id="1", habit_data=habit_data)
            
            assert result["name"] == "New Habit"
            assert result["schedule"]["frequency"] == "daily"
            assert result["schedule"]["goal_link"] == "100"
            assert result["id"] == "55"
            mock_broadcast.assert_called_once()
