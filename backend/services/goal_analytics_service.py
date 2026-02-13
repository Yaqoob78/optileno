# backend/services/goal_analytics_service.py
"""
Goal Analytics Service - Professional Goal-Based Analytics.

This service provides real, actionable analytics about goal progress:
- Goal velocity (tasks completed per day towards goal)
- Progress tracking with trend analysis
- Habit impact on goal achievement
- Risk assessment and predictions
- Milestone tracking
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import logging
from statistics import mean, stdev

from backend.db.database import get_db
from backend.db.models import (
    Goal, Task, Plan, AnalyticsEvent,
    RealTimeMetrics, FocusScore
)
from sqlalchemy import desc, and_, func

logger = logging.getLogger(__name__)


class GoalAnalyticsService:
    """
    Provides professional, goal-focused analytics.
    
    Unlike generic "fun" metrics, this service provides actionable
    insights about goal progress and achievement probability.
    """
    
    async def get_goal_progress_report(
        self,
        user_id: str,
        goal_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive progress report for goals.
        
        Returns:
        - Overall progress percentage
        - Daily velocity (tasks/day)
        - Trend (improving, declining, stable)
        - Risk assessment
        """
        with next(get_db()) as db:
            # Get goal(s)
            query = db.query(Goal).filter(Goal.user_id == int(user_id))
            if goal_id:
                query = query.filter(Goal.id == int(goal_id))
            
            goals = query.all()
            
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
        """Analyze a single goal with all metrics."""
        
        now = datetime.now(timezone.utc)
        
        # Basic info
        progress = goal.current_progress or 0
        target_date = goal.target_date
        created_at = goal.created_at or now
        
        # Time calculations
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
        
        # Get linked tasks
        linked_tasks = self._get_linked_tasks(db, goal.id, user_id)
        completed_tasks = [t for t in linked_tasks if t.status == 'completed']
        pending_tasks = [t for t in linked_tasks if t.status == 'pending']
        
        # Calculate velocity (tasks per day)
        if elapsed_days > 0:
            velocity = len(completed_tasks) / elapsed_days
        else:
            velocity = 0
        
        # Required velocity to complete on time
        if remaining_days and remaining_days > 0 and pending_tasks:
            required_velocity = len(pending_tasks) / remaining_days
        else:
            required_velocity = 0
        
        # Trend analysis (last 7 days vs previous 7 days)
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
        
        # Status determination
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
        
        # Predicted completion date
        if velocity > 0 and progress < 100:
            remaining_progress = 100 - progress
            # Assuming linear progress per day
            days_to_complete = remaining_progress / (velocity * (100 / max(len(linked_tasks), 1)))
            predicted_completion = now + timedelta(days=days_to_complete)
        else:
            predicted_completion = None
        
        # Get linked habits
        linked_habits = self._get_linked_habits(db, goal.id, user_id)
        habit_contribution = self._calculate_habit_contribution(linked_habits)
        
        return {
            "id": goal.id,
            "title": goal.title,
            "description": goal.description,
            "category": goal.category,
            "progress": progress,
            "target_date": target_date.isoformat() if target_date else None,
            "remaining_days": remaining_days,
            "status": status,
            
            # Velocity metrics
            "velocity": round(velocity, 2),
            "required_velocity": round(required_velocity, 2),
            "velocity_status": "on_pace" if velocity >= required_velocity else "behind_pace",
            
            # Task breakdown
            "tasks": {
                "total": len(linked_tasks),
                "completed": len(completed_tasks),
                "pending": len(pending_tasks),
                "completion_rate": round(len(completed_tasks) / max(len(linked_tasks), 1) * 100, 1),
            },
            
            # Trends
            "trend": trend,
            "trend_change": round(trend_change, 1),
            "recent_completions": recent_completions,
            
            # Predictions
            "predicted_completion": predicted_completion.isoformat() if predicted_completion else None,
            "on_time_probability": self._calculate_on_time_probability(progress, time_progress, velocity, required_velocity),
            
            # Habit impact
            "linked_habits": len(linked_habits),
            "habit_contribution": habit_contribution,
            
            # Time analysis
            "time_progress": round(time_progress, 1),
            "elapsed_days": elapsed_days,
        }
    
    def _get_linked_tasks(self, db, goal_id: int, user_id: str) -> List[Task]:
        """Get tasks linked to a goal."""
        # Tasks linked via tags containing goal:{id}
        try:
            tasks = db.query(Task).filter(
                Task.user_id == int(user_id),
            ).all()
            
            # Filter by goal tag (JSON array search)
            linked = []
            for task in tasks:
                if task.tags and f"goal:{goal_id}" in task.tags:
                    linked.append(task)
            return linked
        except Exception:
            return []
    
    def _get_linked_habits(self, db, goal_id: int, user_id: str) -> List[Plan]:
        """Get habits linked to a goal."""
        try:
            habits = db.query(Plan).filter(
                Plan.user_id == int(user_id),
                Plan.plan_type == 'habit'
            ).all()
            
            # Filter by goal link in schedule
            linked = []
            for habit in habits:
                schedule = habit.schedule or {}
                if schedule.get("goal_link") == str(goal_id):
                    linked.append(habit)
            return linked
        except Exception:
            return []
    
    def _calculate_habit_contribution(self, habits: List[Plan]) -> Dict[str, Any]:
        """Calculate how habits are contributing to goal progress."""
        if not habits:
            return {"score": 0, "habits": []}
        
        habit_scores = []
        for habit in habits:
            schedule = habit.schedule or {}
            streak = schedule.get("streak", 0)
            completed_count = schedule.get("completedCount", 0)
            
            # Score based on consistency
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
    
    def _calculate_on_time_probability(
        self,
        progress: float,
        time_progress: float,
        velocity: float,
        required_velocity: float
    ) -> int:
        """Calculate probability of completing on time (0-100)."""
        if progress >= 100:
            return 100
        
        # Factor 1: Progress vs time progress
        progress_factor = min(1.0, (progress / max(time_progress, 1)))
        
        # Factor 2: Velocity vs required velocity
        if required_velocity > 0:
            velocity_factor = min(1.0, velocity / required_velocity)
        else:
            velocity_factor = 1.0
        
        # Combine factors
        probability = (progress_factor * 0.4 + velocity_factor * 0.6) * 100
        
        return min(100, max(0, int(probability)))
    
    async def get_daily_achievement_score(self, user_id: str) -> Dict[str, Any]:
        """
        Calculate daily achievement score based on real activities.
        
        Components:
        - Tasks completed vs planned
        - Habits maintained
        - Goal contributions
        - Focus time
        """
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            today = now.date()
            
            # Tasks completed today
            completed_today = db.query(Task).filter(
                Task.user_id == int(user_id),
                Task.status == 'completed',
                func.date(Task.completed_at) == today
            ).count()
            
            # Tasks due today
            due_today = db.query(Task).filter(
                Task.user_id == int(user_id),
                func.date(Task.due_date) == today
            ).count()
            
            # Task score
            if due_today > 0:
                task_score = min(100, (completed_today / due_today) * 100)
            else:
                task_score = 100 if completed_today > 0 else 50
            
            # Habits completed today
            habits = db.query(Plan).filter(
                Plan.user_id == int(user_id),
                Plan.plan_type == 'habit'
            ).all()
            
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
            metrics = db.query(RealTimeMetrics).filter(
                RealTimeMetrics.user_id == int(user_id)
            ).first()
            
            focus_score = metrics.focus_score if metrics else 50
            focus_minutes = metrics.total_focus_minutes if metrics else 0
            
            # Overall daily score
            daily_score = (task_score * 0.4 + habit_score * 0.3 + focus_score * 0.3)
            
            # Get comparison to weekly average
            week_avg = await self._get_weekly_average_score(db, user_id)
            comparison = daily_score - week_avg if week_avg else 0
            
            return {
                "daily_score": round(daily_score, 1),
                "breakdown": {
                    "task_score": round(task_score, 1),
                    "habit_score": round(habit_score, 1),
                    "focus_score": focus_score,
                },
                "counts": {
                    "tasks_completed": completed_today,
                    "tasks_planned": due_today,
                    "habits_completed": habits_done,
                    "habits_due": habits_due,
                    "focus_minutes": focus_minutes,
                },
                "comparison": {
                    "weekly_average": round(week_avg, 1) if week_avg else None,
                    "difference": round(comparison, 1),
                    "trend": "up" if comparison > 5 else "down" if comparison < -5 else "stable",
                },
                "grade": self._score_to_grade(daily_score),
                "timestamp": now.isoformat(),
            }
    
    async def _get_weekly_average_score(self, db, user_id: str) -> float:
        """Calculate average daily score for the past week."""
        # This would typically query historical data
        # For now, return based on metrics
        metrics = db.query(RealTimeMetrics).filter(
            RealTimeMetrics.user_id == int(user_id)
        ).first()
        
        if metrics:
            return (metrics.focus_score + metrics.engagement_score) / 2
        return 50
    
    def _score_to_grade(self, score: float) -> str:
        """Convert score to letter grade."""
        if score >= 90:
            return "A+"
        elif score >= 85:
            return "A"
        elif score >= 80:
            return "A-"
        elif score >= 75:
            return "B+"
        elif score >= 70:
            return "B"
        elif score >= 65:
            return "B-"
        elif score >= 60:
            return "C+"
        elif score >= 55:
            return "C"
        elif score >= 50:
            return "C-"
        elif score >= 40:
            return "D"
        else:
            return "F"

    async def get_goal_timeline(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get visual timeline data for goals.
        Shows milestones, deadlines, and progress on a calendar view.
        """
        with next(get_db()) as db:
            goals = db.query(Goal).filter(
                Goal.user_id == int(user_id),
                Goal.current_progress < 100
            ).order_by(Goal.target_date).all()

            timeline_events = []

            for goal in goals:
                # Goal deadline event
                if goal.target_date:
                    timeline_events.append({
                        "type": "goal_deadline",
                        "date": goal.target_date.isoformat(),
                        "title": goal.title,
                        "goal_id": goal.id,
                        "progress": goal.current_progress or 0,
                        "urgency": self._calculate_urgency(goal.target_date),
                    })

                # Milestone events
                for i, milestone in enumerate(goal.milestones or []):
                    if isinstance(milestone, dict):
                        timeline_events.append({
                            "type": "milestone",
                            "date": milestone.get("target_date"),
                            "title": milestone.get("title", f"Milestone {i+1}"),
                            "goal_id": goal.id,
                            "completed": milestone.get("completed", False),
                        })

            # Sort by date
            timeline_events.sort(key=lambda x: x.get("date") or "9999")

            return timeline_events

    def _calculate_urgency(self, target_date: datetime) -> str:
        """Calculate urgency level based on deadline."""
        if not target_date:
            return "none"

        now = datetime.now(timezone.utc)
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

    async def get_automated_recommendations(self, user_id: str) -> Dict[str, Any]:
        """
        Generate automated recommendations based on analytics data.

        This method analyzes user behavior patterns and suggests:
        - New tasks to add based on goals
        - Habits that could support goals
        - Optimal times for different activities
        """
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            
            # Get user's goals
            goals = db.query(Goal).filter(
                Goal.user_id == int(user_id),
                Goal.current_progress < 100
            ).all()

            # Get user's tasks
            tasks = db.query(Task).filter(
                Task.user_id == int(user_id)
            ).all()

            # Get user's habits
            habits = db.query(Plan).filter(
                Plan.user_id == int(user_id),
                Plan.plan_type == 'habit'
            ).all()

            recommendations = []
            
            # Analyze each goal for recommendations
            for goal in goals:
                # Find gaps between goal and current tasks
                goal_related_tasks = [t for t in tasks if f"goal:{goal.id}" in (getattr(t, 'tags', []) or [])]
                
                # If goal has few related tasks, suggest adding more
                if len(goal_related_tasks) < 3:
                    recommendations.append({
                        "type": "task_suggestion",
                        "priority": "high",
                        "message": f"Consider adding more tasks to support '{goal.title}'",
                        "suggested_action": f"Create 2-3 specific tasks that contribute to {goal.title}",
                        "goal_id": goal.id
                    })
                
                # Analyze goal progress vs time
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

            # Analyze habits for consistency
            inconsistent_habits = [h for h in habits if (h.schedule or {}).get("streak", 0) < 3]
            if inconsistent_habits:
                recommendations.append({
                    "type": "habit_consistency",
                    "priority": "medium",
                    "message": f"You have {len(inconsistent_habits)} habits with low streaks",
                    "suggested_action": "Focus on maintaining 1-2 key habits rather than starting many",
                    "habit_names": [h.name for h in inconsistent_habits][:3]
                })

            # Analyze task completion patterns
            completed_tasks = [t for t in tasks if t.status == 'completed']
            pending_tasks = [t for t in tasks if t.status == 'pending']
            
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

            # Get focus metrics
            metrics = db.query(RealTimeMetrics).filter(
                RealTimeMetrics.user_id == int(user_id)
            ).first()

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

    async def trigger_automated_analytics_update(self, user_id: str, event_type: str, event_data: Dict[str, Any]):
        """
        Trigger automated analytics updates when certain events occur.

        This method is called when tasks are completed, habits are tracked,
        or other significant events happen to update metrics automatically.
        """
        with next(get_db()) as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            # Update RealTimeMetrics based on the event
            metrics = db.query(RealTimeMetrics).filter(
                RealTimeMetrics.user_id == int(user_id)
            ).first()

            if not metrics:
                # Create metrics record if it doesn't exist
                metrics = RealTimeMetrics(user_id=int(user_id))
                db.add(metrics)

            # Process different event types
            if event_type == "task_completed":
                metrics.tasks_completed_today = metrics.tasks_completed_today + 1
                # Improve focus score slightly for completing tasks
                metrics.focus_score = min(100, metrics.focus_score + 1)
                
            elif event_type == "habit_tracked":
                metrics.habits_completed_today = metrics.habits_completed_today + 1
                # Improve consistency score
                metrics.current_habit_streak = event_data.get("streak", metrics.current_habit_streak)
                
            elif event_type == "focus_session_completed":
                duration = event_data.get("duration_minutes", 0)
                metrics.total_focus_minutes = metrics.total_focus_minutes + duration
                metrics.focus_sessions_today = metrics.focus_sessions_today + 1
                
                # Calculate focus quality based on session completion
                if duration >= 25:  # Standard pomodoro length
                    metrics.focus_score = min(100, metrics.focus_score + 2)

            elif event_type == "goal_updated":
                # Recalculate planning accuracy based on goal progress
                goal_id = event_data.get("goal_id")
                if goal_id:
                    # Get the goal to update metrics
                    goal = db.query(Goal).filter(Goal.id == int(goal_id)).first()
                    if goal:
                        progress = goal.current_progress or 0
                        # Adjust planning accuracy based on goal progress vs expectations
                        if progress > 75:
                            metrics.planning_accuracy = min(100, metrics.planning_accuracy + 2)

            # Update engagement score based on activity
            total_activities = (
                metrics.tasks_completed_today +
                metrics.habits_completed_today +
                metrics.focus_sessions_today
            )
            
            # Engagement increases with activity but caps at 100
            metrics.engagement_score = min(100, 30 + (total_activities * 2))
            
            # Calculate burnout risk inversely proportional to engagement balance
            if metrics.focus_sessions_today > 8:  # Too many focus sessions in a day
                metrics.burnout_risk = min(100, metrics.burnout_risk + 10)
            else:
                metrics.burnout_risk = max(0, metrics.burnout_risk - 2)  # Decrease risk with balanced activity

            # Update the last updated timestamp
            metrics.updated_at = now

            # Commit changes to database
            db.commit()

            # Log the analytics update event
            analytics_event = AnalyticsEvent(
                user_id=int(user_id),
                event_type=f"automated_{event_type}_analytics_update",
                event_source="system",
                category="analytics",
                timestamp=now,
                meta=event_data,
                raw_data={"event_type": event_type, "user_id": user_id}
            )
            db.add(analytics_event)
            db.commit()

            return {
                "status": "updated",
                "event_type": event_type,
                "user_id": user_id,
                "updated_metrics": {
                    "focus_score": metrics.focus_score,
                    "tasks_completed_today": metrics.tasks_completed_today,
                    "habits_completed_today": metrics.habits_completed_today,
                    "total_focus_minutes": metrics.total_focus_minutes,
                    "engagement_score": metrics.engagement_score,
                    "burnout_risk": metrics.burnout_risk
                },
                "timestamp": now.isoformat()
            }


# Singleton instance
goal_analytics_service = GoalAnalyticsService()
