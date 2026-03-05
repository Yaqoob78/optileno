# backend/services/behavior_timeline_service.py
"""
Behavior Timeline Service (Behavior v3)
"""

from datetime import datetime, timedelta, date, timezone
from typing import Dict, Any, List, Optional
import logging
import re

from sqlalchemy import select, func, case
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import (
    Task,
    FocusScore,
    Plan,
    AnalyticsEvent,
    ChatMessage,
    StressLog,
    ChatSession,
    Goal,
)
from backend.services.deep_work_utils import extract_deep_work_session_metrics

logger = logging.getLogger(__name__)


class BehaviorTimelineService:
    _ATHLETE_MARKERS = {
        "fitness", "health", "workout", "gym", "weight", "run", "training", "sport",
        "sports", "football", "recovery", "diet", "sleep", "body", "stamina",
    }
    _STUDENT_MARKERS = {
        "exam", "study", "revision", "chapter", "research", "mock", "assignment",
        "syllabus", "neet", "jee", "test", "interview", "course", "academic",
    }
    _MAKER_MARKERS = {
        "build", "project", "product", "code", "coding", "business", "ship", "launch",
        "design", "portfolio", "startup", "create", "art", "skill",
    }
    _APP_OPEN_EVENTS = {
        "app_open", "app_opened", "session_start", "dashboard_opened", "analytics_opened", "page_view",
    }
    _MEANINGFUL_ACTION_EVENTS = {
        "task_completed", "habit_completed", "deep_work_completed",
        "insight_applied", "goal_progress_updated", "strategy_applied",
    }

    async def get_timeline(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        try:
            async for db in get_db():
                end_date = datetime.now().date()
                start_date = end_date - timedelta(days=days - 1)

                tasks_by_date = await self._batch_fetch_tasks(db, user_id, start_date, end_date)
                focus_by_date = await self._batch_fetch_focus(db, user_id, start_date, end_date)
                activity_by_date = await self._batch_fetch_activity(db, user_id, start_date, end_date)
                stress_by_date = await self._batch_fetch_stress(db, user_id, start_date, end_date)
                chat_by_date = await self._batch_fetch_chats(db, user_id, start_date, end_date)
                plan_by_date = await self._batch_fetch_plan_signals(db, user_id, start_date, end_date)

                profile_meta = await self._resolve_profile(db, user_id, tasks_by_date, plan_by_date)
                profile = profile_meta["profile"]

                timeline: List[Dict[str, Any]] = []
                prev_day_state: Optional[Dict[str, Any]] = None
                missed_streak = 0
                active_streak = 0
                max_active_streak = 0
                total_active = 0
                total_flow = 0
                total_interventions = 0

                for day_offset in range(days):
                    current_date = start_date + timedelta(days=day_offset)
                    key = current_date.isoformat()

                    task_data = tasks_by_date.get(key, {})
                    focus_data = focus_by_date.get(key, {})
                    activity_data = activity_by_date.get(key, {})
                    stress_data = stress_by_date.get(key, {})
                    chat_data = chat_by_date.get(key, {})
                    plan_data = plan_by_date.get(key, {})

                    engagement = self._compute_engagement(task_data, chat_data, activity_data)
                    effort = self._compute_effort(task_data, focus_data)
                    emotion = self._compute_emotion(stress_data, task_data, effort)
                    resistance = self._compute_resistance(task_data)
                    recovery = self._compute_recovery(engagement, prev_day_state)
                    intervention = self._compute_intervention(engagement, effort, emotion, resistance, recovery)

                    day_state: Dict[str, Any] = {
                        "date": key,
                        "engagement": engagement,
                        "effort": effort,
                        "emotion": emotion,
                        "resistance": resistance,
                        "recovery": recovery,
                        "intervention": intervention,
                        "detail": {
                            "tasks_completed": task_data.get("completed", 0),
                            "tasks_due": task_data.get("due_total", 0),
                            "tasks_missed": task_data.get("missed", 0),
                            "focus_score": focus_data.get("score", 0),
                            "focus_minutes": focus_data.get("minutes", 0),
                            "chat_messages": chat_data.get("count", 0),
                            "stress_level": stress_data.get("avg_stress", 0),
                            "high_priority_done": task_data.get("high_priority_done", 0),
                            "app_opens": activity_data.get("app_opens", 0),
                            "meaningful_actions": activity_data.get("meaningful_actions", 0),
                            "deep_work_minutes": plan_data.get("deep_work_minutes", 0),
                            "habit_completions": plan_data.get("habit_completions", 0),
                        },
                    }

                    missed_today = self._is_missed_day(day_state, profile)
                    missed_streak = (missed_streak + 1) if missed_today else 0
                    day_state["anti_quit"] = self._analyze_anti_quit_state(
                        day_state=day_state,
                        missed_streak=missed_streak,
                        profile=profile,
                    )

                    timeline.append(day_state)
                    prev_day_state = day_state

                    if engagement in ("active", "partial"):
                        active_streak += 1
                        max_active_streak = max(max_active_streak, active_streak)
                        total_active += 1
                    else:
                        active_streak = 0
                    if emotion == "flow":
                        total_flow += 1
                    if intervention:
                        total_interventions += 1

                absent_days = days - total_active
                engagement_rate = round((total_active / days) * 100) if days > 0 else 0

                return {
                    "timeline": timeline,
                    "summary": {
                        "active_days": total_active,
                        "absent_days": absent_days,
                        "engagement_rate": engagement_rate,
                        "longest_streak": max_active_streak,
                        "current_streak": active_streak,
                        "flow_days": total_flow,
                        "interventions_triggered": total_interventions,
                        "dominant_pattern": self._detect_dominant_pattern(timeline),
                        "anti_quit": self._build_anti_quit_summary(timeline, profile, profile_meta),
                    },
                    "meta": {
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "days": days,
                        "score_version": "v3",
                        "source": "derived",
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                    },
                }
        except Exception as e:
            logger.error(f"Error generating behavior timeline: {e}", exc_info=True)
            return {"timeline": [], "summary": {}, "error": str(e)}

    async def _batch_fetch_tasks(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}

        completed_res = await db.execute(
            select(
                func.date(Task.completed_at).label("d"),
                func.count(Task.id).label("total"),
                func.sum(case((Task.priority.in_(["high", "urgent"]), 1), else_=0)).label("high_pri"),
            )
            .where(
                Task.user_id == user_id,
                Task.status == "completed",
                func.date(Task.completed_at) >= start,
                func.date(Task.completed_at) <= end,
            )
            .group_by(func.date(Task.completed_at))
        )
        for row in completed_res.fetchall():
            key = self._row_date_key(row.d)
            if key:
                result.setdefault(key, {})
                result[key]["completed"] = int(row.total or 0)
                result[key]["high_priority_done"] = int(row.high_pri or 0)

        due_res = await db.execute(
            select(
                func.date(Task.due_date).label("d"),
                func.count(Task.id).label("due_total"),
                func.sum(case((Task.status == "pending", 1), else_=0)).label("pending_count"),
                func.sum(case((Task.status == "completed", 1), else_=0)).label("done_count"),
            )
            .where(
                Task.user_id == user_id,
                Task.due_date.isnot(None),
                func.date(Task.due_date) >= start,
                func.date(Task.due_date) <= end,
            )
            .group_by(func.date(Task.due_date))
        )
        for row in due_res.fetchall():
            key = self._row_date_key(row.d)
            if key:
                result.setdefault(key, {})
                result[key]["due_total"] = int(row.due_total or 0)
                result[key]["missed"] = int(row.pending_count or 0)
                result[key]["due_completed"] = int(row.done_count or 0)

        return result

    async def _batch_fetch_focus(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}
        focus_res = await db.execute(
            select(FocusScore).where(
                FocusScore.user_id == user_id,
                func.date(FocusScore.date) >= start,
                func.date(FocusScore.date) <= end,
            )
        )
        for entry in focus_res.scalars().all():
            key: Optional[str] = None
            dt = getattr(entry, "date", None)
            if isinstance(dt, datetime):
                key = dt.date().isoformat()
            elif isinstance(dt, date):
                key = dt.isoformat()
            if not key:
                continue

            minutes = 0
            breakdown = getattr(entry, "breakdown", {}) if isinstance(getattr(entry, "breakdown", {}), dict) else {}
            if breakdown:
                minutes = int(breakdown.get("deep_work_minutes", 0) or breakdown.get("focus_minutes", 0) or 0)

            result[key] = {
                "score": float(entry.score or 0),
                "minutes": int(minutes),
            }
        return result

    async def _batch_fetch_activity(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}
        event_res = await db.execute(
            select(
                func.date(AnalyticsEvent.timestamp).label("d"),
                func.count(AnalyticsEvent.id).label("count"),
                func.sum(
                    case((AnalyticsEvent.event_type.in_(list(self._APP_OPEN_EVENTS)), 1), else_=0)
                ).label("app_opens"),
                func.sum(
                    case((AnalyticsEvent.event_type.in_(list(self._MEANINGFUL_ACTION_EVENTS)), 1), else_=0)
                ).label("meaningful_actions"),
            )
            .where(
                AnalyticsEvent.user_id == user_id,
                func.date(AnalyticsEvent.timestamp) >= start,
                func.date(AnalyticsEvent.timestamp) <= end,
            )
            .group_by(func.date(AnalyticsEvent.timestamp))
        )
        for row in event_res.fetchall():
            key = self._row_date_key(row.d)
            if key:
                result[key] = {
                    "count": int(row.count or 0),
                    "app_opens": int(row.app_opens or 0),
                    "meaningful_actions": int(row.meaningful_actions or 0),
                }
        return result

    async def _batch_fetch_stress(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}
        stress_res = await db.execute(
            select(
                func.date(StressLog.timestamp).label("d"),
                func.avg(StressLog.stress_level).label("avg_stress"),
                func.max(StressLog.stress_level).label("max_stress"),
                func.count(StressLog.id).label("entries"),
            )
            .where(
                StressLog.user_id == user_id,
                func.date(StressLog.timestamp) >= start,
                func.date(StressLog.timestamp) <= end,
            )
            .group_by(func.date(StressLog.timestamp))
        )
        for row in stress_res.fetchall():
            key = self._row_date_key(row.d)
            if key:
                result[key] = {
                    "avg_stress": round(float(row.avg_stress or 0), 1),
                    "max_stress": int(row.max_stress or 0),
                    "entries": int(row.entries or 0),
                }
        return result

    async def _batch_fetch_chats(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}
        chat_res = await db.execute(
            select(
                func.date(ChatMessage.created_at).label("d"),
                func.count(ChatMessage.id).label("count"),
            )
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == "user",
                func.date(ChatMessage.created_at) >= start,
                func.date(ChatMessage.created_at) <= end,
            )
            .group_by(func.date(ChatMessage.created_at))
        )
        for row in chat_res.fetchall():
            key = self._row_date_key(row.d)
            if key:
                result[key] = {"count": int(row.count or 0)}
        return result

    async def _batch_fetch_plan_signals(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        result: Dict[str, Dict[str, Any]] = {}

        deepwork_res = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                func.date(Plan.date) >= start,
                func.date(Plan.date) <= end,
            )
        )
        for plan in deepwork_res.scalars().all():
            if not getattr(plan, "date", None):
                continue
            metrics = extract_deep_work_session_metrics(plan)
            if not metrics["include_for_analytics"] or metrics["effective_minutes"] <= 0:
                continue
            key = self._row_date_key(plan.date)
            if not key:
                continue
            result.setdefault(key, {})
            result[key]["deep_work_sessions"] = int(result[key].get("deep_work_sessions", 0)) + 1
            result[key]["deep_work_minutes"] = int(result[key].get("deep_work_minutes", 0)) + int(
                metrics["effective_minutes"]
            )

        habit_res = await db.execute(
            select(Plan).where(Plan.user_id == user_id, Plan.plan_type == "habit")
        )
        seen: set[tuple[int, str]] = set()
        for plan in habit_res.scalars().all():
            schedule = plan.schedule if isinstance(plan.schedule, dict) else {}
            history = schedule.get("history")

            if isinstance(history, list):
                for raw in history:
                    d = self._parse_iso_date(raw)
                    if not d or d < start or d > end:
                        continue
                    key = d.isoformat()
                    token = (int(plan.id), key)
                    if token in seen:
                        continue
                    seen.add(token)
                    result.setdefault(key, {})
                    result[key]["habit_completions"] = int(result[key].get("habit_completions", 0)) + 1

            last_completed = self._parse_iso_date(
                schedule.get("lastCompleted") or schedule.get("last_completed")
            )
            if last_completed and start <= last_completed <= end:
                key = last_completed.isoformat()
                token = (int(plan.id), key)
                if token not in seen:
                    seen.add(token)
                    result.setdefault(key, {})
                    result[key]["habit_completions"] = int(result[key].get("habit_completions", 0)) + 1

        return result

    def _compute_engagement(self, task_data: Dict, chat_data: Dict, activity_data: Dict) -> str:
        tasks_done = int(task_data.get("completed", 0) or 0)
        chats = int(chat_data.get("count", 0) or 0)
        events = int(activity_data.get("count", 0) or 0)
        meaningful = int(activity_data.get("meaningful_actions", 0) or 0)
        app_opens = int(activity_data.get("app_opens", 0) or 0)
        activity_score = (tasks_done * 3) + (chats * 2) + (meaningful * 2) + max(app_opens - 1, 0) + (events // 5)
        if activity_score >= 8:
            return "active"
        if activity_score > 0:
            return "partial"
        return "absent"

    def _compute_effort(self, task_data: Dict, focus_data: Dict) -> str:
        focus_score = float(focus_data.get("score", 0) or 0)
        high_pri = int(task_data.get("high_priority_done", 0) or 0)
        total_done = int(task_data.get("completed", 0) or 0)
        effort_signal = focus_score + (high_pri * 15) + (total_done * 5)
        if effort_signal >= 80:
            return "high"
        if effort_signal >= 35:
            return "medium"
        if effort_signal > 0:
            return "low"
        return "none"

    def _compute_emotion(self, stress_data: Dict, task_data: Dict, effort: str) -> str:
        avg_stress = float(stress_data.get("avg_stress", 0) or 0)
        has_stress = int(stress_data.get("entries", 0) or 0) > 0
        missed = int(task_data.get("missed", 0) or 0)
        due_total = int(task_data.get("due_total", 0) or 0)
        if has_stress and avg_stress >= 7:
            return "drained"
        if has_stress and avg_stress >= 5:
            return "frustrated"
        if due_total > 0 and missed > 0:
            miss_rate = missed / max(due_total, 1)
            if miss_rate > 0.6 and missed >= 3:
                return "strained"
        if effort == "high":
            if has_stress and avg_stress < 3:
                return "flow"
            if not has_stress:
                if int(task_data.get("completed", 0) or 0) >= 4:
                    return "flow"
                return "calm"
        return "calm"

    def _compute_resistance(self, task_data: Dict) -> List[str]:
        signals: List[str] = []
        missed = int(task_data.get("missed", 0) or 0)
        due_total = int(task_data.get("due_total", 0) or 0)
        due_completed = int(task_data.get("due_completed", 0) or 0)
        if due_total > 0:
            miss_rate = missed / max(due_total, 1)
            if miss_rate > 0.5 and missed >= 2:
                signals.append("avoidance")
            elif missed > 0 and due_completed == 0:
                signals.append("skipped_all")
        return signals

    def _compute_recovery(self, engagement: str, prev_state: Optional[Dict]) -> bool:
        if not prev_state:
            return False
        return prev_state.get("engagement") == "absent" and engagement in ("active", "partial")

    def _compute_intervention(
        self,
        engagement: str,
        effort: str,
        emotion: str,
        resistance: List[str],
        recovery: bool,
    ) -> Optional[Dict[str, str]]:
        if emotion == "drained":
            return {"title": "Recharge Protocol", "action": "Step away for 15 min. Non-screen break required.", "icon": "coffee", "priority": "health"}
        if emotion == "frustrated":
            return {"title": "Clear the Fog", "action": "Brain dump everything on your mind into a note.", "icon": "file-text", "priority": "emotional"}
        if "avoidance" in resistance:
            return {"title": "Break the Seal", "action": "Do just 2 minutes of the task you're avoiding.", "icon": "zap", "priority": "behavioral"}
        if "skipped_all" in resistance:
            return {"title": "Pick One", "action": "Choose the easiest due task and finish just that.", "icon": "target", "priority": "behavioral"}
        if engagement == "absent":
            return {"title": "Small Re-entry", "action": "Open the app and check one notification.", "icon": "log-in", "priority": "behavioral"}
        if recovery:
            return {"title": "Welcome Back", "action": "Great comeback! Start with something easy to build momentum.", "icon": "sunrise", "priority": "reinforcement"}
        if engagement == "active" and effort == "high" and emotion == "flow":
            return {"title": "Peak Performance", "action": "You're in flow! Note what worked so you can replicate it.", "icon": "star", "priority": "reinforcement"}
        return None

    async def _resolve_profile(
        self,
        db: Session,
        user_id: int,
        tasks_by_date: Dict[str, Dict],
        plan_by_date: Dict[str, Dict],
    ) -> Dict[str, Any]:
        goals_res = await db.execute(
            select(Goal).where(Goal.user_id == user_id, Goal.current_progress < 100)
        )
        goals = goals_res.scalars().all()
        goal_text = " ".join(f"{g.title or ''} {g.description or ''} {g.category or ''}" for g in goals).lower()

        athlete_hits = self._keyword_hits(goal_text, self._ATHLETE_MARKERS)
        student_hits = self._keyword_hits(goal_text, self._STUDENT_MARKERS)
        maker_hits = self._keyword_hits(goal_text, self._MAKER_MARKERS)

        habit_total = sum(int(v.get("habit_completions", 0) or 0) for v in plan_by_date.values())
        deep_minutes = sum(int(v.get("deep_work_minutes", 0) or 0) for v in plan_by_date.values())
        tasks_total = sum(int(v.get("completed", 0) or 0) for v in tasks_by_date.values())
        high_pri_total = sum(int(v.get("high_priority_done", 0) or 0) for v in tasks_by_date.values())

        athlete_signal = (athlete_hits * 3.0) + (habit_total * 0.8) + max(0.0, deep_minutes / 180.0)
        student_signal = (student_hits * 3.0) + (deep_minutes / 60.0) + (high_pri_total * 0.7)
        maker_signal = (maker_hits * 3.0) + (tasks_total * 0.9) + (high_pri_total * 1.2)

        signal_map = {"athlete": athlete_signal, "student": student_signal, "maker": maker_signal}
        ordered = sorted(signal_map.items(), key=lambda kv: kv[1], reverse=True)
        profile = ordered[0][0]
        best = ordered[0][1]
        second = ordered[1][1] if len(ordered) > 1 else 0.0
        if best <= 0.2:
            profile = "maker"
            best = maker_signal
            second = max(athlete_signal, student_signal)

        confidence = max(0.45, min(0.95, 0.5 + ((best - second) / 10.0)))
        return {
            "profile": profile,
            "confidence": round(confidence, 3),
            "signals": {
                "athlete": round(athlete_signal, 2),
                "student": round(student_signal, 2),
                "maker": round(maker_signal, 2),
            },
        }

    def _is_missed_day(self, day_state: Dict[str, Any], profile: str) -> bool:
        detail = day_state.get("detail", {}) if isinstance(day_state.get("detail"), dict) else {}
        engagement = str(day_state.get("engagement", "absent"))
        tasks_completed = int(detail.get("tasks_completed", 0) or 0)
        high_priority_done = int(detail.get("high_priority_done", 0) or 0)
        focus_score = float(detail.get("focus_score", 0) or 0)
        deep_work_minutes = int(detail.get("deep_work_minutes", 0) or 0)
        habit_completions = int(detail.get("habit_completions", 0) or 0)
        if profile == "athlete":
            return habit_completions <= 0 and engagement == "absent"
        if profile == "student":
            return deep_work_minutes < 30 and focus_score < 40 and tasks_completed == 0
        return tasks_completed == 0 and high_priority_done == 0 and focus_score < 45 and engagement != "active"

    def _analyze_anti_quit_state(self, *, day_state: Dict[str, Any], missed_streak: int, profile: str) -> Dict[str, Any]:
        detail = day_state.get("detail", {}) if isinstance(day_state.get("detail"), dict) else {}
        engagement = str(day_state.get("engagement", "absent"))
        tasks_completed = int(detail.get("tasks_completed", 0) or 0)
        tasks_due = int(detail.get("tasks_due", 0) or 0)
        focus_score = float(detail.get("focus_score", 0) or 0)
        stress_level = float(detail.get("stress_level", 0) or 0)
        high_priority_done = int(detail.get("high_priority_done", 0) or 0)
        app_opens = int(detail.get("app_opens", 0) or 0)

        frustration = focus_score > 70 and tasks_completed == 0 and stress_level >= 6
        avoidance = tasks_due > 5 and focus_score < 10 and app_opens > 3 and tasks_completed == 0
        momentum_decay = tasks_due <= 2 and focus_score < 35 and missed_streak >= 1 and engagement != "active"
        adrenaline_debt = (tasks_completed >= 4 or high_priority_done >= 2) and focus_score > 90 and stress_level >= 7

        state = "STABLE"
        secondary_state: Optional[str] = None
        matches: List[str] = []
        if adrenaline_debt:
            matches.append("ADRENALINE_DEBT")
        if frustration:
            matches.append("FRUSTRATION_TRAP")
        if avoidance:
            matches.append("AVOIDANCE_LOOP")
        if momentum_decay:
            matches.append("MOMENTUM_DECAY")
        if matches:
            state = matches[0]
            if len(matches) > 1:
                secondary_state = matches[1]
        elif missed_streak >= 3:
            state = "DISENGAGING"

        if missed_streak <= 0:
            quit_probability = 4.0
        elif missed_streak == 1:
            quit_probability = 10.0
        elif missed_streak == 2:
            quit_probability = 45.0
        else:
            quit_probability = 90.0
        if frustration:
            quit_probability += 12.0
        if avoidance:
            quit_probability += 15.0
        if momentum_decay:
            quit_probability += 10.0
        if adrenaline_debt:
            quit_probability += 8.0
        if stress_level >= 8:
            quit_probability += 5.0
        if bool(day_state.get("recovery", False)):
            quit_probability -= 8.0
        quit_probability = max(0.0, min(99.0, quit_probability))

        evidence = [f"profile={profile}", f"missed_streak={missed_streak}"]
        if frustration:
            evidence.extend(["focus_score>70", "tasks_completed=0", "stress_level>=6"])
        if avoidance:
            evidence.extend(["tasks_due>5", "focus_score<10", "app_opens>3"])
        if momentum_decay:
            evidence.extend(["low_demand", "low_focus", "streak_pressure"])
        if adrenaline_debt:
            evidence.extend(["high_output", "focus_score>90", "stress_level>=7"])

        signals = 0
        if focus_score > 0:
            signals += 1
        if tasks_due > 0 or tasks_completed > 0:
            signals += 1
        if stress_level > 0:
            signals += 1
        if app_opens > 0:
            signals += 1
        if int(detail.get("deep_work_minutes", 0) or 0) > 0 or int(detail.get("habit_completions", 0) or 0) > 0:
            signals += 1
        confidence = max(0.4, min(0.95, 0.45 + (signals * 0.09)))

        if quit_probability >= 90:
            visual = "flashing_red"
        elif quit_probability >= 45:
            visual = "orange"
        elif quit_probability >= 10:
            visual = "yellow"
        else:
            visual = "green"

        return {
            "current_state": state,
            "secondary_state": secondary_state,
            "quit_probability": round(quit_probability, 1),
            "risk_level": self._map_risk_level(quit_probability),
            "warning_label": self._warning_for_state(state),
            "timeline_visual": visual,
            "missed_streak": int(missed_streak),
            "confidence": round(confidence, 3),
            "confidence_state": "calibrating" if signals <= 2 else "established",
            "evidence": evidence,
            "profile": profile,
        }

    def _build_anti_quit_summary(self, timeline: List[Dict[str, Any]], profile: str, profile_meta: Dict[str, Any]) -> Dict[str, Any]:
        if not timeline:
            return {
                "profile": profile,
                "current_state": "STABLE",
                "quit_probability": 0,
                "risk_level": "low",
                "warning_label": "Insufficient data.",
                "confidence": 0.2,
                "evidence": [],
            }
        latest = timeline[-1].get("anti_quit", {}) if isinstance(timeline[-1].get("anti_quit"), dict) else {}
        recent = timeline[-7:]
        state_counts: Dict[str, int] = {}
        for day in recent:
            anti = day.get("anti_quit", {}) if isinstance(day.get("anti_quit"), dict) else {}
            s = str(anti.get("current_state", "STABLE"))
            if s != "STABLE":
                state_counts[s] = state_counts.get(s, 0) + 1
        dominant_state_7d = max(state_counts, key=state_counts.get) if state_counts else "STABLE"
        return {
            "profile": profile,
            "profile_confidence": profile_meta.get("confidence", 0.5),
            "profile_signals": profile_meta.get("signals", {}),
            "current_state": latest.get("current_state", "STABLE"),
            "secondary_state": latest.get("secondary_state"),
            "dominant_state_7d": dominant_state_7d,
            "quit_probability": latest.get("quit_probability", 0),
            "risk_level": latest.get("risk_level", "low"),
            "warning_label": latest.get("warning_label", self._warning_for_state("STABLE")),
            "missed_streak": latest.get("missed_streak", 0),
            "confidence": latest.get("confidence", 0.45),
            "confidence_state": latest.get("confidence_state", "calibrating"),
            "evidence": latest.get("evidence", []),
        }

    def _detect_dominant_pattern(self, timeline: List[Dict]) -> str:
        if not timeline or len(timeline) < 7:
            return "Insufficient data"
        recent_7 = timeline[-7:]
        anti_state_counts: Dict[str, int] = {}
        for day in recent_7:
            anti = day.get("anti_quit", {}) if isinstance(day.get("anti_quit"), dict) else {}
            state = str(anti.get("current_state", "STABLE"))
            if state != "STABLE":
                anti_state_counts[state] = anti_state_counts.get(state, 0) + 1
        if anti_state_counts:
            state = max(anti_state_counts, key=anti_state_counts.get)
            if anti_state_counts[state] >= 2:
                return f"{state} pattern detected"

        active_count = sum(1 for d in recent_7 if d.get("engagement") in ("active", "partial"))
        flow_count = sum(1 for d in recent_7 if d.get("emotion") == "flow")
        drained_count = sum(1 for d in recent_7 if d.get("emotion") in ("drained", "frustrated"))
        absent_count = sum(1 for d in recent_7 if d.get("engagement") == "absent")
        avoidance_count = sum(1 for d in recent_7 if "avoidance" in (d.get("resistance") or []))
        consecutive_absent = 0
        for d in reversed(recent_7):
            if d.get("engagement") == "absent":
                consecutive_absent += 1
            else:
                break
        if consecutive_absent >= 3:
            return "Disengaging - re-entry support needed"
        if drained_count >= 3:
            return "Burnout risk - sustained high stress"
        if avoidance_count >= 3:
            return "Avoidance loop - task friction detected"
        if flow_count >= 3:
            return "Strong momentum - productive cycle"
        if active_count >= 6:
            return "Consistently engaged - solid rhythm"
        if active_count >= 4:
            return "Building consistency - room to grow"
        if absent_count >= 4:
            return "Low engagement - activation needed"
        return "Variable - no strong pattern yet"

    def _row_date_key(self, value: Any) -> Optional[str]:
        if isinstance(value, str):
            return value
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return None

    def _parse_iso_date(self, value: Any) -> Optional[date]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
        except Exception:
            return None

    def _keyword_hits(self, text: str, markers: set[str]) -> int:
        raw = str(text or "").lower()
        tokens = set(re.findall(r"[a-z]{3,}", raw))
        return sum(1 for marker in markers if marker in tokens or marker in raw)

    def _map_risk_level(self, quit_probability: float) -> str:
        if quit_probability < 25:
            return "low"
        if quit_probability < 50:
            return "moderate"
        if quit_probability < 75:
            return "high"
        return "critical"

    def _warning_for_state(self, state: str) -> str:
        mapping = {
            "FRUSTRATION_TRAP": "Effort-outcome mismatch detected.",
            "AVOIDANCE_LOOP": "Avoidance loop detected.",
            "MOMENTUM_DECAY": "Momentum decay detected.",
            "ADRENALINE_DEBT": "Performance is high but sustainability is low.",
            "DISENGAGING": "Three-miss quit-risk threshold reached.",
            "STABLE": "Behavior is stable.",
        }
        return mapping.get(state, "Behavior signal detected.")


# Singleton instance
behavior_timeline_service = BehaviorTimelineService()
