# backend/services/strategic_insight_service.py
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from sqlalchemy import select, func
import logging

from backend.db.database import get_db
from backend.db.models import Task, UserInsight, Notification

logger = logging.getLogger(__name__)


class StrategicInsightService:
    """
    Generate deterministic, data-backed strategic insights.
    No random confidence values and no generic placeholder advice once data exists.
    """

    LOOKBACK_DAYS = 30
    MIN_TASKS_FOR_INSIGHT = 5
    INSIGHT_STALE_HOURS = 24
    MIN_NEW_COMPLETIONS_FOR_REFRESH = 3
    COMPLETED_STATUSES = ("completed", "done")
    OPEN_STATUSES = ("pending", "planned", "in_progress", "in-progress", "overdue", "todo")
    HIGH_PRIORITIES = ("high", "urgent")

    async def get_active_insight(self, user_id: int) -> Dict[str, Any]:
        async for db in get_db():
            snapshot = await self._build_snapshot(db, user_id)

            if snapshot["completed_30d"] < self.MIN_TASKS_FOR_INSIGHT:
                return self._awaiting_data_response(snapshot["completed_30d"])

            existing = await self._get_latest_strategic_insight(db, user_id)
            if existing and not await self._should_refresh_insight(db, user_id, existing, snapshot):
                return self._format_insight(existing)

            return await self._generate_and_store_insight(db, user_id, snapshot)

    async def generate_insight(self, user_id: int) -> Dict[str, Any]:
        """
        Force generation of a new strategic insight (used by admin/tools workflows).
        """
        async for db in get_db():
            snapshot = await self._build_snapshot(db, user_id)
            if snapshot["completed_30d"] < self.MIN_TASKS_FOR_INSIGHT:
                return self._awaiting_data_response(snapshot["completed_30d"])
            return await self._generate_and_store_insight(db, user_id, snapshot)

    async def apply_insight(self, user_id: int, insight_id: int) -> Dict[str, Any]:
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

            context = self._parse_context(insight.context)
            action_type = context.get("type", "general")
            created_task_title = None

            if action_type == "peak_window_protection":
                day_name = context.get("day_name", "Peak Day")
                hour = context.get("hour", 9)
                created_task_title = f"STRATEGIC: Protect {day_name} {hour:02d}:00 Deep Work Block"
                await self._create_task_if_missing(
                    db=db,
                    user_id=user_id,
                    title=created_task_title,
                    description="Protect your highest-yield cognitive window with uninterrupted deep work.",
                    category="deep_work",
                    priority="high",
                )
            elif action_type == "priority_firewall":
                created_task_title = "STRATEGIC: Priority Firewall (Top 1 High-Impact Task)"
                await self._create_task_if_missing(
                    db=db,
                    user_id=user_id,
                    title=created_task_title,
                    description="Start each day by finishing one high-priority task before low-value work.",
                    category="planning",
                    priority="high",
                )
            elif action_type == "consistency_recovery":
                created_task_title = "STRATEGIC: Consistency Recovery Sprint (45 min)"
                await self._create_task_if_missing(
                    db=db,
                    user_id=user_id,
                    title=created_task_title,
                    description="Rebuild momentum with one focused recovery block today.",
                    category="deep_work",
                    priority="high",
                )

            notification = Notification(
                user_id=user_id,
                title="Strategic Insight Applied",
                message=f"Applied: {insight.title}" + (f" | Task created: {created_task_title}" if created_task_title else ""),
                notification_type="achievement",
                channel="in_app",
            )
            db.add(notification)

            insight.read_at = datetime.utcnow()
            await db.commit()

            return {
                "status": "success",
                "message": f"Applied: {insight.title}",
                "applied_at": insight.read_at.isoformat(),
            }

    async def _get_latest_strategic_insight(self, db, user_id: int):
        result = await db.execute(
            select(UserInsight)
            .where(
                UserInsight.user_id == user_id,
                UserInsight.insight_type == "strategic_high_impact",
            )
            .order_by(UserInsight.generated_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def _build_snapshot(self, db, user_id: int) -> Dict[str, Any]:
        now = datetime.utcnow()
        lookback_start = now - timedelta(days=self.LOOKBACK_DAYS)

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

        last_completed_at = max((t.completed_at for t in completed_tasks if t.completed_at), default=None)

        return {
            "lookback_days": self.LOOKBACK_DAYS,
            "completed_tasks": completed_tasks,
            "completed_30d": len(completed_tasks),
            "open_high_priority": open_high_priority,
            "last_completed_at": last_completed_at,
            "generated_at": now,
        }

    async def _count_completed_since(self, db, user_id: int, since_ts: datetime) -> int:
        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status.in_(self.COMPLETED_STATUSES),
                Task.completed_at.is_not(None),
                Task.completed_at > since_ts,
            )
        )
        return int(result.scalar() or 0)

    async def _should_refresh_insight(self, db, user_id: int, existing: UserInsight, snapshot: Dict[str, Any]) -> bool:
        if not existing.generated_at:
            return True

        now = datetime.utcnow()
        age_hours = (now - existing.generated_at).total_seconds() / 3600
        completed_since_generated = await self._count_completed_since(db, user_id, existing.generated_at)

        context = self._parse_context(existing.context)
        previous_signature = context.get("data_signature")
        current_signature = self._build_signature(snapshot)

        if previous_signature != current_signature:
            return True

        if existing.read_at:
            completed_since_applied = await self._count_completed_since(db, user_id, existing.read_at)
            if completed_since_applied >= 1:
                return True

        if age_hours >= self.INSIGHT_STALE_HOURS and completed_since_generated >= self.MIN_NEW_COMPLETIONS_FOR_REFRESH:
            return True

        return False

    async def _generate_and_store_insight(self, db, user_id: int, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        candidates = self._build_candidates(snapshot)
        if not candidates:
            return self._awaiting_data_response(snapshot["completed_30d"])

        selected = max(candidates, key=lambda c: c["impact_score"])
        context = dict(selected["context"])
        context["data_signature"] = self._build_signature(snapshot)
        context["completed_30d"] = snapshot["completed_30d"]
        context["open_high_priority"] = snapshot["open_high_priority"]
        context["lookback_days"] = snapshot["lookback_days"]
        context["last_completed_at"] = (
            snapshot["last_completed_at"].isoformat() if snapshot["last_completed_at"] else None
        )

        insight = UserInsight(
            user_id=user_id,
            title=selected["title"],
            description=selected["description"],
            insight_type="strategic_high_impact",
            category=selected["category"],
            severity=selected["severity"],
            confidence=selected["confidence"],
            context=context,
            action_items=selected["action_items"],
        )
        db.add(insight)
        await db.commit()
        await db.refresh(insight)
        return self._format_insight(insight)

    def _build_candidates(self, snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
        tasks: List[Task] = snapshot["completed_tasks"]
        total = snapshot["completed_30d"]
        candidates: List[Dict[str, Any]] = []

        # Candidate 1: Peak cognitive window protection.
        window_counts: Dict[Tuple[int, int], int] = {}
        for task in tasks:
            if not task.completed_at:
                continue
            key = (task.completed_at.weekday(), task.completed_at.hour)
            window_counts[key] = window_counts.get(key, 0) + 1

        if window_counts:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            (day_idx, hour), best_count = max(window_counts.items(), key=lambda x: x[1])
            others = [c for k, c in window_counts.items() if k != (day_idx, hour)]
            avg_others = sum(others) / len(others) if others else 0.0
            lift = (best_count / max(avg_others, 1.0)) if avg_others > 0 else float(best_count)
            support = best_count / max(1, total)
            improvement_pct = round(((lift - 1.0) * 100), 1) if avg_others > 0 else 100.0

            confidence = self._clamp(
                0.58
                + min(0.20, support * 0.8)
                + min(0.12, max(0.0, lift - 1.0) * 0.10)
                + min(0.05, total / 100.0),
                0.58,
                0.95,
            )
            impact_score = self._clamp(
                (support * 0.45)
                + (min(2.0, lift) / 2.0 * 0.35)
                + (min(1.0, total / 40.0) * 0.20),
                0.0,
                1.0,
            )

            day_name = days[day_idx]
            title = f"Protect {day_name} {hour:02d}:00"
            description = (
                f"You completed {best_count} tasks in this slot over the last {snapshot['lookback_days']} days "
                f"({improvement_pct:.0f}% above your average active hour). Block it for deep work."
            )
            candidates.append(
                {
                    "title": title,
                    "description": description,
                    "category": "planning",
                    "severity": "positive",
                    "confidence": confidence,
                    "impact_score": impact_score,
                    "context": {
                        "type": "peak_window_protection",
                        "day_idx": day_idx,
                        "day_name": day_name,
                        "hour": hour,
                        "supporting_tasks": best_count,
                        "improvement_percent": improvement_pct,
                        "evidence": [
                            f"{best_count} completed tasks at {hour:02d}:00 on {day_name}",
                            f"Lift vs other active hours: {lift:.2f}x",
                        ],
                    },
                    "action_items": [
                        {
                            "action": "schedule_block",
                            "params": {
                                "day": day_name,
                                "time": f"{hour:02d}:00",
                                "duration": 90,
                            },
                        }
                    ],
                }
            )

        # Candidate 2: High-priority backlog firewall.
        open_high = snapshot["open_high_priority"]
        high_completed = len([t for t in tasks if (t.priority or "medium") in self.HIGH_PRIORITIES])
        high_completed_ratio = high_completed / max(1, total)
        if open_high >= 3:
            confidence = self._clamp(
                0.60
                + min(0.20, open_high * 0.03)
                + min(0.10, (1 - high_completed_ratio) * 0.15)
                + min(0.03, total / 120.0),
                0.60,
                0.93,
            )
            impact_score = self._clamp(
                min(1.0, open_high / 10.0) * 0.65
                + (1.0 - min(1.0, high_completed_ratio)) * 0.35,
                0.0,
                1.0,
            )
            candidates.append(
                {
                    "title": "Create a Priority Firewall",
                    "description": (
                        f"You have {open_high} open high-priority tasks, while only "
                        f"{round(high_completed_ratio * 100)}% of recent completions were high-priority. "
                        f"Start each day with one high-impact task before any low-priority work."
                    ),
                    "category": "planning",
                    "severity": "info",
                    "confidence": confidence,
                    "impact_score": impact_score,
                    "context": {
                        "type": "priority_firewall",
                        "open_high_priority": open_high,
                        "high_completed_ratio": round(high_completed_ratio, 3),
                        "evidence": [
                            f"{open_high} open high/urgent tasks",
                            f"{high_completed} high/urgent tasks completed in {snapshot['lookback_days']}d",
                        ],
                    },
                    "action_items": [
                        {
                            "action": "create_guardrail",
                            "params": {"rule": "top_1_high_priority_first"},
                        }
                    ],
                }
            )

        # Candidate 3: Weekly consistency recovery.
        if total > 0:
            now = snapshot["generated_at"]
            recent_start = now - timedelta(days=7)
            previous_start = now - timedelta(days=14)
            recent_week = len([t for t in tasks if t.completed_at and t.completed_at >= recent_start])
            previous_week = len(
                [
                    t
                    for t in tasks
                    if t.completed_at and previous_start <= t.completed_at < recent_start
                ]
            )

            if previous_week >= 4 and recent_week < previous_week * 0.75:
                drop_pct = round((1 - (recent_week / max(1, previous_week))) * 100, 1)
                confidence = self._clamp(
                    0.58 + min(0.18, drop_pct / 100.0 * 0.4) + min(0.10, previous_week / 20.0),
                    0.58,
                    0.90,
                )
                impact_score = self._clamp(
                    min(1.0, drop_pct / 60.0) * 0.60 + min(1.0, previous_week / 14.0) * 0.40,
                    0.0,
                    1.0,
                )
                candidates.append(
                    {
                        "title": "Recover Your Weekly Rhythm",
                        "description": (
                            f"Your completions dropped from {previous_week} to {recent_week} tasks week-over-week "
                            f"({drop_pct:.0f}% decline). A focused recovery block today will stabilize momentum."
                        ),
                        "category": "consistency",
                        "severity": "medium",
                        "confidence": confidence,
                        "impact_score": impact_score,
                        "context": {
                            "type": "consistency_recovery",
                            "recent_week_tasks": recent_week,
                            "previous_week_tasks": previous_week,
                            "drop_percent": drop_pct,
                            "evidence": [
                                f"Week-1 completed tasks: {previous_week}",
                                f"Current week completed tasks: {recent_week}",
                            ],
                        },
                        "action_items": [
                            {
                                "action": "schedule_recovery_block",
                                "params": {"duration": 45},
                            }
                        ],
                    }
                )

        return candidates

    async def _create_task_if_missing(
        self,
        db,
        user_id: int,
        title: str,
        description: str,
        category: str,
        priority: str,
    ) -> None:
        existing_result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.title == title,
                Task.status.in_(self.OPEN_STATUSES),
            )
        )
        existing = existing_result.scalars().first()
        if existing:
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

    def _awaiting_data_response(self, completed_count: int) -> Dict[str, Any]:
        remaining = max(0, self.MIN_TASKS_FOR_INSIGHT - completed_count)
        return {
            "id": 0,
            "title": "Gathering Data",
            "description": (
                f"Complete {remaining} more task(s) to unlock a data-backed strategic insight "
                f"(currently {completed_count}/{self.MIN_TASKS_FOR_INSIGHT} in the last {self.LOOKBACK_DAYS} days)."
            ),
            "confidence": 0,
            "type": "awaiting_data",
            "impact": "low",
            "data_points": completed_count,
        }

    def _build_signature(self, snapshot: Dict[str, Any]) -> str:
        last_completed = snapshot["last_completed_at"].isoformat() if snapshot["last_completed_at"] else "none"
        return f"{snapshot['completed_30d']}|{snapshot['open_high_priority']}|{last_completed}"

    def _parse_context(self, context: Any) -> Dict[str, Any]:
        if isinstance(context, dict):
            return context
        return {}

    def _format_insight(self, insight: UserInsight) -> Dict[str, Any]:
        context = self._parse_context(insight.context)
        return {
            "id": insight.id,
            "title": insight.title,
            "description": insight.description,
            "confidence": round((insight.confidence or 0) * 100),
            "applied_at": insight.read_at.isoformat() if insight.read_at else None,
            "generated_at": insight.generated_at.isoformat() if insight.generated_at else None,
            "type": context.get("type", "general"),
            "evidence": context.get("evidence", []),
            "data_points": context.get("completed_30d", 0),
        }

    def _clamp(self, value: float, min_value: float, max_value: float) -> float:
        return max(min_value, min(max_value, value))


strategic_insight_service = StrategicInsightService()
