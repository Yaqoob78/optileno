# backend/schemas/planner.py
from pydantic import BaseModel, Field, ConfigDict, field_serializer, field_validator, model_validator
from typing import Optional, List, Literal, Any, Dict
from datetime import datetime, date
from uuid import UUID


# ── Task Schemas ───────────────────────────────────────────────────────

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=1000)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    status: Literal["todo", "in-progress", "done", "planned", "overdue"] = "planned"
    due_date: Optional[datetime] = None
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, le=1440)
    tags: List[str] = Field(default_factory=list)
    category: Optional[str] = None
    energy: Optional[Literal["low", "medium", "high"]] = "medium"


class TaskCreate(TaskBase):
    """Used when creating a new task (from frontend or AI)"""
    goal_id: Optional[int | str] = None


class TaskUpdate(BaseModel):
    """Used for partial updates — all fields optional"""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    status: Optional[Literal["todo", "in-progress", "done", "planned", "overdue"]] = None
    due_date: Optional[datetime] = None
    estimated_duration_minutes: Optional[int] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    energy: Optional[Literal["low", "medium", "high"]] = None
    goal_id: Optional[int | str] = None

    model_config = ConfigDict(extra="forbid")


class TaskOut(TaskBase):
    """Response model — includes DB-generated fields"""
    id: int | str  # Accept both int and str
    user_id: int | str  # Accept both int and str
    created_at: datetime
    updated_at: Optional[datetime] = None
    related_goal_id: Optional[str] = None
    goal_title: Optional[str] = None
    meta: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)  # Enables .from_orm()

    @model_validator(mode='before')
    @classmethod
    def convert_db_values(cls, data: Any) -> Any:
        """Convert database values to API format before validation"""
        if isinstance(data, dict):
            # Map database status values to API values
            status_map = {
                "pending": "todo",
                "in_progress": "in-progress",
                "completed": "done",
                "planned": "planned",
                "overdue": "overdue",
                # Handle already-correct values
                "todo": "todo",
                "in-progress": "in-progress",
                "done": "done",
            }
            if "status" in data and data["status"] in status_map:
                data["status"] = status_map[data["status"]]
            
            # Map estimated_minutes -> estimated_duration_minutes
            if "estimated_minutes" in data:
                data["estimated_duration_minutes"] = data["estimated_minutes"]
                
            return data
        # For ORM objects, convert them to dict first
        if hasattr(data, '__dict__'):
            data_dict = {k: v for k, v in data.__dict__.items() if not k.startswith('_')}
            status_map = {
                "pending": "todo",
                "in_progress": "in-progress",
                "completed": "done",
                "planned": "planned",
                "overdue": "overdue",
                "todo": "todo",
                "in-progress": "in-progress",
                "done": "done",
            }
            if "status" in data_dict and data_dict["status"] in status_map:
                data_dict["status"] = status_map[data_dict["status"]]
                
            # Map estimated_minutes -> estimated_duration_minutes
            if "estimated_minutes" in data_dict:
                data_dict["estimated_duration_minutes"] = data_dict["estimated_minutes"]
                
            return data_dict
        return data

    @field_serializer('id', 'user_id')
    def serialize_ids(self, value: Any) -> str:
        """Convert IDs to strings for response"""
        return str(value)


# ── Deep Work Session Schemas ──────────────────────────────────────────

class DeepWorkBase(BaseModel):
    planned_duration_minutes: int = Field(..., ge=5, le=480, description="Planned focus time in minutes")
    focus_goal: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=1000)
    goal_id: Optional[int | str] = None


class DeepWorkCreate(DeepWorkBase):
    """Used when starting a new deep work session"""
    pass


class DeepWorkOut(DeepWorkBase):
    """Response model for deep work sessions"""
    id: int | str
    user_id: int | str
    started_at: datetime
    ended_at: Optional[datetime] = None
    actual_duration_minutes: Optional[int] = None
    status: Literal["active", "completed", "cancelled"] = "active"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('id', 'user_id')
    def serialize_ids(self, value: Any) -> str:
        """Convert IDs to strings for response"""
        return str(value)


# ── Optional: Goal Schemas (expand when you implement GoalTimeline) ─────

class GoalBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[date] = None
    current_progress: int = Field(0, ge=0, le=100)
    milestones: List[str] = Field(default_factory=list)
    ai_suggestions: Dict[str, Any] = Field(default_factory=dict)


class GoalCreate(GoalBase):
    pass


class GoalOut(GoalBase):
    id: int | str
    user_id: int | str
    status: Literal["active", "completed", "archived"] = "active"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('id', 'user_id')
    def serialize_ids(self, value: Any) -> str:
        """Convert IDs to strings for response"""
        return str(value)


# ── Optional: Habit Schemas (for HabitTracker) ─────────────────────────

class HabitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    frequency: Literal["daily", "weekly", "custom"] = "daily"
    goal_id: Optional[int | str] = None
    description: Optional[str] = None
    target: int = 1
    category: Optional[str] = "Wellness"


class HabitCreate(HabitBase):
    pass


class HabitOut(HabitBase):
    id: int | str
    user_id: int | str
    schedule: Dict[str, Any] = Field(default_factory=dict)
    streak: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('id', 'user_id')
    def serialize_ids(self, value: Any) -> str:
        """Convert IDs to strings for response"""
        return str(value)
    
    @model_validator(mode='before')
    @classmethod
    def extract_schedule_fields(cls, data: Any) -> Any:
        """Extract fields from schedule JSON if needed or pass thorough"""
        # Logic to flatten schedule if we wanted to...
        # For now, let's just make sure schedule is passed
        return data


# ── Example: Bulk AI planning response (if you add an /ai/plan-day endpoint later)
class BulkTaskCreate(BaseModel):
    tasks: List[TaskCreate]


class BulkTaskResponse(BaseModel):
    created_count: int
    tasks: List[TaskOut]