import asyncio
import os
import sys

# Add the root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.session import SessionLocal
from backend.db.models import Task, Plan, Goal

async def migrate_goal_links():
    print("Starting goal migration...")
    async with SessionLocal() as db:
        # Migrate Tasks
        tasks_res = await db.execute(select(Task).where(Task.goal_id == None))
        tasks = tasks_res.scalars().all()
        migrated_tasks = 0
        for task in tasks:
            if not task.tags: continue
            for tag in task.tags:
                if isinstance(tag, str) and tag.startswith("goal:"):
                    try:
                        g_id = int(tag.split(":")[1])
                        task.goal_id = g_id
                        migrated_tasks += 1
                        break
                    except Exception:
                        pass
                        
        # Migrate Plans (Habits / Deep Work)
        plans_res = await db.execute(select(Plan).where(Plan.goal_id == None))
        plans = plans_res.scalars().all()
        migrated_plans = 0
        for plan in plans:
            if not plan.schedule or not isinstance(plan.schedule, dict): continue
            link = plan.schedule.get("goal_link")
            if link:
                try:
                    plan.goal_id = int(link)
                    migrated_plans += 1
                except Exception:
                    pass
                    
        await db.commit()
        print(f"Migrated {migrated_tasks} tasks.")
        print(f"Migrated {migrated_plans} plans.")
        
        # Verify valid goal_ids (optional cleanup)
        
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate_goal_links())
