# backend/analytics/processors/even_normalizer.py
"""
Event normalizer - standardizes events from different sources.
"""

from typing import Dict, Any
from datetime import datetime
import json

async def normalize_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize event structure to ensure consistency.
    """
    # Ensure required fields
    normalized = {
        "user_id": str(event_data.get("user_id", "")),
        "event": event_data.get("event", "unknown").lower().strip(),
        "source": event_data.get("source", "unknown").lower().strip(),
        "timestamp": event_data.get("timestamp") or datetime.utcnow().isoformat(),
        "metadata": event_data.get("metadata", {}),
    }
    
    # Handle different event formats
    if "type" in event_data and "event" not in event_data:
        normalized["event"] = event_data["type"]
    
    if "data" in event_data and "metadata" not in event_data:
        normalized["metadata"] = event_data["data"]
    
    # Extract additional fields
    for key in ["category", "duration", "quality", "task_id", "habit_id", "session_id"]:
        if key in event_data:
            normalized["metadata"][key] = event_data[key]
    
    # Normalize metadata values
    normalized["metadata"] = _normalize_metadata(normalized["metadata"])
    
    # Add derived fields
    normalized["derived"] = {
        "hour_of_day": _extract_hour(normalized["timestamp"]),
        "day_of_week": _extract_day_of_week(normalized["timestamp"]),
        "is_weekend": _is_weekend(normalized["timestamp"]),
        "event_category": _categorize_event(normalized["event"]),
    }
    
    return normalized

async def normalize_events_batch(events_data: list) -> list:
    """Normalize a batch of events"""
    return [await normalize_event(event) for event in events_data]

def _normalize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize metadata values"""
    normalized = {}
    
    for key, value in metadata.items():
        # Convert datetime objects to ISO strings
        if isinstance(value, datetime):
            normalized[key] = value.isoformat()
        else:
            normalized[key] = value
    
    return normalized

def _extract_hour(timestamp: str) -> int:
    """Extract hour from timestamp"""
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.hour
    except:
        return 0

def _extract_day_of_week(timestamp: str) -> str:
    """Extract day of week"""
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.strftime('%A')
    except:
        return "Unknown"

def _is_weekend(timestamp: str) -> bool:
    """Check if timestamp is on weekend"""
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.weekday() >= 5  # 5 = Saturday, 6 = Sunday
    except:
        return False

def _categorize_event(event_type: str) -> str:
    """Categorize event type"""
    event_lower = event_type.lower()
    
    if any(term in event_lower for term in ["task", "todo", "item"]):
        return "task"
    elif any(term in event_lower for term in ["deep_work", "focus", "session"]):
        return "focus"
    elif any(term in event_lower for term in ["habit", "routine", "streak"]):
        return "habit"
    elif any(term in event_lower for term in ["chat", "message", "conversation"]):
        return "chat"
    elif any(term in event_lower for term in ["plan", "schedule", "calendar"]):
        return "planning"
    elif any(term in event_lower for term in ["vent", "stress", "overwhelm"]):
        return "wellbeing"
    else:
        return "system"