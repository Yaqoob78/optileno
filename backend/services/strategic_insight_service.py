# backend/services/strategic_insight_service.py
"""V3 Strategic Insight Engine.

10 data-driven insight types drawn from tasks, deep work, habits,
focus scores, goals, chat engagement, and activity patterns.
Returns up to 3 ranked insights per request.  Every confidence
value is computed from observable data — no random numbers.
"""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select

from backend.db.database import get_db
from backend.db.models import (
    AnalyticsEvent,
    ChatMessage,
    ChatSession,
    FocusScore,
    Goal,
    Notification,
    Plan,
    Task,
    UserInsight,
)
from backend.services.deep_work_utils import extract_deep_work_session_metrics

logger = logging.getLogger(__name__)


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


class StrategicInsightService:
    """V3: multi-source, analytics-connected insight engine."""

    LOOKBACK_DAYS = 30
    MIN_ACTIVITY_SIGNALS = 3
    INSIGHT_STALE_HOURS = 12
    MAX_INSIGHTS = 3
    COMPLETED_STATUSES = ("completed", "done")
    OPEN_STATUSES = ("pending", "planned", "in_progress", "in-progress", "overdue", "todo")
    HIGH_PRIORITIES = ("high", "urgent")

    # ──────────────────────────────────────────────────────────────
    # PUBLIC API
    # ──────────────────────────────────────────────────────────────

    async def get_active_insight(self, user_id: int) -> Dict[str, Any]:
        """Return up to 3 ranked insights wrapped in {insights:[], count:N}."""
        async for db in get_db():
            snapshot = await self._build_snapshot(db, user_id)

            if snapshot["activity_signals"] < self.MIN_ACTIVITY_SIGNALS:
                return self._awaiting_data_response(snapshot)

            # Check if stored insights are still fresh
            existing = await self._get_recent_insights(db, user_id)
            if existing and not self._should_refresh(existing[0], snapshot):
                return {
                    "insights": [self._format_insight(i) for i in existing[:self.MAX_INSIGHTS]],
                    "count": min(len(existing), self.MAX_INSIGHTS),
                }

            return await self._generate_and_store(db, user_id, snapshot)

    async def generate_insight(self, user_id: int) -> Dict[str, Any]:
        """Force-generate fresh insights (admin / tool workflows)."""
        async for db in get_db():
            snapshot = await self._build_snapshot(db, user_id)
            if snapshot["activity_signals"] < self.MIN_ACTIVITY_SIGNALS:
                return self._awaiting_data_response(snapshot)
            return await self._generate_and_store(db, user_id, snapshot)

    async def apply_insight(self, user_id: int, insight_id: int) -> Dict[str, Any]:
        """Apply an insight — creates a task if applicable."""
        async for db in get_db():
            result = await db.execute(
                select(UserInsight).where(
                    UserInsight.id == insight_id,
                    UserInsight.user_id == user_id,
                )
            )
            insight = result.scalars().first()
            if not insight:
                raise ValueError("Insight not found")

            if insight.read_at:
                return {
                    "status": "already_applied",
                    "message": "Insight already implemented.",
                    "applied_at": insight.read_at.isoformat(),
                }

            context = insight.context if isinstance(insight.context, dict) else {}
            action_type = context.get("type", "general")
            created_task_title = self._apply_action(action_type, context)

            if created_task_title:
                await self._create_task_if_missing(
                    db, user_id,
                    title=created_task_title,
                    description=context.get("task_description", "Strategic action from insight."),
                    category=context.get("task_category", "planning"),
                    priority=context.get("task_priority", "high"),
                )

            notification = Notification(
                user_id=user_id,
                title="Strategic Insight Applied",
                message=f"Applied: {insight.title}" + (f" | Task created: {created_task_title}" if created_task_title else ""),
                notification_type="achievement",
                channel="in_app",
            )
            db.add(notification)
            insight.read_at = datetime.now(timezone.utc)
            await db.commit()

            return {
                "status": "success",
                "message": f"Applied: {insight.title}",
                "applied_at": insight.read_at.isoformat(),
            }

    # ──────────────────────────────────────────────────────────────
    # SNAPSHOT (all data sources in one pass)
    # ──────────────────────────────────────────────────────────────

    async def _build_snapshot(self, db, user_id: int) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        lookback_start = now - timedelta(days=self.LOOKBACK_DAYS)
        week_start = now - timedelta(days=7)
        prev_week_start = now - timedelta(days=14)

        # ── Tasks ────────────────────────────────────────────────
        completed_result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status.in_(self.COMPLETED_STATUSES),
                Task.completed_at.is_not(None),
                Task.completed_at >= lookback_start,
            )
        )
        completed_tasks = completed_result.scalars().all()

        open_high_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.priority.in_(self.HIGH_PRIORITIES),
                Task.status.in_(self.OPEN_STATUSES),
            )
        )
        open_high_priority = int(open_high_result.scalar() or 0)

        goal_linked_completed = len([t for t in completed_tasks if t.goal_id is not None])

        # ── Deep Work ────────────────────────────────────────────
        dw_result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                Plan.date >= lookback_start,
                Plan.date <= now,
            )
        )
        deep_work_sessions_all = dw_result.scalars().all()
        deep_work_sessions: List[Plan] = []
        dw_7d: List[Plan] = []
        dw_minutes_30d = 0
        dw_minutes_7d = 0
        for session in deep_work_sessions_all:
            metrics = extract_deep_work_session_metrics(session)
            if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                continue
            deep_work_sessions.append(session)
            dw_minutes_30d += int(metrics["effective_minutes"])
            if session.date and session.date >= week_start:
                dw_7d.append(session)
                dw_minutes_7d += int(metrics["effective_minutes"])

        # ── Habits ───────────────────────────────────────────────
        habit_result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "habit",
            )
        )
        habits = habit_result.scalars().all()
        habits_total = len(habits)
        habits_completed_7d = 0
        habits_stale: List[str] = []  # habit names not completed in 7+ days
        for habit in habits:
            schedule = habit.schedule if isinstance(habit.schedule, dict) else {}
            completed_raw = schedule.get("lastCompleted")
            if not completed_raw:
                habits_stale.append(habit.name or "Unnamed habit")
                continue
            try:
                completed_dt = datetime.fromisoformat(str(completed_raw).replace("Z", "+00:00"))
                if completed_dt >= week_start:
                    habits_completed_7d += 1
                else:
                    habits_stale.append(habit.name or "Unnamed habit")
            except Exception:
                habits_stale.append(habit.name or "Unnamed habit")

        # ── Focus Scores ─────────────────────────────────────────
        focus_result = await db.execute(
            select(FocusScore.score, FocusScore.date).where(
                FocusScore.user_id == user_id,
                FocusScore.date >= now - timedelta(days=14),
                FocusScore.date <= now,
            ).order_by(FocusScore.date.asc())
        )
        focus_records = focus_result.all()
        focus_scores = [float(r[0]) for r in focus_records]

        focus_trend = "stable"
        if len(focus_scores) >= 4:
            mid = len(focus_scores) // 2
            first_half_mean = statistics.mean(focus_scores[:mid])
            second_half_mean = statistics.mean(focus_scores[mid:])
            diff = second_half_mean - first_half_mean
            if diff > 5:
                focus_trend = "up"
            elif diff < -5:
                focus_trend = "down"

        # ── Goals ────────────────────────────────────────────────
        goals_result = await db.execute(
            select(Goal).where(
                Goal.user_id == user_id,
                Goal.current_progress < 100,
            )
        )
        active_goals = goals_result.scalars().all()
        goals_behind_pace: List[Dict[str, Any]] = []
        for goal in active_goals:
            progress = float(goal.current_progress or 0)
            created_at = goal.created_at or lookback_start
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            target_date = goal.target_date or (created_at + timedelta(days=30))
            if hasattr(target_date, 'tzinfo') and target_date.tzinfo is None:
                target_date = target_date.replace(tzinfo=timezone.utc)
            total_days = max((target_date.date() - created_at.date()).days, 1)
            elapsed_days = min((now.date() - created_at.date()).days, total_days)
            expected = (elapsed_days / total_days) * 100.0
            pace_delta = progress - expected
            if pace_delta < -10:
                goals_behind_pace.append({
                    "title": goal.title,
                    "progress": round(progress, 1),
                    "expected": round(expected, 1),
                    "pace_delta": round(pace_delta, 1),
                    "days_left": max((target_date.date() - now.date()).days, 0),
                })

        # ── Chat Activity ────────────────────────────────────────
        chat_7d = (
            await db.execute(
                select(func.count(ChatMessage.id))
                .join(ChatSession, ChatMessage.session_id == ChatSession.id)
                .where(
                    ChatSession.user_id == user_id,
                    ChatMessage.role == "user",
                    ChatMessage.created_at >= week_start,
                )
            )
        ).scalar() or 0

        chat_30d = (
            await db.execute(
                select(func.count(ChatMessage.id))
                .join(ChatSession, ChatMessage.session_id == ChatSession.id)
                .where(
                    ChatSession.user_id == user_id,
                    ChatMessage.role == "user",
                    ChatMessage.created_at >= lookback_start,
                )
            )
        ).scalar() or 0

        # ── Active Days & Consecutive Work ───────────────────────
        active_dates: set = set()
        for t in completed_tasks:
            if t.completed_at:
                active_dates.add(t.completed_at.date())
        for s in deep_work_sessions:
            if s.date:
                d = s.date.date() if hasattr(s.date, 'date') else s.date
                active_dates.add(d)

        # Consecutive work days (looking back)
        consecutive = 0
        for i in range(30):
            check = (now - timedelta(days=i)).date()
            if check in active_dates:
                consecutive += 1
            else:
                break

        # Weekly task counts for trend
        recent_week_tasks = len([
            t for t in completed_tasks
            if t.completed_at and t.completed_at >= week_start
        ])
        previous_week_tasks = len([
            t for t in completed_tasks
            if t.completed_at and prev_week_start <= t.completed_at < week_start
        ])

        last_completed_at = max(
            (t.completed_at for t in completed_tasks if t.completed_at),
            default=None,
        )

        # Activity signal count (for minimum threshold)
        activity_signals = sum([
            1 if len(completed_tasks) > 0 else 0,
            1 if len(deep_work_sessions) > 0 else 0,
            1 if habits_completed_7d > 0 else 0,
            1 if chat_7d > 0 else 0,
            1 if len(focus_scores) > 0 else 0,
            1 if len(active_goals) > 0 else 0,
        ])

        return {
            # Tasks
            "completed_tasks": completed_tasks,
            "completed_30d": len(completed_tasks),
            "recent_week_tasks": recent_week_tasks,
            "previous_week_tasks": previous_week_tasks,
            "open_high_priority": open_high_priority,
            "goal_linked_completed": goal_linked_completed,
            "last_completed_at": last_completed_at,
            # Deep Work
            "deep_work_sessions_30d": len(deep_work_sessions),
            "deep_work_sessions_7d": len(dw_7d),
            "deep_work_minutes_30d": dw_minutes_30d,
            "deep_work_minutes_7d": dw_minutes_7d,
            # Habits
            "habits_total": habits_total,
            "habits_completed_7d": habits_completed_7d,
            "habits_stale": habits_stale,
            # Focus
            "focus_scores": focus_scores,
            "focus_trend": focus_trend,
            "avg_focus_score": statistics.mean(focus_scores) if focus_scores else 0.0,
            # Goals
            "active_goals": len(active_goals),
            "goals_behind_pace": goals_behind_pace,
            # Chat
            "chat_7d": chat_7d,
            "chat_30d": chat_30d,
            # Activity
            "active_days_30d": len(active_dates),
            "consecutive_work_days": consecutive,
            # Meta
            "activity_signals": activity_signals,
            "generated_at": now,
            "lookback_days": self.LOOKBACK_DAYS,
        }

    # ──────────────────────────────────────────────────────────────
    # CANDIDATE GENERATORS  (10 types)
    # ──────────────────────────────────────────────────────────────

    def _build_candidates(self, snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        out += self._candidate_peak_window(snapshot)
        out += self._candidate_priority_firewall(snapshot)
        out += self._candidate_consistency_recovery(snapshot)
        out += self._candidate_burnout_warning(snapshot)
        out += self._candidate_recovery_gap(snapshot)
        out += self._candidate_goal_pace(snapshot)
        out += self._candidate_focus_decline(snapshot)
        out += self._candidate_deep_work_deficit(snapshot)
        out += self._candidate_ai_synergy(snapshot)
        out += self._candidate_habit_momentum(snapshot)
        return out

    # ── 1. Peak Cognitive Window ─────────────────────────────────

    def _candidate_peak_window(self, s: Dict) -> List[Dict]:
        tasks = s["completed_tasks"]
        total = s["completed_30d"]
        if total < 5:
            return []

        window_counts: Dict[Tuple[int, int], int] = {}
        for task in tasks:
            if not task.completed_at:
                continue
            key = (task.completed_at.weekday(), task.completed_at.hour)
            window_counts[key] = window_counts.get(key, 0) + 1

        if not window_counts:
            return []

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        (day_idx, hour), best_count = max(window_counts.items(), key=lambda x: x[1])
        others = [c for k, c in window_counts.items() if k != (day_idx, hour)]
        avg_others = sum(others) / len(others) if others else 0.0
        lift = (best_count / max(avg_others, 1.0)) if avg_others > 0 else float(best_count)
        support = best_count / max(1, total)
        improvement_pct = round(((lift - 1.0) * 100), 1) if avg_others > 0 else 100.0

        confidence = _clamp(
            58 + min(20, support * 80) + min(12, max(0, lift - 1) * 10) + min(5, total / 20),
            58, 95,
        )
        impact_score = _clamp(
            support * 45 + min(2.0, lift) / 2.0 * 35 + min(1.0, total / 40) * 20,
            0, 100,
        )

        day_name = days[day_idx]
        return [{
            "title": f"Protect {day_name} {hour:02d}:00",
            "description": (
                f"You completed {best_count} tasks in this slot over the last {s['lookback_days']} days "
                f"({improvement_pct:.0f}% above your average hour). Block it for deep work."
            ),
            "category": "planning",
            "severity": "positive",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "peak_window_protection",
                "day_name": day_name, "day_idx": day_idx, "hour": hour,
                "supporting_tasks": best_count,
                "improvement_percent": improvement_pct,
                "task_description": f"Protect your highest-yield cognitive window ({day_name} {hour:02d}:00) with uninterrupted deep work.",
                "task_category": "deep_work", "task_priority": "high",
                "evidence": [
                    f"{best_count} completed tasks at {hour:02d}:00 on {day_name}",
                    f"Lift vs other hours: {lift:.1f}x",
                ],
            },
            "action_items": [{"action": "schedule_block", "params": {"day": day_name, "time": f"{hour:02d}:00", "duration": 90}}],
        }]

    # ── 2. Priority Firewall ─────────────────────────────────────

    def _candidate_priority_firewall(self, s: Dict) -> List[Dict]:
        open_high = s["open_high_priority"]
        total = s["completed_30d"]
        if open_high < 3:
            return []

        high_completed = len([t for t in s["completed_tasks"] if (t.priority or "medium") in self.HIGH_PRIORITIES])
        high_ratio = high_completed / max(1, total) if total > 0 else 0

        confidence = _clamp(
            60 + min(20, open_high * 3) + min(10, (1 - high_ratio) * 15) + min(3, total / 40),
            60, 93,
        )
        impact_score = _clamp(
            min(1.0, open_high / 10) * 65 + (1.0 - min(1.0, high_ratio)) * 35,
            0, 100,
        )

        return [{
            "title": "Create a Priority Firewall",
            "description": (
                f"You have {open_high} open high-priority tasks, while only "
                f"{round(high_ratio * 100)}% of recent completions were high-priority. "
                f"Start each day with one high-impact task before any low-priority work."
            ),
            "category": "planning",
            "severity": "info",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "priority_firewall",
                "open_high_priority": open_high,
                "high_completed_ratio": round(high_ratio, 3),
                "task_description": "Start each day by finishing one high-priority task before low-value work.",
                "task_category": "planning", "task_priority": "high",
                "evidence": [
                    f"{open_high} open high/urgent tasks",
                    f"{high_completed} high/urgent completed in {s['lookback_days']}d",
                ],
            },
            "action_items": [{"action": "create_guardrail", "params": {"rule": "top_1_high_priority_first"}}],
        }]

    # ── 3. Consistency Recovery ──────────────────────────────────

    def _candidate_consistency_recovery(self, s: Dict) -> List[Dict]:
        recent = s["recent_week_tasks"]
        previous = s["previous_week_tasks"]
        if previous < 4 or recent >= previous * 0.75:
            return []

        drop_pct = round((1 - recent / max(1, previous)) * 100, 1)
        confidence = _clamp(58 + min(18, drop_pct / 100 * 40) + min(10, previous / 20), 58, 90)
        impact_score = _clamp(min(1.0, drop_pct / 60) * 60 + min(1.0, previous / 14) * 40, 0, 100)

        return [{
            "title": "Recover Your Weekly Rhythm",
            "description": (
                f"Your completions dropped from {previous} to {recent} tasks week-over-week "
                f"({drop_pct:.0f}% decline). A focused recovery block today will stabilize momentum."
            ),
            "category": "consistency",
            "severity": "medium",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "consistency_recovery",
                "recent_week_tasks": recent, "previous_week_tasks": previous,
                "drop_percent": drop_pct,
                "task_description": "Rebuild momentum with one focused recovery block today.",
                "task_category": "deep_work", "task_priority": "high",
                "evidence": [
                    f"Last week: {previous} tasks completed",
                    f"This week: {recent} tasks completed ({drop_pct:.0f}% drop)",
                ],
            },
            "action_items": [{"action": "schedule_recovery_block", "params": {"duration": 45}}],
        }]

    # ── 4. Burnout Warning ───────────────────────────────────────

    def _candidate_burnout_warning(self, s: Dict) -> List[Dict]:
        dw_daily = s["deep_work_minutes_7d"] / 7.0
        active_ratio = s["active_days_30d"] / max(s["lookback_days"], 1)
        consecutive = s["consecutive_work_days"]

        # Trigger if: heavy daily deep work + high active ratio + long streak
        overwork_signal = (
            (1 if dw_daily > 180 else 0)  # 3+ hours/day deep work
            + (1 if active_ratio > 0.85 else 0)  # almost no rest days
            + (1 if consecutive >= 7 else 0)  # 7+ day streak
        )
        if overwork_signal < 2:
            return []

        confidence = _clamp(62 + overwork_signal * 8 + min(10, dw_daily / 30), 62, 90)
        impact_score = _clamp(overwork_signal * 25 + min(25, dw_daily / 10), 0, 100)

        evidence = []
        if dw_daily > 180:
            evidence.append(f"Averaging {dw_daily:.0f} min/day deep work this week")
        if consecutive >= 7:
            evidence.append(f"{consecutive} consecutive work days without rest")
        if active_ratio > 0.85:
            evidence.append(f"Active {round(active_ratio * 100)}% of days this month")

        return [{
            "title": "Burnout Risk Elevated",
            "description": (
                "Multiple overwork signals detected. Sustained high-intensity work "
                "without adequate recovery degrades both performance and well-being. "
                "Schedule a lighter day or full rest day."
            ),
            "category": "wellbeing",
            "severity": "high",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "burnout_warning",
                "daily_deep_work_min": round(dw_daily),
                "consecutive_work_days": consecutive,
                "active_ratio": round(active_ratio, 2),
                "task_description": "Take a planned recovery day — no deep work, only light tasks or rest.",
                "task_category": "wellbeing", "task_priority": "high",
                "evidence": evidence,
            },
            "action_items": [{"action": "schedule_rest_day", "params": {"type": "recovery"}}],
        }]

    # ── 5. Recovery Gap ──────────────────────────────────────────

    def _candidate_recovery_gap(self, s: Dict) -> List[Dict]:
        consecutive = s["consecutive_work_days"]
        if consecutive < 10:
            return []

        confidence = _clamp(65 + min(20, (consecutive - 10) * 3), 65, 92)
        impact_score = _clamp(50 + min(40, (consecutive - 10) * 5), 50, 95)

        return [{
            "title": f"No Rest Day in {consecutive} Days",
            "description": (
                f"You've been active for {consecutive} consecutive days. "
                "Research shows that even one rest day per week improves "
                "sustained cognitive performance by 15-20%. Schedule recovery."
            ),
            "category": "wellbeing",
            "severity": "high",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "recovery_gap",
                "consecutive_work_days": consecutive,
                "task_description": f"Recovery day — you've worked {consecutive} days straight. Rest today.",
                "task_category": "wellbeing", "task_priority": "high",
                "evidence": [
                    f"{consecutive} consecutive days with activity",
                    "No full rest day detected in recent history",
                ],
            },
            "action_items": [{"action": "schedule_rest_day", "params": {"type": "mandatory"}}],
        }]

    # ── 6. Goal Pace Alert ───────────────────────────────────────

    def _candidate_goal_pace(self, s: Dict) -> List[Dict]:
        behind = s["goals_behind_pace"]
        if not behind:
            return []

        # Pick the most behind goal
        worst = min(behind, key=lambda g: g["pace_delta"])
        confidence = _clamp(60 + min(25, abs(worst["pace_delta"]) / 2), 60, 90)
        impact_score = _clamp(40 + min(40, abs(worst["pace_delta"])) + (10 if worst["days_left"] < 14 else 0), 0, 100)

        urgency = "soon" if worst["days_left"] < 14 else "within the timeline"
        return [{
            "title": f"Goal Behind Pace: {worst['title'][:40]}",
            "description": (
                f"'{worst['title']}' is at {worst['progress']}% progress but should be "
                f"at {worst['expected']}% by now ({worst['pace_delta']:+.0f}% behind). "
                f"{'Deadline approaching — prioritize this.' if worst['days_left'] < 14 else 'Create linked tasks to catch up.'}"
            ),
            "category": "goals",
            "severity": "high" if worst["days_left"] < 14 else "medium",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "goal_pace_alert",
                "goal_title": worst["title"],
                "progress": worst["progress"],
                "expected": worst["expected"],
                "pace_delta": worst["pace_delta"],
                "days_left": worst["days_left"],
                "task_description": f"Focus session: catch up on '{worst['title']}' — currently {abs(worst['pace_delta']):.0f}% behind pace.",
                "task_category": "goals", "task_priority": "high",
                "evidence": [
                    f"Current: {worst['progress']}% | Expected: {worst['expected']}%",
                    f"{worst['days_left']} days remaining {urgency}",
                ],
            },
            "action_items": [{"action": "focus_on_goal", "params": {"goal_title": worst["title"]}}],
        }]

    # ── 7. Focus Decline ─────────────────────────────────────────

    def _candidate_focus_decline(self, s: Dict) -> List[Dict]:
        if s["focus_trend"] != "down" or len(s["focus_scores"]) < 4:
            return []

        scores = s["focus_scores"]
        mid = len(scores) // 2
        first_avg = statistics.mean(scores[:mid])
        second_avg = statistics.mean(scores[mid:])
        drop = first_avg - second_avg

        confidence = _clamp(58 + min(22, drop * 1.5) + min(10, len(scores) / 10 * 5), 58, 88)
        impact_score = _clamp(30 + min(50, drop * 2.5) + min(15, len(scores) / 2), 0, 100)

        return [{
            "title": "Focus Score Declining",
            "description": (
                f"Your average focus score dropped from {first_avg:.0f} to {second_avg:.0f} "
                f"over the last 14 days ({drop:.0f} point decline). "
                "Consider shorter, more intentional deep work sessions."
            ),
            "category": "focus",
            "severity": "medium",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "focus_decline",
                "first_half_avg": round(first_avg, 1),
                "second_half_avg": round(second_avg, 1),
                "decline_points": round(drop, 1),
                "task_description": "Schedule a 45-min focused deep work block with no distractions.",
                "task_category": "focus", "task_priority": "medium",
                "evidence": [
                    f"First half avg: {first_avg:.0f} → Second half avg: {second_avg:.0f}",
                    f"{drop:.0f}-point decline over {len(scores)} data points",
                ],
            },
            "action_items": [{"action": "schedule_focus_block", "params": {"duration": 45}}],
        }]

    # ── 8. Deep Work Deficit ─────────────────────────────────────

    def _candidate_deep_work_deficit(self, s: Dict) -> List[Dict]:
        sessions_7d = s["deep_work_sessions_7d"]
        completed_7d = s["recent_week_tasks"]

        # Only trigger if user is active (completing tasks) but not doing deep work
        if completed_7d < 3 or sessions_7d >= 2:
            return []

        confidence = _clamp(60 + min(20, completed_7d * 2), 60, 85)
        impact_score = _clamp(35 + min(30, completed_7d * 3) + (20 if sessions_7d == 0 else 10), 0, 100)

        return [{
            "title": "Deep Work Gap Detected",
            "description": (
                f"You completed {completed_7d} tasks this week but "
                f"{'had zero' if sessions_7d == 0 else 'only had ' + str(sessions_7d)} deep work sessions. "
                "Tasks without focused work blocks tend to be shallow. "
                "Schedule at least 2 deep work sessions per week."
            ),
            "category": "focus",
            "severity": "info",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "deep_work_deficit",
                "sessions_7d": sessions_7d,
                "tasks_completed_7d": completed_7d,
                "task_description": "Schedule a 60-min deep work block — sustained focus drives higher quality output.",
                "task_category": "deep_work", "task_priority": "medium",
                "evidence": [
                    f"{completed_7d} tasks completed this week",
                    f"{sessions_7d} deep work sessions this week",
                ],
            },
            "action_items": [{"action": "schedule_deep_work", "params": {"duration": 60}}],
        }]

    # ── 9. AI Synergy Nudge ──────────────────────────────────────

    def _candidate_ai_synergy(self, s: Dict) -> List[Dict]:
        chat_7d = s["chat_7d"]
        tasks_7d = s["recent_week_tasks"]

        # Only relevant if user is active but not using AI
        if tasks_7d < 2 or chat_7d >= 3:
            return []

        confidence = _clamp(55 + min(15, tasks_7d * 2), 55, 78)
        impact_score = _clamp(20 + min(30, tasks_7d * 3), 0, 60)

        usage_word = "did not use" if chat_7d == 0 else "barely used"
        return [{
            "title": "Boost Your AI Synergy",
            "description": (
                f"You completed {tasks_7d} tasks this week but "
                f"{usage_word} Leno. "
                "Users who turn AI conversations into actions score 25% higher "
                "on the Intelligence metric. Try asking Leno to plan your next day."
            ),
            "category": "ai_collaboration",
            "severity": "info",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "ai_synergy_nudge",
                "chat_messages_7d": chat_7d,
                "tasks_completed_7d": tasks_7d,
                "evidence": [
                    f"{chat_7d} AI interactions this week",
                    f"{tasks_7d} tasks completed without AI assistance",
                ],
            },
            "action_items": [{"action": "open_chat", "params": {"prompt": "Help me plan my day"}}],
        }]

    # ── 10. Habit Momentum ───────────────────────────────────────

    def _candidate_habit_momentum(self, s: Dict) -> List[Dict]:
        total = s["habits_total"]
        completed = s["habits_completed_7d"]
        stale = s["habits_stale"]

        if total == 0 or not stale:
            return []

        completion_rate = completed / max(total, 1)
        if completion_rate > 0.7:
            return []  # habits are fine

        stale_names = stale[:3]
        confidence = _clamp(58 + min(20, len(stale) * 5) + min(10, total * 2), 58, 85)
        impact_score = _clamp(25 + min(40, len(stale) * 8) + min(20, (1 - completion_rate) * 30), 0, 100)

        verb = "has not" if len(stale_names) == 1 else "have not"
        extras = " and others" if len(stale_names) > 2 else ""
        return [{
            "title": "Habit Momentum Slipping",
            "description": (
                f"Only {completed}/{total} habits completed this week. "
                f"{', '.join(stale_names[:2])}"
                f"{extras} "
                f"{verb} been completed recently. "
                "Consistency compounds — even partial completion beats skipping."
            ),
            "category": "consistency",
            "severity": "medium" if completion_rate < 0.3 else "info",
            "confidence": round(confidence),
            "impact_score": impact_score,
            "context": {
                "type": "habit_momentum",
                "habits_total": total,
                "habits_completed_7d": completed,
                "stale_habits": stale_names,
                "completion_rate": round(completion_rate, 2),
                "task_description": f"Complete at least one stale habit today: {stale_names[0]}",
                "task_category": "habits", "task_priority": "medium",
                "evidence": [
                    f"{completed}/{total} habits completed this week ({round(completion_rate * 100)}%)",
                    f"Stale: {', '.join(stale_names)}",
                ],
            },
            "action_items": [{"action": "complete_habit", "params": {"habit_name": stale_names[0]}}],
        }]

    # ──────────────────────────────────────────────────────────────
    # GENERATION & STORAGE
    # ──────────────────────────────────────────────────────────────

    async def _generate_and_store(self, db, user_id: int, snapshot: Dict) -> Dict[str, Any]:
        candidates = self._build_candidates(snapshot)
        if not candidates:
            return self._awaiting_data_response(snapshot)

        # Rank by impact score, pick top N
        ranked = sorted(candidates, key=lambda c: c["impact_score"], reverse=True)
        top = ranked[:self.MAX_INSIGHTS]

        stored: List[UserInsight] = []
        for candidate in top:
            context = dict(candidate["context"])
            context["data_signature"] = self._build_signature(snapshot)
            context["completed_30d"] = snapshot["completed_30d"]
            context["activity_signals"] = snapshot["activity_signals"]

            insight = UserInsight(
                user_id=user_id,
                title=candidate["title"],
                description=candidate["description"],
                insight_type="strategic_high_impact",
                category=candidate["category"],
                severity=candidate["severity"],
                confidence=candidate["confidence"] / 100.0,
                context=context,
                action_items=candidate["action_items"],
            )
            db.add(insight)
            stored.append(insight)

        await db.commit()
        for ins in stored:
            await db.refresh(ins)

        return {
            "insights": [self._format_insight(i) for i in stored],
            "count": len(stored),
        }

    # ──────────────────────────────────────────────────────────────
    # HELPERS
    # ──────────────────────────────────────────────────────────────

    async def _get_recent_insights(self, db, user_id: int) -> List[UserInsight]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self.INSIGHT_STALE_HOURS)
        result = await db.execute(
            select(UserInsight)
            .where(
                UserInsight.user_id == user_id,
                UserInsight.insight_type == "strategic_high_impact",
                UserInsight.generated_at >= cutoff,
            )
            .order_by(UserInsight.confidence.desc().nullslast())
            .limit(self.MAX_INSIGHTS)
        )
        return list(result.scalars().all())

    def _should_refresh(self, latest: UserInsight, snapshot: Dict) -> bool:
        if not latest.generated_at:
            return True
        age_hours = (datetime.now(timezone.utc) - latest.generated_at.replace(tzinfo=timezone.utc) if latest.generated_at.tzinfo is None else datetime.now(timezone.utc) - latest.generated_at).total_seconds() / 3600
        if age_hours >= self.INSIGHT_STALE_HOURS:
            return True
        ctx = latest.context if isinstance(latest.context, dict) else {}
        if ctx.get("data_signature") != self._build_signature(snapshot):
            return True
        if latest.read_at:
            return True
        return False

    def _build_signature(self, s: Dict) -> str:
        parts = [
            str(s["completed_30d"]),
            str(s["open_high_priority"]),
            str(s["deep_work_sessions_7d"]),
            str(s["habits_completed_7d"]),
            str(s["consecutive_work_days"]),
            str(len(s["goals_behind_pace"])),
            s["focus_trend"],
        ]
        return "|".join(parts)

    def _apply_action(self, action_type: str, context: Dict) -> Optional[str]:
        """Map insight type → task title to create when applied."""
        type_to_title = {
            "peak_window_protection": lambda c: f"STRATEGIC: Protect {c.get('day_name', 'Peak Day')} {c.get('hour', 9):02d}:00 Deep Work Block",
            "priority_firewall": lambda _: "STRATEGIC: Priority Firewall (Top 1 High-Impact Task)",
            "consistency_recovery": lambda _: "STRATEGIC: Consistency Recovery Sprint (45 min)",
            "burnout_warning": lambda _: "STRATEGIC: Recovery Day — Reduce Workload",
            "recovery_gap": lambda c: f"STRATEGIC: Rest Day (Active {c.get('consecutive_work_days', 7)}+ days)",
            "goal_pace_alert": lambda c: f"STRATEGIC: Focus on '{c.get('goal_title', 'Goal')[:30]}'",
            "focus_decline": lambda _: "STRATEGIC: Focused Deep Work Block (45 min)",
            "deep_work_deficit": lambda _: "STRATEGIC: Schedule Deep Work Session (60 min)",
            "habit_momentum": lambda c: f"STRATEGIC: Complete '{c.get('stale_habits', ['habit'])[0]}' Today",
            "ai_synergy_nudge": None,  # no task, just acknowledge
        }
        generator = type_to_title.get(action_type)
        if generator is None or not callable(generator):
            return None
        return generator(context)

    async def _create_task_if_missing(
        self, db, user_id: int,
        title: str, description: str, category: str, priority: str,
    ) -> None:
        existing = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.title == title,
                Task.status.in_(self.OPEN_STATUSES),
            )
        )
        if existing.scalars().first():
            return
        task = Task(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority,
            category=category,
            status="pending",
            meta={"source": "strategic_insight"},
        )
        db.add(task)

    def _awaiting_data_response(self, snapshot_or_count) -> Dict[str, Any]:
        if isinstance(snapshot_or_count, dict):
            signals = snapshot_or_count.get("activity_signals", 0)
        else:
            signals = int(snapshot_or_count)
        remaining = max(0, self.MIN_ACTIVITY_SIGNALS - signals)
        return {
            "insights": [{
                "id": 0,
                "title": "Gathering Data",
                "description": (
                    f"Leno needs a bit more activity to generate data-backed insights. "
                    f"Complete tasks, log deep work, or use the chat to unlock strategic recommendations "
                    f"({signals}/{self.MIN_ACTIVITY_SIGNALS} activity signals detected)."
                ),
                "confidence": 0,
                "type": "awaiting_data",
                "severity": "info",
                "category": "system",
                "applied_at": None,
                "evidence": [],
                "data_points": signals,
            }],
            "count": 1,
        }

    def _format_insight(self, insight: UserInsight) -> Dict[str, Any]:
        context = insight.context if isinstance(insight.context, dict) else {}
        return {
            "id": insight.id,
            "title": insight.title,
            "description": insight.description,
            "confidence": round((insight.confidence or 0) * 100),
            "applied_at": insight.read_at.isoformat() if insight.read_at else None,
            "generated_at": insight.generated_at.isoformat() if insight.generated_at else None,
            "type": context.get("type", "general"),
            "severity": insight.severity or "info",
            "category": insight.category or "general",
            "evidence": context.get("evidence", []),
            "data_points": context.get("completed_30d", context.get("activity_signals", 0)),
        }


strategic_insight_service = StrategicInsightService()
