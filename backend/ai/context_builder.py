# backend/ai/context_builder.py
"""
AI Context Builder - Provides COMPLETE access to user's productivity data.

This module constructs the full context that the AI agent needs to:
1. Understand user's current goals and progress
2. Access all tasks (active, overdue, completed)
3. View habit tracking and streaks
4. Analyze productivity patterns
5. Provide data-backed recommendations
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import logging

from backend.db.database import get_db
from backend.db.models import (
    User, Task, Goal, Plan, 
    RealTimeMetrics, AnalyticsEvent, UserInsight, 
    BehavioralPattern, FocusScore
)
from sqlalchemy import desc, and_, or_

logger = logging.getLogger(__name__)


class AIContextBuilder:
    """
    Builds comprehensive context for AI agent.
    
    The AI needs REAL data to provide REAL value.
    This class aggregates all user data into a structured context.
    """
    
    async def build_full_context(self, user_id: str) -> Dict[str, Any]:
        """
        Build complete context for AI agent.
        
        This is the MOST IMPORTANT method - it gives AI full visibility.
        Catches errors in individual components to ensure partial context is better than none.
        """
        context = {
            "context_generated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Helper to safely fetch context components
        async def fetch_safely(key, awaitable, default):
            try:
                return await awaitable
            except Exception as e:
                logger.error(f"Failed to fetch context component '{key}': {e}")
                return default

        # Core planner data
        context["goals"] = await fetch_safely("goals", self._get_goals_context(user_id), {"total": 0, "list": []})
        context["goal_timeline"] = await fetch_safely("goal_timeline", self._get_goal_timeline(user_id), [])
        context["tasks"] = await fetch_safely("tasks", self._get_tasks_context(user_id), {"total": 0, "pending": []})
        context["habits"] = await fetch_safely("habits", self._get_habits_context(user_id), {"total": 0, "list": []})
        context["goal_task_relationships"] = await fetch_safely("goal_task_relationships", self._get_goal_task_relationships(user_id), [])

        # Analytics data (Likely source of errors if tables missing)
        context["productivity"] = await fetch_safely("productivity", self._get_productivity_context(user_id), {})
        context["patterns"] = await fetch_safely("patterns", self._get_patterns_context(user_id), [])
        context["insights"] = await fetch_safely("insights", self._get_recent_insights(user_id), [])
        context["daily_achievement_score"] = await fetch_safely("daily_achievement_score", self._get_daily_achievement_score_context(user_id), {})

        # Timeline & history
        context["recent_activity"] = await fetch_safely("recent_activity", self._get_recent_activity(user_id), [])
        context["upcoming"] = await fetch_safely("upcoming", self._get_upcoming_items(user_id), {})

        # Summary stats (depends on mostly core tables)
        context["summary"] = await fetch_safely("summary", self._get_summary_stats(user_id), {})

        return context

    async def _get_daily_achievement_score_context(self, user_id: str) -> Dict[str, Any]:
        """Fetch daily score safely."""
        try:
            from backend.services.goal_analytics_service import goal_analytics_service
            return await goal_analytics_service.get_daily_achievement_score(user_id)
        except Exception:
            return {}
    
    async def _get_goals_context(self, user_id: str) -> Dict[str, Any]:
        """Get all goals with progress and linked items."""
        with next(get_db()) as db:
            goals = db.query(Goal).filter(
                Goal.user_id == int(user_id)
            ).order_by(desc(Goal.created_at)).all()
            
            goals_data = []
            for goal in goals:
                # Calculate days remaining
                days_remaining = None
                if goal.target_date:
                    delta = goal.target_date - datetime.now(timezone.utc)
                    days_remaining = max(0, delta.days)
                
                # Get linked tasks count - Updated to use proper relationship
                linked_tasks = db.query(Task).filter(
                    Task.user_id == int(user_id),
                    Task.goal_id == goal.id  # Assuming there's a goal_id foreign key
                ).all()
                
                # If no direct relationship exists, try tags as fallback
                if not linked_tasks and hasattr(Task, 'tags'):
                    linked_tasks = db.query(Task).filter(
                        Task.user_id == int(user_id),
                        Task.tags.contains([f"goal:{goal.id}"])
                    ).all()
                
                completed_tasks = [t for t in linked_tasks if t.status == 'completed']
                
                goals_data.append({
                    "id": goal.id,
                    "title": goal.title,
                    "description": goal.description,
                    "category": goal.category,
                    "progress": goal.current_progress or 0,
                    "target_date": goal.target_date.isoformat() if goal.target_date else None,
                    "days_remaining": days_remaining,
                    "milestones": goal.milestones or [],
                    "linked_tasks_count": len(linked_tasks),
                    "completed_tasks_count": len(completed_tasks),
                    "status": self._calculate_goal_status(goal, days_remaining),
                    "ai_suggestions": goal.ai_suggestions or [],
                    "created_at": goal.created_at.isoformat() if goal.created_at else None,
                })
            
            return {
                "total": len(goals_data),
                "active": [g for g in goals_data if g["progress"] < 100],
                "completed": [g for g in goals_data if g["progress"] >= 100],
                "list": goals_data,
            }
    
    async def _get_goal_timeline(self, user_id: str) -> List[Dict[str, Any]]:
        """Get goals organized by timeline (deadlines)."""
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            
            goals = db.query(Goal).filter(
                Goal.user_id == int(user_id),
                Goal.current_progress < 100
            ).order_by(Goal.target_date).all()
            
            timeline = []
            for goal in goals:
                if goal.target_date:
                    delta = goal.target_date - now
                    days = delta.days
                    
                    urgency = "normal"
                    if days < 0:
                        urgency = "overdue"
                    elif days <= 3:
                        urgency = "critical"
                    elif days <= 7:
                        urgency = "soon"
                    
                    timeline.append({
                        "goal_id": goal.id,
                        "title": goal.title,
                        "target_date": goal.target_date.isoformat(),
                        "days_remaining": days,
                        "progress": goal.current_progress or 0,
                        "urgency": urgency,
                    })
            
            return timeline
    
    async def _get_tasks_context(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive task context."""
        with next(get_db()) as db:
            all_tasks = db.query(Task).filter(
                Task.user_id == int(user_id)
            ).order_by(desc(Task.created_at)).limit(100).all()

            now = datetime.now(timezone.utc)
            today = now.date()

            # Categorize tasks
            pending = []
            in_progress = []
            completed_today = []
            overdue = []

            for task in all_tasks:
                # Get associated goal if exists
                associated_goal = None
                if hasattr(task, 'goal_id') and task.goal_id:
                    goal = db.query(Goal).filter(Goal.id == task.goal_id).first()
                    if goal:
                        associated_goal = {
                            "id": goal.id,
                            "title": goal.title,
                            "progress": goal.current_progress or 0
                        }
                
                task_data = {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status,
                    "priority": task.priority,
                    "category": task.category,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "estimated_minutes": task.estimated_minutes,
                    "tags": task.tags if hasattr(task, 'tags') else [],
                    "associated_goal": associated_goal,
                }

                if task.status == 'pending':
                    if task.due_date and task.due_date.date() < today:
                        overdue.append(task_data)
                    else:
                        pending.append(task_data)
                elif task.status == 'in_progress':
                    in_progress.append(task_data)
                elif task.status == 'completed':
                    if task.completed_at and task.completed_at.date() == today:
                        completed_today.append(task_data)

            # Today's tasks
            today_tasks = [t for t in pending + in_progress
                          if t.get("due_date") and t["due_date"].startswith(today.isoformat())]

            return {
                "total": len(all_tasks),
                "pending": pending[:20],  # Limit for context size
                "in_progress": in_progress,
                "completed_today": completed_today,
                "overdue": overdue,
                "today": today_tasks,
                "counts": {
                    "pending": len(pending),
                    "in_progress": len(in_progress),
                    "completed_today": len(completed_today),
                    "overdue": len(overdue),
                }
            }
    
    async def _get_habits_context(self, user_id: str) -> Dict[str, Any]:
        """Get habits with streak information."""
        with next(get_db()) as db:
            # Habits are stored as Plans with plan_type='habit'
            habits = db.query(Plan).filter(
                Plan.user_id == int(user_id),
                Plan.plan_type == 'habit'
            ).all()
            
            habits_data = []
            for habit in habits:
                schedule = habit.schedule or {}
                
                habits_data.append({
                    "id": habit.id,
                    "name": habit.name,
                    "description": habit.description,
                    "frequency": schedule.get("frequency", "daily"),
                    "streak": schedule.get("streak", 0),
                    "best_streak": schedule.get("bestStreak", 0),
                    "completed_today": schedule.get("completedToday", False),
                    "last_completed": schedule.get("lastCompleted"),
                    "total_completions": schedule.get("completedCount", 0),
                    "category": habit.focus_areas[0] if habit.focus_areas else "General",
                })
            
            # Calculate habit stats
            completed_today = [h for h in habits_data if h["completed_today"]]
            active_streaks = [h for h in habits_data if h["streak"] > 0]
            
            return {
                "total": len(habits_data),
                "list": habits_data,
                "completed_today": len(completed_today),
                "due_today": len(habits_data) - len(completed_today),
                "active_streaks": len(active_streaks),
                "longest_streak": max((h["streak"] for h in habits_data), default=0),
                "average_streak": sum(h["streak"] for h in habits_data) / len(habits_data) if habits_data else 0,
            }
    
    async def _get_productivity_context(self, user_id: str) -> Dict[str, Any]:
        """Get productivity metrics."""
        with next(get_db()) as db:
            metrics = db.query(RealTimeMetrics).filter(
                RealTimeMetrics.user_id == int(user_id)
            ).first()
            
            if not metrics:
                return {
                    "focus_score": 0,
                    "productivity_score": 0,
                    "burnout_risk": 0,
                    "tasks_completed_today": 0,
                    "habits_completed_today": 0,
                }
            
            # Get recent focus sessions
            focus_scores = db.query(FocusScore).filter(
                FocusScore.user_id == int(user_id),
                FocusScore.date >= datetime.now(timezone.utc) - timedelta(days=7)
            ).all()
            
            weekly_focus_avg = sum(f.score for f in focus_scores) / len(focus_scores) if focus_scores else 0
            
            return {
                "focus_score": metrics.focus_score,
                "focus_sessions_today": metrics.focus_sessions_today,
                "total_focus_minutes": metrics.total_focus_minutes,
                "tasks_completed_today": metrics.tasks_completed_today,
                "habits_completed_today": metrics.habits_completed_today,
                "habit_streak": metrics.current_habit_streak,
                "burnout_risk": metrics.burnout_risk,
                "engagement_score": metrics.engagement_score,
                "weekly_focus_average": round(weekly_focus_avg, 1),
                "last_updated": metrics.updated_at.isoformat() if metrics.updated_at else None,
            }
    
    async def _get_patterns_context(self, user_id: str) -> List[Dict[str, Any]]:
        """Get detected behavioral patterns."""
        with next(get_db()) as db:
            patterns = db.query(BehavioralPattern).filter(
                BehavioralPattern.user_id == int(user_id)
            ).order_by(desc(BehavioralPattern.last_detected)).limit(10).all()
            
            return [
                {
                    "type": p.pattern_type,
                    "event_type": p.event_type,
                    "frequency": p.frequency,
                    "significance": p.significance,
                    "meta": p.meta,
                }
                for p in patterns
            ]
    
    async def _get_recent_insights(self, user_id: str) -> List[Dict[str, Any]]:
        """Get recent AI-generated insights."""
        with next(get_db()) as db:
            insights = db.query(UserInsight).filter(
                UserInsight.user_id == int(user_id),
                UserInsight.dismissed_at.is_(None)
            ).order_by(desc(UserInsight.generated_at)).limit(5).all()
            
            return [
                {
                    "title": i.title,
                    "description": i.description,
                    "type": i.insight_type,
                    "category": i.category,
                    "severity": i.severity,
                    "action_items": i.action_items,
                }
                for i in insights
            ]
    
    async def _get_recent_activity(self, user_id: str) -> List[Dict[str, Any]]:
        """Get recent user activity for context."""
        with next(get_db()) as db:
            events = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.user_id == int(user_id),
                AnalyticsEvent.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24)
            ).order_by(desc(AnalyticsEvent.timestamp)).limit(20).all()
            
            return [
                {
                    "type": e.event_type,
                    "source": e.event_source,
                    "category": e.category,
                    "timestamp": e.timestamp.isoformat(),
                    "meta": e.meta,
                }
                for e in events
            ]
    
    async def _get_upcoming_items(self, user_id: str) -> Dict[str, Any]:
        """Get upcoming deadlines and tasks."""
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            next_week = now + timedelta(days=7)
            
            # Upcoming tasks
            upcoming_tasks = db.query(Task).filter(
                Task.user_id == int(user_id),
                Task.status.in_(['pending', 'in_progress']),
                Task.due_date >= now,
                Task.due_date <= next_week
            ).order_by(Task.due_date).limit(10).all()
            
            # Upcoming goal deadlines
            upcoming_goals = db.query(Goal).filter(
                Goal.user_id == int(user_id),
                Goal.current_progress < 100,
                Goal.target_date >= now,
                Goal.target_date <= next_week
            ).order_by(Goal.target_date).all()
            
            return {
                "tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "due_date": t.due_date.isoformat() if t.due_date else None,
                        "priority": t.priority,
                    }
                    for t in upcoming_tasks
                ],
                "goal_deadlines": [
                    {
                        "id": g.id,
                        "title": g.title,
                        "target_date": g.target_date.isoformat() if g.target_date else None,
                        "progress": g.current_progress,
                    }
                    for g in upcoming_goals
                ],
            }
    
    async def _get_summary_stats(self, user_id: str) -> Dict[str, Any]:
        """Get quick summary statistics for AI context."""
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            today = now.date()
            week_ago = now - timedelta(days=7)
            
            # Count various items
            total_goals = db.query(Goal).filter(Goal.user_id == int(user_id)).count()
            active_goals = db.query(Goal).filter(
                Goal.user_id == int(user_id),
                Goal.current_progress < 100
            ).count()
            
            total_tasks = db.query(Task).filter(Task.user_id == int(user_id)).count()
            pending_tasks = db.query(Task).filter(
                Task.user_id == int(user_id),
                Task.status == 'pending'
            ).count()
            
            completed_this_week = db.query(Task).filter(
                Task.user_id == int(user_id),
                Task.status == 'completed',
                Task.completed_at >= week_ago
            ).count()
            
            return {
                "total_goals": total_goals,
                "active_goals": active_goals,
                "total_tasks": total_tasks,
                "pending_tasks": pending_tasks,
                "completed_this_week": completed_this_week,
                "current_date": today.isoformat(),
                "current_time": now.strftime("%H:%M"),
                "day_of_week": now.strftime("%A"),
            }
    
    async def _get_goal_task_relationships(self, user_id: str) -> List[Dict[str, Any]]:
        """Get detailed relationships between goals and tasks."""
        with next(get_db()) as db:
            relationships = []
            
            # Get all goals for the user
            goals = db.query(Goal).filter(Goal.user_id == int(user_id)).all()
            
            for goal in goals:
                # Find tasks associated with this goal
                associated_tasks = db.query(Task).filter(
                    Task.user_id == int(user_id),
                    Task.goal_id == goal.id
                ).all()
                
                # If no direct relationship exists, try to find by tags
                if not associated_tasks and hasattr(Task, 'tags'):
                    associated_tasks = db.query(Task).filter(
                        Task.user_id == int(user_id),
                        Task.tags.contains([f"goal:{goal.id}"])
                    ).all()
                
                # Also check for tasks that might reference the goal in description
                if not associated_tasks:
                    associated_tasks = db.query(Task).filter(
                        Task.user_id == int(user_id),
                        Task.description.ilike(f"%{goal.title}%")
                    ).all()
                
                task_breakdown = {
                    "goal_id": goal.id,
                    "goal_title": goal.title,
                    "goal_description": goal.description,
                    "goal_category": goal.category,
                    "goal_target_date": goal.target_date.isoformat() if goal.target_date else None,
                    "goal_progress": goal.current_progress or 0,
                    "total_tasks": len(associated_tasks),
                    "completed_tasks": len([t for t in associated_tasks if t.status == 'completed']),
                    "pending_tasks": len([t for t in associated_tasks if t.status == 'pending']),
                    "in_progress_tasks": len([t for t in associated_tasks if t.status == 'in_progress']),
                    "tasks": []
                }
                
                for task in associated_tasks:
                    task_breakdown["tasks"].append({
                        "id": task.id,
                        "title": task.title,
                        "description": task.description,
                        "status": task.status,
                        "priority": task.priority,
                        "due_date": task.due_date.isoformat() if task.due_date else None,
                        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                        "estimated_minutes": task.estimated_minutes,
                        "tags": task.tags if hasattr(task, 'tags') else []
                    })
                
                # Calculate goal health based on task completion
                if task_breakdown["total_tasks"] > 0:
                    completion_rate = task_breakdown["completed_tasks"] / task_breakdown["total_tasks"]
                    task_breakdown["completion_rate"] = completion_rate
                    
                    # Assess if goal is on track based on task progress
                    if completion_rate >= (goal.current_progress or 0) / 100:
                        task_breakdown["status"] = "on_track"
                    elif completion_rate >= (goal.current_progress or 0) / 100 * 0.8:
                        task_breakdown["status"] = "slightly_behind"
                    else:
                        task_breakdown["status"] = "at_risk"
                else:
                    task_breakdown["completion_rate"] = 0
                    task_breakdown["status"] = "no_tasks_yet"
                
                relationships.append(task_breakdown)
            
            return relationships

    def _calculate_goal_status(self, goal: Goal, days_remaining: Optional[int]) -> str:
        """Calculate goal health status."""
        progress = goal.current_progress or 0

        if progress >= 100:
            return "completed"

        if days_remaining is None:
            return "active"

        if days_remaining < 0:
            return "overdue"

        # Calculate expected progress based on time elapsed
        if goal.target_date and goal.created_at:
            total_days = (goal.target_date - goal.created_at).days
            elapsed_days = total_days - days_remaining

            if total_days > 0:
                expected_progress = (elapsed_days / total_days) * 100

                if progress >= expected_progress:
                    return "on_track"
                elif progress >= expected_progress * 0.7:
                    return "slightly_behind"
                else:
                    return "at_risk"

        return "active"
    
    def format_for_prompt(self, context: Dict[str, Any]) -> str:
        """Format context into a readable string for AI prompt."""
        lines = []

        # Summary
        summary = context.get("summary", {})
        lines.append(f"📊 CURRENT STATUS ({summary.get('day_of_week', 'Today')}, {summary.get('current_time', '')}):")
        lines.append(f"  - Active Goals: {summary.get('active_goals', 0)}/{summary.get('total_goals', 0)}")
        lines.append(f"  - Pending Tasks: {summary.get('pending_tasks', 0)}/{summary.get('total_tasks', 0)}")
        lines.append(f"  - Completed This Week: {summary.get('completed_this_week', 0)}")
        lines.append("")

        # Goals
        goals = context.get("goals", {})
        if goals.get("active"):
            lines.append("🎯 ACTIVE GOALS:")
            for goal in goals["active"][:5]:
                status_emoji = "✅" if goal["status"] == "on_track" else "⚠️" if goal["status"] == "at_risk" else "📌"
                lines.append(f"  {status_emoji} {goal['title']} - {goal['progress']}% complete")
                if goal["days_remaining"] is not None:
                    lines.append(f"     └─ {goal['days_remaining']} days remaining")
            lines.append("")

        # Goal-Task Relationships
        goal_task_relationships = context.get("goal_task_relationships", [])
        if goal_task_relationships:
            lines.append("🔗 GOAL-TASK RELATIONSHIPS:")
            for rel in goal_task_relationships[:3]:  # Limit to top 3 for brevity
                lines.append(f"  🎯 {rel['goal_title']} ({rel['completed_tasks']}/{rel['total_tasks']} tasks completed) - {rel['status'].replace('_', ' ').title()}")
                for task in rel.get("tasks", [])[:3]:  # Limit to top 3 tasks per goal
                    status_icon = "✅" if task["status"] == "completed" else "🔄" if task["status"] == "in_progress" else "📋"
                    lines.append(f"    {status_icon} {task['title']} ({task['status']})")
                
                # Add completion rate info
                if rel.get("completion_rate") is not None:
                    lines.append(f"     └─ Task completion rate: {rel['completion_rate']*100:.1f}%")
            lines.append("")

        # Daily Achievement Score
        daily_score = context.get("daily_achievement_score", {})
        if daily_score:
            lines.append("🏆 DAILY ACHIEVEMENT SCORE:")
            lines.append(f"  Score: {daily_score.get('score', 0)}/100")
            if daily_score.get('breakdown'):
                for key, value in daily_score['breakdown'].items():
                    lines.append(f"  {key.replace('_', ' ').title()}: {value}")
            lines.append("")

        # Today's Tasks
        tasks = context.get("tasks", {})
        if tasks.get("today"):
            lines.append("📋 TODAY'S TASKS:")
            for task in tasks["today"][:5]:
                associated_goal = task.get("associated_goal")
                goal_info = f" → {associated_goal['title']}" if associated_goal else ""
                lines.append(f"  • {task['title']} ({task['priority']} priority){goal_info}")
            lines.append("")

        if tasks.get("overdue"):
            lines.append(f"⚠️ OVERDUE TASKS: {len(tasks['overdue'])}")
            for task in tasks["overdue"][:3]:
                associated_goal = task.get("associated_goal")
                goal_info = f" → {associated_goal['title']}" if associated_goal else ""
                lines.append(f"  • {task['title']}{goal_info}")
            lines.append("")

        # Habits
        habits = context.get("habits", {})
        if habits.get("list"):
            lines.append(f"🔄 HABITS ({habits['completed_today']}/{habits['total']} done today):")
            for habit in habits["list"][:5]:
                streak_text = f"🔥 {habit['streak']} day streak" if habit['streak'] > 0 else ""
                done = "✓" if habit["completed_today"] else "○"
                lines.append(f"  {done} {habit['name']} {streak_text}")
            lines.append("")

        # Productivity
        productivity = context.get("productivity", {})
        lines.append("📈 PRODUCTIVITY METRICS:")
        lines.append(f"  - Focus Score: {productivity.get('focus_score', 0)}/100")
        lines.append(f"  - Burnout Risk: {productivity.get('burnout_risk', 0)}%")
        lines.append(f"  - Focus Minutes Today: {productivity.get('total_focus_minutes', 0)}")
        lines.append("")

        # Upcoming
        upcoming = context.get("upcoming", {})
        if upcoming.get("goal_deadlines"):
            lines.append("⏰ UPCOMING GOAL DEADLINES:")
            for deadline in upcoming["goal_deadlines"]:
                lines.append(f"  • {deadline['title']} - {deadline['target_date']}")
            lines.append("")

        return "\n".join(lines)


# Singleton instance
ai_context_builder = AIContextBuilder()
