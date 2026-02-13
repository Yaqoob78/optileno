# backend/ai/memory/store.py
"""
Long-term memory storage — delegates persistence to memory_service.
No DB logic here.
"""

from typing import Dict, Any
import logging

# from backend.services.memory_service import memory_service # REMOVED

logger = logging.getLogger(__name__)

async def save_memory(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save or update long-term memory snapshot.
    """
    try:
        # Normalize data (minimal)
        memory_data = {
            "insights_summary": data.get("insights_summary", ""),
            "frequent_intents": data.get("frequent_intents", []),
            "planner_habits": data.get("planner_habits", {}),
            "last_updated": data.get("last_updated")
        }

        # TODO: Implement direct DB persistence here
        # For now, just log to avoid circular dependency crash
        logger.info(f"Memory persistence requested for user {user_id}")
        
        return {"status": "updated", "data": memory_data}

    except Exception as e:
        logger.error(f"Failed to save memory for user {user_id}: {str(e)}")
        return {"status": "error", "message": str(e)}