"""
Enhanced Goal Analytics Service with Real-Time Progress Tracking

This service provides real-time goal progress tracking based on actual user behavior,
with accurate timeline dates and progress calculations.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import logging
from statistics import mean, stdev
from sqlalchemy import select, func, and_, or_

from backend.db.session import get_db
from backend.db.models import (
    Goal, Task, Plan, AnalyticsEvent,
    RealTimeMetrics, FocusScore
)
from backend.services.complex_goal_service import complex_goal_service

logger = logging.getLogger(__name__)


class EnhancedGoalAnalyticsService:
    """
    Enhanced Goal Analytics Service with Real-Time Processing
    
    Provides real-time goal progress tracking based on actual user behavior
    with accurate timeline dates and progress calculations.
    """

    async def get_goal_progress_report(
        self,
        user_id: str,
        goal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive real-time progress report for goals.

        Returns:
        - Real-time progress percentage based on actual behavior
        - Daily velocity (tasks/day) based on actual completion
        - Trend (improving, declining, stable) based on recent activity
        - Risk assessment based on actual behavior patterns
        """
        async for db in get_db():
            # Get goal(s)
            query = select(Goal).where(Goal.user_id == int(user_id))
            if goal_id:
                query = query.where(Goal.id == int(goal_id))

            result = await db.execute(query)
            goals = result.scalars().all()

            if not goals:
                return {"goals": [], "overall_progress": 0}

            goal_reports = []
            for goal in goals:
                report = await self._analyze_single_goal(db, goal, user_id)
                goal_reports.append(report)

            # Calculate overall stats
            overall_progress = mean([g["progress"] for g in goal_reports]) if goal_reports else 0
            on_track_count = sum(1 for g in goal_reports if g["status"] == "on_track")
            at_risk_count = sum(1 for g in goal_reports if g["status"] == "at_risk")

            return {
                "goals": goal_reports,
                "overall_progress": round(overall_progress, 1),
                "on_track_count": on_track_count,
                "at_risk_count": at_risk_count,
                "total_goals": len(goal_reports),
            }

    async def _analyze_single_goal(
        self,
        db,
        goal: Goal,
        user_id: str
    ) -> Dict[str, Any]:
        """Analyze a single goal with real-time behavior metrics."""

        now = datetime.now(timezone.utc)
        
        # --- COMPLEX ANALYTICS INTEGRATION ---
        # Fetch probabilistic progress from the new service
        complex_metrics = await complex_goal_service.get_goal_analytics(int(user_id), goal.id)
        
        # Use AI Probability as the "Real Progress"
        if complex_metrics:
            progress = complex_metrics["smart_progress"]
            ai_insights = complex_metrics["ai_insights"]
            dynamics = complex_metrics["dynamics"]
        else:
            progress = goal.current_progress or 0
            ai_insights = []
            dynamics = {}
            
        target_date = goal.target_date
        created_at = goal.created_at or now

        # Time calculations - preserve exact dates from goal creation
        # Ensure timezone-aware datetime objects
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if target_date and target_date.tzinfo is None:
            target_date = target_date.replace(tzinfo=timezone.utc)
            
        if target_date:
            total_days = (target_date - created_at).days or 1
            elapsed_days = (now - created_at).days
            remaining_days = (target_date - now).days
            time_progress = min(100, (elapsed_days / total_days) * 100)
        else:
            total_days = 30  # Default assumption
            elapsed_days = (now - created_at).days
            remaining_days = None
            time_progress = 0

        # Get linked tasks and calculate real-time progress
        linked_tasks = await self._get_linked_tasks(db, goal.id, user_id)
        completed_tasks = [t for t in linked_tasks if t.status == 'completed']
        pending_tasks = [t for t in linked_tasks if t.status in ['pending', 'in_progress']]

        # Calculate real-time velocity based on actual behavior
        if elapsed_days > 0:
            velocity = len(completed_tasks) / elapsed_days
        else:
            velocity = 0

        # Required velocity to complete on time
        if remaining_days and remaining_days > 0 and pending_tasks:
            required_velocity = len(pending_tasks) / remaining_days
        else:
            required_velocity = 0

        # Real-time trend analysis based on recent activity
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        recent_completions = sum(
            1 for t in completed_tasks
            if t.completed_at and t.completed_at >= week_ago
        )
        previous_completions = sum(
            1 for t in completed_tasks
            if t.completed_at and two_weeks_ago <= t.completed_at < week_ago
        )

        if previous_completions > 0:
            trend_change = ((recent_completions - previous_completions) / previous_completions) * 100
        else:
            trend_change = 100 if recent_completions > 0 else 0

        trend = "improving" if trend_change > 10 else "declining" if trend_change < -10 else "stable"

        # Calculate progress based on actual behavior, not just stored value
        real_progress = 0
        if linked_tasks:
            real_progress = (len(completed_tasks) / len(linked_tasks)) * 100
            # Use the higher of stored progress or calculated progress
            progress = max(progress, real_progress)

        # Status determination based on real-time data
        if progress >= 100:
            status = "completed"
        elif remaining_days is not None and remaining_days < 0:
            status = "overdue"
        elif progress >= time_progress * 0.9:  # Within 10% of expected
            status = "on_track"
        elif progress >= time_progress * 0.7:  # Within 30% of expected
            status = "slightly_behind"
        else:
            status = "at_risk"

        # Predicted completion date based on real-time velocity
        if velocity > 0 and progress < 100:
            remaining_progress = 100 - progress
            # Calculate days needed based on current velocity and task completion rate
            if len(linked_tasks) > 0:
                # Estimate based on current task completion rate
                tasks_per_day = velocity
                remaining_tasks = len(pending_tasks)
                if tasks_per_day > 0:
                    days_to_complete = remaining_tasks / tasks_per_day
                    predicted_completion = now + timedelta(days=days_to_complete)
                else:
                    predicted_completion = None
            else:
                predicted_completion = None
        else:
            predicted_completion = None

        # Get linked habits and calculate real-time impact
        linked_habits = await self._get_linked_habits(db, goal.id, user_id)
        habit_contribution = await self._calculate_habit_contribution(linked_habits)

        return {
            "id": goal.id,
            "title": goal.title,
            "description": goal.description,
            "category": goal.category,
            "progress": round(progress, 1),
            "target_date": target_date.isoformat() if target_date else None,
            "created_at": created_at.isoformat() if created_at else None,
            "remaining_days": remaining_days,
            "status": status,

            # Real-time velocity metrics
            "velocity": round(velocity, 2),
            "required_velocity": round(required_velocity, 2),
            "velocity_status": "on_pace" if velocity >= required_velocity else "behind_pace",

            # Real-time task breakdown
            "tasks": {
                "total": len(linked_tasks),
                "completed": len(completed_tasks),
                "pending": len(pending_tasks),
                "completion_rate": round(len(completed_tasks) / max(len(linked_tasks), 1) * 100, 1),
            },

            # Real-time trends
            "trend": trend,
            "trend_change": round(trend_change, 1),
            "recent_completions": recent_completions,

            # Real-time predictions
            "predicted_completion": predicted_completion.isoformat() if predicted_completion else None,
            "on_time_probability": await self._calculate_on_time_probability(
                progress, time_progress, velocity, required_velocity
            ),

            # Real-time habit impact
            "linked_habits": len(linked_habits),
            "habit_contribution": habit_contribution,
            
            # --- AI ANALYTICS ---
            "ai_probability": round(progress, 1), # The progress is now the complex probability
            "ai_insights": ai_insights,
            "dynamics": dynamics,
            "is_complex_tracked": True,

            # Real-time time analysis
            "time_progress": round(time_progress, 1),
            "elapsed_days": elapsed_days,
            
            # Real-time engagement metrics
            "engagement_score": await self._calculate_engagement_score(db, goal.id, user_id, now),
        }

    async def _get_linked_tasks(self, db, goal_id: int, user_id: str) -> List[Any]:
        """Get tasks linked to a goal in real-time."""
        try:
            # Get all tasks for the user
            tasks_result = await db.execute(
                select(Task).where(Task.user_id == int(user_id))
            )
            tasks = tasks_result.scalars().all()

            # Filter by goal tag (JSON array search)
            linked = []
            for task in tasks:
                if task.tags and str(task.tags).find(f"goal:{goal_id}") != -1:
                    linked.append(task)
            return linked
        except Exception as e:
            logger.error(f"Error getting linked tasks: {e}")
            return []

    async def _get_linked_habits(self, db, goal_id: int, user_id: str) -> List[Any]:
        """Get habits linked to a goal in real-time."""
        try:
            habits_result = await db.execute(
                select(Plan).where(
                    Plan.user_id == int(user_id),
                    Plan.plan_type == 'habit'
                )
            )
            habits = habits_result.scalars().all()

            # Filter by goal link in schedule
            linked = []
            for habit in habits:
                schedule = habit.schedule or {}
                if schedule.get("goal_link") == str(goal_id):
                    linked.append(habit)
            return linked
        except Exception as e:
            logger.error(f"Error getting linked habits: {e}")
            return []

    async def _calculate_habit_contribution(self, habits: List[Any]) -> Dict[str, Any]:
        """Calculate how habits are contributing to goal progress in real-time."""
        if not habits:
            return {"score": 0, "habits": []}

        habit_scores = []
        for habit in habits:
            schedule = habit.schedule or {}
            streak = schedule.get("streak", 0)
            completed_count = schedule.get("completedCount", 0)

            # Score based on real-time consistency
            score = min(100, streak * 10 + completed_count * 2)
            habit_scores.append({
                "name": habit.name,
                "streak": streak,
                "contribution_score": score,
            })

        avg_score = mean([h["contribution_score"] for h in habit_scores]) if habit_scores else 0

        return {
            "score": round(avg_score, 1),
            "habits": habit_scores,
        }

    async def _calculate_on_time_probability(
        self,
        progress: float,
        time_progress: float,
        velocity: float,
        required_velocity: float
    ) -> int:
        """Calculate probability of completing on time based on real-time data (0-100)."""
        if progress >= 100:
            return 100

        # Factor 1: Progress vs time progress
        progress_factor = min(1.0, (progress / max(time_progress, 1)))

        # Factor 2: Velocity vs required velocity
        if required_velocity > 0:
            velocity_factor = min(1.0, velocity / required_velocity)
        else:
            velocity_factor = 1.0

        # Factor 3: Recent activity trend
        # This would normally come from recent activity data
        trend_factor = 1.0  # Placeholder - would be calculated from recent activity

        # Combine factors
        probability = (progress_factor * 0.4 + velocity_factor * 0.4 + trend_factor * 0.2) * 100

        return min(100, max(0, int(probability)))

    async def _calculate_engagement_score(self, db, goal_id: int, user_id: str, now: datetime) -> int:
        """Calculate real-time engagement score for a specific goal."""
        try:
            # Look for recent analytics events related to this goal
            week_ago = now - timedelta(days=7)
            
            events_result = await db.execute(
                select(AnalyticsEvent).where(
                    and_(
                        AnalyticsEvent.user_id == int(user_id),
                        AnalyticsEvent.timestamp >= week_ago,
                        or_(
                            AnalyticsEvent.meta.op('->>')('goal_id') == str(goal_id),
                            AnalyticsEvent.event_type.contains('goal')
                        )
                    )
                )
            )
            events = events_result.scalars().all()
            
            if not events:
                # Check for any activity related to this goal's tasks
                linked_tasks = await self._get_linked_tasks(db, goal_id, user_id)
                if not linked_tasks:
                    return 30  # Low engagement if no related tasks
                
                # Check for activity on linked tasks
                task_ids = [t.id for t in linked_tasks]
                task_events_result = await db.execute(
                    select(AnalyticsEvent).where(
                        and_(
                            AnalyticsEvent.user_id == int(user_id),
                            AnalyticsEvent.timestamp >= week_ago,
                            AnalyticsEvent.meta.op('->>')('task_id').in_([str(tid) for tid in task_ids])
                        )
                    )
                )
                task_events = task_events_result.scalars().all()
                
                if not task_events:
                    return 30  # Low engagement
                
                # Calculate engagement based on task activity
                return min(100, len(task_events) * 15)
            
            # Calculate engagement based on goal-related events
            return min(100, len(events) * 20)
            
        except Exception as e:
            logger.error(f"Error calculating engagement score: {e}")
            return 50  # Default score

    async def get_daily_achievement_score(self, user_id: str) -> Dict[str, Any]:
        """
        Calculate real-time daily achievement score based on actual activities.

        Components:
        - Tasks completed vs planned
        - Habits maintained
        - Goal contributions
        - Focus time
        """
        async for db in get_db():
            now = datetime.now(timezone.utc)
            today = now.date()

            # Tasks completed today
            completed_today_result = await db.execute(
                select(func.count(Task.id)).where(
                    and_(
                        Task.user_id == int(user_id),
                        Task.status == 'completed',
                        func.date(Task.completed_at) == today
                    )
                )
            )
            completed_today = completed_today_result.scalar() or 0

            # Tasks due today
            due_today_result = await db.execute(
                select(func.count(Task.id)).where(
                    and_(
                        Task.user_id == int(user_id),
                        func.date(Task.due_date) == today
                    )
                )
            )
            due_today = due_today_result.scalar() or 0

            # Task score
            if due_today > 0:
                task_score = min(100, (completed_today / due_today) * 100)
            else:
                task_score = 100 if completed_today > 0 else 50

            # Habits completed today
            habits_result = await db.execute(
                select(Plan).where(
                    and_(
                        Plan.user_id == int(user_id),
                        Plan.plan_type == 'habit'
                    )
                )
            )
            habits = habits_result.scalars().all()

            habits_due = len(habits)
            habits_done = sum(
                1 for h in habits
                if h.schedule and h.schedule.get("completedToday", False)
            )

            if habits_due > 0:
                habit_score = (habits_done / habits_due) * 100
            else:
                habit_score = 50

            # Focus score
            metrics_result = await db.execute(
                select(RealTimeMetrics).where(
                    RealTimeMetrics.user_id == int(user_id)
                )
            )
            metrics = metrics_result.scalar_one_or_none()

            focus_score = metrics.focus_score if metrics else 50
            focus_minutes = metrics.total_focus_minutes if metrics else 0

            # Goal contribution score
            goal_contributions = await self._calculate_goal_contributions_today(db, user_id, today)
            goal_score = min(100, goal_contributions * 25)  # Up to 4 contributions = 100%

            # Overall daily score
            daily_score = (task_score * 0.3 + habit_score * 0.2 + focus_score * 0.2 + goal_score * 0.3)

            # Get comparison to weekly average
            week_avg = await self._get_weekly_average_score(db, user_id)
            comparison = daily_score - week_avg if week_avg else 0

            return {
                "daily_score": round(daily_score, 1),
                "breakdown": {
                    "task_score": round(task_score, 1),
                    "habit_score": round(habit_score, 1),
                    "focus_score": focus_score,
                    "goal_score": goal_score,
                },
                "counts": {
                    "tasks_completed": completed_today,
                    "tasks_planned": due_today,
                    "habits_completed": habits_done,
                    "habits_due": habits_due,
                    "focus_minutes": focus_minutes,
                    "goal_contributions": goal_contributions,
                },
                "comparison": {
                    "weekly_average": round(week_avg, 1) if week_avg else None,
                    "difference": round(comparison, 1),
                    "trend": "up" if comparison > 5 else "down" if comparison < -5 else "stable",
                },
                "grade": self._score_to_grade(daily_score),
                "timestamp": now.isoformat(),
            }

    async def _calculate_goal_contributions_today(self, db, user_id: str, today: Any) -> int:
        """Calculate how many activities contributed to goals today."""
        try:
            # Count tasks completed today that are linked to goals
            tasks_result = await db.execute(
                select(Task).where(
                    and_(
                        Task.user_id == int(user_id),
                        Task.status == 'completed',
                        func.date(Task.completed_at) == today
                    )
                )
            )
            completed_tasks = tasks_result.scalars().all()

            goal_contributions = sum(
                1 for task in completed_tasks
                if task.tags and any('goal:' in tag for tag in (task.tags or []))
            )

            return goal_contributions
        except Exception:
            return 0

    async def _get_weekly_average_score(self, db, user_id: str) -> float:
        """Calculate average daily score for the past week."""
        try:
            # Get metrics for the user
            metrics_result = await db.execute(
                select(RealTimeMetrics).where(
                    RealTimeMetrics.user_id == int(user_id)
                )
            )
            metrics = metrics_result.scalar_one_or_none()

            if metrics:
                return (metrics.focus_score + metrics.engagement_score) / 2
            return 50
        except Exception:
            return 50

    def _score_to_grade(self, score: float) -> str:
        """Convert score to letter grade."""
        if score >= 95:
            return "A+"
        elif score >= 90:
            return "A"
        elif score >= 85:
            return "A-"
        elif score >= 80:
            return "B+"
        elif score >= 75:
            return "B"
        elif score >= 70:
            return "B-"
        elif score >= 65:
            return "C+"
        elif score >= 60:
            return "C"
        elif score >= 55:
            return "C-"
        elif score >= 50:
            return "D"
        else:
            return "F"

    async def get_goal_timeline(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get real-time visual timeline data for goals with exact dates.
        Shows milestones, deadlines, and progress on a calendar view.
        """
        async for db in get_db():
            goals_result = await db.execute(
                select(Goal).where(
                    and_(
                        Goal.user_id == int(user_id),
                        Goal.current_progress < 100
                    )
                ).order_by(Goal.target_date)
            )
            goals = goals_result.scalars().all()

            timeline_events = []

            for goal in goals:
                # Goal creation event (preserve exact creation date)
                if goal.created_at:
                    timeline_events.append({
                        "type": "goal_created",
                        "date": goal.created_at.isoformat(),
                        "title": f"Started: {goal.title}",
                        "goal_id": goal.id,
                        "progress": 0,
                        "urgency": "low",
                        "color": "#4ade80"  # Green for start
                    })

                # Goal deadline event (preserve exact target date)
                if goal.target_date:
                    timeline_events.append({
                        "type": "goal_deadline",
                        "date": goal.target_date.isoformat(),
                        "title": f"Deadline: {goal.title}",
                        "goal_id": goal.id,
                        "progress": goal.current_progress or 0,
                        "urgency": await self._calculate_urgency(goal.target_date),
                        "color": await self._get_urgency_color(await self._calculate_urgency(goal.target_date))
                    })

                # Milestone events (preserve exact milestone dates)
                for i, milestone in enumerate(goal.milestones or []):
                    if isinstance(milestone, dict):
                        milestone_date = milestone.get("target_date")
                        if milestone_date:
                            timeline_events.append({
                                "type": "milestone",
                                "date": milestone_date,
                                "title": milestone.get("title", f"Milestone {i+1}"),
                                "goal_id": goal.id,
                                "completed": milestone.get("completed", False),
                                "color": "#60a5fa" if milestone.get("completed", False) else "#fbbf24"
                            })

                # Progress update events (based on actual progress changes)
                progress_events = await self._get_progress_events(db, goal.id, user_id)
                timeline_events.extend(progress_events)

            # Sort by date
            timeline_events.sort(key=lambda x: x.get("date") or "9999")

            return timeline_events

    async def _get_progress_events(self, db, goal_id: int, user_id: str) -> List[Dict[str, Any]]:
        """Get progress update events for a goal."""
        try:
            # Look for analytics events related to goal progress
            events_result = await db.execute(
                select(AnalyticsEvent).where(
                    and_(
                        AnalyticsEvent.user_id == int(user_id),
                        AnalyticsEvent.event_type.contains('goal'),
                        AnalyticsEvent.meta.op('->>')('goal_id') == str(goal_id)
                    )
                ).order_by(AnalyticsEvent.timestamp.desc()).limit(20)
            )
            events = events_result.scalars().all()

            progress_events = []
            for event in events:
                if 'progress' in event.event_type.lower():
                    progress_events.append({
                        "type": "progress_update",
                        "date": event.timestamp.isoformat(),
                        "title": f"Progress: {event.meta.get('progress', 0)}%",
                        "goal_id": goal_id,
                        "progress": event.meta.get('progress', 0),
                        "urgency": "low",
                        "color": "#a78bfa"
                    })

            return progress_events
        except Exception:
            return []

    async def _calculate_urgency(self, target_date: datetime) -> str:
        """Calculate urgency level based on deadline."""
        if not target_date:
            return "none"

        # Ensure timezone-aware datetime objects
        now = datetime.now(timezone.utc)
        if target_date.tzinfo is None:
            target_date = target_date.replace(tzinfo=timezone.utc)
            
        days_remaining = (target_date - now).days

        if days_remaining < 0:
            return "overdue"
        elif days_remaining <= 3:
            return "critical"
        elif days_remaining <= 7:
            return "high"
        elif days_remaining <= 14:
            return "medium"
        else:
            return "low"

    async def _get_urgency_color(self, urgency: str) -> str:
        """Get color code for urgency level."""
        colors = {
            "critical": "#ef4444",  # Red
            "high": "#f97316",     # Orange
            "medium": "#eab308",   # Yellow
            "low": "#22c55e",      # Green
            "overdue": "#7e22ce"   # Purple
        }
        return colors.get(urgency, "#6b7280")  # Gray default

    async def get_automated_recommendations(self, user_id: str) -> Dict[str, Any]:
        """
        Generate real-time automated recommendations based on actual analytics data.
        """
        async for db in get_db():
            now = datetime.now(timezone.utc)

            # Get user's goals
            goals_result = await db.execute(
                select(Goal).where(
                    and_(
                        Goal.user_id == int(user_id),
                        Goal.current_progress < 100
                    )
                )
            )
            goals = goals_result.scalars().all()

            # Get user's tasks
            tasks_result = await db.execute(
                select(Task).where(Task.user_id == int(user_id))
            )
            tasks = tasks_result.scalars().all()

            # Get user's habits
            habits_result = await db.execute(
                select(Plan).where(
                    and_(
                        Plan.user_id == int(user_id),
                        Plan.plan_type == 'habit'
                    )
                )
            )
            habits = habits_result.scalars().all()

            recommendations = []

            # Analyze each goal for real-time recommendations
            for goal in goals:
                # Find gaps between goal and current tasks
                goal_related_tasks = [t for t in tasks if f"goal:{goal.id}" in (t.tags or [])]

                # If goal has few related tasks, suggest adding more
                if len(goal_related_tasks) < 3:
                    recommendations.append({
                        "type": "task_suggestion",
                        "priority": "high",
                        "message": f"Consider adding more tasks to support '{goal.title}'",
                        "suggested_action": f"Create 2-3 specific tasks that contribute to {goal.title}",
                        "goal_id": goal.id
                    })

                # Analyze goal progress vs time with real-time data
                if goal.target_date:
                    days_left = (goal.target_date - now).days
                    progress = goal.current_progress or 0

                    if days_left < 30 and progress < 50:
                        recommendations.append({
                            "type": "urgent_action",
                            "priority": "critical",
                            "message": f"'{goal.title}' is approaching deadline with low progress",
                            "suggested_action": f"Increase focus on {goal.title} - consider breaking into smaller tasks",
                            "goal_id": goal.id
                        })

            # Analyze habits for consistency with real-time data
            inconsistent_habits = [h for h in habits if (h.schedule or {}).get("streak", 0) < 3]
            if inconsistent_habits:
                recommendations.append({
                    "type": "habit_consistency",
                    "priority": "medium",
                    "message": f"You have {len(inconsistent_habits)} habits with low streaks",
                    "suggested_action": "Focus on maintaining 1-2 key habits rather than starting many",
                    "habit_names": [h.name for h in inconsistent_habits][:3]
                })

            # Analyze task completion patterns with real-time data
            completed_tasks = [t for t in tasks if t.status == 'completed']
            pending_tasks = [t for t in tasks if t.status in ['pending', 'in_progress']]

            if pending_tasks and len(completed_tasks) > 0:
                completion_rate = len(completed_tasks) / (len(completed_tasks) + len(pending_tasks))

                if completion_rate < 0.6:
                    recommendations.append({
                        "type": "task_management",
                        "priority": "medium",
                        "message": "Your task completion rate is below optimal",
                        "suggested_action": "Try breaking larger tasks into smaller, more manageable chunks",
                        "current_completion_rate": f"{completion_rate:.1%}"
                    })

            # Get focus metrics with real-time data
            metrics_result = await db.execute(
                select(RealTimeMetrics).where(RealTimeMetrics.user_id == int(user_id))
            )
            metrics = metrics_result.scalar_one_or_none()

            if metrics and metrics.focus_score < 60:
                recommendations.append({
                    "type": "focus_improvement",
                    "priority": "high",
                    "message": "Your focus score could be improved",
                    "suggested_action": "Try scheduling focused work sessions during your peak energy hours",
                    "current_score": metrics.focus_score
                })

            return {
                "recommendations": recommendations,
                "total_recommendations": len(recommendations),
                "timestamp": now.isoformat(),
                "next_review": (now + timedelta(days=1)).isoformat()  # Suggest reviewing tomorrow
            }

    async def update_goal_progress_realtime(self, user_id: str, goal_id: int, event_type: str, event_data: Dict[str, Any]):
        """
        Update goal progress in real-time based on user behavior.
        This method should be called whenever goal-related events occur.
        """
        try:
            # Get the goal to update
            async for db in get_db():
                goal_result = await db.execute(
                    select(Goal).where(Goal.id == int(goal_id))
                )
                goal = goal_result.scalar_one_or_none()
                
                if not goal:
                    logger.warning(f"Goal {goal_id} not found for user {user_id}")
                    return
                
                # Calculate new progress based on actual behavior
                linked_tasks = await self._get_linked_tasks(db, goal.id, user_id)
                if linked_tasks:
                    completed_tasks = [t for t in linked_tasks if t.status == 'completed']
                    new_progress = (len(completed_tasks) / len(linked_tasks)) * 100
                    
                    # Update the goal's progress
                    goal.current_progress = max(goal.current_progress or 0, round(new_progress))
                    goal.updated_at = datetime.utcnow()
                    
                    await db.commit()
                    
                    # Log the analytics event
                    analytics_event = AnalyticsEvent(
                        user_id=int(user_id),
                        event_type=f"goal_progress_updated_realtime",
                        event_source="system",
                        category="goals",
                        timestamp=datetime.utcnow(),
                        meta={
                            "goal_id": goal_id,
                            "new_progress": goal.current_progress,
                            "trigger_event": event_type,
                            "event_data": event_data
                        },
                        raw_data={"event_type": event_type, "user_id": user_id, "goal_id": goal_id}
                    )
                    db.add(analytics_event)
                    await db.commit()
                    
                    # Broadcast the update to real-time systems
                    try:
                        from backend.realtime.socket_manager import broadcast_analytics_update
                        await broadcast_analytics_update(int(user_id), {
                            "type": "goal_progress_updated",
                            "goal_id": goal_id,
                            "progress": goal.current_progress,
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except ImportError:
                        # Socket manager not available, skip broadcasting
                        pass
                        
        except Exception as e:
            logger.error(f"Error updating real-time goal progress: {e}", exc_info=True)


# Singleton instance
enhanced_goal_analytics_service = EnhancedGoalAnalyticsService()