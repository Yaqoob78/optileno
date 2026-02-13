# backend/services/attention_integrity_service.py
"""
Attention Integrity Score Service
Measures sustained, goal-directed cognitive effort across multiple signals:
- Deep Work Blocks (40%)
- Task-Based Focus (25%)
- Habit Consistency (15%)
- AI Cognitive Engagement (10%)
- Goal Progress Momentum (10%)
Global disruption penalty applied as a multiplier.
Behavior-derived only - AI classifies intent but does not invent scores.
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
import statistics
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db.models import Plan, AnalyticsEvent, Task, Goal, ChatMessage, ChatSession

logger = logging.getLogger(__name__)


class AttentionIntegrityService:
    """
    Attention Integrity Score - Pure behavioral telemetry.
    Measures focus ability, not time spent.
    """

    # Component weights (total = 100%)
    WEIGHTS = {
        "deep_work": 0.40,
        "task_based": 0.25,
        "habit_consistency": 0.15,
        "ai_engagement": 0.10,
        "goal_momentum": 0.10
    }

    async def calculate_attention_integrity(
        self, 
        user_id: int, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate Attention Integrity Score for a given day.
        Returns score (0-100) with detailed breakdown.
        """
        if target_date is None:
            target_date = date.today()

        try:
            async for db in get_db():
                # Get time range for the day
                start_of_day = datetime.combine(target_date, time.min)
                end_of_day = datetime.combine(target_date, time.max)
                
                # 1. Deep Work Blocks (40%)
                dw_score = await self._calculate_dw_integrity(db, user_id, start_of_day, end_of_day)
                
                # 2. Task-Based Focus (25%)
                task_score = await self._calculate_task_focus(db, user_id, start_of_day, end_of_day)
                
                # 3. Habit Consistency (15%)
                habit_score = await self._calculate_habit_discipline(db, user_id, start_of_day, end_of_day)
                
                # 4. AI Cognitive Engagement (10%)
                ai_score = await self._calculate_ai_engagement(db, user_id, start_of_day, end_of_day)
                
                # 5. Goal Progress Momentum (10%)
                goal_score = await self._calculate_goal_momentum(db, user_id, start_of_day, end_of_day)

                # Total Raw Focus
                raw_focus = (
                    dw_score * self.WEIGHTS["deep_work"] +
                    task_score * self.WEIGHTS["task_based"] +
                    habit_score * self.WEIGHTS["habit_consistency"] +
                    ai_score * self.WEIGHTS["ai_engagement"] +
                    goal_score * self.WEIGHTS["goal_momentum"]
                )

                # If no meaningful effort, return None (Neutral Gray)
                if raw_focus < 5:  # Threshold for "Inactive"
                    return {
                        "score": None,
                        "date": target_date.isoformat(),
                        "total_minutes": 0,
                        "breakdown": {},
                        "grade": "N/A",
                        "status": "Inactive"
                    }

                # Apply Global Disruption Penalty (Multiplier)
                disruption_multiplier = await self._calculate_disruption_multiplier(db, user_id, start_of_day, end_of_day)
                final_score = raw_focus * disruption_multiplier

                # Clamp to 0-100
                final_score = max(0, min(100, final_score))

                # Calculate total focus minutes (metadata)
                total_minutes = await self._calculate_total_focus_minutes(db, user_id, target_date)

                return {
                    "score": round(final_score, 1),
                    "date": target_date.isoformat(),
                    "total_minutes": total_minutes,
                    "breakdown": {
                        "deep_work": round(dw_score, 1),
                        "task_focus": round(task_score, 1),
                        "habit_discipline": round(habit_score, 1),
                        "ai_engagement": round(ai_score, 1),
                        "goal_momentum": round(goal_score, 1),
                        "disruption_penalty": round((1 - disruption_multiplier) * 100, 1)
                    },
                    "grade": self._get_grade(final_score),
                    "status": self._get_status(final_score)
                }
        except Exception as e:
            logger.error(f"Error calculating attention integrity: {e}")
            return {
                "score": 0,
                "date": target_date.isoformat(),
                "total_minutes": 0,
                "breakdown": {},
                "grade": "F",
                "status": "No Data",
                "error": str(e)
            }

    async def _calculate_dw_integrity(self, db, user_id, start, end) -> float:
        """Deep Work Blocks (40%) - Planned vs Actual."""
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start,
                Plan.date <= end
            )
        )
        sessions = result.scalars().all()
        if not sessions:
            return 0
        
        session_scores = []
        for s in sessions:
            schedule = s.schedule or {}
            planned = schedule.get("planned_duration") or (s.duration_hours * 60 if s.duration_hours else 0)
            actual = schedule.get("actual_duration", 0)
            
            if planned > 0:
                score = min(100, (actual / planned) * 100)
                session_scores.append(score)
        
        return sum(session_scores) / len(session_scores) if session_scores else 0

    async def _calculate_task_focus(self, db, user_id, start, end) -> float:
        """Task-Based Focus (25%) - Engagement >= 45 min."""
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start,
                Task.completed_at <= end
            )
        )
        tasks = result.scalars().all()
        if not tasks:
            return 0
        
        # 1 long task (>=45m) = 50 points, 2 = 100 points
        # Goal-linked tasks weighted higher
        score = 0
        for t in tasks:
            actual = t.actual_minutes or 0
            if actual >= 45:
                # Check for goal link in tags
                is_goal_linked = any(tag.startswith("goal:") for tag in (t.tags or []))
                score += 50 if is_goal_linked else 30
        
        return min(100, score)

    async def _calculate_habit_discipline(self, db, user_id, start, end) -> float:
        """Habit Consistency (15%) - Streak >= 3 days."""
        # Query habits (Plans with type='habit')
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'habit'
            )
        )
        habits = result.scalars().all()
        if not habits:
            return 0
        
        completed_habits = 0
        total_active_habits = 0
        
        for h in habits:
            schedule = h.schedule or {}
            # Check if done today (lastCompleted is today)
            last_completed_str = schedule.get("lastCompleted")
            if last_completed_str:
                last_completed = datetime.fromisoformat(last_completed_str).date()
                if last_completed == start.date():
                    total_active_habits += 1
                    # Check streak
                    if schedule.get("streak", 0) >= 3:
                        completed_habits += 1
        
        if total_active_habits == 0:
            return 0
            
        return (completed_habits / total_active_habits) * 100

    async def _calculate_ai_engagement(self, db, user_id, start, end) -> float:
        """AI Cognitive Engagement (10%) - Learning/Planning conversations."""
        # Join through ChatSession to get user_id (ChatMessage only has session_id)
        result = await db.execute(
            select(ChatMessage)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == 'user',
                ChatMessage.created_at >= start,
                ChatMessage.created_at <= end
            )
        )
        messages = result.scalars().all()
        if not messages:
            return 0
        
        # Count messages with learning/planning markers
        engagement_markers = ['how', 'why', 'plan', 'strategy', 'explain', 'learn', 'goal']
        meaningful_messages = 0
        for m in messages:
            content = m.content.lower()
            if len(content.split()) > 5: # Not trivial
                if any(marker in content for marker in engagement_markers):
                    meaningful_messages += 1
                elif m.meta and m.meta.get("intent") in ['learning', 'planning', 'strategic']:
                    meaningful_messages += 1
                    
        # 3+ meaningful interactions = 100 points
        return min(100, (meaningful_messages / 3) * 100)

    async def _calculate_goal_momentum(self, db, user_id, start, end) -> float:
        """Goal Progress Momentum (10%) - Advancing meaningful intent."""
        # Simple signal: Any completed goal-linked task today
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start,
                Task.completed_at <= end
            )
        )
        tasks = result.scalars().all()
        
        for t in tasks:
            if t.tags and any(tag.startswith("goal:") for tag in t.tags):
                return 100 # Micro-progress detected
        
        return 0

    async def _calculate_disruption_multiplier(self, db, user_id, start, end) -> float:
        """Global Disruption Penalty applied as a multiplier."""
        disruption_events = ['tab_switch', 'task_switch', 'context_switch', 'early_exit', 'interruption']
        
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end,
                AnalyticsEvent.event_type.in_(disruption_events)
            )
        )
        count = result.scalar() or 0
        
        # Penalty Map (from multiplier 1.0 down)
        if count == 0: return 1.0
        if count <= 2: return 0.95
        if count <= 5: return 0.85
        if count <= 10: return 0.70
        if count <= 20: return 0.50
        return 0.30

    async def _calculate_total_focus_minutes(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> int:
        """Calculate total focus/deep work minutes for the day."""
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get deep work plans
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start_time,
                Plan.date <= end_time
            )
        )
        deep_work_sessions = result.scalars().all()

        total_minutes = sum(
            int((p.duration_hours or 0) * 60) 
            for p in deep_work_sessions
        )

        return total_minutes

    def _get_grade(self, score: float) -> str:
        """Convert score to letter grade."""
        if score is None: return "N/A"
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
        elif score >= 50:
            return "D"
        else:
            return "F"

    def _get_status(self, score: float) -> str:
        """Get status description based on score."""
        if score is None: return "Rest Day"
        if score >= 90:
            return "Peak Focus"
        elif score >= 75:
            return "Deep Work"
        elif score >= 60:
            return "Focused"
        elif score >= 40:
            return "Moderate"
        elif score >= 20:
            return "Scattered"
        else:
            return "Unfocused"

    async def get_weekly_average(self, user_id: int) -> Dict[str, Any]:
        """Calculate average attention integrity for the last 7 days."""
        scores = []
        total_minutes = 0
        
        for i in range(7):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_attention_integrity(user_id, target_date)
            if result["score"] is not None:
                scores.append(result["score"])
                total_minutes += result["total_minutes"]

        avg_score = sum(scores) / len(scores) if scores else 0
        avg_minutes = total_minutes // 7

        return {
            "average_score": round(avg_score, 1),
            "average_minutes": avg_minutes,
            "period": "weekly",
            "days": 7
        }

    async def get_monthly_average(self, user_id: int) -> Dict[str, Any]:
        """Calculate average attention integrity for the last 30 days."""
        scores = []
        total_minutes = 0
        
        for i in range(30):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_attention_integrity(user_id, target_date)
            if result["score"] is not None:
                scores.append(result["score"])
                total_minutes += result["total_minutes"]

        avg_score = sum(scores) / len(scores) if scores else 0
        avg_minutes = total_minutes // 30

        return {
            "average_score": round(avg_score, 1),
            "average_minutes": avg_minutes,
            "period": "monthly",
            "days": 30
        }


    async def get_monthly_heatmap(
        self, 
        user_id: int, 
        year: Optional[int] = None, 
        month: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get monthly focus heatmap data formatted for the calendar grid."""
        today = date.today()
        year = year or today.year
        month = month or today.month

        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)

        try:
            weeks = []
            current_week = [None] * first_day.weekday() # Pad start of first week

            scores_list = []
            scored_days: List[Dict[str, Any]] = []
            previous_score = None # Track previous valid score for volatility dampening

            for d in range(1, last_day.day + 1):
                current_date = date(year, month, d)
                
                # Calculate daily score using new logic
                result = await self.calculate_attention_integrity(user_id, current_date)
                raw_score = result["score"]

                # Volatility Cap: Max daily delta = ±35 points from previous ACTIVE day
                final_score = raw_score
                if raw_score is not None and previous_score is not None:
                    diff = raw_score - previous_score
                    if abs(diff) > 35:
                        # Cap the change
                        final_score = previous_score + (35 * (1 if diff > 0 else -1))
                        # Clamp to valid range 0-100 (though math shouldn't normally exceed unless prev was edge)
                        final_score = max(0, min(100, final_score))
                
                if final_score is not None:
                    scores_list.append(final_score)
                    previous_score = final_score
                    scored_days.append(
                        {
                            "date": current_date.isoformat(),
                            "score": round(final_score, 1),
                        }
                    )

                day_data = {
                    "date": current_date.isoformat(),
                    "day": d,
                    "score": final_score,
                    "color": self._get_color_for_score(final_score),
                    "breakdown": result["breakdown"],
                    "activities": [] # We don't have separate activities list in new logic yet
                }

                current_week.append(day_data)
                if len(current_week) == 7:
                    weeks.append(current_week)
                    current_week = []

            if current_week:
                current_week.extend([None] * (7 - len(current_week)))
                weeks.append(current_week)

            # Summary stats (current month)
            avg = sum(scores_list) / len(scores_list) if scores_list else 0

            # Previous month stats for trend
            if month == 1:
                prev_year = year - 1
                prev_month = 12
            else:
                prev_year = year
                prev_month = month - 1

            prev_first_day = date(prev_year, prev_month, 1)
            if prev_month == 12:
                prev_last_day = date(prev_year + 1, 1, 1) - timedelta(days=1)
            else:
                prev_last_day = date(prev_year, prev_month + 1, 1) - timedelta(days=1)

            previous_scores: List[float] = []
            for d in range(1, prev_last_day.day + 1):
                prev_date = date(prev_year, prev_month, d)
                prev_result = await self.calculate_attention_integrity(user_id, prev_date)
                if prev_result["score"] is not None:
                    previous_scores.append(prev_result["score"])

            previous_avg = sum(previous_scores) / len(previous_scores) if previous_scores else 0
            rise_pct = 0.0
            if previous_avg > 0:
                rise_pct = ((avg - previous_avg) / previous_avg) * 100

            peak_day = max(scored_days, key=lambda s: s["score"]) if scored_days else None
            lowest_day = min(scored_days, key=lambda s: s["score"]) if scored_days else None
             
            return {
                "year": year,
                "month": month,
                "weeks": weeks,
                "monthly_average": round(avg, 1),
                "previous_month_average": round(previous_avg, 1),
                "rise_percentage": round(rise_pct, 1),
                "consistency_score": round((len([s for s in scores_list if s >= 60]) / len(scores_list) * 100), 1) if scores_list else 0, # >60 is good in new system
                "peak_day": {
                    "date": peak_day["date"],
                    "score": peak_day["score"],
                    "color": self._get_color_for_score(peak_day["score"]),
                } if peak_day else None,
                "lowest_day": {
                    "date": lowest_day["date"],
                    "score": lowest_day["score"],
                    "color": self._get_color_for_score(lowest_day["score"]),
                } if lowest_day else None
            }
        except Exception as e:
            logger.error(f"Error getting heatmap: {e}")
            return {"weeks": [], "error": str(e)}

    async def get_focus_stats(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive focus statistics for the stats panel."""
        try:
            today = date.today()
            current_focus = await self.calculate_attention_integrity(user_id, today)
            weekly_scores: List[Dict[str, Any]] = []
            for i in range(7):
                target_date = today - timedelta(days=i)
                result = await self.calculate_attention_integrity(user_id, target_date)
                weekly_scores.append({"date": target_date, "score": result["score"]})

            prev_week_scores: List[float] = []
            for i in range(7, 14):
                target_date = today - timedelta(days=i)
                result = await self.calculate_attention_integrity(user_id, target_date)
                if result["score"] is not None:
                    prev_week_scores.append(result["score"])

            monthly_scores: List[float] = []
            for i in range(30):
                target_date = today - timedelta(days=i)
                result = await self.calculate_attention_integrity(user_id, target_date)
                if result["score"] is not None:
                    monthly_scores.append(result["score"])

            prev_month_scores: List[float] = []
            for i in range(30, 60):
                target_date = today - timedelta(days=i)
                result = await self.calculate_attention_integrity(user_id, target_date)
                if result["score"] is not None:
                    prev_month_scores.append(result["score"])

            active_week_scores = [s for s in weekly_scores if s["score"] is not None]
            weekly_avg = round(sum(s["score"] for s in active_week_scores) / len(active_week_scores), 1) if active_week_scores else 0
            prev_week_avg = (sum(prev_week_scores) / len(prev_week_scores)) if prev_week_scores else weekly_avg
            weekly_change = round(weekly_avg - prev_week_avg, 1)
            weekly_trend = "up" if weekly_change > 0.5 else "down" if weekly_change < -0.5 else "stable"

            peak_day = max(active_week_scores, key=lambda s: s["score"]) if active_week_scores else None
            lowest_day = min(active_week_scores, key=lambda s: s["score"]) if active_week_scores else None

            monthly_avg = round(sum(monthly_scores) / len(monthly_scores), 1) if monthly_scores else 0
            prev_month_avg = (sum(prev_month_scores) / len(prev_month_scores)) if prev_month_scores else monthly_avg
            monthly_rise = round(monthly_avg - prev_month_avg, 1)
            monthly_trend = "up" if monthly_rise > 0.5 else "down" if monthly_rise < -0.5 else "stable"
            monthly_consistency = round((len([s for s in monthly_scores if s >= 60]) / len(monthly_scores) * 100), 1) if monthly_scores else 0

            breakdown = current_focus.get("breakdown", {}) or {}
            activities_today: List[str] = []
            if breakdown.get("deep_work", 0) > 0:
                activities_today.append("Deep Work Session")
            if breakdown.get("task_focus", 0) > 0:
                activities_today.append("Task Completion")
            if breakdown.get("habit_discipline", 0) > 0:
                activities_today.append("Habit Discipline")
            if breakdown.get("goal_momentum", 0) > 0:
                activities_today.append("Goal Progress")
            if breakdown.get("ai_engagement", 0) > 0:
                activities_today.append("AI Engagement")

            return {
                "current_focus": {
                    "score": current_focus["score"] or 0, # Default to 0 format if None for gauge
                    "breakdown": current_focus.get("breakdown", {}),
                    "color": self._get_color_for_score(current_focus["score"])
                },
                "weekly": {
                    "average": weekly_avg,
                    "change": weekly_change,
                    "trend": weekly_trend,
                    "peak_day": peak_day["date"].strftime("%a") if peak_day else None,
                    "peak_score": round(peak_day["score"], 1) if peak_day else 0,
                    "lowest_day": lowest_day["date"].strftime("%a") if lowest_day else None,
                    "lowest_score": round(lowest_day["score"], 1) if lowest_day else 0
                },
                "monthly": {
                    "average": monthly_avg,
                    "rise": monthly_rise,
                    "trend": monthly_trend,
                    "consistency": monthly_consistency
                },
                "activities_today": activities_today
            }
        except Exception as e:
            logger.error(f"Error getting focus stats: {e}")
            return {}

    def _get_color_for_score(self, score: Optional[float]) -> Dict[str, str]:
        """Get score visualization token used by the frontend heatmap/stat cards."""
        if score is None:
            return {"color": "#2a2a2a", "label": "Inactive"}
        if score <= 10:
            return {"color": "#ef4444", "label": "Critical"}
        if score <= 20:
            return {"color": "#f97316", "label": "Very Low"}
        if score <= 35:
            return {"color": "#eab308", "label": "Low"}
        if score <= 60:
            return {"color": "#10b981", "label": "Moderate"}
        if score <= 80:
            return {"color": "#06b6d4", "label": "Strong"}
        return {"color": "#8b5cf6", "label": "Peak"}

# Singleton instance
attention_integrity_service = AttentionIntegrityService()
