import logging
from typing import Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.models import Goal, Task, Plan
from backend.services.deep_work_utils import extract_deep_work_session_metrics

logger = logging.getLogger(__name__)

class GoalProgressResult:
    def __init__(self, goal_id: int, completion_progress: int, success_probability: int, confidence: float, confidence_state: str):
        self.goal_id = goal_id
        self.completion_progress = completion_progress
        self.success_probability = success_probability
        self.confidence = confidence
        self.confidence_state = confidence_state
        self.goal_progress_version = "ultra_v1"

    def to_dict(self):
        return {
            "goal_id": self.goal_id,
            "completion_progress": self.completion_progress,
            "success_probability": self.success_probability,
            "confidence": self.confidence,
            "confidence_state": self.confidence_state,
            "goal_progress_version": self.goal_progress_version
        }

class GoalProgressEngine:
    @staticmethod
    async def calculate_progress(db: AsyncSession, goal_id: int, user_id: int, is_ultra: bool = False) -> GoalProgressResult:
        if not is_ultra:
            # Explorer fallback: no advanced probability, just raw ratio if available
            return GoalProgressResult(goal_id, 0, 0, 0.0, "calibrating")

        # 1. Fetch Goal
        result = await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
        goal = result.scalar_one_or_none()
        if not goal:
            return GoalProgressResult(goal_id, 0, 0, 0.0, "calibrating")

        now = datetime.now(timezone.utc)
        
        # 2. Fetch all linked tasks strictly via goal_id
        tasks_res = await db.execute(select(Task).where(Task.goal_id == goal_id, Task.user_id == user_id))
        tasks = tasks_res.scalars().all()
        
        # 3. Fetch all linked plans (habits / deep_work) strictly via goal_id
        plans_res = await db.execute(select(Plan).where(Plan.goal_id == goal_id, Plan.user_id == user_id))
        plans = plans_res.scalars().all()

        # Check for AI structuring (if goal ai_suggestions exist or 'ai' metadata is set)
        is_ai_mode = False
        if getattr(goal, 'ai_suggestions', None):
            is_ai_mode = True

        # Base calculations
        earned_units = 0.0
        total_units = 0.0
        signal_items = 0
        
        # Determine weighting logic
        PRIORITY_WEIGHT = {"high": 3.0, "medium": 2.0, "low": 1.0, "urgent": 4.0}
        
        # TASK units
        for task in tasks:
            status = str(task.status).lower().replace("-", "_")
            weight = PRIORITY_WEIGHT.get(str(task.priority).lower(), 2.0)
            mins = task.estimated_minutes or 60
            unit = weight * (mins / 60.0)
            signal_items += 1
            total_units += unit
            if status in ["completed"]:
                earned_units += unit
            elif status in ["in_progress"]:
                earned_units += unit * 0.2
            
        # PLAN units (Habits and Deep Work)
        for plan in plans:
            p_type = str(plan.plan_type).lower()
            if p_type == "habit":
                # Expect 1 per day essentially as a simplifier, or from target
                target = 1.0
                streak = 0.0
                if plan.schedule and isinstance(plan.schedule, dict):
                    try:
                        target = float(plan.schedule.get("target", 1.0))
                    except (TypeError, ValueError):
                        target = 1.0
                    try:
                        streak = float(plan.schedule.get("streak", 0.0))
                    except (TypeError, ValueError):
                        streak = 0.0
                signal_items += 1
                earned_units += min(streak, target * 30) * 0.5
                total_units += target * 30 * 0.5
            elif p_type == "deep_work":
                metrics = extract_deep_work_session_metrics(plan)
                plan_date = plan.date
                if plan_date and getattr(plan_date, "tzinfo", None) is None:
                    plan_date = plan_date.replace(tzinfo=timezone.utc)

                # Do not penalize with future-scheduled sessions that have no execution signal yet.
                if plan_date and plan_date > now and not metrics["completed"]:
                    continue

                duration_hrs = float(metrics["weight_hours"])
                unit = duration_hrs * 2.0
                signal_items += 1
                total_units += unit

                if metrics["completed"]:
                    if metrics["planned_minutes"] > 0 and metrics["effective_minutes"] > 0:
                        completion_ratio = min(
                            float(metrics["effective_minutes"]) / float(metrics["planned_minutes"]),
                            1.0,
                        )
                    else:
                        completion_ratio = 1.0
                    earned_units += unit * completion_ratio
                elif metrics["effective_minutes"] > 0 and metrics["planned_minutes"] > 0:
                    partial_ratio = min(
                        0.8,
                        float(metrics["effective_minutes"]) / max(float(metrics["planned_minutes"]), 1.0),
                    )
                    earned_units += unit * partial_ratio

        if signal_items == 0 or total_units <= 0:
            return GoalProgressResult(
                goal_id=goal_id,
                completion_progress=goal.current_progress or 0,
                success_probability=50,
                confidence=0.1,
                confidence_state="calibrating"
            )

        epsilon = 0.1
        completion_progress_raw = 100.0 * earned_units / max(total_units, epsilon)
        completion_progress_raw = min(100.0, max(0.0, completion_progress_raw))

        # Exponential moving average to prevent massive swings
        prev_progress = float(goal.current_progress or 0)
        # alpha ~ 0.3 for stability
        smoothed_progress = (0.3 * completion_progress_raw) + (0.7 * prev_progress)
        
        # Cap delta (max +8, min -4)
        delta = smoothed_progress - prev_progress
        if delta > 8.0:
            smoothed_progress = prev_progress + 8.0
        elif delta < -4.0:
            smoothed_progress = prev_progress - 4.0

        # Hysteresis: discard noise < 1.5
        if abs(smoothed_progress - prev_progress) < 1.5:
            smoothed_progress = prev_progress
            
        final_progress = int(round(smoothed_progress))
        final_progress = min(100, max(0, final_progress))

        # Probability Logic 
        if is_ai_mode:
            # PV vs EV simulation
            SPI = earned_units / max((total_units * 0.8), epsilon) # assume 80% should be done for perfect pacing
            raw_prob = min(99.0, max(10.0, SPI * 80.0))
        else:
            # Manual mode
            raw_prob = 50.0 + (final_progress * 0.4) 
            
            # Penalize heavily if dates are overdue
            target_date = goal.target_date
            if target_date and getattr(target_date, "tzinfo", None):
                days_left = (target_date - now).days
                if days_left < 0 and final_progress < 100:
                    raw_prob -= min(40, abs(days_left) * 5)

        # Confidence
        active_days = 1.0
        if goal.created_at:
            created_dt = goal.created_at
            if not getattr(created_dt, "tzinfo", None):
                created_dt = created_dt.replace(tzinfo=timezone.utc)
            active_days = max(1.0, (now - created_dt).days)

        event_freq = signal_items / active_days
        confidence_raw = min(1.0, event_freq * 0.5)
        
        if signal_items < 2:
            confidence_raw = 0.2
            
        confidence_state = "established" if confidence_raw > 0.6 else "calibrating"

        if confidence_state == "calibrating":
            raw_prob = min(raw_prob, 70.0) # cap probability if calibrating

        final_probability = int(round(min(99.0, max(1.0, raw_prob))))
        if final_progress == 100:
            final_probability = 100

        # Sync back to goal
        goal.current_progress = final_progress
        
        # Translate to probability status
        if final_probability < 20:
            goal.probability_status = "Very Low"
        elif final_probability < 40:
            goal.probability_status = "Low"
        elif final_probability < 60:
            goal.probability_status = "Medium"
        elif final_probability < 80:
            goal.probability_status = "High"
        elif final_probability < 95:
            goal.probability_status = "Very High"
        else:
            goal.probability_status = "Extremely High"

        goal.last_analyzed_at = now
        await db.commit()
        await db.refresh(goal)

        return GoalProgressResult(
            goal_id=goal_id,
            completion_progress=final_progress,
            success_probability=final_probability,
            confidence=round(confidence_raw, 2),
            confidence_state=confidence_state
        )
