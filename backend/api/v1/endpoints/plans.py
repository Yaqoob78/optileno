# backend/api/v1/endpoints/plans.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from datetime import date
from pydantic import BaseModel, Field

from backend.core.security import get_current_user
from backend.schemas.planner import (
    TaskCreate, TaskUpdate, TaskOut,
    DeepWorkCreate, DeepWorkOut,
    # Add these when you create them:
    # GoalCreate, GoalUpdate, GoalOut,
    # HabitCreate, HabitUpdate, HabitOut,
)
from backend.services.planner_service import planner_service
from backend.db.models import User
from backend.realtime.socket_manager import (
    broadcast_task_created,
    broadcast_task_updated,
    broadcast_task_deleted,
    broadcast_deep_work_started,
    broadcast_deep_work_completed,
)

router = APIRouter()


# ── Tasks ──────────────────────────────────────────────────────────────

@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new task (user or AI can call this)"""
    task = await planner_service.create_task(
        user_id=str(current_user.id),
        task_data=task_in
    )
    # Broadcast to connected clients (fire and forget)
    try:
        task_dict = {
            "id": str(task.id),
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "category": task.category
        }
        await broadcast_task_created(current_user.id, task_dict)
    except Exception as e:
        # Log error but don't fail the request
        print(f"Broadcast failed: {e}")
        
    return task


@router.get("/tasks", response_model=List[TaskOut])
async def get_tasks(
    status: Optional[str] = Query(None, description="Filter by task status (todo, in-progress, done)"),
    due_from: Optional[date] = Query(None),
    due_to: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user)
):
    """List user's tasks with optional filters"""
    return await planner_service.get_tasks(
        user_id=str(current_user.id),
        status=status,
        due_date_from=due_from,
        due_date_to=due_to,
        limit=limit,
        offset=offset
    )


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single task by ID"""
    task = await planner_service.get_task_by_id(str(current_user.id), task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing task"""
    updated = await planner_service.update_task(
        user_id=str(current_user.id),
        task_id=task_id,
        updates=task_update
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found or not owned")
        
    # Broadcast to connected clients
    try:
        updated_dict = {
            "id": str(updated.id),
            "title": updated.title,
            "status": updated.status,
            "priority": updated.priority,
            "category": updated.category
        }
        await broadcast_task_updated(current_user.id, updated_dict)
    except Exception:
        pass
        
    return updated


@router.post("/tasks/{task_id}/start", response_model=TaskOut)
async def start_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start a task (initial start or retry)."""
    result = await planner_service.start_task(str(current_user.id), task_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a task"""
    success = await planner_service.delete_task(str(current_user.id), task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or not owned")
    # Broadcast to connected clients
    await broadcast_task_deleted(current_user.id, task_id)


# ── Deep Work Sessions ─────────────────────────────────────────────────

@router.post("/deep-work/start", response_model=DeepWorkOut, status_code=status.HTTP_201_CREATED)
async def start_deep_work(
    session_in: DeepWorkCreate,
    current_user: User = Depends(get_current_user)
):
    """Start a new deep work session (can be triggered by user or AI)"""
    session = await planner_service.start_deep_work(
        user_id=str(current_user.id),
        data=session_in
    )
    # Broadcast to connected clients
    await broadcast_deep_work_started(current_user.id, session.dict())
    return session


class CompleteDeepWorkRequest(BaseModel):
    session_id: str = Field(..., description="The session ID to complete")
    actual_duration_minutes: int = Field(..., ge=1, le=480, description="Actual duration in minutes")

@router.post("/deep-work/complete", response_model=DeepWorkOut)
async def complete_deep_work(
    request_body: CompleteDeepWorkRequest,
    current_user: User = Depends(get_current_user)
):
    """Mark a deep work session as completed"""
    session = await planner_service.complete_deep_work(
        user_id=str(current_user.id),
        session_id=request_body.session_id,
        actual_duration_minutes=request_body.actual_duration_minutes
    )
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    # Broadcast to connected clients
    await broadcast_deep_work_completed(current_user.id, session.dict())
    return session


@router.get("/deep-work/active", response_model=Optional[DeepWorkOut])
async def get_active_deep_work(
    current_user: User = Depends(get_current_user)
):
    """Get currently active deep work session if any"""
    return await planner_service.get_active_deep_work(str(current_user.id))


# ── Habits ───────────────────────────────────────────────────────────────

@router.get("/habits", response_model=List[Dict[str, Any]])
async def get_habits(current_user: User = Depends(get_current_user)):
    """Get all habits for the current user."""
    return await planner_service.get_user_habits(str(current_user.id))


@router.post("/habits", status_code=status.HTTP_201_CREATED)
async def create_habit(
    habit_in: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Create a new habit."""
    return await planner_service.create_habit(str(current_user.id), habit_in)


@router.post("/habits/{habit_id}/track")
async def track_habit(
    habit_id: str,
    current_user: User = Depends(get_current_user)
):
    """Track habit completion (increment streak)."""
    result = await planner_service.track_habit(str(current_user.id), habit_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a habit"""
    success = await planner_service.delete_habit(str(current_user.id), habit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Habit not found or not owned")


# ── Goals ────────────────────────────────────────────────────────────────

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
    """Get all goals for the current user."""
    return await planner_service.get_user_goals(str(current_user.id))


@router.get("/goals/timeline", response_model=List[Dict[str, Any]])
async def get_goal_timeline(current_user: User = Depends(get_current_user)):
    """Get goals organized by timeline."""
    return await planner_service.get_goal_timeline(str(current_user.id))


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_in: GoalCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new goal (user or AI can call this)."""
    goal = await planner_service.create_goal(
        user_id=str(current_user.id),
        goal_data=goal_in.dict()
    )
    if "error" in goal:
        raise HTTPException(status_code=500, detail=goal["error"])
    return goal


@router.patch("/goals/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    progress: int = Query(..., ge=0, le=100),
    current_user: User = Depends(get_current_user)
):
    """Update goal progress percentage."""
    success = await planner_service.update_goal_progress(
        user_id=str(current_user.id),
        goal_id=goal_id,
        progress=progress
    )
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found or not owned")
    return {"message": "Progress updated", "progress": progress}


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a goal"""
    success = await planner_service.delete_goal(str(current_user.id), goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found or not owned")


# ── Dashboard (Read-Only Aggregation) ────────────────────────────────────

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_planner_dashboard(current_user: User = Depends(get_current_user)):
    """
    Get aggregated dashboard data for the planner.
    Returns: daily_stats, counts, productivity_score
    """
    from backend.ai.tools.goal_automation import get_planner_dashboard
    return await get_planner_dashboard(str(current_user.id))


# ── AI Bulk Planning ─────────────────────────────────────────────────────

class AIGoalRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    category: Optional[str] = "personal"
    timeframe: Optional[str] = "month"  # day, week, month, quarter
    complexity: Optional[str] = "medium"  # low, medium, high
    target_date: Optional[str] = None
    auto_create_tasks: Optional[bool] = True
    auto_create_habits: Optional[bool] = False
    propose_deep_work: Optional[bool] = True


@router.post("/ai/create-goal-with-cascade", status_code=status.HTTP_201_CREATED)
async def ai_create_goal_with_cascade(
    request: AIGoalRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI endpoint: Create a goal with full cascade automation.
    - Creates the goal
    - Auto-generates supporting tasks
    - Suggests supporting habits
    - Proposes deep work blocks if needed
    """
    from backend.ai.tools.goal_automation import create_goal_with_cascade
    
    result = await create_goal_with_cascade(
        user_id=str(current_user.id),
        payload=request.dict()
    )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to create goal"))
    
    return result


# ── Legacy / simple plan endpoints (keep if you still use generic plans) ──

@router.get("/current", response_model=dict) # type: ignore
async def get_current_plan(current_user: User = Depends(get_current_user)):
    """Get the user's latest active or most recent generic plan"""
    plan = await planner_service.get_latest_plan(str(current_user.id))
    if not plan:
        return {"message": "No active plan found"}
    return plan


@router.get("/history", response_model=list) # type: ignore
async def get_plan_history(current_user: User = Depends(get_current_user)):
    """Get history of generic plans"""
    return await planner_service.get_plan_history(str(current_user.id))