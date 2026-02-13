# backend/services/big_five_service.py
from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
from sqlalchemy import select, func, and_, or_, distinct, case, extract
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import (
    Task, Plan, AnalyticsEvent, UserInsight, Goal, FocusScore,
    ChatSession, ChatMessage
)

logger = logging.getLogger(__name__)

class BigFiveService:
    """
    Big Five Analytics Service
    Calculates behavioral tendency indexes (0-100) based on 14-day rolling averages.
    
    Traits:
    - Conscientiousness: Reliability, Structure (Task completion, Deep Work)
    - Neuroticism: Volatility, Reactivity (Task switching, Chaos) -> Reported as "Stability" (inverse) or kept raw? 
      * Spec says "Neuroticism", implies tracking the trait itself. 
      * Users see "Behavioral Tendency Index".
      * If label is "Neuroticism", a higher bar usually means "More Neurotic". 
      * BUT in UI bars, "full" usually means "Good". 
      * Spec says: "Neuroticism -> Muted Amber". 
      * Spec Logic: "Penalty: High volatility days". 
      * I will return a score where 0 = Low Neuroticism (Good), 100 = High Neuroticism (Bad/Volatile).
      * Wait, UI shows "Neuroticism -> Muted Amber". If the bar is full, it looks like a lot of neuroticism.
      * Let's stick to standard: Score 0-100. 
    - Openness: Exploration (New tags, Insight adoption)
    - Agreeableness: System Cooperation (Balanced workload, guidance)
    - Extraversion: Energy Rhythm (Interaction cadence)
    """

    async def get_profile(self, user_id: int) -> Dict[str, Any]:
        """Get the current Big Five behavioral profile."""
        async for db in get_db():
            end_date = datetime.now()
            start_date = end_date - timedelta(days=14)
            prev_start_date = start_date - timedelta(days=14)

            # CURRENT PERIOD
            c_score = await self._calculate_conscientiousness(db, user_id, start_date, end_date)
            n_score = await self._calculate_neuroticism(db, user_id, start_date, end_date)
            o_score = await self._calculate_openness(db, user_id, start_date, end_date)
            a_score = await self._calculate_agreeableness(db, user_id, start_date, end_date)
            e_score = await self._calculate_extraversion(db, user_id, start_date, end_date)

            # PREVIOUS PERIOD (For Trend)
            c_prev = await self._calculate_conscientiousness(db, user_id, prev_start_date, start_date)
            n_prev = await self._calculate_neuroticism(db, user_id, prev_start_date, start_date)
            o_prev = await self._calculate_openness(db, user_id, prev_start_date, start_date)
            a_prev = await self._calculate_agreeableness(db, user_id, prev_start_date, start_date)
            e_prev = await self._calculate_extraversion(db, user_id, prev_start_date, start_date)

            return {
                "conscientiousness": {
                    "score": c_score,
                    "trend": self._get_trend(c_score, c_prev),
                    "insight": await self._generate_insight("conscientiousness", c_score, self._get_trend(c_score, c_prev), db, user_id)
                },
                "neuroticism": {
                    "score": n_score, # 0-100 (Higher = More Volatile)
                    "trend": self._get_trend(n_score, n_prev),
                    "insight": await self._generate_insight("neuroticism", n_score, self._get_trend(n_score, n_prev), db, user_id)
                },
                "openness": {
                    "score": o_score,
                    "trend": self._get_trend(o_score, o_prev),
                    "insight": await self._generate_insight("openness", o_score, self._get_trend(o_score, o_prev), db, user_id)
                },
                "agreeableness": {
                    "score": a_score,
                    "trend": self._get_trend(a_score, a_prev),
                    "insight": await self._generate_insight("agreeableness", a_score, self._get_trend(a_score, a_prev), db, user_id)
                },
                "extraversion": {
                    "score": e_score,
                    "trend": self._get_trend(e_score, e_prev),
                    "insight": await self._generate_insight("extraversion", e_score, self._get_trend(e_score, e_prev), db, user_id)
                }
            }

    def _get_trend(self, current: float, previous: float) -> str:
        if current > previous + 5:
            return "up"
        elif current < previous - 5:
            return "down"
        else:
            return "stable"

    async def _calculate_conscientiousness(self, db: Session, user_id: int, start: datetime, end: datetime) -> int:
        """
        Conscientiousness: Task completion, Habit streak, Deep Work ratio.
        """
        # 1. Task Completion Rate
        result = await db.execute(
            select(
                func.count(Task.id).label("total"),
                func.sum(case([(Task.status == 'completed', 1)], else_=0)).label("completed")
            ).where(
                Task.user_id == user_id,
                Task.created_at >= start,
                Task.created_at <= end
            )
        )
        task_stats = result.first()
        total_tasks = task_stats.total if task_stats and task_stats.total else 0
        completed_tasks = task_stats.completed if task_stats and task_stats.completed else 0
        
        completion_rate = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 50 # Baseline 50

        # ... (rest of method remains same logic but more robust)
        result = await db.execute(
            select(func.avg(FocusScore.score)).where(
                FocusScore.user_id == user_id,
                FocusScore.date >= start,
                FocusScore.date <= end
            )
        )
        avg_focus = result.scalar() or 0
        
        final_score = (completion_rate * 0.6) + (avg_focus * 0.4)
        return int(min(100, max(0, final_score)))

    async def _calculate_neuroticism(self, db: Session, user_id: int, start: datetime, end: datetime) -> int:
        """
        Neuroticism: Volatility, Chaos.
        """
        chaos_events = ['task_switch', 'early_exit', 'interruption']
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.event_type.in_(chaos_events),
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end
            )
        )
        total_chaos = result.scalar() or 0
        days = (end - start).days or 1
        daily_chaos = total_chaos / days
        
        chaos_score = min(100, (daily_chaos / 10) * 100)
        
        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.completed_at >= start,
                Task.completed_at <= end,
                or_(
                    extract('hour', Task.completed_at) >= 23,
                    extract('hour', Task.completed_at) < 4
                )
            )
        )
        late_night_tasks = result.scalar() or 0
        late_night_score = min(100, (late_night_tasks / 5) * 100) 
        
        final_score = (chaos_score * 0.7) + (late_night_score * 0.3)
        return int(final_score)

    async def _calculate_openness(self, db: Session, user_id: int, start: datetime, end: datetime) -> int:
        """
        Openness: Exploration, Insight adoption.
        """
        result = await db.execute(
            select(
                func.count(UserInsight.id).label("total"),
                func.sum(case([(UserInsight.read_at.isnot(None), 1)], else_=0)).label("read")
            ).where(
                UserInsight.user_id == user_id,
                UserInsight.generated_at >= start,
                UserInsight.generated_at <= end
            )
        )
        insight_stats = result.first()
        total_insights = insight_stats.total if insight_stats and insight_stats.total else 0
        read_insights = insight_stats.read if insight_stats and insight_stats.read else 0
        
        adoption_rate = (read_insights / total_insights) * 100 if total_insights > 0 else 50
        
        result = await db.execute(
            select(func.count(distinct(Task.category))).where(
                Task.user_id == user_id,
                Task.created_at >= start,
                Task.created_at <= end
            )
        )
        unique_categories = result.scalar() or 1
        variety_score = min(100, (unique_categories / 5) * 100)
        
        final_score = (adoption_rate * 0.6) + (variety_score * 0.4)
        return int(final_score)

    async def _calculate_agreeableness(self, db: Session, user_id: int, start: datetime, end: datetime) -> int:
        """
        Agreeableness: System cooperation, Balanced workload.
        """
        day_col = func.date(Task.created_at).label("day")
        result = await db.execute(
            select(
                day_col,
                func.count(Task.id).label("count")
            ).where(
                Task.user_id == user_id,
                Task.created_at >= start,
                Task.created_at <= end
            ).group_by(day_col)
        )
        rows = result.all()
        overload_days = sum(1 for r in rows if r.count > 12)
        total_days = (end - start).days or 1
        
        balance_score = 100 - ((overload_days / total_days) * 100)
        
        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.created_at >= start,
                Task.created_at <= end,
                Task.due_date < datetime.now(),
                Task.status != 'completed'
            )
        )
        overdue_tasks = result.scalar() or 0
        responsiveness_score = max(0, 100 - (overdue_tasks * 5)) 
        
        final_score = (balance_score * 0.5) + (responsiveness_score * 0.5)
        return int(final_score)

    async def _calculate_extraversion(self, db: Session, user_id: int, start: datetime, end: datetime) -> int:
        """
        Extraversion: Engagement Energy, Interaction Cadence.
        """
        # 1. Interaction Density (Events per day)
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end
            )
        )
        total_events = result.scalar() or 0
        days = (end - start).days or 1
        avg_events = total_events / days
        
        # Normalize: 20 events/day = 100 
        energy_score = min(100, (avg_events / 20) * 100)
        
        # 2. Chat Engagement (Messages sent by user)
        # We need to find chat sessions for this user first
        result = await db.execute(
            select(func.count(ChatMessage.id))
            .join(ChatSession)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == 'user',
                ChatMessage.created_at >= start,
                ChatMessage.created_at <= end
            )
        )
        chat_count = result.scalar() or 0
        chat_score = min(100, (chat_count / 10) * 100) # 10 messages in 14 days is low baseline
        
        final_score = (energy_score * 0.7) + (chat_score * 0.3)
        return int(final_score)

    async def _generate_insight(self, trait: str, score: int, trend: str, db: Session, user_id: int) -> str:
        """
        Generate a one-line goal-linked insight.
        Ideally uses AI, but hardcoded templated logic for speed/reliability first.
        """
        # Fetch active goal if any
        result = await db.execute(
            select(Goal).where(Goal.user_id == user_id).limit(1)
        )
        goal = result.scalars().first()
        goal_text = f"your goal '{goal.title}'" if goal else "your productivity"

        if trait == "conscientiousness":
            if score < 40:
                return f"Low structure is impacting {goal_text}. Try smaller task batches."
            elif score > 80:
                return f"High reliability is accelerating {goal_text}. Keep maintainable pace."
            else:
                return f"Consistent output is stabilizing {goal_text}."
        
        elif trait == "neuroticism":
            # High score = High Volatility
            if score > 60:
                return f"High volatility detected. Schedule buffer time to protect {goal_text}."
            else:
                return f"Emotional reactivity is stable. Good foundation for {goal_text}."

        elif trait == "openness":
            if score < 40:
                return f"Routine is rigid. Experiment with one new method for {goal_text}."
            else:
                return f"Adaptive approach is finding new paths to {goal_text}."

        elif trait == "agreeableness":
            if score < 40:
                return f"Workload imbalance is risking burnout on {goal_text}."
            else:
                return f"Balanced workload is sustainable for {goal_text}."

        elif trait == "extraversion":
            if score < 30:
                return f"Low energy rhythm. Shorten sessions to maintain {goal_text}."
            else:
                return f"High engagement energy is driving {goal_text} forward."
        
        return "Insight calculation pending."

big_five_service = BigFiveService()
