from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, validator
from datetime import datetime
import json
import uuid

# --- TIER CAPABILITY MATRIX ---

TIER_CAPABILITIES = {
    "explorer": [
        "CREATE_TASK",
        "DELETE_TASK",
        "CREATE_HABIT",
        "CREATE_GOAL",
        "GET_TASKS",
        "GET_GOALS",
        "GET_HABITS",
        "GET_PLANNER_STATS",
        "GET_DAILY_ACHIEVEMENT_SCORE",
        "GET_GOAL_PROGRESS_REPORT",
        "UPDATE_TASK_STATUS",
        "UPDATE_GOAL_PROGRESS",
        "COMPLETE_HABIT",
        "DELETE_GOAL",
        "DELETE_HABIT"
    ],
    "ultra": [
        "CREATE_TASK",
        "DELETE_TASK",
        "CREATE_HABIT",
        "CREATE_GOAL",
        "GET_TASKS",
        "GET_GOALS",
        "GET_HABITS",
        "GET_PLANNER_STATS",
        "GET_DAILY_ACHIEVEMENT_SCORE",
        "GET_GOAL_PROGRESS_REPORT",
        "GET_GOAL_TIMELINE",
        "BREAKDOWN_GOAL",
        "UPDATE_TASK_STATUS",
        "UPDATE_GOAL_PROGRESS",
        "COMPLETE_HABIT",
        "DELETE_GOAL",
        "DELETE_HABIT",
        "START_DEEP_WORK",
        "CREATE_GOAL_CASCADE"
    ]
}

# --- SCHEMAS ---

class CreateTaskContract(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    priority: str = Field(default="medium")
    due_date: Optional[str] = None
    estimated_minutes: int = Field(default=30, gt=0)
    goal_link: Optional[str] = None  # UUID or Name
    category: Optional[str] = "work"
    scheduled_time: Optional[str] = None

    @validator("priority")
    def validate_priority(cls, v):
        allowed = ["low", "medium", "high", "urgent"]
        if v.lower() not in allowed:
            return "medium"
        return v.lower()

class CreateHabitContract(BaseModel):
    title: str = Field(..., min_length=1, max_length=100) # Renamed from name to sync with API
    frequency_type: str = Field(default="daily")
    description: Optional[str] = ""
    category: Optional[str] = "Wellness"
    goal_link: Optional[str] = None

    @validator("frequency_type")
    def validate_frequency(cls, v):
        allowed = ["daily", "weekly"]
        return v.lower() if v.lower() in allowed else "daily"

class CreateGoalContract(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    target_date: Optional[str] = None
    category: Optional[str] = "Personal"
    milestones: Optional[List[str]] = Field(default_factory=list)

class CreateDeepworkContract(BaseModel):
    title: str = Field(default="Focus Session")
    duration_minutes: int = Field(..., ge=15, le=240)
    scheduled_start: Optional[str] = None
    focus_goal: str = Field(default="Focus on priority tasks")

class DeleteTaskContract(BaseModel):
    task_id: Optional[str] = None
    title: Optional[str] = None
    
    @validator("title")
    def check_one_present(cls, v, values):
        if not v and not values.get("task_id"):
            raise ValueError("Must provide either task_id or title")
        return v

class CascadingTaskDef(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    estimated_minutes: Optional[int] = 30
    order_index: int = 1

class CreateGoalCascadeContract(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    category: str = "personal"
    timeframe: str = "month"
    complexity: str = "medium"
    target_date: Optional[str] = None
    auto_create_tasks: bool = True
    auto_create_habits: bool = True
    propose_deep_work: bool = True
    create_new_goal: bool = True
    existing_goal_id: Optional[str] = None
    preferred_task_time: Optional[str] = None
    preferred_deep_work_time: Optional[str] = None


class BreakdownGoalContract(BaseModel):
    goal_link: str = Field(..., min_length=1, description="Goal ID or exact title")
    auto_create_tasks: bool = True
    auto_create_habits: bool = True
    propose_deep_work: bool = True
    preferred_task_time: Optional[str] = None
    preferred_deep_work_time: Optional[str] = None

# Map tools to schemas
CONTRACT_SCHEMATA = {
    "CREATE_TASK": CreateTaskContract,
    "CREATE_HABIT": CreateHabitContract,
    "CREATE_GOAL": CreateGoalContract,
    "START_DEEP_WORK": CreateDeepworkContract,
    "DELETE_TASK": DeleteTaskContract,
    "CREATE_GOAL_CASCADE": CreateGoalCascadeContract,
    "BREAKDOWN_GOAL": BreakdownGoalContract,
}

class ToolExecutionError(Exception):
    def __init__(self, message: str, tool_name: str, payload: Any):
        super().__init__(message)
        self.message = message
        self.tool_name = tool_name
        self.payload = payload

# --- PIPELINE / VALIDATION ---

def validate_tool_payload(tool_name: str, payload: Dict[str, Any], plan_tier: str) -> Dict[str, Any]:
    # 1. Tier Verification
    tier = plan_tier.lower()
    if tier not in TIER_CAPABILITIES:
        tier = "explorer"
    
    allowed_tools = TIER_CAPABILITIES.get(tier, TIER_CAPABILITIES["explorer"])
    if tool_name not in allowed_tools:
        raise ToolExecutionError(
            message=f"TOOL_EXECUTION_FAILED. Reason: [Tier Restriction]. Details: '{tool_name}' requires Ultra tier. Instruction: Inform user they need to upgrade.",
            tool_name=tool_name,
            payload=payload
        )
    
    # 1.5 Goal Locking for Explorers
    # Explorers cannot link tasks or habits to goals.
    if tier == "explorer" and payload.get("goal_link"):
        payload["goal_link"] = None # Silently drop it, or we can raise an error if we strictly want AI to know
        # But raising an error teaches the AI
        raise ToolExecutionError(
            message=f"TOOL_EXECUTION_FAILED. Reason: [Tier Restriction]. Details: Passing 'goal_link' is an Ultra-only feature. Instruction: Re-try the tool but omit the 'goal_link' parameter and inform the user that linking to goals requires Ultra.",
            tool_name=tool_name,
            payload=payload
        )
    
    # 2. Schema Validation (if we have a contract for it)
    schema_cls = CONTRACT_SCHEMATA.get(tool_name)
    if not schema_cls:
        # Pass through for tools without strict schemas right now
        return payload

    try:
        # To handle aliases like habit name -> habit title
        if tool_name == "CREATE_HABIT" and "name" in payload and "title" not in payload:
            payload["title"] = payload.pop("name")
        if tool_name in {"CREATE_DEEP_WORK", "START_DEEP_WORK"} and "duration" in payload and "duration_minutes" not in payload:
            payload["duration_minutes"] = payload.pop("duration")

        validated = schema_cls(**payload)
        return validated.dict()
    except ValueError as e:
        error_msgs = []
        for error in e.errors():
            field = ".".join([str(loc) for loc in error.get("loc", [])])
            msg = error.get("msg", "Invalid value")
            error_msgs.append(f"{field}: {msg}")
            
        raise ToolExecutionError(
            message=f"TOOL_EXECUTION_FAILED. Reason: [Schema Validation]. Details: {'. '.join(error_msgs)}. Instruction: Correct the payload parameters to match required types and missing fields.",
            tool_name=tool_name,
            payload=payload
        )
