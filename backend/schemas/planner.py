# backend/schemas/planner.py
from pydantic import BaseModel, Field, ConfigDict, field_serializer, field_validator, model_validator
from typing import Optional, List, Literal, Any, Dict
from datetime import datetime, date
from uuid import UUID


# ── Task Schemas ───────────────────────────────────────────────────────

class SubtaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    completed: bool = False


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
    due_local_date: Optional[date] = None
    due_local_time: Optional[str] = None
    timezone: Optional[str] = None
    subtasks: Optional[List[SubtaskCreate]] = None
    depends_on_task_id: Optional[int | str] = None
    recurring: Optional[bool] = False
    recurrence_config: Optional[Dict[str, Any]] = None

    @field_validator("due_local_time")
    @classmethod
    def validate_due_local_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if len(value) != 5 or value[2] != ":":
            raise ValueError("due_local_time must be HH:MM")
        hour = int(value[:2])
        minute = int(value[3:])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("due_local_time must be HH:MM")
        return value


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
    due_local_date: Optional[date] = None
    due_local_time: Optional[str] = None
    timezone: Optional[str] = None
    subtasks: Optional[List[Dict[str, Any]]] = None
    depends_on_task_id: Optional[int | str] = None
    recurring: Optional[bool] = None
    recurrence_config: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("due_local_time")
    @classmethod
    def validate_due_local_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if len(value) != 5 or value[2] != ":":
            raise ValueError("due_local_time must be HH:MM")
        hour = int(value[:2])
        minute = int(value[3:])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("due_local_time must be HH:MM")
        return value


class TaskOut(TaskBase):
    """Response model — includes DB-generated fields"""
    id: int | str  # Accept both int and str
    user_id: int | str  # Accept both int and str
    created_at: datetime
    updated_at: Optional[datetime] = None
    related_goal_id: Optional[str] = None
    goal_title: Optional[str] = None
    meta: Optional[dict] = None
    subtasks: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    depends_on_task_id: Optional[int | str] = None
    is_recurring: bool = False
    recurrence_pattern_id: Optional[str] = None

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
    planned_duration_minutes: int = Field(..., ge=5, le=720, description="Planned focus time in minutes")
    focus_goal: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=1000)
    goal_id: Optional[int | str] = None
    status: Literal["scheduled", "active", "paused", "completed", "cancelled", "missed"] = "active"
    accumulated_pause_seconds: int = 0


class DeepWorkCreate(DeepWorkBase):
    """Used when starting a new deep work session"""
    pass


class DeepWorkScheduleCreate(BaseModel):
    days_of_week: List[int] = Field(..., min_length=1, max_length=7, description="0=Sun .. 6=Sat")
    local_dates: Optional[List[date]] = None
    start_time: str = Field(..., description="Local HH:MM")
    duration_minutes: int = Field(..., ge=5, le=720)
    timezone: str = Field(..., min_length=1, max_length=64)
    focus_goal: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=1000)
    goal_id: Optional[int | str] = None

    @field_validator("days_of_week")
    @classmethod
    def validate_days_of_week(cls, value: List[int]) -> List[int]:
        normalized = sorted(set(value))
        if any(day < 0 or day > 6 for day in normalized):
            raise ValueError("days_of_week must contain values between 0 and 6")
        return normalized

    @field_validator("local_dates")
    @classmethod
    def validate_local_dates(cls, value: Optional[List[date]]) -> Optional[List[date]]:
        if value is None:
            return value
        return sorted(set(value))

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: str) -> str:
        if len(value) != 5 or value[2] != ":":
            raise ValueError("start_time must be HH:MM")
        hour = int(value[:2])
        minute = int(value[3:])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("start_time must be HH:MM")
        return value


class DeepWorkOut(DeepWorkBase):
    id: int | str
    user_id: int | str
    scheduled_start_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    actual_duration_minutes: Optional[int] = None
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
