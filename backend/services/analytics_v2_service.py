from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import statistics
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
        async for db in get_db():
            goal_summary = await self._goal_progress_summary(db, user.id, window, goal_id=goal_id)
            confidence = 0.35 if not goal_summary.get("goals") else min(0.85, 0.5 + len(goal_summary["goals"]) * 0.05)
            payload = {
                **goal_summary,
                **self._meta(window, source="derived", confidence=confidence),
            }
            return payload


analytics_v2_service = AnalyticsV2Service()
