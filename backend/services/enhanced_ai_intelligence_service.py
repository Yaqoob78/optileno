"""
Enhanced AI Intelligence Score Service with Real-Time Behavior Analysis

This service calculates intelligence scores based on real-time user behavior patterns,
with immediate updates as users interact with the system.
"""

from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, and_, or_, extract
import logging
import asyncio
from decimal import Decimal

from backend.db.session import get_db
from backend.db.models import (
    Task,
    Plan,
    Goal,
    UserInsight,
    AnalyticsEvent,
    ChatMessage,
    ChatSession,
    RealTimeMetrics,
    AIIntelligenceScore
)

logger = logging.getLogger(__name__)

class EnhancedAIIntelligenceService:
    """
    Enhanced AI Intelligence Score Service with Real-Time Processing
    
    Formula:
    Score = 0.25 * Planning Quality
          + 0.30 * Execution Intelligence  
          + 0.20 * Adaptation & Reflection
          + 0.15 * Behavioral Stability
          + 0.10 * Learning & Growth
    """

    READINESS_WINDOW_DAYS = 30
    MIN_TASKS_COMPLETED = 3
    MIN_HABITS = 1
    MIN_INTERACTIONS = 1

    def _clamp(self, value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
        return max(min_val, min(max_val, value))

    def _safe_div(self, numerator: float, denominator: float, default: float = 0.0) -> float:
        return numerator / denominator if denominator else default

    def _confidence(self, evidence: float, target: float) -> float:
        if target <= 0:
            return 0.0
        return max(0.0, min(1.0, evidence / target))

    def _blend(self, score: float, confidence: float, baseline: float = 50.0) -> float:
        return baseline + (score - baseline) * confidence

    def _merge_signals(self, signals_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        merged: Dict[str, Any] = {}
        event_types: set = set()
        for signals in signals_list:
            if not signals:
                continue
            for key, value in signals.items():
                if key == "event_types":
                    if value:
                        event_types.update(value)
                    continue
                if isinstance(value, (int, float)):
                    merged[key] = merged.get(key, 0) + value
                elif isinstance(value, list):
                    merged.setdefault(key, []).extend(value)
                else:
                    merged[key] = value
        if event_types:
            merged["event_types"] = list(event_types)
        return merged

    async def _get_readiness(self, db, user_id: int) -> Dict[str, Any]:
        since = datetime.utcnow() - timedelta(days=self.READINESS_WINDOW_DAYS)

        tasks_completed_res = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= since
            )
        )
        tasks_completed = tasks_completed_res.scalar() or 0

        habits_created_res = await db.execute(
            select(func.count(Plan.id)).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'habit',
                Plan.created_at >= since
            )
        )
        habits_created = habits_created_res.scalar() or 0

        habits_completed_res = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= since,
                AnalyticsEvent.event_type.in_([
                    'habit_completed',
                    'habit_tracked',
                    'habit_streak_extended'
                ])
            )
        )
        habits_completed = habits_completed_res.scalar() or 0

        chat_messages_res = await db.execute(
            select(func.count(ChatMessage.id))
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == 'user',
                ChatMessage.created_at >= since
            )
        )
        chat_messages = chat_messages_res.scalar() or 0

        insights_read_res = await db.execute(
            select(func.count(UserInsight.id)).where(
                UserInsight.user_id == user_id,
                UserInsight.read_at.isnot(None),
                UserInsight.read_at >= since
            )
        )
        insights_read = insights_read_res.scalar() or 0

        deep_work_res = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= since,
                AnalyticsEvent.event_type.in_([
                    'deep_work_completed',
                    'deep_work_session',
                    'focus_session'
                ])
            )
        )
        deep_work_sessions = deep_work_res.scalar() or 0

        interactions = chat_messages + insights_read + deep_work_sessions
        habit_signal = max(habits_created, habits_completed)

        ready = (
            tasks_completed >= self.MIN_TASKS_COMPLETED
            and habit_signal >= self.MIN_HABITS
            and interactions >= self.MIN_INTERACTIONS
        )

        return {
            "ready": ready,
            "requirements": {
                "tasks_completed_min": self.MIN_TASKS_COMPLETED,
                "habits_min": self.MIN_HABITS,
                "interactions_min": self.MIN_INTERACTIONS
            },
            "counts": {
                "tasks_completed": tasks_completed,
                "habits_created": habits_created,
                "habits_completed": habits_completed,
                "interactions": interactions,
                "chat_messages": chat_messages,
                "insights_read": insights_read,
                "deep_work_sessions": deep_work_sessions
            },
            "window_days": self.READINESS_WINDOW_DAYS
        }

    async def _get_baseline_30d(self, db, user_id: int) -> Optional[Dict[str, Any]]:
        """Get 30-day baseline from stored daily AI intelligence scores."""
        since = datetime.utcnow() - timedelta(days=30)
        result = await db.execute(
            select(AIIntelligenceScore.overall_score).where(
                AIIntelligenceScore.user_id == user_id,
                AIIntelligenceScore.time_range == "daily",
                AIIntelligenceScore.calculated_at >= since
            )
        )
        scores = [row[0] for row in result.fetchall() if row and row[0] is not None]
        if len(scores) < 5:
            return None
        avg_score = sum(scores) / len(scores)
        return {
            "label": "30-day average",
            "score": round(avg_score),
            "samples": len(scores)
        }

    def _build_coverage(self, signals: Dict[str, Any], confidences: List[float]) -> Dict[str, Any]:
        confidence_score = round((sum(confidences) / len(confidences)) * 100) if confidences else 0
        if confidence_score >= 70:
            level = "high"
        elif confidence_score >= 40:
            level = "medium"
        else:
            level = "low"

        return {
            "level": level,
            "confidence": confidence_score,
            "tasks_created": int(signals.get("tasks_created", 0)),
            "tasks_completed": int(signals.get("tasks_completed", 0)),
            "plans_created": int(signals.get("plans_created", 0)),
            "deep_work_sessions": int(signals.get("deep_work_sessions", 0)),
            "chat_messages": int(signals.get("chat_messages", 0)),
            "insights_read": int(signals.get("insights_read", 0)),
            "events": int(signals.get("events_total", 0)),
            "active_days": int(signals.get("active_day", signals.get("active_days", 0)))
        }

    def _build_drivers(self, metrics: Dict[str, int], signals: Dict[str, Any]) -> List[Dict[str, Any]]:
        drivers: List[Dict[str, Any]] = []
        weights = {
            "planning": 0.25,
            "execution": 0.30,
            "adaptation": 0.20,
            "stability": 0.15,
            "learning": 0.10
        }

        tasks_created = signals.get("tasks_created", 0)
        tasks_completed = signals.get("tasks_completed", 0)
        tasks_total = signals.get("tasks_total", 0) or (tasks_created + tasks_completed)
        proactive_tasks = signals.get("proactive_tasks", 0)
        tagged_tasks = signals.get("tagged_tasks", 0)
        goal_linked_tasks_completed = signals.get("goal_linked_tasks_completed", 0)
        deep_work_sessions = signals.get("deep_work_sessions", 0)
        insights_read = signals.get("insights_read", 0)
        reflection_messages = signals.get("reflection_messages", 0)
        active_days = signals.get("active_day", signals.get("active_days", 0))
        event_types = signals.get("event_types", []) or []
        events_total = signals.get("events_total", 0)

        planning_score = metrics.get("planning_quality", 50)
        execution_score = metrics.get("execution_intelligence", 50)
        adaptation_score = metrics.get("adaptation_reflection", 50)
        stability_score = metrics.get("behavioral_stability", 50)
        learning_score = metrics.get("learning_growth", 50)

        completion_ratio = self._safe_div(tasks_completed, max(tasks_created, 1), 0.0)
        proactive_ratio = self._safe_div(proactive_tasks, max(tasks_total, 1), 0.0)
        tagged_ratio = self._safe_div(tagged_tasks, max(tasks_total, 1), 0.0)
        goal_alignment_ratio = self._safe_div(goal_linked_tasks_completed, max(tasks_completed, 1), 0.0)

        def add_driver(direction: str, label: str, detail: str, metric_key: str):
            base = metrics.get(metric_key, 50)
            impact = (base - 50) * weights[metric_key] if direction == "up" else (50 - base) * weights[metric_key]
            drivers.append({
                "direction": direction,
                "label": label,
                "detail": detail,
                "impact": impact
            })

        if tasks_total >= 3:
            if proactive_ratio >= 0.6:
                add_driver("up", "Planned ahead", f"{proactive_tasks} of {tasks_total} tasks were created before the day started.", "planning")
            elif proactive_ratio <= 0.3:
                add_driver("down", "Reactive planning", f"{tasks_total - proactive_tasks} of {tasks_total} tasks were created same-day.", "planning")

            if tagged_ratio >= 0.5:
                add_driver("up", "Goal linkage", f"{tagged_tasks} of {tasks_total} tasks were tagged to goals.", "planning")
            elif tagged_ratio <= 0.2:
                add_driver("down", "Weak goal linkage", f"Only {tagged_tasks} of {tasks_total} tasks were tagged to goals.", "planning")

        if tasks_created >= 3 or tasks_completed >= 3:
            if tasks_created > 0 and completion_ratio >= 0.6:
                add_driver("up", "Strong execution", f"Completed {tasks_completed} of {tasks_created} tasks created this period.", "execution")
            elif tasks_created > 0 and completion_ratio <= 0.4:
                add_driver("down", "Low completion rate", f"Completed {tasks_completed} of {tasks_created} tasks created this period.", "execution")
            elif tasks_created == 0 and tasks_completed >= 3:
                add_driver("up", "Strong execution", f"Completed {tasks_completed} tasks created earlier.", "execution")

        if goal_alignment_ratio >= 0.5 and tasks_completed >= 2:
            add_driver("up", "Goal-aligned execution", f"{goal_linked_tasks_completed} of {tasks_completed} completed tasks were goal-linked.", "execution")

        if deep_work_sessions >= 1:
            add_driver("up", "Deep work completed", f"{deep_work_sessions} focused session(s) completed.", "execution")

        if insights_read >= 1 or reflection_messages >= 1:
            detail = f"Insights read: {insights_read}, reflective chats: {reflection_messages}."
            add_driver("up", "Reflection signal", detail, "adaptation")

        if active_days >= 4:
            if stability_score >= 65:
                add_driver("up", "Consistent output", f"Activity recorded across {active_days} days.", "stability")
            elif stability_score <= 40:
                add_driver("down", "High variability", f"Activity varied widely across {active_days} days.", "stability")

        if events_total > 0:
            if len(event_types) >= 4:
                add_driver("up", "Learning variety", f"{len(event_types)} unique activity types tracked.", "learning")
            elif len(event_types) <= 1:
                add_driver("down", "Low variety", "Limited variety in activity types this period.", "learning")

        if tasks_total >= 12:
            add_driver("down", "Overloaded plan", f"{tasks_total} tasks in the period can dilute execution.", "planning")

        drivers = sorted(drivers, key=lambda d: abs(d.get("impact", 0)), reverse=True)
        return drivers[:3]

    def _build_next_actions(self, metrics: Dict[str, int], signals: Dict[str, Any]) -> List[Dict[str, Any]]:
        actions: List[Dict[str, Any]] = []

        tasks_created = signals.get("tasks_created", 0)
        tasks_completed = signals.get("tasks_completed", 0)
        tasks_total = signals.get("tasks_total", 0) or (tasks_created + tasks_completed)
        proactive_tasks = signals.get("proactive_tasks", 0)
        tagged_tasks = signals.get("tagged_tasks", 0)
        goal_linked_tasks_completed = signals.get("goal_linked_tasks_completed", 0)
        deep_work_sessions = signals.get("deep_work_sessions", 0)
        insights_read = signals.get("insights_read", 0)
        reflection_messages = signals.get("reflection_messages", 0)
        plan_creations = signals.get("plan_adjustments", signals.get("plans_created", 0))
        active_days = signals.get("active_day", signals.get("active_days", 0))
        event_types = signals.get("event_types", []) or []
        events_total = signals.get("events_total", 0)
        tasks_with_estimates = signals.get("tasks_with_estimates", 0)

        planning_score = metrics.get("planning_quality", 50)
        execution_score = metrics.get("execution_intelligence", 50)
        adaptation_score = metrics.get("adaptation_reflection", 50)
        stability_score = metrics.get("behavioral_stability", 50)
        learning_score = metrics.get("learning_growth", 50)

        completion_ratio = self._safe_div(tasks_completed, max(tasks_created, 1), 0.0)
        proactive_ratio = self._safe_div(proactive_tasks, max(tasks_total, 1), 0.0)
        tagged_ratio = self._safe_div(tagged_tasks, max(tasks_total, 1), 0.0)
        goal_alignment_ratio = self._safe_div(goal_linked_tasks_completed, max(tasks_completed, 1), 0.0)

        def add_action(label: str, detail: str, target: str, priority: float):
            actions.append({
                "label": label,
                "detail": detail,
                "target": target,
                "priority": priority
            })

        if planning_score < 60:
            if tasks_total >= 10:
                add_action(
                    "Trim today’s plan",
                    "Keep the top 3 tasks and defer the rest to reduce overload.",
                    "Planning Quality",
                    100 - planning_score
                )
            if proactive_ratio < 0.5 and tasks_total >= 2:
                add_action(
                    "Plan ahead for tomorrow",
                    "Create tomorrow’s top 3 tasks before the day starts.",
                    "Planning Quality",
                    95 - planning_score
                )
            if tagged_ratio < 0.3 and tasks_total >= 3:
                add_action(
                    "Link tasks to goals",
                    "Tag tasks so execution stays aligned with goals.",
                    "Planning Quality",
                    90 - planning_score
                )
            if tasks_with_estimates < 2 and tasks_total >= 3:
                add_action(
                    "Add time estimates",
                    "Estimate durations for planned tasks to improve accuracy.",
                    "Planning Quality",
                    88 - planning_score
                )

        if execution_score < 60:
            if completion_ratio < 0.5 and tasks_created >= 3:
                add_action(
                    "Finish a planned task first",
                    "Complete one planned task before adding new ones.",
                    "Execution IQ",
                    100 - execution_score
                )
            if deep_work_sessions == 0:
                add_action(
                    "Schedule one deep work block",
                    "Do a 25–50 minute focused session.",
                    "Execution IQ",
                    95 - execution_score
                )
            if goal_alignment_ratio < 0.3 and tasks_completed >= 2:
                add_action(
                    "Complete a goal-linked task",
                    "Pick one task tied to a goal and finish it.",
                    "Execution IQ",
                    90 - execution_score
                )

        if adaptation_score < 60:
            if insights_read == 0:
                add_action(
                    "Review one insight",
                    "Read a recent insight and note one adjustment.",
                    "Adaptation",
                    100 - adaptation_score
                )
            if reflection_messages == 0:
                add_action(
                    "Reflect in chat",
                    "Use chat to note what to adjust or improve.",
                    "Adaptation",
                    95 - adaptation_score
                )
            if plan_creations == 0 and tasks_total >= 3:
                add_action(
                    "Adjust your plan once",
                    "Make one intentional change to today’s plan.",
                    "Adaptation",
                    90 - adaptation_score
                )

        if stability_score < 55:
            if active_days < 4:
                add_action(
                    "Build a small daily streak",
                    "Complete at least one task on 3+ days this week.",
                    "Stability",
                    95 - stability_score
                )
            else:
                add_action(
                    "Keep workload steady",
                    "Aim for a consistent number of tasks per day.",
                    "Stability",
                    90 - stability_score
                )

        if learning_score < 55:
            if events_total == 0:
                add_action(
                    "Log one activity",
                    "Complete one task or start a focus session to calibrate learning.",
                    "Learning & Growth",
                    95 - learning_score
                )
            elif len(event_types) < 3:
                add_action(
                    "Try a new feature",
                    "Use a new workflow like goal progress or focus tracking.",
                    "Learning & Growth",
                    90 - learning_score
                )

        actions = sorted(actions, key=lambda a: a.get("priority", 0), reverse=True)
        return actions[:3]

    async def get_score(self, user_id: int, time_range: str = 'daily') -> Dict[str, Any]:
        """
        Get real-time AI Intelligence Score based on time range.
        Supported ranges: 'daily', 'weekly', 'monthly'
        """
        try:
            async for db in get_db():
                readiness = await self._get_readiness(db, user_id)
                if not readiness.get("ready", False):
                    return {
                        "ready": False,
                        "status": "pending",
                        "message": "AI will load your intelligence score soon. Keep working.",
                        "requirements": readiness.get("requirements"),
                        "counts": readiness.get("counts"),
                        "window_days": readiness.get("window_days"),
                        "last_updated": datetime.utcnow().isoformat()
                    }

                if time_range == 'weekly':
                    result = await self._calculate_weekly_score(db, user_id)
                elif time_range == 'monthly':
                    result = await self._calculate_monthly_score(db, user_id)
                else:
                    result = await self._calculate_daily_score(db, user_id)

                result["ready"] = True
                result["status"] = "ready"
                return result
        except Exception as e:
            logger.error(f"Error calculating enhanced AI intelligence score: {e}", exc_info=True)
            return {
                "ready": False,
                "status": "pending",
                "message": "AI will load your intelligence score soon. Keep working.",
                "error": str(e),
                "last_updated": datetime.utcnow().isoformat()
            }

    async def _calculate_daily_score(
        self,
        db,
        user_id: int,
        target_date: datetime = None,
        include_extras: bool = True
    ) -> Dict[str, Any]:
        """Calculate score for a specific day (default today)."""
        if not target_date:
            target_date = datetime.utcnow()

        start_of_day = datetime.combine(target_date.date(), time.min)
        end_of_day = datetime.combine(target_date.date(), time.max)

        # Component calculations
        planning = await self._calculate_planning_quality(db, user_id, start_of_day, end_of_day)
        execution = await self._calculate_execution_intelligence(db, user_id, start_of_day, end_of_day)
        adaptation = await self._calculate_adaptation_reflection(db, user_id, start_of_day, end_of_day)
        stability = await self._calculate_behavioral_stability(db, user_id, start_of_day)
        learning = await self._calculate_learning_growth(db, user_id, start_of_day, end_of_day)

        metrics = {
            "planning_quality": round(planning["score"]),
            "execution_intelligence": round(execution["score"]),
            "adaptation_reflection": round(adaptation["score"]),
            "behavioral_stability": round(stability["score"]),
            "learning_growth": round(learning["score"])
        }

        # Final Weighted Score
        raw_score = (
            (planning["score"] * 0.25) +
            (execution["score"] * 0.30) +
            (adaptation["score"] * 0.20) +
            (stability["score"] * 0.15) +
            (learning["score"] * 0.10)
        )

        final_score = max(0, min(100, round(raw_score)))

        signals = self._merge_signals([
            planning.get("signals", {}),
            execution.get("signals", {}),
            adaptation.get("signals", {}),
            stability.get("signals", {}),
            learning.get("signals", {})
        ])

        activity_total = (
            signals.get("tasks_created", 0) +
            signals.get("tasks_completed", 0) +
            signals.get("chat_messages", 0) +
            signals.get("insights_read", 0) +
            signals.get("events_total", 0)
        )
        signals["active_day"] = 1 if activity_total > 0 else 0

        confidences = {
            "planning": planning.get("confidence", 0.0),
            "execution": execution.get("confidence", 0.0),
            "adaptation": adaptation.get("confidence", 0.0),
            "stability": stability.get("confidence", 0.0),
            "learning": learning.get("confidence", 0.0)
        }

        response: Dict[str, Any] = {
            "score": final_score,
            "category": self._get_category(final_score),
            "context_label": "Daily Snapshot",
            "metrics": metrics,
            "last_updated": datetime.utcnow().isoformat()
        }

        if include_extras:
            baseline = await self._get_baseline_30d(db, user_id)
            if baseline:
                baseline["delta"] = round(final_score - baseline["score"])

            # 7-day sparkline from stored daily scores
            sparkline_7d = []
            try:
                since_7d = datetime.utcnow() - timedelta(days=7)
                spark_res = await db.execute(
                    select(
                        func.date(AIIntelligenceScore.calculated_at).label('date'),
                        func.avg(AIIntelligenceScore.overall_score).label('avg_score')
                    ).where(
                        AIIntelligenceScore.user_id == user_id,
                        AIIntelligenceScore.time_range == "daily",
                        AIIntelligenceScore.calculated_at >= since_7d
                    ).group_by(func.date(AIIntelligenceScore.calculated_at))
                    .order_by(func.date(AIIntelligenceScore.calculated_at))
                )
                sparkline_7d = [round(float(row.avg_score)) for row in spark_res.fetchall()]
            except Exception:
                sparkline_7d = []

            coverage = self._build_coverage(signals, list(confidences.values()))
            response.update({
                "coverage": coverage,
                "baseline": baseline,
                "drivers": self._build_drivers(metrics, signals),
                "next_actions": self._build_next_actions(metrics, signals),
                "confidence": coverage.get("confidence", 0),
                "sparkline_7d": sparkline_7d
            })
        else:
            response["signals"] = signals
            response["confidences"] = confidences

        return response

    async def _calculate_weekly_score(self, db, user_id: int) -> Dict[str, Any]:
        """Weekly score: compute components once across 7-day range, with trend from two halves."""
        today = datetime.utcnow()
        week_start = datetime.combine((today - timedelta(days=6)).date(), time.min)
        week_end = datetime.combine(today.date(), time.max)

        # Compute each component over the full 7-day window (5 queries total, not 35)
        planning = await self._calculate_planning_quality(db, user_id, week_start, week_end)
        execution = await self._calculate_execution_intelligence(db, user_id, week_start, week_end)
        adaptation = await self._calculate_adaptation_reflection(db, user_id, week_start, week_end)
        stability = await self._calculate_behavioral_stability(db, user_id, week_start)
        learning = await self._calculate_learning_growth(db, user_id, week_start, week_end)

        metrics = {
            "planning_quality": round(planning["score"]),
            "execution_intelligence": round(execution["score"]),
            "adaptation_reflection": round(adaptation["score"]),
            "behavioral_stability": round(stability["score"]),
            "learning_growth": round(learning["score"])
        }

        raw_score = (
            (planning["score"] * 0.25) +
            (execution["score"] * 0.30) +
            (adaptation["score"] * 0.20) +
            (stability["score"] * 0.15) +
            (learning["score"] * 0.10)
        )
        final_score = max(0, min(100, round(raw_score)))

        # Lightweight trend: compare recent 3 days vs previous 4 days (only 2 extra score calculations)
        recent_result = await self._calculate_daily_score(db, user_id, today, include_extras=False)
        prev_result = await self._calculate_daily_score(db, user_id, today - timedelta(days=4), include_extras=False)
        trend_delta = recent_result["score"] - prev_result["score"]
        
        if trend_delta > 2:
            trend = "up"
        elif trend_delta < -2:
            trend = "down"
        else:
            trend = "stable"
        trend_percent = round((trend_delta / max(prev_result["score"], 1)) * 100, 1)

        signals = self._merge_signals([
            planning.get("signals", {}),
            execution.get("signals", {}),
            adaptation.get("signals", {}),
            stability.get("signals", {}),
            learning.get("signals", {})
        ])

        confidences = [
            planning.get("confidence", 0.0),
            execution.get("confidence", 0.0),
            adaptation.get("confidence", 0.0),
            stability.get("confidence", 0.0),
            learning.get("confidence", 0.0)
        ]

        coverage = self._build_coverage(signals, confidences)
        baseline = await self._get_baseline_30d(db, user_id)
        if baseline:
            baseline["delta"] = round(final_score - baseline["score"])

        return {
            "score": final_score,
            "category": self._get_category(final_score),
            "context_label": self._get_weekly_context_label([final_score]),
            "trend": trend,
            "trend_percent": trend_percent,
            "metrics": metrics,
            "coverage": coverage,
            "baseline": baseline,
            "drivers": self._build_drivers(metrics, signals),
            "next_actions": self._build_next_actions(metrics, signals),
            "confidence": coverage.get("confidence", 0),
            "last_updated": datetime.utcnow().isoformat(),
        }

    async def _calculate_monthly_score(self, db, user_id: int) -> Dict[str, Any]:
        """Monthly score: compute components once across 30-day range with lightweight trend."""
        today = datetime.utcnow()
        month_start = datetime.combine((today - timedelta(days=29)).date(), time.min)
        month_end = datetime.combine(today.date(), time.max)

        # Compute each component over the full 30-day window (5 queries total, not 150)
        planning = await self._calculate_planning_quality(db, user_id, month_start, month_end)
        execution = await self._calculate_execution_intelligence(db, user_id, month_start, month_end)
        adaptation = await self._calculate_adaptation_reflection(db, user_id, month_start, month_end)
        stability = await self._calculate_behavioral_stability(db, user_id, month_start)
        learning = await self._calculate_learning_growth(db, user_id, month_start, month_end)

        metrics = {
            "planning_quality": round(planning["score"]),
            "execution_intelligence": round(execution["score"]),
            "adaptation_reflection": round(adaptation["score"]),
            "behavioral_stability": round(stability["score"]),
            "learning_growth": round(learning["score"])
        }

        raw_score = (
            (planning["score"] * 0.25) +
            (execution["score"] * 0.30) +
            (adaptation["score"] * 0.20) +
            (stability["score"] * 0.15) +
            (learning["score"] * 0.10)
        )
        final_score = max(0, min(100, round(raw_score)))

        # Lightweight trend: compare recent week vs 3 weeks ago (2 daily score calcs)
        recent_result = await self._calculate_daily_score(db, user_id, today, include_extras=False)
        prev_result = await self._calculate_daily_score(db, user_id, today - timedelta(days=21), include_extras=False)
        trend_delta = recent_result["score"] - prev_result["score"]

        if trend_delta > 3:
            trend = "up"
        elif trend_delta < -3:
            trend = "down"
        else:
            trend = "stable"
        trend_percent = round((trend_delta / max(prev_result["score"], 1)) * 100, 1)

        # Get historical scores for volatility (from stored records, not re-computing)
        stored_scores_result = await db.execute(
            select(AIIntelligenceScore.overall_score).where(
                AIIntelligenceScore.user_id == user_id,
                AIIntelligenceScore.calculated_at >= month_start,
                AIIntelligenceScore.calculated_at <= month_end
            ).order_by(AIIntelligenceScore.calculated_at.desc())
        )
        stored_scores = [row[0] for row in stored_scores_result.fetchall() if row[0] is not None]
        volatility = (max(stored_scores) - min(stored_scores)) if len(stored_scores) >= 2 else 0
        best_day = max(stored_scores) if stored_scores else final_score
        worst_day = min(stored_scores) if stored_scores else final_score

        signals = self._merge_signals([
            planning.get("signals", {}),
            execution.get("signals", {}),
            adaptation.get("signals", {}),
            stability.get("signals", {}),
            learning.get("signals", {})
        ])

        confidences = [
            planning.get("confidence", 0.0),
            execution.get("confidence", 0.0),
            adaptation.get("confidence", 0.0),
            stability.get("confidence", 0.0),
            learning.get("confidence", 0.0)
        ]

        coverage = self._build_coverage(signals, confidences)
        baseline = await self._get_baseline_30d(db, user_id)
        if baseline:
            baseline["delta"] = round(final_score - baseline["score"])

        return {
            "score": final_score,
            "category": self._get_category(final_score),
            "volatility": volatility,
            "best_day_score": best_day,
            "worst_day_score": worst_day,
            "trend": trend,
            "trend_percent": trend_percent,
            "context_label": self._get_weekly_context_label([final_score]),
            "metrics": metrics,
            "coverage": coverage,
            "baseline": baseline,
            "drivers": self._build_drivers(metrics, signals),
            "next_actions": self._build_next_actions(metrics, signals),
            "confidence": coverage.get("confidence", 0),
            "last_updated": datetime.utcnow().isoformat(),
        }

    # -------------------------------------------------------------------------
    # ENHANCED COMPONENT CALCULATIONS
    # -------------------------------------------------------------------------

    async def _calculate_planning_quality(self, db, user_id: int, start: datetime, end: datetime) -> Dict[str, Any]:
        """
        Enhanced Planning Quality (25%):
        - Proactive planning (tasks created before the day starts)
        - Goal linkage (task tags)
        - Planning accuracy (estimated vs actual time)
        - Strategic depth (longer-term tasks)
        - Plan usage (daily/weekly plans created)
        """
        result = await db.execute(
            select(Task).where(
                and_(
                    Task.user_id == user_id,
                    or_(
                        and_(Task.created_at >= start, Task.created_at <= end),
                        and_(Task.completed_at >= start, Task.completed_at <= end)
                    )
                )
            )
        )
        tasks = result.scalars().all()

        total_active_count = len(tasks)
        proactive_tasks = [t for t in tasks if t.created_at and t.created_at < start]
        tagged_tasks = []
        goal_linked_tasks = []
        strategic_tasks = []
        accuracy_sum = 0.0
        accuracy_count = 0

        for t in tasks:
            tags = t.tags or []
            if isinstance(tags, list) and len(tags) > 0:
                tagged_tasks.append(t)
                if any(isinstance(tag, str) and tag.lower().startswith("goal:") for tag in tags):
                    goal_linked_tasks.append(t)
            if t.due_date and (t.due_date - start).days > 7:
                strategic_tasks.append(t)

            estimated = getattr(t, "estimated_minutes", None) or getattr(t, "estimated_duration", None)
            actual = getattr(t, "actual_minutes", None) or getattr(t, "actual_duration", None)
            if estimated and actual and estimated > 0:
                accuracy = 100 - min(100, abs(estimated - actual) / estimated * 100)
                accuracy_sum += accuracy
                accuracy_count += 1

        if total_active_count > 0:
            proactive_ratio = len(proactive_tasks) / total_active_count
            tagged_ratio = len(tagged_tasks) / total_active_count
            strategic_ratio = len(strategic_tasks) / total_active_count
            proactivity_score = self._clamp(50 + (proactive_ratio - 0.5) * 100)
            linkage_score = self._clamp(50 + (tagged_ratio - 0.5) * 100)
            strategic_score = self._clamp(50 + (strategic_ratio - 0.5) * 100)
        else:
            proactivity_score = 50.0
            linkage_score = 50.0
            strategic_score = 50.0

        planning_accuracy_score = (accuracy_sum / accuracy_count) if accuracy_count > 0 else 50.0

        plan_result = await db.execute(
            select(func.count(Plan.id)).where(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end
            )
        )
        plans_created = plan_result.scalar() or 0
        plan_usage_score = self._clamp(min(100, plans_created * 50)) if plans_created > 0 else 50.0

        # Gradual overload penalty: no penalty under 8 tasks, smooth curve above
        if total_active_count <= 8:
            overload_penalty = 1.0
        else:
            overload_penalty = max(0.6, 1.0 - (total_active_count - 8) * 0.02)

        raw_planning = (
            (proactivity_score * 0.25) +
            (linkage_score * 0.20) +
            (planning_accuracy_score * 0.20) +
            (strategic_score * 0.15) +
            (plan_usage_score * 0.20)
        ) * overload_penalty

        evidence = total_active_count + (plans_created * 2)
        confidence = self._confidence(evidence, 8)
        adjusted_score = self._blend(raw_planning, confidence)

        return {
            "score": adjusted_score,
            "raw_score": raw_planning,
            "confidence": confidence,
            "signals": {
                "tasks_total": total_active_count,
                "proactive_tasks": len(proactive_tasks),
                "tagged_tasks": len(tagged_tasks),
                "goal_linked_tasks_planned": len(goal_linked_tasks),
                "strategic_tasks": len(strategic_tasks),
                "tasks_with_estimates": accuracy_count,
                "planning_accuracy_sum": accuracy_sum,
                "planning_accuracy_count": accuracy_count,
                "plans_created": plans_created
            }
        }

    async def _calculate_execution_intelligence(self, db, user_id: int, start: datetime, end: datetime) -> Dict[str, Any]:
        """
        Enhanced Execution Intelligence (30%):
        - Completion rate
        - Priority impact
        - Deep work usage
        - Efficiency of task completion
        - Goal-oriented execution
        """
        created_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.created_at >= start,
                Task.created_at <= end
            )
        )
        tasks_created = created_result.scalar() or 0

        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start,
                Task.completed_at <= end
            )
        )
        completed_tasks = result.scalars().all()
        tasks_completed = len(completed_tasks)

        # Completion rate
        if tasks_created > 0:
            completion_ratio = tasks_completed / tasks_created
        elif tasks_completed > 0:
            completion_ratio = 1.0
        else:
            completion_ratio = 0.0
        completion_score = self._clamp(completion_ratio * 100)

        # Priority impact
        priority_weights = {"urgent": 3, "high": 2, "medium": 1, "low": 0.5}
        if completed_tasks:
            avg_weight = sum(priority_weights.get(t.priority, 1) for t in completed_tasks) / len(completed_tasks)
            priority_score = self._clamp((avg_weight / 3) * 100)
        else:
            priority_score = 50.0

        # Deep work usage (events preferred, fallback to plan schedule)
        dw_events = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end,
                AnalyticsEvent.event_type.in_(["deep_work_completed", "deep_work_session", "focus_session"])
            )
        )
        deep_work_sessions = dw_events.scalar() or 0

        if deep_work_sessions == 0:
            dw_result = await db.execute(
                select(Plan).where(
                    Plan.user_id == user_id,
                    Plan.plan_type == 'deep_work',
                    Plan.date >= start,
                    Plan.date <= end
                )
            )
            deep_works = dw_result.scalars().all()
            if deep_works:
                completed_blocks = 0
                for dw in deep_works:
                    schedule = dw.schedule or {}
                    if isinstance(schedule, dict):
                        if schedule.get("completed") or schedule.get("status") == "completed":
                            completed_blocks += 1
                    elif isinstance(schedule, list):
                        completed_blocks += sum(1 for block in schedule if block.get("completed", False))
                deep_work_sessions = completed_blocks

        deep_work_score = self._clamp(min(100, deep_work_sessions * 35)) if deep_work_sessions > 0 else 50.0

        # Efficiency score (tasks per hour)
        total_time_spent = sum(t.actual_minutes or 0 for t in completed_tasks)
        if total_time_spent > 0:
            tasks_per_hour = tasks_completed / max(total_time_spent / 60, 0.5)
            efficiency_score = self._clamp(40 + (tasks_per_hour * 12))
        elif tasks_completed > 0:
            efficiency_score = 60.0
        else:
            efficiency_score = 50.0

        # Goal-oriented execution
        goal_linked_tasks = [
            t for t in completed_tasks
            if t.tags and any(isinstance(tag, str) and tag.lower().startswith("goal:") for tag in t.tags)
        ]
        goal_alignment_score = self._clamp((len(goal_linked_tasks) / tasks_completed) * 100) if tasks_completed > 0 else 50.0

        raw_execution = (
            (completion_score * 0.35) +
            (priority_score * 0.20) +
            (deep_work_score * 0.15) +
            (efficiency_score * 0.15) +
            (goal_alignment_score * 0.15)
        )

        evidence = max(tasks_created, tasks_completed) + deep_work_sessions
        confidence = self._confidence(evidence, 6)
        adjusted_score = self._blend(raw_execution, confidence)

        return {
            "score": adjusted_score,
            "raw_score": raw_execution,
            "confidence": confidence,
            "signals": {
                "tasks_created": tasks_created,
                "tasks_completed": tasks_completed,
                "deep_work_sessions": deep_work_sessions,
                "goal_linked_tasks_completed": len(goal_linked_tasks),
                "total_time_spent_minutes": total_time_spent
            }
        }

    async def _calculate_adaptation_reflection(self, db, user_id: int, start: datetime, end: datetime) -> Dict[str, Any]:
        """
        Enhanced Adaptation & Reflection (20%):
        - Insights viewed
        - Reflective chat usage
        - Plan adjustments
        - Reflection events
        """
        # 1. Insight Interaction
        insight_res = await db.execute(
            select(func.count(UserInsight.id)).where(
                UserInsight.user_id == user_id,
                UserInsight.read_at != None,
                UserInsight.read_at >= start,
                UserInsight.read_at <= end
            )
        )
        insights_read = insight_res.scalar() or 0
        insight_score = min(100, insights_read * 35)  # 3 insights read = 100%

        # 2. Chat Reflection — require at least 2 reflective keywords per message
        # to avoid false positives from casual mentions of "why" or "plan"
        reflection_keywords = [
            "why did", "what went wrong", "how can i improve", "failed", "adjust",
            "reflect", "review my", "learn from", "do better", "change my approach",
            "what worked", "what didn't", "next time", "lesson", "struggle",
            "improve my", "rethink", "reconsider", "mistake"
        ]
        # Also count phrase-level matches for shorter keywords (need 2+)
        short_keywords = ["fail", "adjust", "review", "learn", "improve", "wrong", "better"]
        chat_res = await db.execute(
            select(ChatMessage.content)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == 'user',
                ChatMessage.created_at >= start,
                ChatMessage.created_at <= end
            )
        )
        messages = [row[0] for row in chat_res.fetchall()]
        reflection_count = 0
        for msg in messages:
            text = (msg or "").lower()
            # Check for strong reflective phrases first
            if any(phrase in text for phrase in reflection_keywords):
                reflection_count += 1
            else:
                # For weaker single keywords, require 2+ matches in the same message
                short_matches = sum(1 for k in short_keywords if k in text)
                if short_matches >= 2:
                    reflection_count += 1

        chat_score = min(100, reflection_count * 20)

        # 3. Plan adjustments (fallback to plan creations)
        plan_creations = await db.execute(
            select(func.count(Plan.id)).where(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end
            )
        )
        adaptations = plan_creations.scalar() or 0
        adaptation_score = min(100, adaptations * 25)

        # 4. Reflection events from analytics
        reflection_events = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end,
                AnalyticsEvent.event_type.in_([
                    "reflection_session",
                    "planning_session",
                    "plan_reviewed",
                    "insight_applied",
                    "retrospective"
                ])
            )
        )
        reflection_event_count = reflection_events.scalar() or 0
        reflection_event_score = min(100, reflection_event_count * 30)

        raw_adaptation = (
            (insight_score * 0.30) +
            (chat_score * 0.30) +
            (adaptation_score * 0.20) +
            (reflection_event_score * 0.20)
        )

        evidence = insights_read + reflection_count + reflection_event_count + (adaptations * 0.5)
        confidence = self._confidence(evidence, 4)
        adjusted_score = self._blend(raw_adaptation, confidence)

        return {
            "score": adjusted_score,
            "raw_score": raw_adaptation,
            "confidence": confidence,
            "signals": {
                "insights_read": insights_read,
                "reflection_messages": reflection_count,
                "chat_messages": len(messages),
                "plan_adjustments": adaptations,
                "reflection_events": reflection_event_count
            }
        }

    async def _calculate_behavioral_stability(self, db, user_id: int, today_start: datetime) -> Dict[str, Any]:
        """
        Enhanced Behavioral Stability (15%):
        - 7-day rolling consistency (not just today vs yesterday)
        - Coefficient of variation instead of raw diffs
        - Active day ratio (how many of 7 days had any activity)
        - Penalizes big gaps, not weekend breaks
        """
        week_ago = today_start - timedelta(days=7)

        # Get daily task counts for the last 7 days
        week_results = await db.execute(
            select(
                func.date(Task.completed_at).label('date'),
                func.count(Task.id).label('count')
            ).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= week_ago
            ).group_by(func.date(Task.completed_at))
        )
        daily_counts_map = {row.date: row.count for row in week_results.fetchall()}

        # Build full 7-day array (0 for days with no activity)
        daily_counts = []
        for i in range(7):
            d = (today_start - timedelta(days=i)).date()
            daily_counts.append(daily_counts_map.get(d, 0))

        active_days = sum(1 for c in daily_counts if c > 0)
        total_completed = sum(daily_counts)

        if active_days == 0:
            raw_stability = 50.0
        else:
            # 1. Consistency score via coefficient of variation (lower = more stable)
            avg = total_completed / 7  # divide by 7 not active_days to penalize gaps
            if avg > 0:
                variance = sum((c - avg) ** 2 for c in daily_counts) / 7
                std_dev = variance ** 0.5
                cv = std_dev / avg  # coefficient of variation
                # cv of 0 = perfectly consistent, cv > 1.5 = very erratic
                consistency_score = max(0, 100 - (cv * 50))
            else:
                consistency_score = 50.0

            # 2. Active day ratio (5/7 days = great, 2/7 = poor)
            active_ratio_score = min(100, (active_days / 5) * 100)  # 5+ days = 100%

            # 3. No big gaps (max consecutive zero days)
            max_gap = 0
            current_gap = 0
            for c in daily_counts:
                if c == 0:
                    current_gap += 1
                    max_gap = max(max_gap, current_gap)
                else:
                    current_gap = 0
            gap_score = max(0, 100 - (max_gap * 25))  # 4+ day gap = 0

            raw_stability = (
                (consistency_score * 0.45) +
                (active_ratio_score * 0.30) +
                (gap_score * 0.25)
            )

        confidence = self._confidence(active_days, 4)
        adjusted_score = self._blend(raw_stability, confidence)

        return {
            "score": adjusted_score,
            "raw_score": raw_stability,
            "confidence": confidence,
            "signals": {
                "active_days": active_days,
                "today_completed": daily_counts[0] if daily_counts else 0,
                "total_7d": total_completed
            }
        }

    async def _calculate_learning_growth(self, db, user_id: int, start: datetime, end: datetime) -> Dict[str, Any]:
        """
        Learning & Growth Component (10%):
        - Diversity of behaviors
        - Improvement in metrics
        - Experimentation with new approaches
        """
        event_types_res = await db.execute(
            select(AnalyticsEvent.event_type)
            .where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end
            )
            .distinct()
        )
        event_types = [row[0] for row in event_types_res.fetchall() if row and row[0]]
        unique_event_types = len(event_types)

        diversity_score = min(100, unique_event_types * 12)

        metrics = await db.execute(
            select(RealTimeMetrics).where(
                RealTimeMetrics.user_id == user_id
            ).order_by(RealTimeMetrics.updated_at.desc()).limit(1)
        )
        current_metrics = metrics.scalar_one_or_none()

        improvement_score = 50.0
        if current_metrics:
            improvement_score = min(100, (current_metrics.focus_score * 0.5) + (current_metrics.engagement_score * 0.5))

        experimental_events = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end,
                AnalyticsEvent.event_type.in_([
                    'feature_discovered', 'tool_used', 'experiment_started',
                    'new_approach_tried', 'method_changed'
                ])
            )
        )
        experiments = experimental_events.scalar() or 0
        experimentation_score = min(100, experiments * 25)

        events_total_res = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start,
                AnalyticsEvent.timestamp <= end
            )
        )
        events_total = events_total_res.scalar() or 0

        raw_learning = (
            (diversity_score * 0.4) +
            (improvement_score * 0.4) +
            (experimentation_score * 0.2)
        )

        confidence = self._confidence(events_total + (experiments * 2), 8)
        adjusted_score = self._blend(raw_learning, confidence)

        return {
            "score": adjusted_score,
            "raw_score": raw_learning,
            "confidence": confidence,
            "signals": {
                "event_types": event_types,
                "events_total": events_total,
                "experiments": experiments
            }
        }

    def _get_category(self, score: int) -> str:
        if score < 30: return "Warming Up"
        if score < 50: return "Building Habits"
        if score < 70: return "Strategically Focused"
        if score < 85: return "Highly Optimized"
        return "Elite Executor"

    def _get_weekly_context_label(self, scores: List[int]) -> str:
        if not scores: return "No data"
        avg = sum(scores) / len(scores)

        if avg > 85: return "Peak Performance"
        if avg > 70: return "High Performance"
        if avg > 55: return "Stable Execution"
        if avg > 40: return "Building Consistency"
        return "Needs Calibration"

    async def update_score_realtime(self, user_id: int, event_data: Dict[str, Any]):
        """
        Update the intelligence score in real-time based on user behavior.
        This method should be called whenever significant user events occur.
        """
        try:
            # Calculate the current score
            current_score = await self.get_score(user_id, 'daily')
            if not current_score.get("ready", True):
                return
            
            # Store in database for historical tracking
            async for db in get_db():
                score_record = AIIntelligenceScore(
                    user_id=user_id,
                    calculated_at=datetime.utcnow(),
                    time_range='daily',
                    overall_score=current_score['score'],
                    category=current_score['category'],
                    planning_quality=current_score['metrics']['planning_quality'],
                    execution_intelligence=current_score['metrics']['execution_intelligence'],
                    adaptation_reflection=current_score['metrics']['adaptation_reflection'],
                    behavioral_stability=current_score['metrics']['behavioral_stability'],
                    meta={
                        'trigger_event': event_data.get('event_type'),
                        'event_timestamp': event_data.get('timestamp'),
                        'user_behavior_context': event_data.get('metadata', {}),
                        'learning_growth': current_score['metrics'].get('learning_growth', 50),  # Store in meta since not in DB schema
                        'calculated_at': datetime.utcnow().isoformat()
                    }
                )
                
                db.add(score_record)
                await db.commit()
                
                # Update RealTimeMetrics with the new score
                metrics = await db.execute(
                    select(RealTimeMetrics).where(RealTimeMetrics.user_id == user_id)
                )
                metrics_record = metrics.scalar_one_or_none()
                
                if metrics_record:
                    metrics_record.focus_score = current_score['score']
                    metrics_record.updated_at = datetime.utcnow()
                    await db.commit()
                    
                    # Broadcast the update to real-time systems
                    try:
                        from backend.realtime.socket_manager import broadcast_analytics_update
                        await broadcast_analytics_update(user_id, {
                            "type": "intelligence_score_updated",
                            "score": current_score['score'],
                            "category": current_score['category'],
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except ImportError:
                        # Socket manager not available, skip broadcasting
                        pass
        except Exception as e:
            logger.error(f"Error updating real-time intelligence score: {e}", exc_info=True)


# Singleton instance
enhanced_ai_intelligence_service = EnhancedAIIntelligenceService()
