# backend/api/v1/endpoints/goals.py
"""
Goals API endpoint for managing user goals.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from backend.core.security import get_current_user
from backend.services.planner_service import planner_service
from backend.db.models import User


router = APIRouter()


# ── Pydantic Schemas ────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = "personal"
    target_date: Optional[datetime] = None
    milestones: Optional[List[str]] = []


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[datetime] = None
    current_progress: Optional[int] = Field(None, ge=0, le=100)


class GoalOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[str] = None
    current_progress: int = 0
    milestones: List[str] = []
    
    # AI Fields
    ai_suggestions: dict = {}
    # is_tracked: bool = False  # Commented out for database compatibility
    # probability_status: str = "Medium"  # Commented out for database compatibility
    
    created_at: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_in: GoalCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new goal."""
    goal_data = {
        "title": goal_in.title,
        "description": goal_in.description,
        "category": goal_in.category,
        "target_date": goal_in.target_date,
        "milestones": goal_in.milestones or [],
    }
    
    result = await planner_service.create_goal(str(current_user.id), goal_data)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/", response_model=List[GoalOut])
async def get_goals(current_user: User = Depends(get_current_user)):
    """Get all goals for the current user."""
    return await planner_service.get_user_goals(str(current_user.id))


@router.get("/timeline", response_model=List[GoalOut])
async def get_goal_timeline(current_user: User = Depends(get_current_user)):
    """Get goals organized by timeline (sorted by target date)."""
    return await planner_service.get_goal_timeline(str(current_user.id))


@router.patch("/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    progress: int = Body(..., ge=0, le=100, embed=True),
    current_user: User = Depends(get_current_user)
):
    """Update the progress of a goal."""
    success = await planner_service.update_goal_progress(
        str(current_user.id), 
        goal_id, 
        progress
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"message": "Progress updated", "progress": progress}


@router.post("/{goal_id}/toggle-tracking", response_model=dict)
async def toggle_goal_tracking(
    goal_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Toggle AI tracking for a goal (Max 3 active).
    Requires 'ULTRA' plan or Owner.
    """
    # Check plan permissions
    if current_user.plan_type != "ULTRA" and not current_user.is_superuser:
         raise HTTPException(
             status_code=403, 
             detail="Goal Intelligence is an ULTRA feature."
         )

    result = await planner_service.toggle_goal_tracking(str(current_user.id), goal_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{goal_id}/breakdown", response_model=dict)
async def breakdown_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate AI breakdown (Tasks, Habits, Deep Work).
    Requires 'ULTRA' plan or Owner.
    """
    if current_user.plan_type != "ULTRA" and not current_user.is_superuser:
         raise HTTPException(
             status_code=403, 
             detail="Goal Intelligence is an ULTRA feature."
         )

    result = await planner_service.breakdown_goal(str(current_user.id), goal_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a goal."""
    success = await planner_service.delete_goal(str(current_user.id), goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    return None
