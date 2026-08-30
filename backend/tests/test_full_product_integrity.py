import pytest
from datetime import datetime, timezone
from sqlalchemy import select

from backend.db.database import get_db, init_db
from backend.db.models import User, Task, Plan
from backend.services.planner_service import planner_service
from backend.ai.client import DualAIClient
from backend.services.entitlements_service import is_ultra_user

@pytest.mark.asyncio
async def test_full_product_integrity():
    await init_db()
    
    # 1. Create or retrieve an Ultra test user
    async for db in get_db():
        res = await db.execute(select(User).where(User.email == "ultra_test@optileno.com"))
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                email="ultra_test@optileno.com",
                hashed_password="dummy_hash",
                full_name="Ultra Test User",
                plan_type="ULTRA",
                role="user"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        user_id = str(user.id)
        break

    # 2. Task creation test
    task_res = await planner_service.create_task(
        user_id=user_id,
        task_data={
            "title": "Comprehensive Test Task",
            "description": "Ensuring task creation works with 0 errors",
            "priority": "high",
            "status": "todo",
            "estimated_minutes": 30
        }
    )
    assert task_res is not None
    assert "error" not in task_res
    assert task_res["title"] == "Comprehensive Test Task"
    task_id = task_res["id"]

    # 3. Task start & update test
    start_res = await planner_service.start_task(user_id=user_id, task_id=task_id)
    assert start_res is not None
    assert "error" not in start_res
    assert start_res["status"] in ["in_progress", "in-progress"]

    # 4. Habit creation test
    habit_res = await planner_service.create_habit(
        user_id=user_id,
        habit_data={
            "name": "Daily Deep Reading",
            "description": "Read 20 pages",
            "frequency": "daily",
            "category": "Mindset"
        }
    )
    assert habit_res is not None
    assert "error" not in habit_res
    habit_id = habit_res["id"]

    # 5. Habit tracking test
    track_res = await planner_service.track_habit(user_id=user_id, habit_id=habit_id)
    assert track_res is not None
    assert "error" not in track_res
    assert track_res["streak"] >= 1

    # 6. Deep work start test
    class MockDeepWorkIn:
        def __init__(self):
            self.task_id = int(task_id)
            self.planned_duration_minutes = 25
            self.goal_id = None
            self.title = "Focus Sprint"
        def dict(self):
            return {
                "task_id": self.task_id,
                "planned_duration_minutes": self.planned_duration_minutes,
                "goal_id": self.goal_id,
                "title": self.title
            }

    dw_res = await planner_service.start_deep_work(user_id=user_id, data=MockDeepWorkIn())
    assert dw_res is not None

    # 7. Leno AI Chat zero-downtime test
    ai_client = DualAIClient(user_id=user_id)
    chat_res = await ai_client.handle_message("Plan my tasks for today")
    assert chat_res is not None
    assert "message" in chat_res
    assert len(chat_res["message"]) > 0
    assert "trouble connecting" not in chat_res["message"].lower()
