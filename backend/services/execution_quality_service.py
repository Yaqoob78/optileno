# backend/services/execution_quality_service.py
"""
Execution Quality Index (EQI) Service
Measures how well users execute their planned work through:
- Task Completion Quality (45%): Priority-weighted, goal-linked tasks
- Time Accuracy (30%): Planned vs actual time
- Deep Work Integrity (25%): Uninterrupted sessions only

Pure mathematics - NO AI involvement
Starts from 0 - no artificial baseline
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Task, Plan, Goal

logger = logging.getLogger(__name__)


class ExecutionQualityService:
    """
    Execution Quality Index (EQI) - Pure mathematical scoring.
    Measures execution quality, not effort or time spent.
    """

    # Component weights (total = 100%)
    WEIGHTS = {
        "task_completion_quality": 0.45,  # 45% - Quality of task execution
        "time_accuracy": 0.30,             # 30% - Estimation accuracy
        "deep_work_integrity": 0.25        # 25% - Uninterrupted focus
    }

    # Task priority weights
    PRIORITY_WEIGHTS = {
        "urgent": 3.0,
        "high": 2.0,
        "medium": 1.0,
        "low": 0.5
    }

    async def calculate_execution_quality(
        self, 
        user_id: int, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate Execution Quality Index for a given day.
        Returns score (0-100) with detailed breakdown.
        """
        if target_date is None:
            target_date = date.today()

        try:
            async for db in get_db():
                # Calculate individual components
                task_quality = await self._calculate_task_completion_quality(db, user_id, target_date)
                time_accuracy = await self._calculate_time_accuracy(db, user_id, target_date)
                deep_work = await self._calculate_deep_work_integrity(db, user_id, target_date)

                # Weighted total
                total_score = (
                    task_quality * self.WEIGHTS["task_completion_quality"] +
                    time_accuracy * self.WEIGHTS["time_accuracy"] +
                    deep_work * self.WEIGHTS["deep_work_integrity"]
                )

                # Apply difficulty curve (95+ is very hard)
                final_score = self._apply_difficulty_curve(total_score)

                return {
                    "score": round(final_score, 1),
                    "date": target_date.isoformat(),
                    "breakdown": {
                        "task_completion_quality": round(task_quality, 1),
                        "time_accuracy": round(time_accuracy, 1),
                        "deep_work_integrity": round(deep_work, 1)
                    },
                    "grade": self._get_grade(final_score),
                    "next_update": self._get_next_update_time(target_date)
                }
        except Exception as e:
            logger.error(f"Error calculating execution quality: {e}")
            return {
                "score": 0,
                "date": target_date.isoformat(),
                "breakdown": {},
                "grade": "F",
                "error": str(e)
            }

    async def _calculate_task_completion_quality(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Task Completion Quality (45% weight)
        NOT just task count - weighted by priority and goal linkage.
        
        Scoring:
        - 0 tasks = 0 points
        - 3 weighted tasks = 50 points
        - 5 weighted tasks = 75 points
        - 8+ weighted tasks = 100 points
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
            return 0  # No tasks = 0 points

        # Calculate weighted score
        total_weight = 0
        
        for task in tasks:
            # Base weight from priority
            priority = task.priority or 'medium'
            task_weight = self.PRIORITY_WEIGHTS.get(priority, 1.0)

            # Goal linkage bonus (20% boost)
            # Check if task has goal-related tags or is linked to a goal
            if task.tags and any('goal' in tag.lower() for tag in task.tags):
                task_weight *= 1.2

            # Completion factor (on-time vs late)
            completion_factor = 1.0
            if task.due_date and task.completed_at:
                # Extract date from due_date (handle both date and datetime)
                if isinstance(task.due_date, datetime):
                    due_date = task.due_date.date()
                else:
                    due_date = task.due_date
                
                completed_date = task.completed_at.date()
                days_late = (completed_date - due_date).days

                if days_late <= 0:
                    completion_factor = 1.0  # On time or early
                elif days_late == 1:
                    completion_factor = 0.8  # 1 day late
                elif days_late == 2:
                    completion_factor = 0.6  # 2 days late
                else:
                    completion_factor = 0.4  # 3+ days late

            total_weight += task_weight * completion_factor

        # Convert weighted score to 0-100 scale
        if total_weight >= 8.0:
            return 100
        elif total_weight >= 5.0:
            # 5-8 weighted tasks: 75-100 points
            return 75 + ((total_weight - 5.0) / 3.0) * 25
        elif total_weight >= 3.0:
            # 3-5 weighted tasks: 50-75 points
            return 50 + ((total_weight - 3.0) / 2.0) * 25
        else:
            # 0-3 weighted tasks: 0-50 points (linear)
            return (total_weight / 3.0) * 50

    async def _calculate_time_accuracy(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Time Accuracy (30% weight)
        Planned vs actual time - measures estimation skill.
        
        Scoring:
        - Perfect estimates (±5%) = 100 points
        - Good estimates (±20%) = 80 points
        - Okay estimates (±50%) = 50 points
        - Poor estimates (>100%) = 0 points
        
        If no tasks have time tracking: return 0 (not neutral)
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get completed tasks with time estimates
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_time,
                Task.completed_at <= end_time,
                Task.estimated_minutes.isnot(None),
                Task.actual_minutes.isnot(None),
                Task.estimated_minutes > 0
            )
        )
        tasks = result.scalars().all()

        if not tasks:
            return 0  # No time tracking = 0 points

        accuracies = []
        for task in tasks:
            estimated = task.estimated_minutes
            actual = task.actual_minutes

            # Calculate deviation
            deviation = abs(actual - estimated) / estimated

            # Convert to accuracy score
            if deviation <= 0.05:  # ±5%
                accuracy = 100
            elif deviation <= 0.20:  # ±20%
                accuracy = 80 + ((0.20 - deviation) / 0.15) * 20
            elif deviation <= 0.50:  # ±50%
                accuracy = 50 + ((0.50 - deviation) / 0.30) * 30
            elif deviation <= 1.0:  # ±100%
                accuracy = 0 + ((1.0 - deviation) / 0.50) * 50
            else:
                accuracy = 0  # >100% deviation

            accuracies.append(accuracy)

        # Return average accuracy
        return sum(accuracies) / len(accuracies) if accuracies else 0

    async def _calculate_deep_work_integrity(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Deep Work Integrity (25% weight)
        Uninterrupted sessions ONLY.
        
        Scoring:
        - 3+ perfect sessions = 100 points
        - 2 perfect sessions = 75 points
        - 1 perfect session = 50 points
        - 0 perfect sessions = 0 points
        
        Perfect session = no interruptions + completed 90%+ of planned time
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get deep work sessions
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start_time,
                Plan.date <= end_time
            )
        )
        sessions = result.scalars().all()

        if not sessions:
            return 0  # No sessions = 0 points

        perfect_sessions = 0
        
        for session in sessions:
            # Check if session is completed and uninterrupted
            if session.schedule and isinstance(session.schedule, dict):
                interruptions = session.schedule.get('interruptions', 0)
                completed = session.schedule.get('completed', False)
                quality = session.schedule.get('quality', 0)

                # Perfect session criteria:
                # 1. No interruptions
                # 2. Completed
                # 3. Quality >= 0.9 (90%+ of planned time)
                if interruptions == 0 and completed and quality >= 0.9:
                    perfect_sessions += 1

        # Convert to score
        if perfect_sessions >= 3:
            return 100
        elif perfect_sessions == 2:
            return 75
        elif perfect_sessions == 1:
            return 50
        else:
            # Partial credit for any completed session (even if not perfect)
            completed_sessions = sum(
                1 for s in sessions
                if s.schedule and isinstance(s.schedule, dict) and s.schedule.get('completed', False)
            )
            return min(40, completed_sessions * 15)

    def _apply_difficulty_curve(self, raw_score: float) -> float:
        """
        Apply difficulty curve to make 95+ very hard to achieve.
        - 0-90: Linear
        - 90-95: Moderate curve
        - 95-100: Steep curve (requires exceptional performance)
        """
        if raw_score <= 90:
            return raw_score
        elif raw_score <= 95:
            # Moderate compression
            return 90 + (raw_score - 90) * 0.75
        else:
            # Steep compression for 95-100
            return 93.75 + (raw_score - 95) * 0.5

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
        update_time = datetime.combine(target_date, time(21, 0))

        if now >= update_time:
            # Next update is tomorrow at 9 PM
            next_update = datetime.combine(target_date + timedelta(days=1), time(21, 0))
        else:
            next_update = update_time

        return next_update.strftime("%I:%M %p")

    async def get_weekly_average(self, user_id: int) -> float:
        """Calculate average execution quality for the last 7 days."""
        scores = []
        for i in range(7):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_execution_quality(user_id, target_date)
            scores.append(result["score"])

        return sum(scores) / len(scores) if scores else 0

    async def get_monthly_average(self, user_id: int) -> float:
        """Calculate average execution quality for the last 30 days."""
        scores = []
        for i in range(30):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_execution_quality(user_id, target_date)
            scores.append(result["score"])

        return sum(scores) / len(scores) if scores else 0


# Singleton instance
execution_quality_service = ExecutionQualityService()
