from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.services.growth_service import growth_service
from backend.services.growth_tools import generate_task_prioritizer, generate_weekly_planner


router = APIRouter()


class TaskPrioritizerRequest(BaseModel):
    tasks_text: str = Field(..., min_length=3, max_length=8000)
    audience: Optional[str] = Field(default="founder", max_length=80)
    work_hours: int = Field(default=6, ge=1, le=12)
    anonymous_id: Optional[str] = Field(default=None, max_length=120)
    source_path: Optional[str] = Field(default=None, max_length=240)
    source_url: Optional[str] = Field(default=None, max_length=600)
    utm: Dict[str, Any] = Field(default_factory=dict)


class WeeklyPlannerRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=2000)
    audience: Optional[str] = Field(default="creator", max_length=80)
    hours_per_day: int = Field(default=2, ge=1, le=8)
    anonymous_id: Optional[str] = Field(default=None, max_length=120)
    source_path: Optional[str] = Field(default=None, max_length=240)
    source_url: Optional[str] = Field(default=None, max_length=600)
    utm: Dict[str, Any] = Field(default_factory=dict)


@router.post("/task-prioritizer")
async def task_prioritizer(payload: TaskPrioritizerRequest, db: AsyncSession = Depends(get_db)):
    result = generate_task_prioritizer(
        tasks_text=payload.tasks_text,
        audience=payload.audience or "founder",
        work_hours=payload.work_hours,
    )
    await growth_service.record_event(
        db,
        event_type="tool_result_generated",
        tool="ai-task-prioritizer",
        anonymous_id=payload.anonymous_id,
        source_path=payload.source_path,
        source_url=payload.source_url,
        utm=payload.utm,
        meta={"task_count": len(result.get("top_priorities", []))},
    )
    return {"success": True, "data": result}


@router.post("/weekly-planner")
async def weekly_planner(payload: WeeklyPlannerRequest, db: AsyncSession = Depends(get_db)):
    result = generate_weekly_planner(
        goal=payload.goal,
        audience=payload.audience or "creator",
        hours_per_day=payload.hours_per_day,
    )
    await growth_service.record_event(
        db,
        event_type="tool_result_generated",
        tool="ai-weekly-planner",
        anonymous_id=payload.anonymous_id,
        source_path=payload.source_path,
        source_url=payload.source_url,
        utm=payload.utm,
        meta={"days": len(result.get("days", []))},
    )
    return {"success": True, "data": result}
