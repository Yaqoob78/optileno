# backend/ai/memory/retrieve.py
"""
Retrieve long-term memory snapshot via service.
Returns empty dict if none exists.
"""

from typing import Dict, Any
import logging

# from backend.services.memory_service import memory_service  # REMOVED due to circular dependency

logger = logging.getLogger(__name__)

async def get_memory(user_id: str) -> Dict[str, Any]:
    """
    Fetch latest long-term memory snapshot.
    Directly accesses persistence layer or simple file storage.
    """
    # For now, just return empty structure or implement direct DB access here if needed
    # Avoiding circular loop with service layer
    logger.debug(f"Retrieving memory for {user_id}")
    return {
        "insights_summary": "",
        "frequent_intents": [],
        "planner_habits": {},
        "last_updated": None
    }

