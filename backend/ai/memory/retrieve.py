# backend/ai/memory/retrieve.py
"""
Retrieve the user's long-term memory snapshot from agent_memory_snapshots.
Returns an empty structure if none exists yet. Imports the DB layer lazily
(not the service layer) to stay clear of circular imports.
"""

from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

_EMPTY_MEMORY: Dict[str, Any] = {
    "insights_summary": "",
    "frequent_intents": [],
    "planner_habits": {},
    "last_updated": None,
}


async def get_memory(user_id: str) -> Dict[str, Any]:
    """
    Fetch the latest long-term memory snapshot for a user.
    """
    from sqlalchemy import select

    from backend.db.database import AsyncSessionLocal
    from backend.db.models import AgentMemorySnapshot

    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        logger.error("get_memory called with non-numeric user_id: %r", user_id)
        return dict(_EMPTY_MEMORY)

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AgentMemorySnapshot).where(AgentMemorySnapshot.user_id == uid)
            )
            snapshot = result.scalar_one_or_none()

        if snapshot is None:
            return dict(_EMPTY_MEMORY)

        return {
            "insights_summary": snapshot.insights_summary or "",
            "frequent_intents": snapshot.frequent_intents or [],
            "planner_habits": snapshot.planner_habits or {},
            "last_updated": snapshot.updated_at.isoformat() if snapshot.updated_at else None,
        }

    except Exception as e:
        logger.error(f"Failed to retrieve memory for user {user_id}: {str(e)}")
        return dict(_EMPTY_MEMORY)
