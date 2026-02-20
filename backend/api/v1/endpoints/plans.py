from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.core.security import get_current_user
from backend.db.models import User
from backend.realtime.socket_manager import (
    broadcast_deep_work_completed,
    broadcast_deep_work_started,
    broadcast_task_created,
    broadcast_task_deleted,
    broadcast_task_updated,
)
from backend.schemas.planner import (
    DeepWorkCreate,
    DeepWorkOut,
    DeepWorkScheduleCreate,
    HabitCreate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from backend.services.entitlements_service import require_ultra_feature
from backend.services.planner_service import planner_service

router = APIRouter()
logger = logging.getLogger(__name__)


def _resolve_timezone(current_user: User, explicit_timezone: Optional[str] = None) -> str:
    if explicit_timezone:
        return explicit_timezone
    preferences = getattr(current_user, "preferences", None)
    if isinstance(preferences, dict):
        timezone_name = preferences.get("timezone")
        if isinstance(timezone_name, str) and timezone_name.strip():
            return timezone_name
    return "UTC"


def _enforce_goal_link_ultra(
    current_user: User,
    goal_id: Optional[Any],
    feature: str = "goal_linking",
) -> None:
    if goal_id is None or str(goal_id).strip() == "":
        return
    require_ultra_feature(current_user, feature)


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
):
    _enforce_goal_link_ultra(current_user, task_in.goal_id)
    task = await planner_service.create_task(user_id=str(current_user.id), task_data=task_in)
    if isinstance(task, dict) and task.get("error"):
        raise HTTPException(status_code=400, detail=task["error"])
    try:
        if isinstance(task, dict):
            payload = {
                "id": str(task.get("id")),
                "title": task.get("title"),
                "status": task.get("status"),
                "priority": task.get("priority"),
                "category": task.get("category"),
            }
        else:
            payload = {
                "id": str(task.id),
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
                "category": task.category,
            }
        await broadcast_task_created(current_user.id, payload)
    except Exception as exc:
        logger.warning("Task created broadcast failed: %s", exc)
    return task


