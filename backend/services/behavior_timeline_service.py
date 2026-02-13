# backend/services/behavior_timeline_service.py
"""
Behavior Timeline Service — Production-Ready
Batch-fetches all data in 5 queries, processes in memory.
Delivers real behavioral analytics: engagement, effort, emotion, resistance, recovery.
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
from collections import defaultdict
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import (
    Task, FocusScore, Plan, AnalyticsEvent, ChatMessage, StressLog, ChatSession
)

logger = logging.getLogger(__name__)


class BehaviorTimelineService:
    """
    Production-ready behavioral analytics.
    5 batch queries instead of 270 per-day queries.
    Real logic for engagement, effort, emotion, resistance, recovery.
    """

    async def get_timeline(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """
        Build the full behavioral timeline from batch-fetched data.
        Returns daily states + summary statistics.
        """
        try:
            async for db in get_db():
                end_date = datetime.now().date()
                start_date = end_date - timedelta(days=days - 1)

                # ── BATCH FETCH ALL DATA (5 queries total) ──────────────────
                tasks_by_date = await self._batch_fetch_tasks(db, user_id, start_date, end_date)
                focus_by_date = await self._batch_fetch_focus(db, user_id, start_date, end_date)
                activity_by_date = await self._batch_fetch_activity(db, user_id, start_date, end_date)
                stress_by_date = await self._batch_fetch_stress(db, user_id, start_date, end_date)
                chat_by_date = await self._batch_fetch_chats(db, user_id, start_date, end_date)

                # ── BUILD TIMELINE IN MEMORY ────────────────────────────────
                timeline = []
                prev_day_state = None

                # Track streaks for summary
                active_streak = 0
                max_active_streak = 0
                total_active = 0
                total_flow = 0
                total_interventions = 0

                for day_offset in range(days):
                    current_date = start_date + timedelta(days=day_offset)
                    date_key = current_date.isoformat()

                    task_data = tasks_by_date.get(date_key, {})
                    focus_data = focus_by_date.get(date_key, {})
                    activity_data = activity_by_date.get(date_key, {})
                    stress_data = stress_by_date.get(date_key, {})
                    chat_data = chat_by_date.get(date_key, {})

                    # 1. Engagement
                    engagement = self._compute_engagement(task_data, chat_data, activity_data)

                    # 2. Effort
                    effort = self._compute_effort(task_data, focus_data)

                    # 3. Emotion (health-first priority)
                    emotion = self._compute_emotion(stress_data, task_data, effort)

                    # 4. Resistance
                    resistance = self._compute_resistance(task_data)

                    # 5. Recovery
                    recovery = self._compute_recovery(engagement, prev_day_state)

                    # 6. Intervention (health > emotion > behavior > reinforcement)
                    intervention = self._compute_intervention(
                        engagement, effort, emotion, resistance, recovery
                    )

                    day_state = {
                        "date": date_key,
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
                        }
                    }

                    timeline.append(day_state)
                    prev_day_state = day_state

                    # Track streaks
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

                # ── SUMMARY STATISTICS ──────────────────────────────────────
                absent_days = days - total_active
                engagement_rate = round((total_active / days) * 100) if days > 0 else 0

                # Detect dominant pattern
                pattern = self._detect_dominant_pattern(timeline)

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
                        "dominant_pattern": pattern,
                    },
                    "meta": {
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "days": days
                    }
                }

        except Exception as e:
            logger.error(f"Error generating behavior timeline: {e}", exc_info=True)
            return {"timeline": [], "summary": {}, "error": str(e)}

    # =========================================================================
    # BATCH FETCHERS — One query each, covering the full date range
    # =========================================================================

    async def _batch_fetch_tasks(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        """Fetch all task data for the range, grouped by date."""
        result = {}

        # Completed tasks by completion date
        completed_res = await db.execute(
            select(
                func.date(Task.completed_at).label("d"),
                func.count(Task.id).label("total"),
                func.sum(case(
                    (Task.priority.in_(["high", "urgent"]), 1),
                    else_=0
                )).label("high_pri")
            ).where(
                Task.user_id == user_id,
                Task.status == "completed",
                func.date(Task.completed_at) >= start,
                func.date(Task.completed_at) <= end
            ).group_by(func.date(Task.completed_at))
        )
        for row in completed_res.fetchall():
            d = row.d if isinstance(row.d, str) else row.d.isoformat() if row.d else None
            if d:
                result.setdefault(d, {})
                result[d]["completed"] = row.total or 0
                result[d]["high_priority_done"] = row.high_pri or 0

        # Tasks due by due date (to calculate missed)
        due_res = await db.execute(
            select(
                func.date(Task.due_date).label("d"),
                func.count(Task.id).label("due_total"),
                func.sum(case(
                    (Task.status == "pending", 1),
                    else_=0
                )).label("pending_count"),
                func.sum(case(
                    (Task.status == "completed", 1),
                    else_=0
                )).label("done_count")
            ).where(
                Task.user_id == user_id,
                Task.due_date.isnot(None),
                func.date(Task.due_date) >= start,
                func.date(Task.due_date) <= end
            ).group_by(func.date(Task.due_date))
        )
        for row in due_res.fetchall():
            d = row.d if isinstance(row.d, str) else row.d.isoformat() if row.d else None
            if d:
                result.setdefault(d, {})
                result[d]["due_total"] = row.due_total or 0
                result[d]["missed"] = row.pending_count or 0
                result[d]["due_completed"] = row.done_count or 0

        return result

    async def _batch_fetch_focus(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        """Fetch focus scores for the range."""
        result = {}
        focus_res = await db.execute(
            select(FocusScore).where(
                FocusScore.user_id == user_id,
                FocusScore.date >= start,
                FocusScore.date <= end
            )
        )
        for entry in focus_res.scalars().all():
            d = entry.date.isoformat() if entry.date else None
            if d:
                result[d] = {
                    "score": entry.score or 0,
                    "minutes": getattr(entry, "total_minutes", 0) or getattr(entry, "focus_minutes", 0) or 0
                }
        return result

    async def _batch_fetch_activity(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        """Fetch analytics events grouped by date."""
        result = {}
        event_res = await db.execute(
            select(
                func.date(AnalyticsEvent.timestamp).label("d"),
                func.count(AnalyticsEvent.id).label("count")
            ).where(
                AnalyticsEvent.user_id == user_id,
                func.date(AnalyticsEvent.timestamp) >= start,
                func.date(AnalyticsEvent.timestamp) <= end
            ).group_by(func.date(AnalyticsEvent.timestamp))
        )
        for row in event_res.fetchall():
            d = row.d if isinstance(row.d, str) else row.d.isoformat() if row.d else None
            if d:
                result[d] = {"count": row.count or 0}
        return result

    async def _batch_fetch_stress(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        """Fetch stress data grouped by date."""
        result = {}
        stress_res = await db.execute(
            select(
                func.date(StressLog.timestamp).label("d"),
                func.avg(StressLog.stress_level).label("avg_stress"),
                func.max(StressLog.stress_level).label("max_stress"),
                func.count(StressLog.id).label("entries")
            ).where(
                StressLog.user_id == user_id,
                func.date(StressLog.timestamp) >= start,
                func.date(StressLog.timestamp) <= end
            ).group_by(func.date(StressLog.timestamp))
        )
        for row in stress_res.fetchall():
            d = row.d if isinstance(row.d, str) else row.d.isoformat() if row.d else None
            if d:
                result[d] = {
                    "avg_stress": round(float(row.avg_stress or 0), 1),
                    "max_stress": row.max_stress or 0,
                    "entries": row.entries or 0
                }
        return result

    async def _batch_fetch_chats(self, db, user_id: int, start: date, end: date) -> Dict[str, Dict]:
        """Fetch chat message counts grouped by date."""
        result = {}
        chat_res = await db.execute(
            select(
                func.date(ChatMessage.created_at).label("d"),
                func.count(ChatMessage.id).label("count")
            )
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == "user",
                func.date(ChatMessage.created_at) >= start,
                func.date(ChatMessage.created_at) <= end
            ).group_by(func.date(ChatMessage.created_at))
        )
        for row in chat_res.fetchall():
            d = row.d if isinstance(row.d, str) else row.d.isoformat() if row.d else None
            if d:
                result[d] = {"count": row.count or 0}
        return result

    # =========================================================================
    # COMPUTE FUNCTIONS — Pure logic, no DB access
    # =========================================================================

    def _compute_engagement(self, task_data: Dict, chat_data: Dict, activity_data: Dict) -> str:
        """Determines daily presence: active / partial / absent."""
        tasks_done = task_data.get("completed", 0)
        chats = chat_data.get("count", 0)
        events = activity_data.get("count", 0)

        # Weighted activity score
        activity_score = (tasks_done * 3) + (chats * 2) + (events // 5)

        if activity_score >= 8:
            return "active"
        elif activity_score > 0:
            return "partial"
        return "absent"

    def _compute_effort(self, task_data: Dict, focus_data: Dict) -> str:
        """Determines intensity: high / medium / low / none."""
        focus_score = focus_data.get("score", 0)
        high_pri = task_data.get("high_priority_done", 0)
        total_done = task_data.get("completed", 0)

        # Combined effort signal
        effort_signal = focus_score + (high_pri * 15) + (total_done * 5)

        if effort_signal >= 80:
            return "high"
        elif effort_signal >= 35:
            return "medium"
        elif effort_signal > 0:
            return "low"
        return "none"

    def _compute_emotion(self, stress_data: Dict, task_data: Dict, effort: str) -> str:
        """
        Determines emotional state: flow / calm / strained / frustrated / drained.
        Uses stress data when available, falls back to task signals.
        """
        avg_stress = stress_data.get("avg_stress", 0)
        max_stress = stress_data.get("max_stress", 0)
        has_stress = stress_data.get("entries", 0) > 0
        missed = task_data.get("missed", 0)
        due_total = task_data.get("due_total", 0)

        # Health-first priority
        if has_stress and avg_stress >= 7:
            return "drained"
        if has_stress and avg_stress >= 5:
            return "frustrated"

        # Task-based signals (for users who don't log stress)
        if due_total > 0 and missed > 0:
            miss_rate = missed / due_total
            if miss_rate > 0.6 and missed >= 3:
                return "strained"

        # Positive states
        if effort == "high":
            if has_stress and avg_stress < 3:
                return "flow"  # Confirmed: high effort + low stress = flow
            elif not has_stress:
                # No stress data — infer from task completion quality
                completed = task_data.get("completed", 0)
                if completed >= 4:
                    return "flow"  # High output + high effort = likely flow
                return "calm"

        return "calm"

    def _compute_resistance(self, task_data: Dict) -> List[str]:
        """Detect micro-signals of avoidance or friction."""
        signals = []

        missed = task_data.get("missed", 0)
        due_total = task_data.get("due_total", 0)
        due_completed = task_data.get("due_completed", 0)

        if due_total > 0:
            miss_rate = missed / due_total
            # >50% missed AND at least 2 missed = avoidance
            if miss_rate > 0.5 and missed >= 2:
                signals.append("avoidance")
            # Had due tasks but completed none
            elif missed > 0 and due_completed == 0:
                signals.append("skipped_all")

        return signals

    def _compute_recovery(self, engagement: str, prev_state: Optional[Dict]) -> bool:
        """True if user came back after an absent day."""
        if not prev_state:
            return False
        return prev_state["engagement"] == "absent" and engagement in ("active", "partial")

    def _compute_intervention(
        self, engagement: str, effort: str, emotion: str,
        resistance: List[str], recovery: bool
    ) -> Optional[Dict[str, str]]:
        """
        Returns actionable micro-intervention.
        Priority: Health > Emotion > Behavior > Reinforcement.
        """
        # 1. HEALTH FIRST — Never push a drained user to work
        if emotion == "drained":
            return {
                "title": "Recharge Protocol",
                "action": "Step away for 15 min. Non-screen break required.",
                "icon": "coffee",
                "priority": "health"
            }

        # 2. EMOTIONAL SUPPORT
        if emotion == "frustrated":
            return {
                "title": "Clear the Fog",
                "action": "Brain dump everything on your mind into a note.",
                "icon": "file-text",
                "priority": "emotional"
            }

        # 3. BEHAVIORAL NUDGE
        if "avoidance" in resistance:
            return {
                "title": "Break the Seal",
                "action": "Do just 2 minutes of the task you're avoiding.",
                "icon": "zap",
                "priority": "behavioral"
            }

        if "skipped_all" in resistance:
            return {
                "title": "Pick One",
                "action": "Choose the easiest due task and finish just that.",
                "icon": "target",
                "priority": "behavioral"
            }

        if engagement == "absent":
            return {
                "title": "Small Re-entry",
                "action": "Open the app and check one notification.",
                "icon": "log-in",
                "priority": "behavioral"
            }

        # 4. POSITIVE REINFORCEMENT
        if recovery:
            return {
                "title": "Welcome Back",
                "action": "Great comeback! Start with something easy to build momentum.",
                "icon": "sunrise",
                "priority": "reinforcement"
            }

        if engagement == "active" and effort == "high" and emotion == "flow":
            return {
                "title": "Peak Performance",
                "action": "You're in flow! Note what worked so you can replicate it.",
                "icon": "star",
                "priority": "reinforcement"
            }

        return None

    # =========================================================================
    # PATTERN DETECTION
    # =========================================================================

    def _detect_dominant_pattern(self, timeline: List[Dict]) -> str:
        """Analyzes the timeline to find the dominant behavioral pattern."""
        if not timeline or len(timeline) < 7:
            return "Insufficient data"

        recent_7 = timeline[-7:]
        active_count = sum(1 for d in recent_7 if d["engagement"] in ("active", "partial"))
        flow_count = sum(1 for d in recent_7 if d["emotion"] == "flow")
        drained_count = sum(1 for d in recent_7 if d["emotion"] in ("drained", "frustrated"))
        absent_count = sum(1 for d in recent_7 if d["engagement"] == "absent")
        avoidance_count = sum(1 for d in recent_7 if "avoidance" in d["resistance"])

        # Check for streaks of absence at end
        consecutive_absent = 0
        for d in reversed(recent_7):
            if d["engagement"] == "absent":
                consecutive_absent += 1
            else:
                break

        if consecutive_absent >= 3:
            return "Disengaging — needs re-entry support"
        if drained_count >= 3:
            return "Burnout risk — sustained high stress"
        if avoidance_count >= 3:
            return "Avoidance pattern — task friction detected"
        if flow_count >= 3:
            return "Strong momentum — in a productive cycle"
        if active_count >= 6:
            return "Consistently engaged — solid rhythm"
        if active_count >= 4:
            return "Building consistency — room to grow"
        if absent_count >= 4:
            return "Low engagement — needs activation"

        return "Variable — no strong pattern yet"


# Singleton instance
behavior_timeline_service = BehaviorTimelineService()
