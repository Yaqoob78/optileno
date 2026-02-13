"""
Enhanced insight engine with real-time insights and AI integration.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
import asyncio

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.ai.tools.analytics import analyze_behavior_patterns, generate_ai_insight

logger = logging.getLogger(__name__)

async def generate_insights(user_id: str) -> Dict[str, Any]:
    """
    Generate comprehensive insights from all available data.
    Now includes AI-generated insights alongside rule-based ones.
    """
    try:
        # Get all necessary data
        recent_events = await analytics_service.get_recent_events(user_id, limit=50)
        latest_sessions = await planner_service.get_recent_sessions(user_id, limit=10)
        recent_plans = await planner_service.get_recent_plans(user_id, limit=5)
        habits_data = await planner_service.get_habits_overview(user_id)
        
        # Generate rule-based insights
        rule_insights = await _generate_rule_based_insights(
            user_id, recent_events, latest_sessions, recent_plans, habits_data
        )
        
        # Generate AI insights (async)
        ai_insights_task = asyncio.create_task(
            _generate_ai_insights(user_id, recent_events, latest_sessions, recent_plans)
        )
        
        # Generate metrics
        metrics = await _calculate_metrics(recent_events, latest_sessions, habits_data)
        
        # Wait for AI insights
        ai_insights = await ai_insights_task
        
        # Combine all insights
        all_insights = {
            "summary": await _generate_summary(metrics, rule_insights),
            "metrics": metrics,
            "insights": {
                "rule_based": rule_insights,
                "ai_generated": ai_insights.get("insights", []),
                "patterns": ai_insights.get("patterns", []),
            },
            "recommendations": ai_insights.get("recommendations", []),
            "focus_status": await _determine_focus_status(latest_sessions),
            "last_updated": datetime.utcnow().isoformat(),
        }
        
        logger.info(f"Generated comprehensive insights for user {user_id}")
        return all_insights
        
    except Exception as e:
        logger.error(f"Insights generation failed for user {user_id}: {str(e)}")
        return _get_fallback_insights()

async def generate_immediate_insight(user_id: str, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Generate immediate insight for a single event.
    Called right after event collection.
    """
    event_type = event.get("event", "unknown")
    metadata = event.get("metadata", {})
    
    immediate_insights = {
        "task_completed": {
            "title": "Task Completed!",
            "description": f"Great job completing '{metadata.get('task_name', 'a task')}'",
            "type": "positive",
            "action": "Take a short break before starting the next task",
        },
        "deep_work_started": {
            "title": "Deep Work Session Started",
            "description": "Focus mode activated. Minimize distractions.",
            "type": "instruction",
            "action": "Turn off notifications for the next 60 minutes",
        },
        "deep_work_completed": {
            "title": "Deep Work Completed",
            "description": f"Completed {metadata.get('duration', 0)} minutes of focused work",
            "type": "achievement",
            "action": "Take a 5-10 minute break to recharge",
        },
        "habit_completed": {
            "title": "Habit Maintained!",
            "description": f"Kept your '{metadata.get('habit_name', 'habit')}' streak alive",
            "type": "positive",
            "action": "Consistency builds momentum. Keep it up!",
        },
        "habit_streak_broken": {
            "title": "Habit Streak Reset",
            "description": "Don't worry about the streak. Focus on starting fresh tomorrow.",
            "type": "encouragement",
            "action": "Set a reminder for tomorrow to rebuild the habit",
        },
        "vent_detected": {
            "title": "Feeling Overwhelmed?",
            "description": "It's okay to feel frustrated. Let's break things down.",
            "type": "support",
            "action": "Try writing down what's overwhelming you, then prioritize",
        },
    }
    
    if event_type in immediate_insights:
        insight = immediate_insights[event_type]
        return {
            **insight,
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "context": metadata,
        }
    
    return None

