# backend/ai/memory/context_builder.py
"""
Unified Context Builder - Aggregates Analytics, Planner, and Settings for the Concierge AI.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from backend.services.analytics_service import analytics_service
from backend.services.planner_service import planner_service
from backend.services.user_service import user_service
from backend.db.session import get_db
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def build_comprehensive_context(user_id: str, context_type: str = "general") -> Dict[str, Any]:
    """
    The primary entry point for the AI to 'see' all 5 pages of the app.
    """
    try:
        # 1. Fetch Analytics Data
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id)
        metrics = await analytics_service.get_realtime_metrics(user_id)
        
        # 2. Fetch Planner Data (Mission Critical: TaskCards, Habits, Goals)
        current_tasks = await planner_service.get_active_tasks(user_id)
        current_habits = await planner_service.get_user_habits(user_id)
        current_goals = await planner_service.get_goal_timeline(user_id)
        
        # 3. Fetch User Settings & Profile
        user = await user_service.get_user_by_id(int(user_id))
        user_prefs = {"preferences": {}} # Default empty structure
        if user and hasattr(user, 'preferences'):
             user_prefs["preferences"] = user.preferences

        # Base Context Object
        context = {
            "user_id": user_id,
            "generated_at": datetime.utcnow().isoformat(),
            "app_state": {
                "planner": {
                    "active_tasks": [
                        {
                            "id": t.id,
                            "title": t.title,
                            "status": t.status,
                            "priority": t.priority,
                            "due_date": t.due_date.isoformat() if t.due_date else None
                        } for t in current_tasks
                    ],
                    "habits": current_habits, # Already dicts
                    "goals": current_goals,   # Already dicts
                    "is_in_deep_work": await planner_service.is_user_in_session(user_id)
                },
                "analytics": {
                    "focus_score": metrics.focus_score if metrics and not isinstance(metrics, dict) else (metrics.get("focus_score", 50) if isinstance(metrics, dict) else 50),
                    "mood_trends": analytics_data.get("mood_summary", "stable"),
                    "recent_insights": await analytics_service.get_user_insights(user_id, limit=3)
                },
                "settings": user_prefs.get("preferences", {})
            }
        }

        # Specialized logic based on user intent
        if context_type == "planning":
            context["focus"] = await _build_planning_context(user_id, metrics, context["app_state"]["planner"])
        elif context_type == "analysis":
            context["focus"] = await _build_analysis_context(user_id, metrics, analytics_data)
        
        return context

    except Exception as e:
        logger.error(f"Failed to build comprehensive context: {str(e)}")
        return {"error": "Context unavailable", "user_id": user_id}

async def _build_planning_context(user_id: str, metrics: Any, planner_state: Dict) -> Dict[str, Any]:
    """Specific context for auto-planning components"""
    return {
        "available_slots": _calculate_free_time(planner_state["active_tasks"]),
        "completion_velocity": metrics.planning_accuracy if metrics and not isinstance(metrics, dict) else (metrics.get("planning_accuracy", 0) if isinstance(metrics, dict) else 0),
        "habit_consistency": [h["streak"] for h in planner_state["habits"]]
    }

async def _build_analysis_context(user_id: str, metrics: Any, analytics_data: Dict) -> Dict[str, Any]:
    """Specific context for Analytics page insights"""
    return {
        "cognitive_load": metrics.cognitive_load if metrics and not isinstance(metrics, dict) and hasattr(metrics, 'cognitive_load') else (metrics.get("cognitive_load", "normal") if isinstance(metrics, dict) else "normal"),
        "patterns": analytics_data.get("behavioral_patterns", []),
        "trajectories": analytics_data.get("predictive_trajectories", [])
    }

def _calculate_free_time(tasks: List[Dict]) -> List[str]:
    # Logic to find gaps in the user's schedule for Deep Work
    return ["09:00-11:00", "14:00-16:00"] # Example gaps


async def build_analytics_context(
    user_id: str,
    events: Optional[List[Dict[str, Any]]] = None,
    sessions: Optional[List[Dict[str, Any]]] = None,
    plans: Optional[List[Dict[str, Any]]] = None,
    context_type: str = "general"
) -> Dict[str, Any]:
    """
    Build context specifically for analytics AI analysis.
    """
    return {
        "user_id": user_id,
        "events_count": len(events) if events else 0,
        "sessions_count": len(sessions) if sessions else 0,
        "plans_count": len(plans) if plans else 0,
        "context_type": context_type,
        "generated_at": datetime.utcnow().isoformat()
    }