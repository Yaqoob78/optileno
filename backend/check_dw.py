import asyncio
from backend.db.database import AsyncSessionLocal
from backend.db.models import Plan
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Plan).where(Plan.plan_type=='deep_work').order_by(Plan.id.desc()).limit(1))
        p = result.scalar()
        if p:
            print(p.id, p.schedule)
        else:
            print("No deep work plans")

asyncio.run(run())
