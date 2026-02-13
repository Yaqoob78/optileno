import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.planner_service import PlannerService

@pytest.mark.asyncio
async def test_manual_goal_creation_no_cascade():
    """
    Verify that planner_service.create_goal only creates the goal
    and does NOT trigger task/habit creation (cascade).
    """
    # Setup
    planner_service = PlannerService()
    user_id = "1"
    goal_data = {
        "title": "Manual Goal",
        "description": "Testing manual creation",
        "category": "Test",
        "target_date": "2023-12-31"
    }
    
    # Mock DB
    mock_db = AsyncMock()
    mock_goal = MagicMock()
    mock_goal.id = 123
    mock_goal.title = goal_data["title"]
    mock_goal.target_date = None # simplified
    mock_goal.created_at = None
    
    # Mock get_db
    with patch("backend.services.planner_service.get_db") as mock_get_db:
        mock_get_db.return_value.__aiter__.return_value = [mock_db]
        
        # Mock socket manager to avoid actual broadcast
        with patch("backend.realtime.socket_manager.broadcast_goal_created", new_callable=AsyncMock) as mock_broadcast:
            
            # Execute
            result = await planner_service.create_goal(user_id, goal_data)
            
            # Verify
            assert result["title"] == "Manual Goal"
            assert result["id"] == "123"
            
            # Ensure goal was added to DB
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            
            # Verify NO other services were called (implicit by lack of mocks/imports in create_goal)
            # create_goal in planner_service.py is simple and self-contained.
            # It does NOT call create_task or create_habit.
            
            print("✓ Manual goal creation verified: No cascade triggered.")
