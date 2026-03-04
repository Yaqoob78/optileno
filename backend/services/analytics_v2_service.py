from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import math
import re
import statistics
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.db.database import get_db
from backend.db.models import (
    AnalyticsEvent,
    BigFiveTest,
    ChatMessage,
    ChatSession,
    FocusScore,
    Goal,
    Plan,
    Task,
    User,
)
from backend.services.deep_work_utils import extract_deep_work_session_metrics


@dataclass
class RangeWindow:
    time_range: str
    period_start: datetime
    period_end: datetime
    timezone_name: str


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


class AnalyticsV2Service:
    SCORE_VERSION = "v3"

    async def resolve_window(self, user: User, time_range: str) -> RangeWindow:
        tr = (time_range or "daily").strip().lower()
        if tr not in {"daily", "weekly", "monthly"}:
            tr = "daily"

        tz_name = "UTC"
        if isinstance(user.preferences, dict):
            tz_name = user.preferences.get("timezone") or "UTC"

        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
            tz_name = "UTC"

        now_local = datetime.now(tz)
        if tr == "daily":
            # Start of today (00:00:00)
            start_local = datetime.combine(now_local.date(), time.min, tzinfo=tz)
        elif tr == "weekly":
            # Start of the week (7 days ago to simulate rolling week or start of Monday)
            start_local = datetime.combine(now_local.date() - timedelta(days=6), time.min, tzinfo=tz)
        else:
            # Monthly/30-days
            start_local = datetime.combine(now_local.date() - timedelta(days=29), time.min, tzinfo=tz)

        # End is always end of today (23:59:59.999999)
        end_local = datetime.combine(now_local.date(), time.max, tzinfo=tz)
        
        return RangeWindow(
            time_range=tr,
            period_start=start_local.astimezone(timezone.utc),
            period_end=end_local.astimezone(timezone.utc),
            timezone_name=tz_name,
        )

    def _meta(
        self,
        window: RangeWindow,
        *,
        source: str,
        confidence: float,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = {
            "time_range": window.time_range,
            "period_start": window.period_start.isoformat(),
            "period_end": window.period_end.isoformat(),
            "score_version": self.SCORE_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "confidence": round(_clamp(confidence, 0.0, 1.0), 3),
        }
        if extra:
            payload.update(extra)
        return payload

    async def _safe_burnout_snapshot(
        self,
        user: User,
        time_range: str,
        *,
        default: float,
    ) -> float:
        """Fetch burnout risk without propagating nested analytics failures."""
        try:
            burnout_data = await self.burnout_risk(user, time_range)
            risk = burnout_data.get("risk") if isinstance(burnout_data, dict) else None
            return float(risk) if risk is not None else float(default)
        except Exception:
            return float(default)

    async def _active_days_count(self, db: AsyncSession, user_id: int, window: RangeWindow) -> int:
        task_rows = await db.execute(
            select(Task.completed_at).where(
                Task.user_id == user_id,
                Task.completed_at.isnot(None),
                Task.completed_at >= window.period_start,
                Task.completed_at <= window.period_end,
            )
        )
        plan_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                Plan.date >= window.period_start,
                Plan.date <= window.period_end,
            )
        )
        chat_rows = await db.execute(
            select(ChatMessage.created_at)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == "user",
                ChatMessage.created_at >= window.period_start,
                ChatMessage.created_at <= window.period_end,
            )
        )
        days: set[date] = set()
        for dt in task_rows.scalars().all():
            if dt:
                days.add(dt.date())
        for plan in plan_rows.scalars().all():
            if not getattr(plan, "date", None):
                continue
            metrics = extract_deep_work_session_metrics(plan)
            if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                continue
            days.add(plan.date.date())
        for dt in chat_rows.scalars().all():
            if dt:
                days.add(dt.date())
        return len(days)

    async def _usage_inputs(self, db: AsyncSession, user_id: int, window: RangeWindow) -> Dict[str, Any]:
        tasks_created = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.created_at >= window.period_start,
                    Task.created_at <= window.period_end,
                )
            )
        ).scalar() or 0

        tasks_completed = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.status == "completed",
                    Task.completed_at.isnot(None),
                    Task.completed_at >= window.period_start,
                    Task.completed_at <= window.period_end,
                )
            )
        ).scalar() or 0

        goal_linked_completed = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.status == "completed",
                    Task.goal_id.isnot(None),
                    Task.completed_at.isnot(None),
                    Task.completed_at >= window.period_start,
                    Task.completed_at <= window.period_end,
                )
            )
        ).scalar() or 0

        high_energy_completed = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.status == "completed",
                    Task.priority.in_(["high", "urgent"]),
                    Task.completed_at.isnot(None),
                    Task.completed_at >= window.period_start,
                    Task.completed_at <= window.period_end,
                )
            )
        ).scalar() or 0

        on_time_completed = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.status == "completed",
                    Task.due_date.isnot(None),
                    Task.completed_at <= Task.due_date,
                    Task.completed_at >= window.period_start,
                    Task.completed_at <= window.period_end,
                )
            )
        ).scalar() or 0

        deep_work_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                Plan.date >= window.period_start,
                Plan.date <= window.period_end,
            )
        )
        deep_work_sessions = deep_work_rows.scalars().all()
        deep_work_minutes = 0
        deep_work_completed_sessions = 0
        for item in deep_work_sessions:
            metrics = extract_deep_work_session_metrics(item)
            if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                continue
            deep_work_minutes += int(metrics["effective_minutes"])
            deep_work_completed_sessions += 1

        habits_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "habit",
            )
        )
        habits = habits_rows.scalars().all()
        habits_total = len(habits)
        habits_completed = 0
        active_streaks = 0
        habits_missed = 0
        
        now_dt = datetime.now(timezone.utc)
        for habit in habits:
            schedule = habit.schedule if isinstance(habit.schedule, dict) else {}
            completed_raw = schedule.get("lastCompleted")
            streak = int(schedule.get("streak", 0))
            if not completed_raw:
                habits_missed += 1
                continue
            try:
                completed_dt = datetime.fromisoformat(str(completed_raw).replace("Z", "+00:00"))
                if completed_dt.tzinfo is None:
                    completed_dt = completed_dt.replace(tzinfo=timezone.utc)
                    
                if window.period_start <= completed_dt <= window.period_end:
                    habits_completed += 1
                    
                days_since = (now_dt.date() - completed_dt.date()).days
                if days_since <= 1 and streak >= 2:
                    active_streaks += streak
                elif days_since > 1:
                    habits_missed += 1
                    
            except Exception:
                habits_missed += 1
                continue

        chat_requests = (
            await db.execute(
                select(func.count(ChatMessage.id))
                .join(ChatSession, ChatMessage.session_id == ChatSession.id)
                .where(
                    ChatSession.user_id == user_id,
                    ChatMessage.role == "user",
                    ChatMessage.created_at >= window.period_start,
                    ChatMessage.created_at <= window.period_end,
                )
            )
        ).scalar() or 0

        active_days = await self._active_days_count(db, user_id, window)

        pending_tasks = (
            await db.execute(
                select(func.count(Task.id)).where(
                    Task.user_id == user_id,
                    Task.status.in_(["pending", "planned", "in-progress"]),
                )
            )
        ).scalar() or 0

        return {
            "tasks_created": int(tasks_created),
            "tasks_completed": int(tasks_completed),
            "goal_linked_completed": int(goal_linked_completed),
            "high_energy_completed": int(high_energy_completed),
            "on_time_completed": int(on_time_completed),
            "deep_work_minutes": int(deep_work_minutes),
            "deep_work_sessions": int(deep_work_completed_sessions),
            "habits_total": int(habits_total),
            "habits_completed": int(habits_completed),
            "chat_requests": int(chat_requests),
            "active_days": int(active_days),
            "pending_tasks": int(pending_tasks),
            "active_streaks": int(active_streaks),
            "habits_missed": int(habits_missed),
        }

    async def _goal_progress_summary(
        self,
        db: AsyncSession,
        user_id: int,
        window: RangeWindow,
        *,
        goal_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        stmt = select(Goal).where(Goal.user_id == user_id)
        if goal_id is not None:
            stmt = stmt.where(Goal.id == goal_id)
        goals_rows = await db.execute(stmt)
        goals = goals_rows.scalars().all()
        if not goals:
            return {
                "score": None,
                "reason": "NO_ACTIVE_GOALS",
                "overall_band": None,
                "goals": [],
            }

        goal_items: List[Dict[str, Any]] = []
        goal_scores: List[float] = []

        for goal in goals:
            progress = float(goal.current_progress or 0)
            created_at = goal.created_at or window.period_start
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            target_date = goal.target_date or (created_at + timedelta(days=30))
            if isinstance(target_date, datetime) and target_date.tzinfo is None:
                target_date = target_date.replace(tzinfo=timezone.utc)

            total_days = max((target_date.date() - created_at.date()).days, 1)
            elapsed_days = _clamp((window.period_end.date() - created_at.date()).days, 0, float(total_days))
            expected_progress = _clamp((elapsed_days / total_days) * 100.0)
            pace_delta = progress - expected_progress

            linked_completed = (
                await db.execute(
                    select(func.count(Task.id)).where(
                        Task.user_id == user_id,
                        Task.goal_id == goal.id,
                        Task.status == "completed",
                        Task.completed_at.isnot(None),
                        Task.completed_at >= window.period_start,
                        Task.completed_at <= window.period_end,
                    )
                )
            ).scalar() or 0
            linked_created = (
                await db.execute(
                    select(func.count(Task.id)).where(
                        Task.user_id == user_id,
                        Task.goal_id == goal.id,
                        Task.created_at >= window.period_start,
                        Task.created_at <= window.period_end,
                    )
                )
            ).scalar() or 0

            consistency = 0.0
            if linked_created > 0:
                consistency = _clamp((linked_completed / linked_created) * 100.0)
            elif linked_completed > 0:
                consistency = 80.0

            probability = (
                progress * 0.50
                + _clamp(50.0 + pace_delta * 1.2) * 0.35
                + consistency * 0.15
            )
            probability = _clamp(probability)

            if probability < 20:
                band = "very_low"
            elif probability < 40:
                band = "low"
            elif probability < 60:
                band = "mid"
            elif probability < 80:
                band = "high"
            else:
                band = "very_high"

            goal_items.append(
                {
                    "goal_id": goal.id,
                    "title": goal.title,
                    "category": goal.category or "custom",
                    "progress": round(progress, 1),
                    "expected_progress": round(expected_progress, 1),
                    "pace_delta": round(pace_delta, 1),
                    "completion_probability": round(probability, 1),
                    "probability_band": band,
                    "linked_tasks_created": int(linked_created),
                    "linked_tasks_completed": int(linked_completed),
                    "target_date": target_date.isoformat() if isinstance(target_date, datetime) else None,
                }
            )
            goal_scores.append(probability)

        overall_score = sum(goal_scores) / len(goal_scores) if goal_scores else None
        overall_band = None
        if overall_score is not None:
            if overall_score < 20:
                overall_band = "very_low"
            elif overall_score < 40:
                overall_band = "low"
            elif overall_score < 60:
                overall_band = "mid"
            elif overall_score < 80:
                overall_band = "high"
            else:
                overall_band = "very_high"

        return {
            "score": round(overall_score, 1) if overall_score is not None else None,
            "overall_band": overall_band,
            "goals": goal_items,
        }

    @staticmethod
    def _sigmoid(value: float) -> float:
        if value < -40:
            return 0.0
        if value > 40:
            return 1.0
        return 1.0 / (1.0 + math.exp(-value))

    @staticmethod
    def _safe_dt(value: Any, fallback: datetime) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return fallback

    @staticmethod
    def _goal_keywords(goal: Goal) -> List[str]:
        text = f"{goal.title or ''} {goal.description or ''} {goal.category or ''}".lower()
        tokens = re.findall(r"[a-z]{3,}", text)
        stop = {
            "the",
            "and",
            "for",
            "with",
            "that",
            "this",
            "goal",
            "plan",
            "task",
            "from",
            "into",
            "your",
            "you",
            "daily",
            "weekly",
            "monthly",
        }
        unique: List[str] = []
        for tok in tokens:
            if tok in stop:
                continue
            if tok not in unique:
                unique.append(tok)
            if len(unique) >= 12:
                break
        return unique

    def _classify_goal_archetype(self, goal: Goal, *, now: datetime) -> Dict[str, Any]:
        text = f"{goal.title or ''} {goal.description or ''} {goal.category or ''}".lower()

        target = goal.target_date
        if isinstance(target, datetime):
            target = target if target.tzinfo else target.replace(tzinfo=timezone.utc)
            days_left = max((target.date() - now.date()).days, 0)
        else:
            days_left = 30

        if days_left <= 14:
            return {"archetype": "blitz", "confidence": 0.92, "reason": "short_deadline"}

        grind_patterns = (
            "exam",
            "jee",
            "neet",
            "study",
            "revision",
            "chapter",
            "mock",
            "interview",
            "syllabus",
            "test",
            "score",
        )
        routine_patterns = (
            "weight",
            "lose",
            "fitness",
            "habit",
            "routine",
            "sleep",
            "diet",
            "walk",
            "yoga",
            "meditat",
            "health",
        )
        builder_patterns = (
            "build",
            "project",
            "portfolio",
            "skill",
            "learn",
            "launch",
            "create",
            "develop",
            "ship",
            "business",
            "product",
        )

        grind_hits = sum(1 for p in grind_patterns if p in text)
        routine_hits = sum(1 for p in routine_patterns if p in text)
        builder_hits = sum(1 for p in builder_patterns if p in text)

        if grind_hits >= routine_hits and grind_hits >= builder_hits and grind_hits > 0:
            return {
                "archetype": "grind",
                "confidence": min(0.95, 0.62 + grind_hits * 0.08),
                "reason": "exam_intensity_signals",
            }
        if routine_hits >= grind_hits and routine_hits >= builder_hits and routine_hits > 0:
            return {
                "archetype": "routine",
                "confidence": min(0.95, 0.62 + routine_hits * 0.08),
                "reason": "habit_consistency_signals",
            }
        if builder_hits > 0:
            return {
                "archetype": "builder",
                "confidence": min(0.95, 0.62 + builder_hits * 0.08),
                "reason": "project_skill_signals",
            }

        return {"archetype": "builder", "confidence": 0.55, "reason": "default_builder"}

    @staticmethod
    def _get_archetype_weights(archetype: str) -> Dict[str, float]:
        matrix: Dict[str, Dict[str, float]] = {
            "grind": {"tasks": 0.30, "habits": 0.10, "deep_work": 0.50, "ai_resonance": 0.10},
            "routine": {"tasks": 0.15, "habits": 0.65, "deep_work": 0.05, "ai_resonance": 0.15},
            "builder": {"tasks": 0.40, "habits": 0.20, "deep_work": 0.30, "ai_resonance": 0.10},
            "blitz": {"tasks": 0.80, "habits": 0.00, "deep_work": 0.20, "ai_resonance": 0.00},
        }
        return matrix.get(archetype, matrix["builder"])

    @staticmethod
    def _probability_band(score: float) -> str:
        if score < 30:
            return "very_low"
        if score < 60:
            return "low"
        if score < 76:
            return "mid"
        if score <= 90:
            return "high"
        return "very_high"

    def _goal_action_preview(
        self,
        *,
        task_score: float,
        habit_score: float,
        deep_work_score: float,
        ai_resonance: float,
        pace_ratio: float,
        days_inactive: int,
        overdue_high_impact: int,
    ) -> List[Dict[str, Any]]:
        actions: List[Dict[str, Any]] = []
        if task_score < 60:
            actions.append(
                {
                    "title": "Finish one high-impact task today",
                    "why": "Task completion is currently the bottleneck.",
                    "expected_momentum_lift": [4, 8],
                    "expected_probability_lift": [1.5, 3.5],
                }
            )
        if habit_score < 55:
            actions.append(
                {
                    "title": "Complete your next habit block now",
                    "why": "Consistency signal is weak and can be recovered quickly.",
                    "expected_momentum_lift": [3, 7],
                    "expected_probability_lift": [1.0, 2.8],
                }
            )
        if deep_work_score < 65 or pace_ratio < 1.0:
            actions.append(
                {
                    "title": "Book a focused deep-work session",
                    "why": "Execution pace is below required velocity.",
                    "expected_momentum_lift": [5, 10],
                    "expected_probability_lift": [1.8, 4.2],
                }
            )
        if ai_resonance < 50:
            actions.append(
                {
                    "title": "Ask Leno for one goal-specific next-step plan",
                    "why": "Low strategic alignment in AI interactions.",
                    "expected_momentum_lift": [2, 5],
                    "expected_probability_lift": [0.8, 2.0],
                }
            )
        if days_inactive >= 3:
            actions.append(
                {
                    "title": "Do one 15-minute restart action",
                    "why": "Inactivity decay is reducing completion probability.",
                    "expected_momentum_lift": [6, 12],
                    "expected_probability_lift": [2.0, 5.0],
                }
            )
        if overdue_high_impact > 0:
            actions.append(
                {
                    "title": "Clear one overdue high-impact task",
                    "why": "Overdue high-impact tasks trigger gate penalties.",
                    "expected_momentum_lift": [4, 9],
                    "expected_probability_lift": [1.4, 3.8],
                }
            )
        return actions[:3]

    async def _goal_progress_summary_v3(
        self,
        db: AsyncSession,
        user: User,
        window: RangeWindow,
        *,
        goal_id: Optional[int] = None,
        burnout_risk_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        stmt = select(Goal).where(Goal.user_id == user.id, Goal.current_progress < 100)
        if goal_id is not None:
            stmt = stmt.where(Goal.id == goal_id)
        goals_rows = await db.execute(stmt)
        goals = goals_rows.scalars().all()
        if not goals:
            return {
                "score": None,
                "momentum_score": None,
                "reason": "NO_ACTIVE_GOALS",
                "overall_band": None,
                "goals": [],
            }

        now = window.period_end
        lookback_start = window.period_start - timedelta(days=14)

        tasks_rows = await db.execute(select(Task).where(Task.user_id == user.id))
        all_tasks = tasks_rows.scalars().all()

        plans_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user.id,
                Plan.plan_type.in_(["habit", "deep_work"]),
            )
        )
        all_plans = plans_rows.scalars().all()
        all_habits = [p for p in all_plans if p.plan_type == "habit"]
        all_deep_work = [p for p in all_plans if p.plan_type == "deep_work"]

        chat_rows = await db.execute(
            select(ChatMessage.content, ChatMessage.created_at)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user.id,
                ChatMessage.role == "user",
                ChatMessage.created_at >= window.period_start,
                ChatMessage.created_at <= window.period_end,
            )
        )
        chat_messages = chat_rows.all()

        insight_events = (
            await db.execute(
                select(func.count(AnalyticsEvent.id)).where(
                    AnalyticsEvent.user_id == user.id,
                    AnalyticsEvent.timestamp >= window.period_start,
                    AnalyticsEvent.timestamp <= window.period_end,
                    AnalyticsEvent.event_type.in_(
                        ["insight_applied", "strategy_applied", "plan_adjusted", "goal_replanned"]
                    ),
                )
            )
        ).scalar() or 0

        focus_rows = await db.execute(
            select(FocusScore.score).where(
                FocusScore.user_id == user.id,
                FocusScore.date >= window.period_start,
                FocusScore.date <= window.period_end,
            )
        )
        focus_scores = [float(s) for s in focus_rows.scalars().all() if s is not None]
        focus_avg = sum(focus_scores) / len(focus_scores) if focus_scores else 52.0

        burnout_value = float(burnout_risk_score) if burnout_risk_score is not None else 45.0

        goal_items: List[Dict[str, Any]] = []
        probabilities: List[float] = []
        momentum_values: List[float] = []
        confidence_values: List[float] = []

        for goal in goals:
            goal_now = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            created_at = self._safe_dt(goal.created_at, window.period_start)
            target_dt = self._safe_dt(goal.target_date, created_at + timedelta(days=30))
            total_days = max((target_dt.date() - created_at.date()).days, 1)
            elapsed_days = _clamp((goal_now.date() - created_at.date()).days, 0, float(total_days))
            days_remaining = max((target_dt.date() - goal_now.date()).days, 1)
            progress = float(goal.current_progress or 0.0)
            expected_progress = _clamp((elapsed_days / total_days) * 100.0)
            pace_delta = progress - expected_progress

            goal_tag = f"goal:{goal.id}"
            linked_tasks = []
            for task in all_tasks:
                task_tags = task.tags if isinstance(task.tags, list) else []
                has_tag = any(str(t).lower() == goal_tag for t in task_tags)
                if task.goal_id == goal.id or has_tag:
                    linked_tasks.append(task)

            def _habit_linked(plan: Plan) -> bool:
                if plan.goal_id == goal.id:
                    return True
                schedule = plan.schedule if isinstance(plan.schedule, dict) else {}
                direct = schedule.get("goal_link") or schedule.get("goalLink")
                return str(direct) == str(goal.id)

            linked_habits = [h for h in all_habits if _habit_linked(h)]
            linked_deep = [
                d
                for d in all_deep_work
                if (
                    d.goal_id == goal.id
                    and isinstance(d.date, datetime)
                    and self._safe_dt(d.date, window.period_start) >= lookback_start
                    and self._safe_dt(d.date, window.period_start) <= window.period_end
                )
            ]

            archetype_info = self._classify_goal_archetype(goal, now=goal_now)
            archetype = str(archetype_info["archetype"])
            weights = self._get_archetype_weights(archetype)

            high_impact_markers = {
                "finish",
                "complete",
                "solve",
                "write",
                "submit",
                "build",
                "practice",
                "revise",
                "revision",
                "implement",
                "ship",
                "deliver",
                "run",
            }
            low_impact_markers = {"setup", "register", "buy", "organize", "plan", "create list"}

            def _task_impact_multiplier(task: Task) -> float:
                text = f"{task.title or ''} {task.description or ''}".lower()
                multiplier = 1.8
                if any(m in text for m in high_impact_markers):
                    multiplier = 3.0
                elif any(m in text for m in low_impact_markers):
                    multiplier = 1.0
                pr = str(task.priority or "medium").lower()
                if pr == "high":
                    multiplier += 0.3
                elif pr == "urgent":
                    multiplier += 0.5
                return multiplier

            total_task_weight = 0.0
            completed_task_weight = 0.0
            overdue_high_impact = 0
            linked_created = 0
            linked_completed = 0
            for task in linked_tasks:
                impact_weight = _task_impact_multiplier(task)
                total_task_weight += impact_weight

                created_at_task = self._safe_dt(task.created_at, window.period_start)
                completed_at_task = self._safe_dt(task.completed_at, window.period_start) if task.completed_at else None
                if window.period_start <= created_at_task <= window.period_end:
                    linked_created += 1
                if completed_at_task and window.period_start <= completed_at_task <= window.period_end:
                    linked_completed += 1

                status = str(task.status or "").lower()
                is_done = status in {"completed", "done"}
                if is_done:
                    completed_task_weight += impact_weight

                due = self._safe_dt(task.due_date, window.period_end) if task.due_date else None
                if (
                    due
                    and due < window.period_end - timedelta(days=2)
                    and not is_done
                    and impact_weight >= 2.5
                ):
                    overdue_high_impact += 1

            if total_task_weight > 0:
                task_score = _clamp((completed_task_weight / total_task_weight) * 100.0)
            else:
                task_score = 10.0 if archetype == "blitz" else 25.0
            task_score = _clamp(task_score - min(20.0, overdue_high_impact * 5.0))

            day_weights = [1.5, 1.2, 1.1, 1.0, 0.95, 0.9, 0.8]
            if linked_habits:
                weighted = 0.0
                total_weight = sum(day_weights)
                habit_completions_7d = 0
                for offset, weight in enumerate(day_weights):
                    day = (goal_now - timedelta(days=offset)).date().isoformat()
                    day_done = 0
                    for habit in linked_habits:
                        schedule = habit.schedule if isinstance(habit.schedule, dict) else {}
                        history = schedule.get("history")
                        last_completed = schedule.get("lastCompleted")
                        completed = False
                        if isinstance(history, list):
                            completed = any(str(h)[:10] == day for h in history)
                        if not completed and last_completed:
                            completed = str(last_completed)[:10] == day
                        if completed:
                            day_done += 1
                    habit_completions_7d += day_done
                    day_ratio = day_done / max(len(linked_habits), 1)
                    weighted += (day_ratio * 100.0) * weight
                habit_score = _clamp(weighted / max(total_weight, 1e-6))
            else:
                habit_completions_7d = 0
                habit_score = 10.0 if archetype == "routine" else 50.0

            baseline_hours_per_day = {
                "grind": 1.6,
                "routine": 0.35,
                "builder": 0.9,
                "blitz": 1.25,
            }.get(archetype, 0.9)
            total_hours_needed = baseline_hours_per_day * total_days
            remaining_hours = max(total_hours_needed * (1.0 - progress / 100.0), 0.0)
            required_pace = max(0.25, remaining_hours / max(days_remaining, 1))

            recent_deep_minutes = 0.0
            deep_dates: List[date] = []
            for deep in linked_deep:
                dt = self._safe_dt(deep.date, window.period_start)
                metrics = extract_deep_work_session_metrics(deep)
                if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                    continue
                if dt >= goal_now - timedelta(days=3):
                    recent_deep_minutes += float(metrics["effective_minutes"])
                deep_dates.append(dt.date())
            actual_pace = (recent_deep_minutes / 60.0) / 3.0
            pace_ratio = actual_pace / max(required_pace, 1e-3)
            deep_work_score = _clamp(min(pace_ratio, 1.2) * 100.0, 0.0, 120.0)

            keywords = self._goal_keywords(goal)
            relevant_queries = 0
            for content, _msg_dt in chat_messages:
                content_text = str(content or "").lower()
                if len(content_text.split()) < 4:
                    continue
                if any(k in content_text for k in keywords):
                    relevant_queries += 1

            implementation_rate = min(1.0, linked_created / max(int(insight_events), 1))
            ai_resonance = _clamp((min(relevant_queries, 12) * 5.0) + (implementation_rate * 20.0))

            raw_score = _clamp(
                task_score * weights["tasks"]
                + habit_score * weights["habits"]
                + deep_work_score * weights["deep_work"]
                + ai_resonance * weights["ai_resonance"]
            )

            if focus_avg > 75:
                focus_multiplier = 1.05
            elif focus_avg < 40:
                focus_multiplier = 0.85
            else:
                focus_multiplier = 0.92 + ((focus_avg - 40.0) / 35.0) * 0.11
                focus_multiplier = max(0.85, min(1.05, focus_multiplier))

            activity_dates: List[date] = []
            for task in linked_tasks:
                if task.completed_at:
                    activity_dates.append(self._safe_dt(task.completed_at, window.period_start).date())
                elif task.created_at:
                    created_dt = self._safe_dt(task.created_at, window.period_start)
                    if created_dt >= window.period_start:
                        activity_dates.append(created_dt.date())
            for deep in linked_deep:
                metrics = extract_deep_work_session_metrics(deep)
                if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                    continue
                activity_dates.append(self._safe_dt(deep.date, window.period_start).date())
            for habit in linked_habits:
                schedule = habit.schedule if isinstance(habit.schedule, dict) else {}
                history = schedule.get("history")
                if isinstance(history, list):
                    for h in history:
                        try:
                            activity_dates.append(datetime.fromisoformat(str(h).replace("Z", "+00:00")).date())
                        except Exception:
                            continue
                last_completed = schedule.get("lastCompleted")
                if last_completed:
                    try:
                        activity_dates.append(datetime.fromisoformat(str(last_completed).replace("Z", "+00:00")).date())
                    except Exception:
                        pass

            last_activity_date = max(activity_dates) if activity_dates else created_at.date()
            days_inactive = max((goal_now.date() - last_activity_date).days, 0)
            if days_inactive >= 10:
                inactivity_decay = max(0.55, 0.95 ** (days_inactive - 9))
            else:
                inactivity_decay = 1.0
            burnout_multiplier = 0.90 if burnout_value > 80 else 1.0

            adjusted_raw = _clamp(raw_score * focus_multiplier * inactivity_decay * burnout_multiplier)

            logit = (
                -1.2
                + (4.2 * (adjusted_raw / 100.0))
                + (0.8 * (focus_avg / 100.0))
                - (1.1 * (burnout_value / 100.0))
                - (1.0 * min(days_inactive / 14.0, 1.0))
            )
            probability = self._sigmoid(logit) * 100.0

            recent_signal = 0.0
            previous_signal = 0.0
            for task in linked_tasks:
                if not task.completed_at:
                    continue
                completed_dt = self._safe_dt(task.completed_at, window.period_start)
                if completed_dt >= goal_now - timedelta(days=3):
                    recent_signal += _task_impact_multiplier(task)
                elif goal_now - timedelta(days=10) <= completed_dt < goal_now - timedelta(days=3):
                    previous_signal += _task_impact_multiplier(task)
            recent_signal += (recent_deep_minutes / 60.0) * 1.4
            previous_deep_minutes = 0.0
            for deep in linked_deep:
                ddt = self._safe_dt(deep.date, window.period_start)
                metrics = extract_deep_work_session_metrics(deep)
                if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                    continue
                if goal_now - timedelta(days=10) <= ddt < goal_now - timedelta(days=3):
                    previous_deep_minutes += float(metrics["effective_minutes"])
            previous_signal += (previous_deep_minutes / 60.0) * 1.4
            recent_signal += habit_completions_7d * 0.25

            baseline_signal = max(previous_signal / 7.0, 0.8)
            recent_rate = recent_signal / 3.0
            delta_ratio = (recent_rate - baseline_signal) / max(baseline_signal, 0.5)
            recovery_bias = 8.0 if days_inactive <= 1 and baseline_signal < 1.2 and recent_rate > baseline_signal else 0.0
            momentum_score = _clamp(55.0 + (delta_ratio * 25.0) + recovery_bias - min(days_inactive, 4) * 4.0)

            data_points = (
                len(linked_tasks)
                + habit_completions_7d
                + len(linked_deep)
                + min(relevant_queries, 10)
            )
            active_days_goal = len(set(d for d in activity_dates if window.period_start.date() <= d <= window.period_end.date()))
            confidence = max(
                0.2,
                min(
                    0.95,
                    0.35
                    + min(0.35, data_points / 25.0)
                    + min(0.25, active_days_goal / 10.0),
                ),
            )

            gatekeeper_reasons: List[str] = []
            score_cap = 100.0
            confidence_state = "established"
            if active_days_goal < 3:
                score_cap = min(score_cap, 60.0)
                confidence_state = "calibrating"
                gatekeeper_reasons.append("low_activity_history")
            if data_points < 10:
                score_cap = min(score_cap, 80.0)
                confidence_state = "calibrating"
                gatekeeper_reasons.append("low_data_points")

            if days_inactive >= 10:
                score_cap = min(score_cap, _clamp(100.0 - (days_inactive - 9) * 5.0, 30.0, 100.0))
                gatekeeper_reasons.append("inactive_decay_gate")

            probability = min(probability, score_cap)

            band = self._probability_band(probability)
            if band in {"high", "very_high"} and (pace_ratio < 1.0 or overdue_high_impact > 0):
                band = "mid"
                probability = min(probability, 75.0)
                gatekeeper_reasons.append("velocity_or_overdue_gate")

            very_high_checks = [
                focus_avg > 75.0,
                ai_resonance > 80.0,
                burnout_value < 60.0,
                pace_ratio > 1.10,
            ]
            if band == "very_high" and not all(very_high_checks):
                band = "high"
                probability = min(probability, 90.0)
                gatekeeper_reasons.append("very_high_gate_failed")

            weekly_trend = "improving" if momentum_score >= 62 else "declining" if momentum_score <= 42 else "stable"
            actions = self._goal_action_preview(
                task_score=task_score,
                habit_score=habit_score,
                deep_work_score=deep_work_score,
                ai_resonance=ai_resonance,
                pace_ratio=pace_ratio,
                days_inactive=days_inactive,
                overdue_high_impact=overdue_high_impact,
            )

            goal_payload = {
                "goal_id": goal.id,
                "title": goal.title,
                "category": goal.category or "custom",
                "target_date": target_dt.isoformat(),
                "archetype": archetype,
                "archetype_confidence": round(float(archetype_info.get("confidence", 0.55)), 3),
                "completion_probability": round(probability, 1),
                "momentum_score": round(momentum_score, 1),
                "probability_band": band,
                "confidence": round(confidence, 3),
                "confidence_state": confidence_state,
                "reason_codes": sorted(set(gatekeeper_reasons)),
                "weekly_trend": weekly_trend,
                "progress": round(progress, 1),
                "expected_progress": round(expected_progress, 1),
                "pace_delta": round(pace_delta, 1),
                "linked_tasks_created": int(linked_created),
                "linked_tasks_completed": int(linked_completed),
                "breakdown": {
                    "task_score": round(task_score, 1),
                    "habit_score": round(habit_score, 1),
                    "deep_work_score": round(deep_work_score, 1),
                    "ai_resonance_score": round(ai_resonance, 1),
                    "raw_score": round(raw_score, 1),
                    "adjusted_raw_score": round(adjusted_raw, 1),
                    "weights": {
                        "tasks": round(weights["tasks"], 2),
                        "habits": round(weights["habits"], 2),
                        "deep_work": round(weights["deep_work"], 2),
                        "ai_resonance": round(weights["ai_resonance"], 2),
                    },
                    "multipliers": {
                        "focus_efficiency": round(focus_multiplier, 3),
                        "inactivity_decay": round(inactivity_decay, 3),
                        "burnout_brake": round(burnout_multiplier, 3),
                    },
                },
                "pace": {
                    "required_hours_per_day": round(required_pace, 2),
                    "actual_hours_per_day": round(actual_pace, 2),
                    "pace_ratio": round(pace_ratio, 2),
                    "on_track_gap_hours": round(actual_pace - required_pace, 2),
                },
                "quality": {
                    "focus_score_avg": round(focus_avg, 1),
                    "burnout_risk": round(burnout_value, 1),
                    "days_inactive": int(days_inactive),
                    "active_days": int(active_days_goal),
                    "data_points": int(data_points),
                    "overdue_high_impact_tasks": int(overdue_high_impact),
                    "relevant_query_count": int(relevant_queries),
                },
                "actions": actions,
            }

            probabilities.append(probability)
            momentum_values.append(momentum_score)
            confidence_values.append(confidence)
            goal_items.append(goal_payload)

        overall_score = round(sum(probabilities) / len(probabilities), 1) if probabilities else None
        overall_momentum = round(sum(momentum_values) / len(momentum_values), 1) if momentum_values else None
        overall_confidence = round(sum(confidence_values) / len(confidence_values), 3) if confidence_values else 0.2
        overall_band = self._probability_band(float(overall_score or 0.0)) if overall_score is not None else None
        confidence_state = "calibrating" if any(g.get("confidence_state") == "calibrating" for g in goal_items) else "established"

        return {
            "score": overall_score,
            "momentum_score": overall_momentum,
            "overall_band": overall_band,
            "confidence_state": confidence_state,
            "goals": goal_items,
            "goal_progress_version": "v3",
            "summary": {
                "active_goals": len(goal_items),
                "avg_confidence": overall_confidence,
                "focus_score_avg": round(focus_avg, 1),
                "burnout_risk": round(burnout_value, 1),
            },
        }

    # ── Daily Intent Resolver ───────────────────────────────────────────
    def _resolve_daily_intent(self, usage: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect the user's mode for the day and return adjusted scoring weights.
        Modes:
          - Maker   : heavy deep-work, few tasks          -> deep_work weighted high
          - Student  : lots of tasks, habit-heavy          -> tasks + habits weighted high
          - Athlete  : balanced across all dimensions      -> even weights
        """
        dw = usage["deep_work_minutes"]
        tc = usage["tasks_completed"]
        hc = usage["habits_completed"]

        # Heuristic: if deep work dominates, user is in Maker mode
        if dw >= 90 and tc <= 3:
            return {
                "intent": "maker",
                "weights": {"tasks": 0.20, "habits": 0.15, "deep_work": 0.45, "engagement": 0.05, "goal_progress": 0.15},
                "confidence": min(0.9, 0.6 + dw / 300.0),
            }
        # Heuristic: if tasks + habits dominate
        if tc >= 5 and dw < 60:
            return {
                "intent": "student",
                "weights": {"tasks": 0.40, "habits": 0.25, "deep_work": 0.15, "engagement": 0.05, "goal_progress": 0.15},
                "confidence": min(0.9, 0.6 + tc / 20.0),
            }
        # Default: balanced (Athlete)
        return {
            "intent": "athlete",
            "weights": {"tasks": 0.30, "habits": 0.20, "deep_work": 0.25, "engagement": 0.05, "goal_progress": 0.20},
            "confidence": 0.65,
        }

    # ── Impact Points ────────────────────────────────────────────────────
    def _task_impact_points(self, tasks_completed: int, goal_linked: int, high_energy: int, on_time: int, tasks_created: int) -> float:
        """
        Point-based scoring incorporating completion %, on-time %, and high energy stacked tasks.
        Each completed task earns points; goal-linked, high-energy, and on-time tasks earn bonuses.
        Diminishing returns past 10 tasks to avoid gaming. Multiply by completion ratio so creating
        many uncompleted tasks has a net drag on the score.
        """
        if tasks_completed == 0 and tasks_created == 0:
            return 0.0
            
        completion_ratio = min(1.0, tasks_completed / tasks_created) if tasks_created > 0 else 1.0
        
        # Base: 5 points per task, soft ceiling past 10
        base = min(tasks_completed, 10) * 5.0 + max(0, tasks_completed - 10) * 2.0
        
        # Bonuses
        goal_bonus = min(goal_linked, 5) * 4.0
        energy_bonus = min(high_energy, 4) * 4.0
        on_time_bonus = min(on_time, 5) * 3.0
        
        # Multiplier scales from 0.5x (0% completed) to 1.0x (100% completed)
        completion_modifier = 0.5 + (completion_ratio * 0.5)
        
        return _clamp((base + goal_bonus + energy_bonus + on_time_bonus) * completion_modifier)

    def _habit_impact_points(self, completed: int, total: int, active_streaks: int = 0, missed: int = 0) -> float:
        """
        Habits use completion ratio BUT with a floor so partial completion
        is still rewarded meaningfully. Incorporates streak bonuses and miss penalties.
        """
        if total == 0:
            return 30.0  # No habits set = neutral baseline, not zero
            
        ratio = completed / total
        base_points = 15.0 + ratio * 85.0
        
        # Streak bonus (max +20)
        streak_bonus = min(active_streaks * 2.0, 20.0)
        
        # Miss penalty (max -25)
        miss_penalty = min(missed * 5.0, 25.0)
        
        # Floor at 5.0 to be forgiving
        return _clamp(base_points + streak_bonus - miss_penalty)

    def _deep_work_impact_points(self, minutes: int) -> float:
        """
        Progressive deep work scoring:
          0-30 min  = 0-30 pts (linear warmup)
          30-120 min = 30-80 pts (productive zone)
          120-240 min = 80-100 pts (diminishing returns)
          240+ min = 100 pts (cap -- more is not always better)
        """
        if minutes <= 0:
            return 0.0
        if minutes <= 30:
            return (minutes / 30.0) * 30.0
        if minutes <= 120:
            return 30.0 + ((minutes - 30) / 90.0) * 50.0
        if minutes <= 240:
            return 80.0 + ((minutes - 120) / 120.0) * 20.0
        return 100.0

    async def productivity_score(self, user: User, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        burnout_value = await self._safe_burnout_snapshot(user, time_range, default=0.0)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            has_data = any(
                [
                    usage["tasks_created"] > 0,
                    usage["tasks_completed"] > 0,
                    usage["deep_work_minutes"] > 0,
                    usage["habits_completed"] > 0,
                    usage["chat_requests"] > 0,
                ]
            )
            if not has_data:
                return {
                    "score": None,
                    "reason": "NO_DATA",
                    "breakdown": {},
                    **self._meta(window, source="derived", confidence=0.2),
                }

            # ── 1. Daily Intent Detection ────────────────────────────
            range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)
            
            # We create a daily-scaled representation of inputs so that a whole week of tasks
            # doesn't break the single-day grading curve.
            scaled_usage = dict(usage)
            for k in ["tasks_created", "tasks_completed", "goal_linked_completed", 
                      "high_energy_completed", "on_time_completed", "deep_work_minutes", 
                      "chat_requests"]:
                scaled_usage[k] = scaled_usage[k] // range_days

            intent_info = self._resolve_daily_intent(scaled_usage)
            weights = intent_info["weights"]

            # ── 2. Impact Points (replaces ratio trap) ───────────────
            task_points = self._task_impact_points(
                scaled_usage["tasks_completed"], 
                scaled_usage.get("goal_linked_completed", 0),
                scaled_usage.get("high_energy_completed", 0),
                scaled_usage.get("on_time_completed", 0),
                scaled_usage.get("tasks_created", 0)
            )
            habit_points = self._habit_impact_points(
                usage["habits_completed"], usage["habits_total"], usage.get("active_streaks", 0), usage.get("habits_missed", 0)
            )
            deep_work_points = self._deep_work_impact_points(scaled_usage["deep_work_minutes"])

            goal_progress = float(goals["score"] or 0.0)

            # Engagement: chat + active minutes (minor signal)
            active_minutes = scaled_usage["deep_work_minutes"] + (scaled_usage["tasks_completed"] * 8) + (scaled_usage["chat_requests"] * 1.5)
            engagement = _clamp(
                (min(scaled_usage["chat_requests"], 30) / 30.0) * 30.0
                + (min(active_minutes, 150) / 150.0) * 70.0
            )

            # ── 3. Weighted Score ────────────────────────────────────
            raw_score = _clamp(
                task_points * weights["tasks"]
                + habit_points * weights["habits"]
                + deep_work_points * weights["deep_work"]
                + goal_progress * weights["goal_progress"]
                + engagement * weights["engagement"]
            )

            # ── 4. 14-Day Baseline Normalization ─────────────────────
            baseline_window = RangeWindow(
                time_range="monthly",
                period_start=window.period_end - timedelta(days=14),
                period_end=window.period_start - timedelta(seconds=1),
                timezone_name=window.timezone_name,
            )
            try:
                baseline_usage = await self._usage_inputs(db, user.id, baseline_window)
                baseline_days = max(baseline_usage.get("active_days", 1), 1)

                # Compute a naive baseline score from the same formula
                bl_task = self._task_impact_points(
                    max(baseline_usage["tasks_completed"] // baseline_days, 0),
                    max(baseline_usage.get("goal_linked_completed", 0) // baseline_days, 0),
                    max(baseline_usage.get("high_energy_completed", 0) // baseline_days, 0),
                    max(baseline_usage.get("on_time_completed", 0) // baseline_days, 0),
                    max(baseline_usage.get("tasks_created", 0) // baseline_days, 0)
                )
                bl_habit = self._habit_impact_points(
                    max(baseline_usage["habits_completed"] // baseline_days, 0),
                    max(baseline_usage["habits_total"], 1),
                    max(baseline_usage.get("active_streaks", 0) // baseline_days, 0),
                    max(baseline_usage.get("habits_missed", 0) // baseline_days, 0)
                )
                bl_deep = self._deep_work_impact_points(
                    max(baseline_usage["deep_work_minutes"] // baseline_days, 0)
                )
                baseline_score = max(
                    25.0,
                    bl_task * 0.30 + bl_habit * 0.20 + bl_deep * 0.25 + 50.0 * 0.20 + 30.0 * 0.05,
                )

                # Normalize: if today > baseline, boost; if below, penalize gently
                if baseline_score > 0:
                    norm_ratio = raw_score / baseline_score
                    # Smooth normalization: shift toward 1.0 center
                    normalized = 50.0 + (norm_ratio - 1.0) * 35.0 + (raw_score * 0.40)
                    raw_score = _clamp(normalized)
                baseline_state = "established" if baseline_days >= 5 else "calibrating"
            except Exception:
                baseline_state = "cold_start"
                # No baseline available, use raw score as-is

            # ── 5. Burnout Interconnection (False Peak Detection) ────
            reason_codes: List[str] = []
            burnout_cap = 100.0
            if burnout_value >= 75 and raw_score >= 70:
                # False Peak: high productivity + high burnout = unsustainable
                burnout_cap = 72.0
                reason_codes.append("false_peak_detected")
            elif burnout_value >= 60:
                # Grind Protection: moderate burnout dampens score slightly
                burnout_cap = 85.0
                reason_codes.append("grind_protection")

            raw_score = min(raw_score, burnout_cap)

            # ── 6. Difficulty Curve ──────────────────────────────────
            if raw_score > 90:
                raw_score = 90.0 + (raw_score - 90.0) * 0.6
            elif raw_score > 80:
                raw_score = 80.0 + (raw_score - 80.0) * 0.8

            final_score = _clamp(raw_score)

            # Grade
            if final_score >= 90:
                grade = "A"
            elif final_score >= 75:
                grade = "B"
            elif final_score >= 55:
                grade = "C"
            elif final_score >= 35:
                grade = "D"
            else:
                grade = "F"

            confidence = 0.45 + min(0.45, usage["active_days"] / 20.0)
            if baseline_state == "cold_start":
                confidence = min(confidence, 0.50)

            return {
                "score": round(final_score, 1),
                "grade": grade,
                "daily_intent": intent_info["intent"],
                "baseline_state": baseline_state,
                "reason_codes": reason_codes,
                "breakdown": {
                    "task_points": round(task_points, 1),
                    "habit_points": round(habit_points, 1),
                    "deep_work_points": round(deep_work_points, 1),
                    "goal_progress_block": round(goal_progress, 1),
                    "engagement_block": round(engagement, 1),
                    "burnout_cap": round(burnout_cap, 1),
                    "weights": {k: round(v, 2) for k, v in weights.items()},
                },
                "inputs": usage,
                "goal_band": goals.get("overall_band"),
                **self._meta(window, source="derived_v3", confidence=confidence),
            }

    async def focus_score(self, user: User, plan_tier: str, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        preferred_source = "heatmap" if plan_tier == "ultra" else "derived"

        try:
            from backend.services.attention_integrity_service import attention_integrity_service

            if window.time_range == "daily":
                daily = await attention_integrity_service.calculate_attention_integrity(
                    user.id, window.period_end.date()
                )
                score = daily.get("score")
                breakdown = daily.get("breakdown", {}) or {}
                confidence = float(daily.get("confidence", 0.62))

                return {
                    "score": round(float(score), 1) if score is not None else None,
                    "reason": daily.get("reason") if score is None else None,
                    "date": daily.get("date"),
                    "total_minutes": int(daily.get("total_minutes", 0)),
                    "focus_profile": daily.get("focus_profile"),
                    "profile_confidence": daily.get("profile_confidence"),
                    "status": daily.get("status"),
                    "grade": daily.get("grade"),
                    "confidence_state": daily.get("confidence_state"),
                    "reason_codes": daily.get("reason_codes", []),
                    "breakdown": {
                        # New model keys.
                        **breakdown,
                        # Compatibility keys consumed by existing frontend mappings.
                        "deep_work_component": round(float(breakdown.get("deep_work", 0.0)), 1),
                        "task_component": round(float(breakdown.get("task_focus", 0.0)), 1),
                        "goal_alignment_component": round(float(breakdown.get("goal_momentum", 0.0)), 1),
                    },
                    **self._meta(
                        window,
                        source=preferred_source if score is not None else "fallback",
                        confidence=confidence if score is not None else 0.35,
                    ),
                }

            if window.time_range == "weekly":
                weekly = await attention_integrity_service.get_weekly_average(user.id)
                scored_days = int(weekly.get("scored_days", 0))
                score = float(weekly.get("average_score", 0.0)) if scored_days > 0 else None
                return {
                    "score": round(score, 1) if score is not None else None,
                    "reason": None if score is not None else "NO_DATA",
                    "average_score": weekly.get("average_score", 0.0),
                    "average_minutes": weekly.get("average_minutes", 0),
                    "period": "weekly",
                    "days": 7,
                    "scored_days": scored_days,
                    "breakdown": {"heatmap_samples": scored_days},
                    **self._meta(
                        window,
                        source=preferred_source if score is not None else "fallback",
                        confidence=float(weekly.get("confidence", 0.6)),
                    ),
                }

            monthly = await attention_integrity_service.get_monthly_average(user.id)
            scored_days = int(monthly.get("scored_days", 0))
            score = float(monthly.get("average_score", 0.0)) if scored_days > 0 else None
            return {
                "score": round(score, 1) if score is not None else None,
                "reason": None if score is not None else "NO_DATA",
                "average_score": monthly.get("average_score", 0.0),
                "average_minutes": monthly.get("average_minutes", 0),
                "period": "monthly",
                "days": 30,
                "scored_days": scored_days,
                "breakdown": {"heatmap_samples": scored_days},
                **self._meta(
                    window,
                    source=preferred_source if score is not None else "fallback",
                    confidence=float(monthly.get("confidence", 0.62)),
                ),
            }

        except Exception:
            # Fallback path keeps endpoint available even if focus v3 engine fails.
            async for db in get_db():
                usage = await self._usage_inputs(db, user.id, window)
                goals = await self._goal_progress_summary(db, user.id, window)
                
                range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)

                task_component = 0.0
                if usage["tasks_created"] > 0:
                    task_component = _clamp((usage["tasks_completed"] / usage["tasks_created"]) * 100.0)
                elif usage["tasks_completed"] > 0:
                    task_component = 80.0
                
                # scale deep work to a reasonable average daily chunk rather than 120 total over 30 days
                # meaning: average daily deep work minutes / 120 minutes = percentage
                average_daily_dw = usage["deep_work_minutes"] / max(range_days, 1)
                deep_work_component = _clamp((average_daily_dw / 120.0) * 100.0)
                
                goal_alignment = float(goals["score"] or 0.0)
                derived_score = _clamp(deep_work_component * 0.55 + task_component * 0.30 + goal_alignment * 0.15)

                return {
                    "score": round(derived_score, 1) if derived_score > 0 else None,
                    "reason": None if derived_score > 0 else "NO_DATA",
                    "breakdown": {
                        "deep_work_component": round(deep_work_component, 1),
                        "task_component": round(task_component, 1),
                        "goal_alignment_component": round(goal_alignment, 1),
                    },
                    **self._meta(window, source="fallback", confidence=0.45),
                }

    async def burnout_risk(self, user: User, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)

            # ── 1. Workload Strain (improved) ────────────────────────
            # Considers pending task weight AND total work volume per day
            pending = usage["pending_tasks"]
            completed = usage["tasks_completed"]
            workload_ratio = pending / max(completed + 1, 1)
            daily_volume = (usage["deep_work_minutes"] + completed * 10) / max(range_days, 1)
            workload_strain = _clamp(
                workload_ratio * 25.0
                + (15 if (usage["deep_work_minutes"] / max(range_days, 1)) > 240 else 0)
                + (min(daily_volume / 120.0, 1.0) * 20.0)  # volume pressure
            )

            # ── 2. Strain Velocity (NEW) ─────────────────────────────
            # Measures sustained high-intensity work from focus scores
            focus_rows = await db.execute(
                select(FocusScore.score, FocusScore.date).where(
                    FocusScore.user_id == user.id,
                    FocusScore.date >= window.period_start,
                    FocusScore.date <= window.period_end,
                )
            )
            focus_records = focus_rows.all()
            focus_scores = [float(r[0]) for r in focus_records]

            # High focus blocks: days with focus > 80 (sustained intensity)
            high_focus_blocks = sum(1 for s in focus_scores if s > 80)
            # Focus volatility (erratic patterns = stress)
            if len(focus_scores) >= 2:
                focus_volatility = _clamp(statistics.pstdev(focus_scores) * 3.5)
            else:
                focus_volatility = 20.0

            # Strain = deep_work_density * 1.5 + high_focus_blocks * 8 + volatility * 0.3
            deep_work_density = min(usage["deep_work_minutes"] / max(range_days, 1) / 60.0, 4.0)
            strain_velocity = _clamp(
                deep_work_density * 15.0
                + high_focus_blocks * 8.0
                + focus_volatility * 0.3
            )

            # ── 3. Offline Gap / Sleep Proxy (NEW) ───────────────────
            # Gap between last event yesterday and first event today
            # Short gap (<6h) = poor recovery = high risk
            offline_gap_risk = 30.0  # default neutral
            try:
                today_date = window.period_end.date()
                yesterday_date = today_date - timedelta(days=1)

                # Last event yesterday
                last_yesterday = (
                    await db.execute(
                        select(func.max(AnalyticsEvent.timestamp)).where(
                            AnalyticsEvent.user_id == user.id,
                            AnalyticsEvent.timestamp >= datetime.combine(yesterday_date, time.min, tzinfo=timezone.utc),
                            AnalyticsEvent.timestamp <= datetime.combine(yesterday_date, time.max, tzinfo=timezone.utc),
                        )
                    )
                ).scalar()

                # First event today
                first_today = (
                    await db.execute(
                        select(func.min(AnalyticsEvent.timestamp)).where(
                            AnalyticsEvent.user_id == user.id,
                            AnalyticsEvent.timestamp >= datetime.combine(today_date, time.min, tzinfo=timezone.utc),
                            AnalyticsEvent.timestamp <= datetime.combine(today_date, time.max, tzinfo=timezone.utc),
                        )
                    )
                ).scalar()

                if last_yesterday and first_today:
                    if hasattr(last_yesterday, 'replace') and last_yesterday.tzinfo is None:
                        last_yesterday = last_yesterday.replace(tzinfo=timezone.utc)
                    if hasattr(first_today, 'replace') and first_today.tzinfo is None:
                        first_today = first_today.replace(tzinfo=timezone.utc)
                    gap_hours = (first_today - last_yesterday).total_seconds() / 3600.0
                    if gap_hours <= 4:
                        offline_gap_risk = 90.0
                    elif gap_hours >= 10:
                        offline_gap_risk = 10.0
                    else:
                        # Smooth transition from 90 (at 4 hrs) down to 10 (at 10 hrs)
                        offline_gap_risk = _clamp(90.0 - ((gap_hours - 4.0) / 6.0) * 80.0)
                else:
                    offline_gap_risk = 25.0  # No data = neutral-low
            except Exception:
                offline_gap_risk = 30.0

            # ── 4. Rest Day Violation (NEW) ──────────────────────────
            # Check consecutive working days (no rest in 7+ days = danger)
            rest_day_violation = 0.0
            try:
                consecutive_work_days = 0
                max_consecutive = 0
                lookback = min(range_days + 7, 30)  # Look back further for streaks
                for i in range(lookback):
                    check_date = (window.period_end - timedelta(days=i)).date()
                    day_events = (
                        await db.execute(
                            select(func.count(AnalyticsEvent.id)).where(
                                AnalyticsEvent.user_id == user.id,
                                AnalyticsEvent.timestamp >= datetime.combine(check_date, time.min, tzinfo=timezone.utc),
                                AnalyticsEvent.timestamp <= datetime.combine(check_date, time.max, tzinfo=timezone.utc),
                            )
                        )
                    ).scalar() or 0
                    # Working day = > 15 min of activity (>30 events)
                    if day_events > 30:
                        consecutive_work_days += 1
                        max_consecutive = max(max_consecutive, consecutive_work_days)
                    else:
                        consecutive_work_days = 0

                # Smooth formula: 0 days = 10 risk, 10 days = 90 risk
                rest_day_violation = _clamp(10.0 + max_consecutive * 8.0)
            except Exception:
                rest_day_violation = 20.0

            # ── 5. Recovery Deficit (fixed) ──────────────────────────
            # Now properly measures ratio of ACTIVE days (more = less recovery)
            active_ratio = usage["active_days"] / max(range_days, 1)
            # Smooth formula: 0 ratio = 5 risk, 1.0 ratio = 85 risk
            recovery_deficit = _clamp(5.0 + active_ratio * 80.0)

            # ── 6. Goal Progress Pressure ────────────────────────────
            goal_progress_pressure = _clamp(100.0 - float(goals["score"] or 0.0))

            # ── 7. Deadline Compression ──────────────────────────────
            goals_rows = await db.execute(
                select(Goal).where(
                    Goal.user_id == user.id,
                    Goal.current_progress < 100,
                    Goal.target_date.isnot(None),
                )
            )
            active_goals = goals_rows.scalars().all()
            deadline_scores = []
            now = window.period_end
            for goal in active_goals:
                target = goal.target_date
                if target is None:
                    continue
                if target.tzinfo is None:
                    target = target.replace(tzinfo=timezone.utc)
                days_left = (target - now).days
                if days_left <= 0:
                    deadline_scores.append(100.0)
                elif days_left <= 7:
                    deadline_scores.append(_clamp(90.0 - (goal.current_progress or 0) * 0.5))
                elif days_left <= 14:
                    deadline_scores.append(_clamp(70.0 - (goal.current_progress or 0) * 0.4))
                else:
                    deadline_scores.append(_clamp(40.0 - (goal.current_progress or 0) * 0.2))
            deadline_compression = sum(deadline_scores) / len(deadline_scores) if deadline_scores else 25.0

            # ── 8. Mood Modulation ───────────────────────────────────
            mood_score = 50.0
            try:
                from backend.services.mood_service import mood_service

                mood = await mood_service.calculate_current_mood(user.id)
                label = str(mood.get("label") or mood.get("category") or "").lower()
                if any(k in label for k in ["energetic", "calm", "focused", "positive"]):
                    mood_score = 15.0
                elif any(k in label for k in ["stressed", "anxious", "sad", "frustrated", "negative"]):
                    mood_score = 85.0
                else:
                    mood_score = 50.0
            except Exception:
                mood_score = 50.0

            # ── FINAL WEIGHTED RISK ──────────────────────────────────
            # Rebalanced weights with new signals:
            #   Workload Strain:       20%
            #   Strain Velocity:       15%  (NEW)
            #   Offline Gap:           10%  (NEW)
            #   Rest Day Violation:    10%  (NEW)
            #   Recovery Deficit:      10%  (fixed)
            #   Goal Pressure:          8%
            #   Deadline Compression:  10%
            #   Focus Volatility:       7%
            #   Mood:                   5%
            #   Engagement Extremes:    5%
            active_minutes = usage["deep_work_minutes"] + usage["tasks_completed"] * 8 + usage["chat_requests"] * 1.5
            if active_minutes < 10:
                engagement_extremes = 35.0
            elif active_minutes > 250:
                engagement_extremes = 75.0
            else:
                engagement_extremes = _clamp(10.0 + abs(active_minutes - 110.0) / 110.0 * 25.0)

            risk = (
                workload_strain * 0.20
                + strain_velocity * 0.15
                + offline_gap_risk * 0.10
                + rest_day_violation * 0.10
                + recovery_deficit * 0.10
                + goal_progress_pressure * 0.08
                + deadline_compression * 0.10
                + focus_volatility * 0.07
                + mood_score * 0.05
                + engagement_extremes * 0.05
            )
            risk = _clamp(risk)

            # ── Risk Level ───────────────────────────────────────────
            if risk < 25:
                level = "low"
            elif risk < 50:
                level = "moderate"
            elif risk < 70:
                level = "high"
            else:
                level = "critical"

            # ── AI Insights ──────────────────────────────────────────
            ai_insights: List[str] = []
            if strain_velocity > 60:
                ai_insights.append("Sustained high-intensity work detected — consider lighter sessions")
            if offline_gap_risk > 60:
                ai_insights.append("Short recovery gap between sessions — prioritize rest tonight")
            if rest_day_violation > 60:
                ai_insights.append(f"No rest day in {max_consecutive}+ days — schedule a recovery day")
            if workload_strain > 60:
                ai_insights.append("Task backlog growing faster than completion rate")
            if deadline_compression > 60:
                ai_insights.append("Multiple goals approaching deadlines — focus on highest impact")
            if mood_score > 70:
                ai_insights.append("Elevated stress indicators in your activity patterns")
            if not ai_insights:
                ai_insights.append("Work patterns within sustainable parameters")

            # Recommendation
            if risk < 25:
                recommendation = "Current pace is sustainable — keep going"
            elif risk < 50:
                recommendation = "Consider scheduling short breaks between deep work"
            elif risk < 70:
                recommendation = "Reduce workload or add a rest day this week"
            else:
                recommendation = "Immediate workload reduction recommended — step back and recover"

            return {
                "risk": round(risk, 1),
                "level": level,
                "ai_insights": ai_insights,
                "recommendation": recommendation,
                "breakdown": {
                    "workload_strain": round(workload_strain, 1),
                    "strain_velocity": round(strain_velocity, 1),
                    "offline_gap_risk": round(offline_gap_risk, 1),
                    "rest_day_violation": round(rest_day_violation, 1),
                    "recovery_deficit": round(recovery_deficit, 1),
                    "focus_volatility": round(focus_volatility, 1),
                    "goal_progress_pressure": round(goal_progress_pressure, 1),
                    "deadline_compression": round(deadline_compression, 1),
                    "engagement_extremes": round(engagement_extremes, 1),
                    "mood_modulation": round(mood_score, 1),
                },
                **self._meta(window, source="derived_v3", confidence=0.72),
            }

    async def ai_intelligence(self, user: User, time_range: str) -> Dict[str, Any]:
        """V3 AI Intelligence Score — 6 pure-logic dimensions."""
        window = await self.resolve_window(user, time_range)
        burnout_score = await self._safe_burnout_snapshot(user, time_range, default=50.0)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)
            range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)
            
            # Fix scaling bug by creating a normalized daily average
            # (Allows metrics evaluated by daily thresholds to work gracefully)
            tasks_created = usage["tasks_created"] // range_days
            goal_linked = usage["goal_linked_completed"] // range_days
            completed = usage["tasks_completed"] // range_days
            dw_minutes = usage["deep_work_minutes"] // range_days
            chat_count = usage["chat_requests"] // range_days

            has_goals = goals["score"] is not None

            # ════════════════════════════════════════════════════════
            # DIM 1 — Strategic Planning  (20%)
            # ════════════════════════════════════════════════════════
            volume_signal = min(math.log2(max(tasks_created, 1) + 1) / math.log2(21), 1.0) * 30.0

            if completed > 0:
                alignment_ratio = min(goal_linked / completed, 1.0)
                goal_alignment_signal = alignment_ratio * 35.0
            else:
                goal_alignment_signal = 0.0

            deep_work_signal = min(usage["deep_work_sessions"] / max(range_days, 1), 2.0) / 2.0 * 20.0
            goal_existence_signal = 15.0 if has_goals else 0.0

            strategic_planning = _clamp(
                volume_signal + goal_alignment_signal + deep_work_signal + goal_existence_signal
            )

            # ════════════════════════════════════════════════════════
            # DIM 2 — Execution Intelligence  (25%)
            # ════════════════════════════════════════════════════════
            task_points = min(completed, 15) * 6.0
            if completed > 15:
                task_points += (completed - 15) * 2.0

            habit_points = min(usage["habits_completed"], 8) * 4.0

            dw_hours = dw_minutes / 60.0
            deep_work_points = min(dw_hours, 4.0) * 10.0
            if dw_hours > 4.0:
                deep_work_points += (dw_hours - 4.0) * 3.0

            goal_bonus = goal_linked * 3.0

            raw_execution = task_points + habit_points + deep_work_points + goal_bonus
            execution_intelligence = _clamp((raw_execution / 120.0) * 100.0)

            # ════════════════════════════════════════════════════════
            # DIM 3 — AI Collaboration  (15%)
            # ════════════════════════════════════════════════════════
            if chat_count > 0 and tasks_created > 0:
                conversion_ratio = min(tasks_created / chat_count, 2.0) / 2.0
                chat_action_signal = conversion_ratio * 40.0
            elif chat_count > 0:
                chat_action_signal = 10.0
            else:
                chat_action_signal = 0.0

            # Insight engagement: check if user read/dismissed insights
            insight_read_count = (
                await db.execute(
                    select(func.count()).select_from(
                        select(AnalyticsEvent.id).where(
                            AnalyticsEvent.user_id == user.id,
                            AnalyticsEvent.timestamp >= window.period_start,
                            AnalyticsEvent.timestamp <= window.period_end,
                            AnalyticsEvent.event_type.in_([
                                "insight_applied", "strategy_applied",
                                "plan_adjusted", "goal_replanned",
                                "insight_read", "insight_dismissed",
                            ]),
                        ).subquery()
                    )
                )
            ).scalar() or 0

            insight_signal = min(insight_read_count / max(range_days, 1), 3.0) / 3.0 * 30.0

            # AI usage depth: regular engagement (log curve)
            if chat_count > 0:
                depth_signal = min(math.log2(chat_count + 1) / math.log2(20), 1.0) * 30.0
            else:
                depth_signal = 0.0

            ai_collaboration = _clamp(chat_action_signal + insight_signal + depth_signal)

            # ════════════════════════════════════════════════════════
            # DIM 4 — Adaptive Capacity  (15%)
            #   "Do you course-correct based on signals?"
            #   Measured by: goal pace response, focus trend,
            #                workload adjustment after burnout signals.
            # ════════════════════════════════════════════════════════
            # Goal pace adjustment: are behind goals getting more attention?
            goal_items = goals.get("goals", [])
            pace_responsiveness = 50.0  # neutral default
            if goal_items:
                behind_goals = [g for g in goal_items if g.get("pace_delta", 0) < -10]
                ahead_goals = [g for g in goal_items if g.get("pace_delta", 0) > 10]
                if behind_goals:
                    # Check if behind-goals have recent linked tasks (= user is responding)
                    behind_with_tasks = sum(
                        1 for g in behind_goals if g.get("linked_tasks_created", 0) > 0
                    )
                    if len(behind_goals) > 0:
                        pace_responsiveness = _clamp(
                            (behind_with_tasks / len(behind_goals)) * 70.0 + 15.0
                        )
                elif ahead_goals:
                    pace_responsiveness = 75.0  # ahead is good
                else:
                    pace_responsiveness = 50.0  # on track

            # Focus trend: improving or declining over the window?
            focus_rows = await db.execute(
                select(FocusScore.score, FocusScore.date).where(
                    FocusScore.user_id == user.id,
                    FocusScore.date >= window.period_start,
                    FocusScore.date <= window.period_end,
                ).order_by(FocusScore.date.asc())
            )
            focus_records = focus_rows.all()
            focus_trend_signal = 50.0  # neutral
            if len(focus_records) >= 3:
                scores_list = [float(r[0]) for r in focus_records]
                first_half = statistics.mean(scores_list[: len(scores_list) // 2])
                second_half = statistics.mean(scores_list[len(scores_list) // 2 :])
                trend_diff = second_half - first_half
                # Improving = good. Declining = bad.
                focus_trend_signal = _clamp(50.0 + trend_diff * 2.0)

            adaptive_capacity = _clamp(
                pace_responsiveness * 0.55 + focus_trend_signal * 0.45
            )

            # ════════════════════════════════════════════════════════
            # DIM 5 — Cognitive Consistency  (15%)
            #   "Are your work patterns stable and sustainable?"
            #   Uses: habit completion rate, active day regularity,
            #         work pattern variance (low = consistent).
            # ════════════════════════════════════════════════════════
            # Habit consistency
            habit_rate = 0.0
            if usage["habits_total"] > 0:
                habit_rate = (usage["habits_completed"] / usage["habits_total"]) * 100.0
            habit_signal = _clamp(habit_rate) * 0.40

            # Active day regularity: for weekly/monthly, is engagement steady?
            active_ratio = usage["active_days"] / max(range_days, 1)
            # Ideal is 0.6-0.85 (sustainable, with rest days)
            if active_ratio >= 0.6 and active_ratio <= 0.85:
                regularity_signal = 90.0
            elif active_ratio >= 0.4 and active_ratio < 0.6:
                regularity_signal = 65.0
            elif active_ratio > 0.85:
                regularity_signal = 60.0  # too much, no rest
            else:
                regularity_signal = 30.0  # sporadic
            regularity_component = regularity_signal * 0.30

            # Work pattern variance (from focus scores)
            if len(focus_records) >= 2:
                focus_scores_raw = [float(r[0]) for r in focus_records]
                cv = statistics.pstdev(focus_scores_raw) / max(statistics.mean(focus_scores_raw), 1.0)
                # Low coefficient of variation = consistent
                variance_signal = _clamp(100.0 - cv * 200.0)
            else:
                variance_signal = 50.0  # neutral when not enough data
            variance_component = variance_signal * 0.30

            cognitive_consistency = _clamp(
                habit_signal + regularity_component + variance_component
            )

            # ════════════════════════════════════════════════════════
            # DIM 6 — Self-Regulation  (10%)
            #   "Do you manage your energy, not just your time?"
            #   Uses real-time burnout risk to see if the user
            #   is operating sustainably. No static personality tests.
            # ════════════════════════════════════════════════════════
            # Low burnout = good self-regulation
            # But zero burnout + zero activity = not doing anything
            if completed == 0 and usage["deep_work_sessions"] == 0:
                self_regulation = 30.0  # inactive, not self-regulating
            elif burnout_score < 25:
                self_regulation = 90.0  # sustainable pace
            elif burnout_score < 45:
                self_regulation = 70.0  # manageable
            elif burnout_score < 65:
                self_regulation = 40.0  # pushing too hard
            else:
                self_regulation = 15.0  # overloaded

            # Big Five conscientiousness provides a small modifier (±5 max)
            # Not a primary signal — just a nudge for personality-aware scoring.
            big_five_modifier = 0.0
            try:
                big_five_row = await db.execute(
                    select(BigFiveTest)
                    .where(BigFiveTest.user_id == user.id, BigFiveTest.test_completed == True)  # noqa: E712
                    .order_by(BigFiveTest.test_completed_at.desc().nullslast(), BigFiveTest.created_at.desc())
                    .limit(1)
                )
                big_five = big_five_row.scalar_one_or_none()
                if big_five:
                    conscientiousness = float(big_five.conscientiousness or 50)
                    big_five_modifier = (conscientiousness - 50.0) / 50.0 * 5.0  # ±5 max
            except Exception:
                big_five_modifier = 0.0

            # ════════════════════════════════════════════════════════
            # FINAL WEIGHTED SCORE
            # ════════════════════════════════════════════════════════
            raw_score = (
                strategic_planning * 0.20
                + execution_intelligence * 0.25
                + ai_collaboration * 0.15
                + adaptive_capacity * 0.15
                + cognitive_consistency * 0.15
                + self_regulation * 0.10
            )
            score = _clamp(raw_score + big_five_modifier)

            # ── Category assignment ──────────────────────────────
            if score >= 88:
                category = "Strategic Architect"
            elif score >= 75:
                category = "Focused Operator"
            elif score >= 60:
                category = "Adaptive Builder"
            elif score >= 45:
                category = "Growing Strategist"
            elif score >= 30:
                category = "Developing Rhythm"
            else:
                category = "Early Explorer"

            # ── Confidence based on data availability ────────────
            data_signals = sum([
                1 if tasks_created > 0 else 0,
                1 if completed > 0 else 0,
                1 if usage["deep_work_sessions"] > 0 else 0,
                1 if chat_count > 0 else 0,
                1 if usage["habits_total"] > 0 else 0,
                1 if has_goals else 0,
                1 if len(focus_records) >= 2 else 0,
                1 if usage["active_days"] >= 2 else 0,
            ])
            confidence = _clamp(0.30 + (data_signals / 8.0) * 0.50, 0.25, 0.85)

            has_data = any([
                tasks_created > 0,
                completed > 0,
                usage["deep_work_sessions"] > 0,
                chat_count > 0,
                insight_read_count > 0,
            ])
            if not has_data:
                return {
                    "score": None,
                    "reason": "NO_DATA",
                    "category": "Early Explorer",
                    **self._meta(window, source="derived_v3", confidence=0.25),
                }

            # ── Strengths & Growth Areas ─────────────────────────
            dimensions = {
                "strategic_planning": strategic_planning,
                "execution_intelligence": execution_intelligence,
                "ai_collaboration": ai_collaboration,
                "adaptive_capacity": adaptive_capacity,
                "cognitive_consistency": cognitive_consistency,
                "self_regulation": self_regulation,
            }
            sorted_dims = sorted(dimensions.items(), key=lambda x: x[1], reverse=True)
            strengths = [d[0] for d in sorted_dims[:2] if d[1] >= 50]
            growth_areas = [d[0] for d in sorted_dims[-2:] if d[1] < 60]

            # ── Actionable Insight ───────────────────────────────
            weakest_dim = sorted_dims[-1]
            insight_map = {
                "strategic_planning": "Link more tasks to goals — purposeful planning raises your intelligence score",
                "execution_intelligence": "Focus on completing high-impact tasks rather than creating more",
                "ai_collaboration": "Ask Leno to help plan your day — turning conversations into actions boosts this score",
                "adaptive_capacity": "When a goal falls behind pace, create tasks to catch up",
                "cognitive_consistency": "Build a daily habit routine — consistency compounds over time",
                "self_regulation": "Your burnout risk is elevated — schedule a recovery day",
            }
            primary_insight = insight_map.get(
                weakest_dim[0], "Keep building consistent patterns across all dimensions"
            )

            return {
                "score": round(score, 1),
                "category": category,
                "score_version": "intelligence_v3",
                "strengths": strengths,
                "growth_areas": growth_areas,
                "primary_insight": primary_insight,
                "metrics": {
                    "strategic_planning": round(strategic_planning, 1),
                    "execution_intelligence": round(execution_intelligence, 1),
                    "ai_collaboration": round(ai_collaboration, 1),
                    "adaptive_capacity": round(adaptive_capacity, 1),
                    "cognitive_consistency": round(cognitive_consistency, 1),
                    "self_regulation": round(self_regulation, 1),
                    "big_five_modifier": round(big_five_modifier, 1),
                },
                "weights": {
                    "strategic_planning": 0.20,
                    "execution_intelligence": 0.25,
                    "ai_collaboration": 0.15,
                    "adaptive_capacity": 0.15,
                    "cognitive_consistency": 0.15,
                    "self_regulation": 0.10,
                },
                **self._meta(window, source="derived_v3", confidence=round(confidence, 2)),
            }

    async def goal_progress(self, user: User, time_range: str, goal_id: Optional[int] = None) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        burnout_snapshot: Optional[float] = None
        if settings.GOAL_PROGRESS_V3_ENABLED:
            burnout_snapshot = await self._safe_burnout_snapshot(user, time_range, default=-1.0)
            if burnout_snapshot < 0:
                burnout_snapshot = None
        async for db in get_db():
            if settings.GOAL_PROGRESS_V3_ENABLED:
                goal_summary = await self._goal_progress_summary_v3(
                    db,
                    user,
                    window,
                    goal_id=goal_id,
                    burnout_risk_score=burnout_snapshot,
                )
                confidence = (
                    float(goal_summary.get("summary", {}).get("avg_confidence", 0.2))
                    if goal_summary.get("goals")
                    else 0.2
                )
                source = "derived_v3"
            else:
                goal_summary = await self._goal_progress_summary(db, user.id, window, goal_id=goal_id)
                confidence = 0.35 if not goal_summary.get("goals") else min(0.85, 0.5 + len(goal_summary["goals"]) * 0.05)
                source = "derived"
            payload = {
                **goal_summary,
                **self._meta(window, source=source, confidence=confidence),
            }
            return payload


analytics_v2_service = AnalyticsV2Service()
