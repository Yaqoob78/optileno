# backend/ai/memory/store.py
"""
Long-term memory storage — persists one evolving snapshot per user in
agent_memory_snapshots. Imports the DB layer lazily (not the service layer)
to stay clear of circular imports.
"""

from typing import Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


async def save_memory(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save or update the user's long-term memory snapshot.
    """
    from sqlalchemy import select

    from backend.db.database import AsyncSessionLocal
    from backend.db.models import AgentMemorySnapshot

    memory_data = {
        "insights_summary": data.get("insights_summary", "") or "",
        "frequent_intents": data.get("frequent_intents", []) or [],
        "planner_habits": data.get("planner_habits", {}) or {},
    }

    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        logger.error("save_memory called with non-numeric user_id: %r", user_id)
        return {"status": "error", "message": "Invalid user id"}

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AgentMemorySnapshot).where(AgentMemorySnapshot.user_id == uid)
            )
            snapshot = result.scalar_one_or_none()

            if snapshot is None:
                snapshot = AgentMemorySnapshot(user_id=uid, **memory_data)
                db.add(snapshot)
            else:
                snapshot.insights_summary = memory_data["insights_summary"]
                snapshot.frequent_intents = memory_data["frequent_intents"]
                snapshot.planner_habits = memory_data["planner_habits"]
                snapshot.updated_at = datetime.now(timezone.utc)

            await db.commit()

        return {"status": "updated", "data": memory_data}

    except Exception as e:
        logger.error(f"Failed to save memory for user {user_id}: {str(e)}")
        return {"status": "error", "message": "Memory persistence failed"}
