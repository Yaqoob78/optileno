# backend/api/v1/endpoints/advanced_features.py
"""
API endpoints for advanced features:
- AI Agent orchestration
- Advanced analytics
- Notifications
- Collaboration
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from backend.core.security import get_current_user
from backend.ai.agent import AgentOrchestrator, AgentState
from backend.ai.client import DualAIClient
from backend.analytics.forecast import TrajectoryForecaster, PerformanceScorer, DataPoint
from backend.services.notification_service import (
    notification_service,
    NotificationType,
    NotificationPriority,
    NotificationChannel
)
from backend.services.collaboration_service import (
    collaboration_service,
    Permission
)
from backend.realtime import (
    broadcast_task_shared,
    broadcast_comment_added,
    broadcast_collaboration_session_started,
    broadcast_agent_conversation_update,
)
from backend.db.models import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# ========================================
# AI Agent Endpoints
# ========================================

class AgentMessageRequest(BaseModel):
    """Request to send message to AI agent"""
    message: str
    mode: str = "CHAT"  # CHAT, PLAN, ANALYZE, TASK


class AgentStateResponse(BaseModel):
    """Agent state information"""
    user_id: int
    state: str
    current_plan: Optional[Dict[str, Any]] = None
    conversation_summary: Optional[Dict[str, Any]] = None


@router.post("/agent/message")
async def send_message_to_agent(
    request: AgentMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """Send a message to the AI agent"""
    # Initialize AI client with user_id
    # Note: DualAIClient expects user_id as string
    ai_client = DualAIClient(str(current_user.id))
    
    # Initialize agent orchestrator with the client
    agent = AgentOrchestrator(current_user.id, ai_client)
    
    response = await agent.process_user_input(request.message, request.mode)
    
    # Broadcast agent update
    import asyncio
    asyncio.create_task(broadcast_agent_conversation_update(
        user_id=current_user.id,
        conversation_id=str(id(agent)),
        update={
            "mode": request.mode,
            "state": agent.state.value,
            "response_preview": str(response)[:100]
        }
    ))
    
    return {
        "message_id": id(response),
        "response": response,
        "agent_state": agent.state.value
    }


@router.get("/agent/state")
async def get_agent_state(current_user: User = Depends(get_current_user)):
    """Get current agent state for user"""
    # Even for state, we initialize properly to avoid any potential issues
    ai_client = DualAIClient(str(current_user.id))
    agent = AgentOrchestrator(current_user.id, ai_client)
    return agent.get_agent_state()


# ========================================
# Advanced Analytics Endpoints
# ========================================

class ForecastRequest(BaseModel):
    """Request for trajectory forecast"""
    metric_type: str  # "productivity", "focus", "wellness"
    days_ahead: int = 7


class GoalAchievementRequest(BaseModel):
    """Request to check goal achievement"""
    current_value: float
    goal_value: float
    target_days: int = 30


@router.post("/analytics/forecast")
async def get_trajectory_forecast(
    request: ForecastRequest,
    current_user: User = Depends(get_current_user)
):
    """Get trajectory forecast for a metric"""
    # In production, fetch actual user data
    sample_data = [
        DataPoint(datetime.utcnow(), float(i * 5), {})
        for i in range(1, 31)
    ]
    
    forecaster = TrajectoryForecaster(sample_data)
    forecast = forecaster.forecast(days_ahead=request.days_ahead)
    
    return {
        "metric": request.metric_type,
        "forecast": forecast,
        "confidence": forecast["confidence"]
    }


@router.post("/analytics/goal-achievement")
async def check_goal_achievement(
    request: GoalAchievementRequest,
    current_user: User = Depends(get_current_user)
):
    """Check if goal will be achieved"""
    sample_data = [
        DataPoint(datetime.utcnow(), float(i * 2), {})
        for i in range(1, 31)
    ]
    
    forecaster = TrajectoryForecaster(sample_data)
    prediction = forecaster.predict_goal_achievement(
        request.current_value,
        request.goal_value,
        request.target_days
    )
    
    return prediction


@router.get("/analytics/performance-score")
async def get_performance_score(
    current_user: User = Depends(get_current_user)
):
    """Calculate user's performance score"""
    # In production, fetch actual metrics
    score = PerformanceScorer.calculate_productivity_score(
        tasks_completed=8,
        deep_work_minutes=120,
        focus_quality=85.0,
        consistency=90.0
    )
    
    return {
        "user_id": current_user.id,
        "performance": score
    }


