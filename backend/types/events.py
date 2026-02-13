# backend/types/events.py
"""
Event type definitions
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel
from datetime import datetime


class AppEvent(BaseModel):
    """Application event type"""
    event_type: str
    user_id: int
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime = None

    class Config:
        json_schema_extra = {
            "example": {
                "event_type": "task_created",
                "user_id": 1,
                "metadata": {"task_id": "123", "title": "My Task"},
            }
        }


class UserMetrics(BaseModel):
    """User performance metrics"""
    user_id: int
    productivity_score: float
    focus_duration_minutes: int
    tasks_completed: int
    deep_work_sessions: int
    timestamp: datetime = None

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "productivity_score": 85.5,
                "focus_duration_minutes": 120,
                "tasks_completed": 5,
                "deep_work_sessions": 2,
            }
        }


class AnalyticsEvent(BaseModel):
    """Individual analytics event"""
    id: Optional[str] = None
    user_id: int
    event: str
    source: str
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "event": "task_completed",
                "source": "mobile",
                "metadata": {"task_id": "123", "duration_minutes": 45},
            }
        }
