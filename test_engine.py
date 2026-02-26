import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.db.session import SessionLocal
from backend.services.goal_progress_engine import GoalProgressEngine

async def test_engine():
    async with SessionLocal() as db:
        # Just grab the first goal
        from sqlalchemy import select
        from backend.db.models import Goal
        result = await db.execute(select(Goal).limit(1))
        goal = result.scalar_one_or_none()
        if goal:
            print(f"Testing goal ID={goal.id} User={goal.user_id}")
            res = await GoalProgressEngine.calculate_progress(db, goal.id, goal.user_id, is_ultra=True)
            print("Result:", res.to_dict())
        else:
            print("No goals found in local DB.")

if __name__ == "__main__":
    asyncio.run(test_engine())