@router.get("/analytics/wellness-score")
async def get_wellness_score(current_user: User = Depends(get_current_user)):
    """Calculate user's wellness score"""
    score = PerformanceScorer.calculate_wellness_score(
        sleep_hours=7.5,
        exercise_minutes=45,
        stress_level=30.0,
        break_frequency=6
    )
    
    return {
        "user_id": current_user.id,
        "wellness": score
    }


# ========================================
# Notification Endpoints
# ========================================

class NotificationPreferenceRequest(BaseModel):
    """Update notification preferences"""
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    enabled: bool = True


@router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
    limit: int = 50
):
    """Get user's notifications"""
    notifications = notification_service.get_user_notifications(
        current_user.id,
        unread_only=unread_only,
        limit=limit
    )
    
    return {
        "notifications": [n.to_dict() for n in notifications],
        "unread_count": sum(1 for n in notifications if not n.read)
    }


@router.post("/notifications/{notification_index}/read")
async def mark_notification_read(
    notification_index: int,
    current_user: User = Depends(get_current_user)
):
    """Mark notification as read"""
    success = notification_service.mark_as_read(current_user.id, notification_index)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "read"}


@router.put("/notifications/preferences")
async def update_notification_preferences(
    request: NotificationPreferenceRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user notification preferences"""
    from backend.services.notification_service import NotificationPreferences
    
    prefs = NotificationPreferences(current_user.id)
    prefs.quiet_hours_start = request.quiet_hours_start
    prefs.quiet_hours_end = request.quiet_hours_end
    prefs.enabled = request.enabled
    
    notification_service.update_preferences(current_user.id, prefs)
    
    return prefs.to_dict()


# ========================================
# Collaboration Endpoints
# ========================================

class ShareTaskRequest(BaseModel):
    """Share a task with another user"""
    task_id: str
    shared_with_user_id: int
    permissions: List[str]  # "view", "edit", "comment", "delete", "share"
    message: Optional[str] = None


class AddCommentRequest(BaseModel):
    """Add a comment to a task"""
    task_id: str
    content: str
    parent_comment_id: Optional[str] = None


@router.post("/tasks/share")
async def share_task(
    request: ShareTaskRequest,
    current_user: User = Depends(get_current_user)
):
    """Share a task with another user"""
    permissions = [Permission[p.upper()] for p in request.permissions]
    
    share = collaboration_service.share_task(
        task_id=request.task_id,
        owner_id=current_user.id,
        shared_with_id=request.shared_with_user_id,
        permissions=permissions,
        message=request.message
    )
    
    # Broadcast to recipient
    import asyncio
    asyncio.create_task(broadcast_task_shared(
        owner_id=current_user.id,
        shared_with_id=request.shared_with_user_id,
        task={
            "task_id": request.task_id,
            "shared_by": current_user.username,
            "permissions": request.permissions,
            "message": request.message
        }
    ))
    
    return share.to_dict()


@router.get("/tasks/shared-with-me")
async def get_shared_tasks(current_user: User = Depends(get_current_user)):
    """Get tasks shared with the user"""
    shared_tasks = collaboration_service.get_user_shared_tasks(current_user.id)
    
    return {
        "shared_tasks": shared_tasks,
        "count": len(shared_tasks)
    }


@router.post("/tasks/{task_id}/comments")
async def add_comment(
    task_id: str,
    request: AddCommentRequest,
    current_user: User = Depends(get_current_user)
):
    """Add a comment to a task"""
    comment = collaboration_service.add_comment(
        task_id=task_id,
        author_id=current_user.id,
        content=request.content,
        parent_comment_id=request.parent_comment_id
    )
    
    if not comment:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Broadcast comment to all viewers
    import asyncio
    asyncio.create_task(broadcast_comment_added(
        user_id=current_user.id,
        task_id=task_id,
        comment={
            "author": current_user.username,
            "content": request.content,
            "created_at": datetime.utcnow().isoformat()
        }
    ))
    
    return comment.to_dict()


@router.get("/tasks/{task_id}/comments")
async def get_task_comments(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get comments on a task"""
    comments = collaboration_service.get_task_comments(task_id)
    
    return {
        "task_id": task_id,
        "comments": [c.to_dict() for c in comments],
        "count": len(comments)
    }


@router.get("/collaboration/stats")
async def get_collaboration_stats(current_user: User = Depends(get_current_user)):
    """Get collaboration statistics"""
    stats = collaboration_service.get_collaboration_stats()
    
    return {
        "user_id": current_user.id,
        "collaboration_stats": stats
    }
