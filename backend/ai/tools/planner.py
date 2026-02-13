# backend/ai/tools/planner.py
"""
Planner tools for AI - now with analytics integration and focus score tracking.
"""
# Helper to allow AI to find items by name if ID is missing
async def resolve_task_id(user_id: str, identifier: str) -> str:
    if identifier.startswith("task_"): return identifier
    # Logic to fetch from planner_service.get_all_tasks and match title
    return await planner_service.find_task_by_title(user_id, identifier)

from typing import Dict, Any
import logging
from datetime import datetime, date

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.realtime.socket_manager import (
    broadcast_task_created,
    broadcast_task_updated,
    broadcast_plan_generated,
    broadcast_focus_score_updated,
    broadcast_habit_completed,
    broadcast_deep_work_started,
)

logger = logging.getLogger(__name__)


async def _trigger_focus_recalculation(user_id: str):
    """Trigger focus score recalculation and broadcast update."""
    try:
        from backend.services.focus_score_service import focus_score_service
        score_data = await focus_score_service.calculate_daily_score(int(user_id), date.today())
        await broadcast_focus_score_updated(int(user_id), score_data)
        logger.debug(f"Focus score recalculated for user {user_id}: {score_data['score']}%")
    except Exception as e:
        logger.error(f"Failed to recalculate focus score: {e}")

async def create_plan(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a plan with analytics tracking"""
    try:
        # Extract plan details from payload
        plan_data = {
            "name": payload.get("name", "Daily Plan"),
            "description": payload.get("description", ""),
            "plan_type": payload.get("plan_type", "daily"),
            "date": datetime.utcnow().isoformat(),
            "focus_areas": payload.get("focus_areas", []),
        }
        
        # Create plan via service
        plan = await planner_service.create_plan(user_id, plan_data)
        
        # Broadcast plan generation
        try:
            # Plan is SQLAlchemy object, convert to dict loosely
            plan_dict = {
                "id": plan.id,
                "date": plan.date.isoformat() if plan.date else None,
                "focus_areas": plan.focus_areas,
                "status": plan.status
            }
            await broadcast_plan_generated(int(user_id), plan_dict)
        except Exception as e:
            logger.error(f"Failed to broadcast plan generation: {e}")
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "plan_created",
            "source": "ai_planner",
            "metadata": {
                "plan_id": plan.id if hasattr(plan, 'id') else None,
                "plan_type": plan_data["plan_type"],
                "focus_areas": plan_data["focus_areas"],
                "ai_generated": True,
            }
        })
        
        logger.info(f"Plan created for user {user_id}")
        
        return {
            "status": "success",
            "plan_id": getattr(plan, 'id', None),
            "message": "Plan created successfully",
        }
        
    except Exception as e:
        logger.error(f"Failed to create plan for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
        }

async def start_deep_work(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Start deep work session with analytics"""
    try:
        # Start deep work via planner service
        session = await planner_service.start_deep_work_session(
            user_id=user_id,
            duration=payload.get("duration", 60),
            focus_area=payload.get("focus_area", "general"),
        )
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "deep_work_started",
            "source": "ai_planner",
            "metadata": {
                "session_id": session.id if hasattr(session, 'id') else None,
                "duration": payload.get("duration", 60),
                "focus_area": payload.get("focus_area", "general"),
                "started_at": datetime.utcnow().isoformat(),
            }
        })
        
        logger.info(f"Deep work started for user {user_id}")
        
        return {
            "status": "success",
            "session_id": getattr(session, 'id', None),
            "message": "Deep work session started",
        }
        
    except Exception as e:
        logger.error(f"Failed to start deep work for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
        }

async def complete_task(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Complete a task with analytics"""
    try:
        task_id = payload.get("task_id")
        if not task_id:
            return {"status": "error", "message": "task_id required"}
        
        # Complete task via planner service
        task = await planner_service.complete_task(user_id, task_id)
        
        # Broadcast update to frontend
        try:
            # Task object from service is SQLAlchemy model, need to convert to dict
            task_dict = {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "priority": task.priority,
            }
            await broadcast_task_updated(int(user_id), task_dict)
        except Exception as e:
            logger.error(f"Failed to broadcast task completion: {e}")
        
        # Calculate actual duration if available
        actual_duration = payload.get("actual_duration")
        planned_duration = None
        
        # Try to get planned duration from task
        if hasattr(task, 'estimated_minutes'):
            planned_duration = task.estimated_minutes
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "task_completed",
            "source": "ai_planner",
            "metadata": {
                "task_id": task_id,
                "task_name": getattr(task, 'title', 'Unknown'),
                "planned_duration": planned_duration,
                "actual_duration": actual_duration,
                "delay": (actual_duration - planned_duration) if actual_duration and planned_duration else None,
                "completed_at": datetime.utcnow().isoformat(),
            }
        })
        
        # Trigger focus score recalculation (real-time heatmap update)
        await _trigger_focus_recalculation(user_id)
        
        logger.info(f"Task {task_id} completed for user {user_id}")
        
        return {
            "status": "success",
            "task_id": task_id,
            "message": "Task completed successfully",
        }
        
    except Exception as e:
        logger.error(f"Failed to complete task for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
        }

async def track_habit(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Track habit completion with analytics"""
    try:
        habit_id = payload.get("habit_id")
        habit_name = payload.get("habit_name", "Unknown Habit")
        
        # Track habit via planner service
        result = await planner_service.track_habit(user_id, habit_id)
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "habit_completed",
            "source": "ai_planner",
            "metadata": {
                "habit_id": habit_id,
                "habit_name": habit_name,
                "streak": result.get("streak", 0),
                "completed_at": datetime.utcnow().isoformat(),
            }
        })
        
        # Broadcast habit completion
        try:
            await broadcast_habit_completed(int(user_id), {"habit_id": habit_id, "streak": result.get("streak", 0)})
        except Exception as e:
            logger.error(f"Failed to broadcast habit completion: {e}")
        
        # Trigger focus score recalculation (real-time heatmap update)
        await _trigger_focus_recalculation(user_id)
        
        logger.info(f"Habit {habit_id} tracked for user {user_id}")
        
        return {
            "status": "success",
            "habit_id": habit_id,
            "streak": result.get("streak", 0),
            "message": "Habit tracked successfully",
        }
        
    except Exception as e:
        logger.error(f"Failed to track habit for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
        }

async def create_task(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a task via AI."""
    try:
        # Create task via service
        task = await planner_service.create_task(user_id, {
            "title": payload.get("title", payload.get("name", "New Task")),
            "description": payload.get("description"),
            "priority": payload.get("priority", "medium"),
            "category": payload.get("category"),
            "estimated_minutes": payload.get("estimated_minutes"),
            "due_date": payload.get("due_date"),
        })
        
        if "error" in task:
            raise Exception(task["error"])
            
        # Broadcast update to frontend
        try:
            await broadcast_task_created(int(user_id), task)
        except Exception as e:
            logger.error(f"Failed to broadcast task creation: {e}")
            
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "task_created",
            "source": "ai_planner",
            "metadata": {
                "task_id": task.get("id"),
                "task_title": task.get("title"),
                "ai_generated": True,
            }
        })
        
        logger.info(f"Task created via AI for user {user_id}")
        
        return {
            "status": "success",
            "task_id": task.get("id"),
            "task": task,
            "message": f"Task '{task.get('title')}' created successfully",
        }
        
    except Exception as e:
        logger.error(f"Failed to create task for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
        }