@router.get("/tasks", response_model=List[TaskOut])
async def get_tasks(
    status: Optional[str] = Query(None, description="todo, in-progress, done"),
    day: Optional[date] = Query(None, description="Local day in user's timezone"),
    timezone: Optional[str] = Query(None, description="IANA timezone"),
    due_from: Optional[date] = Query(None),
    due_to: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
):
    return await planner_service.get_tasks(
        user_id=str(current_user.id),
        status=status,
        local_day=day,
        timezone_name=_resolve_timezone(current_user, timezone),
        due_date_from=due_from,
        due_date_to=due_to,
        limit=limit,
        offset=offset,
    )


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task = await planner_service.get_task_by_id(str(current_user.id), task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
):
    _enforce_goal_link_ultra(current_user, task_update.goal_id)
    updated = await planner_service.update_task(
        user_id=str(current_user.id),
        task_id=task_id,
        updates=task_update,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found or not owned")
    try:
        await broadcast_task_updated(
            current_user.id,
            {
                "id": str(updated.id),
                "title": updated.title,
                "status": updated.status,
                "priority": updated.priority,
                "category": updated.category,
            },
        )
    except Exception:
        pass
    return updated


@router.post("/tasks/{task_id}/start", response_model=TaskOut)
async def start_task(task_id: str, current_user: User = Depends(get_current_user)):
    result = await planner_service.start_task(str(current_user.id), task_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    success = await planner_service.delete_task(str(current_user.id), task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or not owned")
    await broadcast_task_deleted(current_user.id, task_id)


@router.post("/deep-work/start", response_model=DeepWorkOut, status_code=status.HTTP_201_CREATED)
async def start_deep_work(
    session_in: DeepWorkCreate,
    current_user: User = Depends(get_current_user),
):
    _enforce_goal_link_ultra(current_user, session_in.goal_id)
    session = await planner_service.start_deep_work(
        user_id=str(current_user.id),
        data=session_in,
    )
    if not session:
        raise HTTPException(status_code=400, detail="Failed to start deep work session")
    session_payload = session if isinstance(session, dict) else session.dict()
    await broadcast_deep_work_started(current_user.id, session_payload)
    return session


@router.post("/deep-work/schedule", response_model=List[DeepWorkOut], status_code=status.HTTP_201_CREATED)
async def schedule_deep_work(
    schedule_in: DeepWorkScheduleCreate,
    current_user: User = Depends(get_current_user),
):
    require_ultra_feature(current_user, "deepwork_scheduling")
    _enforce_goal_link_ultra(current_user, schedule_in.goal_id)
    return await planner_service.schedule_deep_work(
        user_id=str(current_user.id),
        data=schedule_in,
    )


class CompleteDeepWorkRequest(BaseModel):
    session_id: str = Field(..., description="Session id to complete")
    actual_duration_minutes: int = Field(..., ge=1, le=480, description="Actual duration")


@router.post("/deep-work/complete", response_model=DeepWorkOut)
async def complete_deep_work(
    request_body: CompleteDeepWorkRequest,
    current_user: User = Depends(get_current_user),
):
    session = await planner_service.complete_deep_work(
        user_id=str(current_user.id),
        session_id=request_body.session_id,
        actual_duration_minutes=request_body.actual_duration_minutes,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    session_payload = session if isinstance(session, dict) else session.dict()
    await broadcast_deep_work_completed(current_user.id, session_payload)
    return session


@router.get("/deep-work/active", response_model=Optional[DeepWorkOut])
async def get_active_deep_work(current_user: User = Depends(get_current_user)):
    try:
        return await planner_service.get_active_deep_work(str(current_user.id))
    except Exception as exc:
        logger.error("Failed to fetch active deep work for user %s: %s", current_user.id, exc, exc_info=True)
        return None


@router.get("/habits", response_model=List[Dict[str, Any]])
async def get_habits(
    timezone: Optional[str] = Query(None, description="IANA timezone"),
    current_user: User = Depends(get_current_user),
):
    return await planner_service.get_user_habits(
        str(current_user.id),
        timezone_name=_resolve_timezone(current_user, timezone),
    )


@router.post("/habits", status_code=status.HTTP_201_CREATED)
async def create_habit(
    habit_in: HabitCreate,
    current_user: User = Depends(get_current_user),
):
    _enforce_goal_link_ultra(current_user, habit_in.goal_id)
    habit = await planner_service.create_habit(str(current_user.id), habit_in)
    if isinstance(habit, dict) and habit.get("error"):
        raise HTTPException(status_code=400, detail=habit["error"])
    return habit


@router.post("/habits/{habit_id}/track")
async def track_habit(
    habit_id: str,
    timezone: Optional[str] = Query(None, description="IANA timezone"),
    current_user: User = Depends(get_current_user),
):
    result = await planner_service.track_habit(
        str(current_user.id),
        habit_id,
        timezone_name=_resolve_timezone(current_user, timezone),
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(habit_id: str, current_user: User = Depends(get_current_user)):
    success = await planner_service.delete_habit(str(current_user.id), habit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Habit not found or not owned")


class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = "personal"
    target_date: Optional[str] = None
    milestones: Optional[List[str]] = []


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[str] = None
    current_progress: Optional[int] = Field(None, ge=0, le=100)


@router.get("/goals", response_model=List[Dict[str, Any]])
async def get_goals(current_user: User = Depends(get_current_user)):
    return await planner_service.get_user_goals(str(current_user.id))


@router.get("/goals/timeline", response_model=List[Dict[str, Any]])
async def get_goal_timeline(current_user: User = Depends(get_current_user)):
    return await planner_service.get_goal_timeline(str(current_user.id))


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(goal_in: GoalCreate, current_user: User = Depends(get_current_user)):
    goal = await planner_service.create_goal(
        user_id=str(current_user.id),
        goal_data=goal_in.dict(),
    )
    if "error" in goal:
        raise HTTPException(status_code=500, detail=goal["error"])
    return goal


@router.patch("/goals/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    progress: int = Query(..., ge=0, le=100),
    current_user: User = Depends(get_current_user),
):
    success = await planner_service.update_goal_progress(
        user_id=str(current_user.id),
        goal_id=goal_id,
        progress=progress,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found or not owned")
    return {"message": "Progress updated", "progress": progress}


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(goal_id: str, current_user: User = Depends(get_current_user)):
    success = await planner_service.delete_goal(str(current_user.id), goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found or not owned")


@router.get("/dashboard", response_model=Dict[str, Any])
async def get_planner_dashboard(current_user: User = Depends(get_current_user)):
    from backend.ai.tools.goal_automation import get_planner_dashboard

    return await get_planner_dashboard(str(current_user.id))


class AIGoalRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    category: Optional[str] = "personal"
    timeframe: Optional[str] = "month"
    complexity: Optional[str] = "medium"
    target_date: Optional[str] = None
    auto_create_tasks: Optional[bool] = True
    auto_create_habits: Optional[bool] = False
    propose_deep_work: Optional[bool] = True


@router.post("/ai/create-goal-with-cascade", status_code=status.HTTP_201_CREATED)
async def ai_create_goal_with_cascade(
    request: AIGoalRequest,
    current_user: User = Depends(get_current_user),
):
    require_ultra_feature(current_user, "agentic_planner")
    from backend.ai.tools.goal_automation import create_goal_with_cascade

    result = await create_goal_with_cascade(user_id=str(current_user.id), payload=request.dict())
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to create goal"))
    return result


@router.get("/current", response_model=dict)
async def get_current_plan(current_user: User = Depends(get_current_user)):
    plan = await planner_service.get_latest_plan(str(current_user.id))
    if not plan:
        return {"message": "No active plan found"}
    return plan


@router.get("/history", response_model=list)
async def get_plan_history(current_user: User = Depends(get_current_user)):
    return await planner_service.get_plan_history(str(current_user.id))