async def _generate_rule_based_insights(
    user_id: str,
    recent_events: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    habits: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate rule-based insights from data"""
    insights = []
    
    # 1. Focus insights
    active_sessions = [s for s in sessions if s.get("status") == "active"]
    completed_sessions = [s for s in sessions if s.get("status") == "completed"]
    
    if active_sessions:
        insights.append({
            "id": "focus_active",
            "title": "Currently in Deep Work",
            "description": "You're in a focus session. Protect this time.",
            "type": "status",
            "severity": "info",
        })
    
    if len(completed_sessions) >= 2:
        total_duration = sum(s.get("duration", 0) for s in completed_sessions)
        insights.append({
            "id": "focus_consistency",
            "title": "Strong Focus Consistency",
            "description": f"You've completed {len(completed_sessions)} deep work sessions totaling {total_duration} minutes",
            "type": "achievement",
            "severity": "positive",
        })
    
    # 2. Planning insights
    task_events = [e for e in recent_events if e.get("event", "").startswith("task_")]
    created_tasks = [e for e in task_events if e.get("event") == "task_created"]
    completed_tasks = [e for e in task_events if e.get("event") == "task_completed"]
    
    if created_tasks and completed_tasks:
        completion_rate = len(completed_tasks) / len(created_tasks) * 100
        if completion_rate < 50:
            insights.append({
                "id": "low_completion",
                "title": "Low Task Completion Rate",
                "description": f"Only {completion_rate:.0f}% of planned tasks are being completed",
                "type": "warning",
                "severity": "medium",
                "action": "Consider planning fewer tasks with higher priority",
            })
    
    # 3. Habit insights
    if habits:
        streak = habits.get("longest_streak", 0)
        if streak >= 7:
            insights.append({
                "id": "habit_streak",
                "title": "Impressive Habit Streak!",
                "description": f"You've maintained a {streak}-day streak. Consistency is key!",
                "type": "achievement",
                "severity": "positive",
            })
    
    # 4. Time-based insights
    morning_events = [e for e in recent_events if _is_morning_event(e)]
    evening_events = [e for e in recent_events if _is_evening_event(e)]
    
    if len(morning_events) > len(evening_events) * 2:
        insights.append({
            "id": "morning_productivity",
            "title": "Morning Person Detected",
            "description": "You're most productive in the mornings. Schedule important tasks then.",
            "type": "pattern",
            "severity": "info",
        })
    
    return insights

async def _generate_ai_insights(
    user_id: str,
    events: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
    plans: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate AI-powered insights"""
    try:
        return await analyze_behavior_patterns(
            user_id=user_id,
            events=events,
            sessions=sessions,
            plans=plans
        )
    except Exception as e:
        logger.warning(f"AI insights failed, using fallback: {e}")
        return {
            "insights": [],
            "patterns": [],
            "recommendations": [
                "Review your task completion patterns",
                "Schedule focus sessions during your peak hours",
                "Break large goals into weekly milestones"
            ]
        }

async def _calculate_metrics(
    events: List[Dict[str, Any]],
    sessions: List[Dict[str, Any]],
    habits: Dict[str, Any]
) -> Dict[str, Any]:
    """Calculate comprehensive metrics"""
    # Focus metrics
    completed_sessions = [s for s in sessions if s.get("status") == "completed"]
    total_focus_time = sum(s.get("duration", 0) for s in completed_sessions)
    avg_session_length = total_focus_time / len(completed_sessions) if completed_sessions else 0
    
    # Planning metrics
    task_events = [e for e in events if e.get("event", "").startswith("task_")]
    created_tasks = [e for e in task_events if e.get("event") == "task_created"]
    completed_tasks = [e for e in task_events if e.get("event") == "task_completed"]
    completion_rate = len(completed_tasks) / len(created_tasks) * 100 if created_tasks else 0
    
    # Consistency metrics
    habit_streak = habits.get("current_streak", 0)
    habit_consistency = habits.get("consistency_rate", 0)
    
    return {
        "focus": {
            "total_sessions": len(completed_sessions),
            "total_duration_minutes": total_focus_time,
            "average_session_minutes": avg_session_length,
            "score": min(100, len(completed_sessions) * 10 + total_focus_time / 60),
        },
        "planning": {
            "tasks_created": len(created_tasks),
            "tasks_completed": len(completed_tasks),
            "completion_rate": completion_rate,
            "accuracy": 75,  # This would need planned vs actual duration data
        },
        "consistency": {
            "habit_streak": habit_streak,
            "habit_consistency": habit_consistency,
            "routine_score": min(100, habit_streak * 5 + habit_consistency),
        },
        "wellbeing": {
            "burnout_risk": _calculate_burnout_risk(events, sessions),
            "engagement_score": _calculate_engagement(events),
            "balance_score": 65,  # Work-life balance estimate
        }
    }

async def _generate_summary(metrics: Dict[str, Any], insights: List[Dict[str, Any]]) -> str:
    """Generate overall summary"""
    focus_score = metrics["focus"]["score"]
    completion_rate = metrics["planning"]["completion_rate"]
    
    if focus_score > 70 and completion_rate > 70:
        return "Excellent productivity day! You're maintaining strong focus and completing most tasks."
    elif focus_score > 50 and completion_rate > 50:
        return "Good progress today. Consistent focus and task completion."
    else:
        return "Room for improvement. Consider adjusting your planning or focus strategies."

async def _determine_focus_status(sessions: List[Dict[str, Any]]) -> str:
    """Determine current focus status"""
    active_sessions = [s for s in sessions if s.get("status") == "active"]
    if active_sessions:
        return "in_focus"
    
    recent_sessions = [s for s in sessions if _is_recent(s.get("ended_at"))]
    if recent_sessions:
        return "recently_focused"
    
    return "available"

def _is_morning_event(event: Dict[str, Any]) -> bool:
    """Check if event happened in morning (6am-12pm)"""
    timestamp = event.get("timestamp")
    if not timestamp:
        return False
    try:
        hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        return 6 <= hour < 12
    except:
        return False

def _is_evening_event(event: Dict[str, Any]) -> bool:
    """Check if event happened in evening (6pm-12am)"""
    timestamp = event.get("timestamp")
    if not timestamp:
        return False
    try:
        hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        return 18 <= hour < 24
    except:
        return False

def _is_recent(timestamp: Optional[str], minutes: int = 30) -> bool:
    """Check if timestamp is within last N minutes"""
    if not timestamp:
        return False
    try:
        event_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return (datetime.utcnow() - event_time).total_seconds() < minutes * 60
    except:
        return False

def _calculate_burnout_risk(events: List[Dict[str, Any]], sessions: List[Dict[str, Any]]) -> float:
    """Calculate burnout risk score (0-100)"""
    risk = 0
    
    # Long work sessions increase risk
    long_sessions = [s for s in sessions if s.get("duration", 0) > 120]
    risk += len(long_sessions) * 10
    
    # Venting events increase risk
    vent_events = [e for e in events if e.get("event") == "vent_detected"]
    risk += len(vent_events) * 15
    
    # Late night work increases risk
    late_events = [e for e in events if _is_late_night_event(e)]
    risk += len(late_events) * 5
    
    return min(100, risk)

def _calculate_engagement(events: List[Dict[str, Any]]) -> float:
    """Calculate engagement score (0-100)"""
    if not events:
        return 0
    
    recent_events = [e for e in events if _is_recent(e.get("timestamp"), hours=24)]
    event_count = len(recent_events)
    
    # Different event types indicate higher engagement
    event_types = set(e.get("event") for e in recent_events)
    diversity_score = len(event_types) * 5
    
    return min(100, event_count * 2 + diversity_score)

def _is_late_night_event(event: Dict[str, Any]) -> bool:
    """Check if event happened late at night (10pm-4am)"""
    timestamp = event.get("timestamp")
    if not timestamp:
        return False
    try:
        hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        return hour >= 22 or hour < 4
    except:
        return False

def _get_fallback_insights() -> Dict[str, Any]:
    """Return fallback insights when generation fails"""
    return {
        "summary": "Starting fresh. Log your first task or focus session to get personalized insights.",
        "metrics": {
            "focus": {"score": 0, "sessions_today": 0, "total_duration": 0},
            "planning": {"tasks_created": 0, "tasks_completed": 0, "completion_rate": 0},
            "consistency": {"habit_streak": 0, "habit_consistency": 0},
        },
        "insights": {
            "rule_based": [],
            "ai_generated": [],
            "patterns": [],
        },
        "recommendations": [
            "Plan your first task for today",
            "Try a 25-minute focus session",
            "Set up a daily habit to track"
        ],
        "focus_status": "available",
        "last_updated": datetime.utcnow().isoformat(),
    }