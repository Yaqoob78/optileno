# backend/ai/tools/__init__.py
"""
Tool registry for AI actions.
"""

from typing import Dict, Any, Callable
import logging

logger = logging.getLogger(__name__)

# Tool registry
TOOL_REGISTRY: Dict[str, Callable] = {}

def register_tool(name: str):
    """Decorator to register a tool"""
    def decorator(func):
        TOOL_REGISTRY[name] = func
        logger.info(f"Registered tool: {name}")
        return func
    return decorator

# Import and register all tools
from backend.ai.tools.analytics import log_event as analytics_log_event
from backend.ai.tools.planner import create_plan, start_deep_work, create_task, complete_task, track_habit
from backend.ai.tools.analytics import (
    analyze_behavior_patterns, 
    generate_ai_insight, 
    predict_user_trajectory
)
from backend.ai.tools.goal_automation import (
    create_goal_with_cascade,
    detect_goal_intent,
    get_recommended_habits,
    get_planner_dashboard,
)

# Register tools - Core AI Agent Tools (Primary)
TOOL_REGISTRY["CREATE_GOAL"] = create_goal_with_cascade
TOOL_REGISTRY["CREATE_TASK"] = create_task
TOOL_REGISTRY["CREATE_HABIT"] = track_habit  # Use track_habit for habit creation
TOOL_REGISTRY["START_DEEP_WORK"] = start_deep_work

# Register tools - Analytics Tools
TOOL_REGISTRY["ANALYTICS_LOG_EVENT"] = analytics_log_event
TOOL_REGISTRY["ANALYTICS_ANALYZE_PATTERNS"] = analyze_behavior_patterns
TOOL_REGISTRY["ANALYTICS_GENERATE_INSIGHT"] = generate_ai_insight
TOOL_REGISTRY["ANALYTICS_PREDICT_TRAJECTORY"] = predict_user_trajectory

# Register tools - New Planner Tools (Primary)
try:
    from backend.ai.tools.planner_tools import PlannerToolSet

    # Core agent tools - these are the primary ones used by AI
    primary_tools = {
        "GET_TASKS": PlannerToolSet.get_tasks,
        "GET_GOALS": PlannerToolSet.get_goals,
        "GET_HABITS": PlannerToolSet.get_habits,
        "GET_PLANNER_STATS": PlannerToolSet.get_planner_stats,
        "GET_DAILY_ACHIEVEMENT_SCORE": PlannerToolSet.get_daily_achievement_score,
        "GET_GOAL_PROGRESS_REPORT": PlannerToolSet.get_goal_progress_report,
        "GET_GOAL_TIMELINE": PlannerToolSet.get_goal_timeline,
        "CREATE_TASK": PlannerToolSet.create_task,  # Override legacy
        "CREATE_GOAL": PlannerToolSet.create_goal,  # Override legacy
        "CREATE_HABIT": PlannerToolSet.create_habit,  # Override legacy
        "DELETE_TASK": PlannerToolSet.delete_task,
        "DELETE_GOAL": PlannerToolSet.delete_goal,
        "DELETE_HABIT": PlannerToolSet.delete_habit,
        "UPDATE_TASK_STATUS": PlannerToolSet.update_task_status,
        "UPDATE_GOAL_PROGRESS": PlannerToolSet.update_goal_progress,
        "COMPLETE_HABIT": PlannerToolSet.complete_habit,
        "START_DEEP_WORK": PlannerToolSet.start_deep_work_session,  # Override legacy
        "CREATE_GOAL_CASCADE": PlannerToolSet.create_goal_with_cascade,  # Override legacy
    }

    # Register primary tools (will override any duplicates)
    for tool_name, tool_func in primary_tools.items():
        TOOL_REGISTRY[tool_name] = tool_func

    logger.info(f"Registered {len(primary_tools)} primary AI agent tools")
except ImportError as e:
    logger.warning(f"Could not import planner tools: {e}")

logger.info(f"Total registered tools: {len(TOOL_REGISTRY)}")
