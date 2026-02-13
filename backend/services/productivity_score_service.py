# backend/services/productivity_score_service.py
"""
Real-time Productivity Scoring Engine
Calculates comprehensive productivity metrics based on user activity across the platform.
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Task, Plan, AnalyticsEvent, FocusScore

logger = logging.getLogger(__name__)


class ProductivityScoreService:
    """
    Comprehensive productivity scoring system.
    Scores range from 0-100 with intelligent weighting.
    """

    # Scoring weights (total = 100%)
    WEIGHTS = {
        "base_usage": 0.15,          # 15% - Just using the app
        "task_completion": 0.25,      # 25% - Completing tasks
        "focus_sessions": 0.20,       # 20% - Deep work quality
        "habit_tracking": 0.15,       # 15% - Habit consistency
        "planning_accuracy": 0.15,    # 15% - Time estimation
        "engagement_depth": 0.10      # 10% - Overall engagement
    }

    # Time thresholds for daily calculation
    CALCULATION_HOUR = 21  # 9 PM - Calculate daily score
    RESET_HOUR = 11        # 11 AM - Start fresh calculation

    async def calculate_productivity_score(
        self, 
        user_id: int, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive productivity score for a given day.
        Returns score (0-100) with detailed breakdown.
        """
        if target_date is None:
            target_date = date.today()

        try:
            async for db in get_db():
                # Get all components
                base_score = await self._calculate_base_usage(db, user_id, target_date)
                task_score = await self._calculate_task_completion(db, user_id, target_date)
                focus_score = await self._calculate_focus_quality(db, user_id, target_date)
                habit_score = await self._calculate_habit_consistency(db, user_id, target_date)
                planning_score = await self._calculate_planning_accuracy(db, user_id, target_date)
                engagement_score = await self._calculate_engagement_depth(db, user_id, target_date)

                # Weighted total
                total_score = (
                    base_score * self.WEIGHTS["base_usage"] +
                    task_score * self.WEIGHTS["task_completion"] +
                    focus_score * self.WEIGHTS["focus_sessions"] +
                    habit_score * self.WEIGHTS["habit_tracking"] +
                    planning_score * self.WEIGHTS["planning_accuracy"] +
                    engagement_score * self.WEIGHTS["engagement_depth"]
                )

                # Apply difficulty curve (harder to reach 95+)
                final_score = self._apply_difficulty_curve(total_score)

                return {
                    "score": round(final_score, 1),
                    "date": target_date.isoformat(),
                    "breakdown": {
                        "base_usage": round(base_score, 1),
                        "task_completion": round(task_score, 1),
                        "focus_quality": round(focus_score, 1),
                        "habit_consistency": round(habit_score, 1),
                        "planning_accuracy": round(planning_score, 1),
                        "engagement_depth": round(engagement_score, 1)
                    },
                    "grade": self._get_grade(final_score),
                    "next_update": self._get_next_update_time(target_date)
                }
        except Exception as e:
            logger.error(f"Error calculating productivity score: {e}")
            return {
                "score": 0,
                "date": target_date.isoformat(),
                "breakdown": {},
                "grade": "F",
                "error": str(e)
            }

    async def _calculate_base_usage(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Base score for platform engagement (15% weight).
        Purely activity-based - starts from 0.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Count analytics events as proxy for usage time
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start_time,
                AnalyticsEvent.timestamp <= end_time
            )
        )
        event_count = result.scalar() or 0

        # More accurate estimation: 1 event per 30 seconds of active use
        # 120 events ≈ 1 hour of real engagement
        estimated_hours = event_count / 120

        # Progressive scoring:
        # 0 events = 0 points
        # 1 hour = 40 points
        # 2 hours = 65 points
        # 3 hours = 80 points
        # 4+ hours = 100 points
        if estimated_hours >= 4:
            return 100
        elif estimated_hours >= 3:
            return 80 + ((estimated_hours - 3) * 20)
        elif estimated_hours >= 2:
            return 65 + ((estimated_hours - 2) * 15)
        elif estimated_hours >= 1:
            return 40 + ((estimated_hours - 1) * 25)
        else:
            # Below 1 hour: linear scale from 0 to 40
            return estimated_hours * 40

    async def _calculate_task_completion(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Score based on task completion (25% weight).
        Considers quantity, priority, and on-time completion.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get completed tasks
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_time,
                Task.completed_at <= end_time
            )
        )
        tasks = result.scalars().all()

        if not tasks:
            return 0

        # Base score: 20 points per task (max 5 tasks = 100)
        quantity_score = min(100, len(tasks) * 20)

        # Priority bonus
        priority_bonus = sum(
            30 if t.priority == 'high' else 15 if t.priority == 'medium' else 5
            for t in tasks
        ) / max(len(tasks), 1)

        # On-time bonus (if due_date exists and met)
        on_time_count = sum(
            1 for t in tasks
            if t.due_date and t.completed_at and t.completed_at.date() <= t.due_date
        )
        on_time_bonus = (on_time_count / len(tasks)) * 20 if tasks else 0

        total = quantity_score * 0.6 + priority_bonus * 0.3 + on_time_bonus * 0.1
        return min(100, total)

    async def _calculate_habit_consistency(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Score based on habit tracking (15% weight).
        Looks at active habits and their completion status for the target date.
        """
        # Get ALL active habits (plan_type='habit')
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'habit'
            )
        )
        habits = result.scalars().all()
        
        # Filter for active habits (exclude archived)
        active_habits = [h for h in habits if h.schedule and h.schedule.get('status') != 'archived']

        if not active_habits:
            return 0

        completed_count = 0
        target_iso = target_date.isoformat()
        
        for habit in active_habits:
            schedule = habit.schedule or {}
            
            # Check history first (most reliable)
            history = schedule.get('history', [])
            if isinstance(history, list) and target_iso in history:
                completed_count += 1
                continue
                
            # Fallback: check lastCompleted
            last_completed = schedule.get('lastCompleted')
            if last_completed:
                try:
                    # Parse ISO string to date
                    if 'T' in str(last_completed):
                        lc_date = datetime.fromisoformat(str(last_completed)).date()
                    else:
                        lc_date = date.fromisoformat(str(last_completed))
                        
                    if lc_date == target_date:
                        completed_count += 1
                except (ValueError, TypeError):
                    pass

        completion_rate = (completed_count / len(active_habits)) * 100
        return completion_rate

    async def _calculate_focus_quality(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Score based on focus sessions (20% weight).
        Uses FocusScore + Habit Bonus (good habits improve focus).
        """
        base_focus_score = 0
        
        # Try to get focus score from FocusScore table
        result = await db.execute(
            select(FocusScore).where(
                FocusScore.user_id == user_id,
                FocusScore.date == target_date
            )
        )
        focus_record = result.scalar_one_or_none()

        if focus_record:
            base_focus_score = focus_record.score
        else:
            # Fallback: estimate from deep work plans
            start_time = datetime.combine(target_date, time.min)
            end_time = datetime.combine(target_date, time.max)

            result = await db.execute(
                select(Plan).where(
                    Plan.user_id == user_id,
                    Plan.plan_type == 'deep_work',
                    Plan.date >= start_time,
                    Plan.date <= end_time
                )
            )
            deep_work_sessions = result.scalars().all()

            if deep_work_sessions:
                # Score based on number and duration of sessions
                total_hours = sum(p.duration_hours or 0 for p in deep_work_sessions)
                session_count = len(deep_work_sessions)
                
                # 2+ hours = 100 base
                duration_score = min(100, (total_hours / 2) * 100)
                session_bonus = min(20, session_count * 7)
                base_focus_score = min(100, duration_score + session_bonus)
        
        # Add Habit Bonus (up to 15 points)
        # "if someone is using good habits like wake up early there should be slight changes"
        habit_consistency = await self._calculate_habit_consistency(db, user_id, target_date)
        habit_bonus = min(15, habit_consistency * 0.15) 
        
        return min(100, base_focus_score + habit_bonus)

    async def _calculate_planning_accuracy(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Score based on time estimation accuracy (15% weight).
        Compares estimated vs actual time for completed tasks.
        Returns 0 if no tasks with estimates.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_time,
                Task.completed_at <= end_time,
                Task.estimated_minutes.isnot(None),
                Task.actual_minutes.isnot(None)
            )
        )
        tasks = result.scalars().all()

        if not tasks:
            return 0  # No data = 0 points

        accuracies = []
        for task in tasks:
            if task.estimated_minutes and task.estimated_minutes > 0:
                deviation = abs(task.actual_minutes - task.estimated_minutes) / task.estimated_minutes
                accuracy = max(0, 100 * (1 - deviation))
                accuracies.append(accuracy)

        return sum(accuracies) / len(accuracies) if accuracies else 0

    async def _calculate_engagement_depth(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Score based on overall engagement (10% weight).
        Diversity of features used, interaction quality.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Count distinct event types (feature diversity)
        result = await db.execute(
            select(func.count(func.distinct(AnalyticsEvent.event_type))).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start_time,
                AnalyticsEvent.timestamp <= end_time
            )
        )
        distinct_features = result.scalar() or 0

        # 5+ different features used = 100
        diversity_score = min(100, (distinct_features / 5) * 100)

        return diversity_score

    def _apply_difficulty_curve(self, raw_score: float) -> float:
        """
        Apply difficulty curve to make 95+ harder to achieve.
        - 0-90: Linear
        - 90-95: Slight curve
        - 95-100: Steep curve (requires exceptional performance)
        """
        if raw_score <= 90:
            return raw_score
        elif raw_score <= 95:
            # Slight compression
            return 90 + (raw_score - 90) * 0.8
        else:
            # Steep compression for 95-100
            return 94 + (raw_score - 95) * 0.6

    def _get_grade(self, score: float) -> str:
        """Convert score to letter grade."""
        if score >= 97:
            return "A+"
        elif score >= 93:
            return "A"
        elif score >= 90:
            return "A-"
        elif score >= 87:
            return "B+"
        elif score >= 83:
            return "B"
        elif score >= 80:
            return "B-"
        elif score >= 77:
            return "C+"
        elif score >= 73:
            return "C"
        elif score >= 70:
            return "C-"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def _get_next_update_time(self, target_date: date) -> str:
        """Get next update time (9 PM today or tomorrow)."""
        now = datetime.now()
        update_time = datetime.combine(target_date, time(self.CALCULATION_HOUR, 0))

        if now >= update_time:
            # Next update is tomorrow at 9 PM
            next_update = datetime.combine(target_date + timedelta(days=1), time(self.CALCULATION_HOUR, 0))
        else:
            next_update = update_time

        return next_update.strftime("%I:%M %p")

    async def get_weekly_average(self, user_id: int) -> float:
        """Calculate average productivity score for the last 7 days."""
        scores = []
        for i in range(7):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_productivity_score(user_id, target_date)
            scores.append(result["score"])

        return sum(scores) / len(scores) if scores else 0

    async def get_monthly_average(self, user_id: int) -> float:
        """Calculate average productivity score for the last 30 days."""
        scores = []
        for i in range(30):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_productivity_score(user_id, target_date)
            scores.append(result["score"])

        return sum(scores) / len(scores) if scores else 0


# Singleton instance
productivity_score_service = ProductivityScoreService()
