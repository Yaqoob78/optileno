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


@dataclass
class RangeWindow:
    time_range: str
    period_start: datetime
    period_end: datetime
    timezone_name: str


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


class AnalyticsV2Service:
    SCORE_VERSION = "v2"

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
            start_local = datetime.combine(now_local.date(), time.min, tzinfo=tz)
        elif tr == "weekly":
            start_local = datetime.combine(now_local.date() - timedelta(days=6), time.min, tzinfo=tz)
        else:
            start_local = datetime.combine(now_local.date() - timedelta(days=29), time.min, tzinfo=tz)

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
            select(Plan.date).where(
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
        for dt in plan_rows.scalars().all():
            if dt:
                days.add(dt.date())
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

        deep_work_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                Plan.date >= window.period_start,
                Plan.date <= window.period_end,
            )
        )
        deep_work_sessions = deep_work_rows.scalars().all()
        deep_work_minutes = sum(int((item.duration_hours or 0) * 60) for item in deep_work_sessions)

        habits_rows = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "habit",
            )
        )
        habits = habits_rows.scalars().all()
        habits_total = len(habits)
        habits_completed = 0
        for habit in habits:
            schedule = habit.schedule if isinstance(habit.schedule, dict) else {}
            completed_raw = schedule.get("lastCompleted")
            if not completed_raw:
                continue
            try:
                completed_dt = datetime.fromisoformat(str(completed_raw).replace("Z", "+00:00"))
                if window.period_start <= completed_dt <= window.period_end:
                    habits_completed += 1
            except Exception:
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
            "deep_work_minutes": int(deep_work_minutes),
            "deep_work_sessions": len(deep_work_sessions),
            "habits_total": int(habits_total),
            "habits_completed": int(habits_completed),
            "chat_requests": int(chat_requests),
            "active_days": int(active_days),
            "pending_tasks": int(pending_tasks),
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
                if dt >= goal_now - timedelta(days=3):
                    recent_deep_minutes += max(float(deep.duration_hours or 0.0) * 60.0, 0.0)
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
            inactivity_decay = max(0.55, 0.95 ** days_inactive)
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
                if goal_now - timedelta(days=10) <= ddt < goal_now - timedelta(days=3):
                    previous_deep_minutes += max(float(deep.duration_hours or 0.0) * 60.0, 0.0)
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

            if days_inactive > 5:
                score_cap = min(score_cap, 29.0)
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

    async def productivity_score(self, user: User, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            task_component = 0.0
            if usage["tasks_created"] > 0:
                task_component = _clamp((usage["tasks_completed"] / usage["tasks_created"]) * 100.0)
            elif usage["tasks_completed"] > 0:
                task_component = 85.0

            habit_component = 0.0
            if usage["habits_total"] > 0:
                habit_component = _clamp((usage["habits_completed"] / usage["habits_total"]) * 100.0)

            deep_work_component = _clamp((usage["deep_work_minutes"] / 120.0) * 100.0)
            execution = (
                task_component * 0.45
                + habit_component * 0.25
                + deep_work_component * 0.30
            )

            goal_progress = float(goals["score"] or 0.0)
            active_minutes = usage["deep_work_minutes"] + (usage["tasks_completed"] * 12) + (usage["chat_requests"] * 2)
            engagement = _clamp((min(usage["chat_requests"], 50) / 50.0) * 40.0 + (min(active_minutes, 180) / 180.0) * 60.0)

            bonus = 0
            if usage["chat_requests"] > 10:
                bonus += 2
            if active_minutes >= 50:
                bonus += 2
            if usage["chat_requests"] > 40 and active_minutes >= 100:
                bonus += 4
            bonus = min(bonus, 6)

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
                    "breakdown": {
                        "execution_block": round(execution, 1),
                        "goal_progress_block": goals["score"],
                        "engagement_block": round(engagement, 1),
                    },
                    **self._meta(window, source="derived", confidence=0.2),
                }

            score = _clamp(execution * 0.70 + goal_progress * 0.25 + engagement * 0.05 + bonus)
            confidence = 0.55 + min(0.35, usage["active_days"] / 30.0)
            return {
                "score": round(score, 1),
                "bonus_applied": bonus,
                "breakdown": {
                    "execution_block": round(execution, 1),
                    "goal_progress_block": round(goal_progress, 1),
                    "engagement_block": round(engagement, 1),
                    "task_component": round(task_component, 1),
                    "habit_component": round(habit_component, 1),
                    "deep_work_component": round(deep_work_component, 1),
                },
                "inputs": usage,
                "goal_band": goals.get("overall_band"),
                **self._meta(window, source="derived", confidence=confidence),
            }

    async def focus_score(self, user: User, plan_tier: str, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            task_component = 0.0
            if usage["tasks_created"] > 0:
                task_component = _clamp((usage["tasks_completed"] / usage["tasks_created"]) * 100.0)
            elif usage["tasks_completed"] > 0:
                task_component = 80.0
            deep_work_component = _clamp((usage["deep_work_minutes"] / 120.0) * 100.0)
            goal_alignment = float(goals["score"] or 0.0)
            derived_score = _clamp(deep_work_component * 0.55 + task_component * 0.30 + goal_alignment * 0.15)

            if plan_tier == "ultra":
                heatmap_rows = await db.execute(
                    select(FocusScore.score).where(
                        FocusScore.user_id == user.id,
                        FocusScore.date >= window.period_start,
                        FocusScore.date <= window.period_end,
                    )
                )
                scores = [float(x) for x in heatmap_rows.scalars().all()]
                if scores:
                    avg_score = sum(scores) / len(scores)
                    return {
                        "score": round(_clamp(avg_score), 1),
                        "breakdown": {
                            "heatmap_samples": len(scores),
                            "derived_fallback": round(derived_score, 1),
                        },
                        **self._meta(
                            window,
                            source="heatmap",
                            confidence=0.65 + min(0.3, len(scores) / 40.0),
                        ),
                    }
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

            return {
                "score": round(derived_score, 1) if derived_score > 0 else None,
                "reason": None if derived_score > 0 else "NO_DATA",
                "breakdown": {
                    "deep_work_component": round(deep_work_component, 1),
                    "task_component": round(task_component, 1),
                    "goal_alignment_component": round(goal_alignment, 1),
                },
                **self._meta(window, source="derived", confidence=0.62),
            }

    async def burnout_risk(self, user: User, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            workload_ratio = usage["pending_tasks"] / max(usage["tasks_completed"] + 1, 1)
            workload_strain = _clamp(workload_ratio * 35.0 + (20 if usage["deep_work_minutes"] > 240 else 0))

            range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)
            recovery_deficit = _clamp((usage["active_days"] / max(range_days, 1)) * 100.0)

            focus_rows = await db.execute(
                select(FocusScore.score).where(
                    FocusScore.user_id == user.id,
                    FocusScore.date >= window.period_start,
                    FocusScore.date <= window.period_end,
                )
            )
            focus_scores = [float(x) for x in focus_rows.scalars().all()]
            if len(focus_scores) >= 2:
                focus_volatility = _clamp(statistics.pstdev(focus_scores) * 4.0)
            else:
                focus_volatility = 25.0

            goal_progress_pressure = _clamp(100.0 - float(goals["score"] or 0.0))

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
            deadline_compression = sum(deadline_scores) / len(deadline_scores) if deadline_scores else 30.0

            active_minutes = usage["deep_work_minutes"] + usage["tasks_completed"] * 12 + usage["chat_requests"] * 2
            if active_minutes < 10:
                engagement_extremes = 40.0
            elif active_minutes > 250:
                engagement_extremes = 70.0
            else:
                engagement_extremes = _clamp(10.0 + abs(active_minutes - 120.0) / 120.0 * 20.0)

            mood_score = 55.0
            try:
                from backend.services.mood_service import mood_service

                mood = await mood_service.calculate_current_mood(user.id)
                label = str(mood.get("label") or mood.get("category") or "").lower()
                if any(k in label for k in ["energetic", "calm", "focused", "positive"]):
                    mood_score = 20.0
                elif any(k in label for k in ["stressed", "anxious", "sad", "frustrated", "negative"]):
                    mood_score = 80.0
                else:
                    mood_score = 55.0
            except Exception:
                mood_score = 55.0

            daily_workload: List[float] = []
            for i in range(range_days):
                day_start = datetime.combine((window.period_end - timedelta(days=i)).date(), time.min, tzinfo=timezone.utc)
                day_end = datetime.combine((window.period_end - timedelta(days=i)).date(), time.max, tzinfo=timezone.utc)
                day_tasks = (
                    await db.execute(
                        select(func.count(Task.id)).where(
                            Task.user_id == user.id,
                            Task.status == "completed",
                            Task.completed_at.isnot(None),
                            Task.completed_at >= day_start,
                            Task.completed_at <= day_end,
                        )
                    )
                ).scalar() or 0
                day_deep_minutes = (
                    await db.execute(
                        select(func.coalesce(func.sum(Plan.duration_hours), 0.0)).where(
                            Plan.user_id == user.id,
                            Plan.plan_type == "deep_work",
                            Plan.date >= day_start,
                            Plan.date <= day_end,
                        )
                    )
                ).scalar() or 0.0
                daily_workload.append(float(day_tasks) + float(day_deep_minutes) * 2.0)

            if len(daily_workload) >= 2 and sum(daily_workload) > 0:
                mean_load = statistics.mean(daily_workload)
                std_load = statistics.pstdev(daily_workload)
                inconsistency_shock = _clamp((std_load / max(mean_load, 1.0)) * 100.0)
            else:
                inconsistency_shock = 20.0

            risk = (
                workload_strain * 0.30
                + recovery_deficit * 0.20
                + focus_volatility * 0.10
                + goal_progress_pressure * 0.10
                + deadline_compression * 0.10
                + engagement_extremes * 0.10
                + mood_score * 0.05
                + inconsistency_shock * 0.05
            )
            risk = _clamp(risk)

            if risk < 30:
                level = "low"
            elif risk < 55:
                level = "moderate"
            elif risk < 75:
                level = "high"
            else:
                level = "critical"

            return {
                "risk": round(risk, 1),
                "level": level,
                "breakdown": {
                    "workload_strain": round(workload_strain, 1),
                    "recovery_deficit": round(recovery_deficit, 1),
                    "focus_volatility": round(focus_volatility, 1),
                    "goal_progress_pressure": round(goal_progress_pressure, 1),
                    "deadline_compression": round(deadline_compression, 1),
                    "engagement_extremes": round(engagement_extremes, 1),
                    "mood_modulation": round(mood_score, 1),
                    "inconsistency_shock": round(inconsistency_shock, 1),
                },
                **self._meta(window, source="derived", confidence=0.66),
            }

    async def ai_intelligence(self, user: User, time_range: str) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        async for db in get_db():
            usage = await self._usage_inputs(db, user.id, window)
            goals = await self._goal_progress_summary(db, user.id, window)

            planning_quality = 0.0
            if usage["tasks_created"] > 0:
                planning_quality = _clamp(
                    (min(usage["tasks_created"], 40) / 40.0) * 70.0
                    + (20.0 if goals["score"] is not None else 0.0)
                    + (10.0 if usage["deep_work_sessions"] > 0 else 0.0)
                )

            execution_quality = _clamp(
                (usage["tasks_completed"] / max(usage["tasks_created"], 1)) * 100.0
                if usage["tasks_created"] > 0
                else (80.0 if usage["tasks_completed"] > 0 else 0.0)
            )

            adaptation_events = (
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
            adaptation_to_insights = _clamp((adaptation_events / 8.0) * 100.0 + (float(goals["score"] or 0.0) * 0.2))

            range_days = 1 if window.time_range == "daily" else (7 if window.time_range == "weekly" else 30)
            consistency = _clamp((usage["active_days"] / max(range_days, 1)) * 100.0)
            if usage["habits_total"] > 0:
                consistency = _clamp(consistency * 0.6 + ((usage["habits_completed"] / usage["habits_total"]) * 100.0) * 0.4)

            big_five_row = await db.execute(
                select(BigFiveTest)
                .where(BigFiveTest.user_id == user.id, BigFiveTest.test_completed == True)  # noqa: E712
                .order_by(BigFiveTest.test_completed_at.desc().nullslast(), BigFiveTest.created_at.desc())
                .limit(1)
            )
            big_five = big_five_row.scalar_one_or_none()
            if big_five:
                emotional_stability = 100.0 - float(big_five.neuroticism or 50)
                cognitive_profile = _clamp(
                    (float(big_five.openness or 50) * 0.35)
                    + (float(big_five.conscientiousness or 50) * 0.45)
                    + (emotional_stability * 0.20)
                )
            else:
                cognitive_profile = 50.0

            score = _clamp(
                planning_quality * 0.25
                + execution_quality * 0.30
                + adaptation_to_insights * 0.20
                + consistency * 0.15
                + cognitive_profile * 0.10
            )

            if score >= 85:
                category = "Strategic Operator"
            elif score >= 70:
                category = "Focused Executor"
            elif score >= 55:
                category = "Adaptive Builder"
            elif score >= 40:
                category = "Developing Rhythm"
            else:
                category = "Early Momentum"

            has_data = any(
                [
                    usage["tasks_created"] > 0,
                    usage["tasks_completed"] > 0,
                    usage["deep_work_sessions"] > 0,
                    usage["chat_requests"] > 0,
                    adaptation_events > 0,
                ]
            )
            if not has_data:
                return {
                    "score": None,
                    "reason": "NO_DATA",
                    "category": category,
                    **self._meta(window, source="derived", confidence=0.25),
                }

            return {
                "score": round(score, 1),
                "category": category,
                "metrics": {
                    "planning_quality": round(planning_quality, 1),
                    "execution_quality": round(execution_quality, 1),
                    "adaptation_to_insights": round(adaptation_to_insights, 1),
                    "consistency": round(consistency, 1),
                    "cognitive_profile": round(cognitive_profile, 1),
                },
                **self._meta(window, source="derived", confidence=0.68),
            }

    async def goal_progress(self, user: User, time_range: str, goal_id: Optional[int] = None) -> Dict[str, Any]:
        window = await self.resolve_window(user, time_range)
        burnout_snapshot: Optional[float] = None
        if settings.GOAL_PROGRESS_V3_ENABLED:
            try:
                burnout_payload = await self.burnout_risk(user, time_range)
                if burnout_payload and burnout_payload.get("risk") is not None:
                    burnout_snapshot = float(burnout_payload["risk"])
            except Exception:
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
