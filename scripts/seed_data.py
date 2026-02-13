"""
Seed development data.

Usage:
    python scripts/seed_data.py

Adds minimal placeholder data for local development.
"""

import asyncio
from datetime import datetime

from backend.db.session import get_db
from backend.models.user import User


async def seed():
    async for db in get_db():
        # Check if user already exists
        existing = await db.execute(
            User.__table__.select().where(User.email == "demo@concierge.ai")
        )
        if existing.scalar():
            print("ℹ️ Demo user already exists.")
            return

        user = User(
            email="demo@concierge.ai",
            username="demo",
            full_name="Demo User",
            hashed_password="dev-only-not-secure",
            tier="free",
            created_at=datetime.utcnow(),
        )

        db.add(user)
        await db.commit()
        print("✅ Demo user created.")


if __name__ == "__main__":
    asyncio.run(seed())
