"""
Planner service.

Raw persistence layer for plans and deep work sessions.
No business logic. No validation. No ORM exposure.
"""

from __future__ import annotations

from typing import Any, Optional
from datetime import datetime, date, time, timedelta, timezone
import logging
import json
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from backend.db.database import get_db
from backend.db.models import Plan
from backend.services.entitlements_service import is_ultra_user

# Import analytics tracker for real-time event tracking
from backend.services.realtime_analytics_tracker import realtime_analytics

logger = logging.getLogger(__name__)


class PlannerService:
    """
    Planner persistence service.
    """

    def _normalize_habit_schedule(self, schedule: Any) -> dict[str, Any]:
        """Normalize habit schedule payloads across storage formats."""
        if schedule is None:
            return {}

        # SQLite raw SQL can return JSON as a string
        if isinstance(schedule, str):
            try:
                schedule = json.loads(schedule)
            except Exception:
                logger.warning("Failed to parse habit schedule JSON; using empty schedule.")
                return {}

        if not isinstance(schedule, dict):
            return {}

        # Back-compat key normalization
        if "lastCompleted" not in schedule and "last_completed" in schedule:
            schedule["lastCompleted"] = schedule["last_completed"]
        if "completedToday" not in schedule and "completed_today" in schedule:
            schedule["completedToday"] = schedule["completed_today"]

        return schedule

    def _utc_now(self) -> datetime:
        return datetime.now(timezone.utc)

    def _get_timezone(self, timezone_name: Optional[str]) -> ZoneInfo:
        if not timezone_name:
            return ZoneInfo("UTC")
        try:
            return ZoneInfo(timezone_name)
        except Exception:
            logger.warning("Invalid timezone '%s'; falling back to UTC", timezone_name)
            return ZoneInfo("UTC")

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _local_day_bounds_to_utc(self, day_value: date, timezone_name: Optional[str]) -> tuple[datetime, datetime]:
        tz = self._get_timezone(timezone_name)
        start_local = datetime.combine(day_value, time(0, 0, 0), tzinfo=tz)
        end_local = datetime.combine(day_value, time(23, 59, 59, 999999), tzinfo=tz)
        return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)

    def _date_key_in_timezone(self, dt_value: datetime, timezone_name: Optional[str]) -> str:
        tz = self._get_timezone(timezone_name)
        return self._ensure_utc(dt_value).astimezone(tz).date().isoformat()

    async def _is_ultra_user_by_id(self, user_id: str) -> bool:
        from backend.db.models import User
        from sqlalchemy import select

        try:
            async for db in get_db():
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                if not user:
                    return False
                return is_ultra_user(user)
        except Exception as exc:
            logger.warning("Failed to resolve tier for user %s: %s", user_id, exc)
            return False

    async def _enforce_goal_id_ultra(self, user_id: str, goal_id: Any) -> None:
        if goal_id is None or str(goal_id).strip() == "":
            return
        if not await self._is_ultra_user_by_id(user_id):
            raise HTTPException(
                status_code=403,
                detail={"code": "PLAN_UPGRADE_REQUIRED", "feature": "goal_linking"},
            )

    def _parse_due_datetime(self, input_data: dict[str, Any]) -> Optional[datetime]:
        timezone_name = input_data.get("timezone")

        local_date = input_data.get("due_local_date")
        local_time = input_data.get("due_local_time")
        if local_date and local_time:
            try:
                if isinstance(local_date, str):
                    local_date = date.fromisoformat(local_date)
                hour = int(local_time[:2])
                minute = int(local_time[3:])
                tz = self._get_timezone(timezone_name)
                local_dt = datetime.combine(local_date, time(hour, minute), tzinfo=tz)
                return local_dt.astimezone(timezone.utc)
            except Exception as exc:
                logger.warning("Failed to parse due_local_date/time payload: %s", exc)

        due_date_value = input_data.get("due_date")
        if not due_date_value:
            return None

        if isinstance(due_date_value, datetime):
            return self._ensure_utc(due_date_value)

        if isinstance(due_date_value, str):
            try:
                parsed_date = datetime.fromisoformat(due_date_value.replace("Z", "+00:00"))
                if parsed_date.tzinfo is None:
                    # Treat naive values as local time in provided timezone (or UTC fallback).
                    tz = self._get_timezone(timezone_name)
                    parsed_date = parsed_date.replace(tzinfo=tz)
                return parsed_date.astimezone(timezone.utc)
            except (ValueError, AttributeError):
                try:
                    now = self._utc_now()
                    target_date = now.date()
                    time_lower = due_date_value.lower().strip()
                    target_time = None

                    if "tomorrow" in time_lower:
                        target_date = target_date + timedelta(days=1)
                        time_lower = time_lower.replace("tomorrow", "").strip()

                    if "morning" in time_lower:
                        target_time = time(9, 0)
                    elif "afternoon" in time_lower:
                        target_time = time(14, 0)
                    elif "evening" in time_lower:
                        target_time = time(18, 0)
                    elif "tonight" in time_lower:
                        target_time = time(20, 0)
                    elif ":" in time_lower:
                        fmt = "%H:%M"
                        if "am" in time_lower or "pm" in time_lower:
                            fmt = "%I:%M%p"
                            time_lower = time_lower.replace(" ", "")
                        target_time = datetime.strptime(time_lower, fmt).time()
                    else:
                        hour_str = "".join(filter(str.isdigit, time_lower))
                        if hour_str:
                            hour = int(hour_str)
                            if "pm" in time_lower and hour < 12:
                                hour += 12
                            elif "am" in time_lower and hour == 12:
                                hour = 0
                            elif hour <= 6 and "am" not in time_lower:
                                hour += 12
                            target_time = time(hour, 0)

                    if target_time:
                        return datetime.combine(target_date, target_time, tzinfo=timezone.utc)

                    if "tomorrow" in due_date_value.lower():
                        return datetime.combine(target_date, time(0, 0), tzinfo=timezone.utc)
                except Exception as exc:
                    logger.warning("Failed to parse due_date '%s': %s", due_date_value, exc)
        return None

    async def start_deep_work_session(
        self,
        user_id: str,
        duration_minutes: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Persist a deep work session as a Plan record.
        Enforces a minimum of 60 minutes and prevents overlapping sessions.
        """
        # 1. Enforce minimum duration of 60 minutes
        if duration_minutes is None or duration_minutes < 60:
            logger.info(f"Deep work duration {duration_minutes} adjusted to minimum 60 mins for user {user_id}")
            duration_minutes = 60

        # 2. Prevent overlapping / active sessions
        latest_session = await self.get_latest_session(user_id)
        if latest_session and latest_session.get("status") == "active":
            started_at_str = latest_session.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    session_duration = latest_session.get("data", {}).get("duration_minutes", 60)
                    end_time = started_at + timedelta(minutes=session_duration)
                    if self._utc_now() < end_time:
                        raise ValueError(f"An active deep work session is already running until {end_time.strftime('%H:%M')} UTC.")
                except ValueError as e:
                    # Ignore parsing errors if legacy records exist
                    pass

        plan_data = {
            "type": "deep_work",
            "duration_minutes": duration_minutes,
            "started_at": self._utc_now().isoformat(),
        }

        try:
            async for db in get_db():
                plan = Plan(
                    user_id=int(user_id),
                    name="Deep Work Session",
                    description="AI-triggered deep work session",
                    plan_type="deep_work",
                    date=self._utc_now(),
                    duration_hours=(
                        duration_minutes / 60.0
                    ),
                    schedule=plan_data,
                    recommendations=[],
                )

                db.add(plan)
                await db.commit()

                logger.debug(
                    f"Deep work session persisted for user {user_id}"
                )

        except Exception as e:
            logger.warning(f"Deep work persistence skipped: {e}")
            raise e # Reraising to ensure the AI knows it failed

        return {
            "user_id": user_id,
            "type": "deep_work",
            "duration_minutes": duration_minutes,
        }

    async def create_plan(
        self,
        user_id: str,
        plan_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Persist a generic plan.
        """
        try:
            async for db in get_db():
                plan = Plan(
                    user_id=int(user_id),
                    name=plan_data.get("name", "AI Plan"),
                    description=plan_data.get("description"),
                    plan_type=plan_data.get("plan_type", "custom"),
                    date=self._ensure_utc(plan_data["date"]) if isinstance(plan_data.get("date"), datetime) else self._utc_now(),
                    duration_hours=plan_data.get("duration_hours"),
                    focus_areas=plan_data.get("focus_areas", []),
                    schedule=plan_data.get("schedule", {}),
                    recommendations=plan_data.get("recommendations", []),
                )

                db.add(plan)
                await db.commit()
                await db.refresh(plan)

                # Broadcast creation event based on plan type
                try:
                    if plan.plan_type == 'habit':
                        from backend.realtime.socket_manager import broadcast_habit_created
                        await broadcast_habit_created(int(user_id), {
                            "id": str(plan.id),
                            "name": plan.name,
                            "description": plan.description,
                            "category": plan.schedule.get('category', 'Wellness'),
                            "frequency": plan.schedule.get('frequency', 'daily'),
                            "created_at": plan.created_at.isoformat() if plan.created_at else None,
                        })
                    elif plan.plan_type == 'goal':
                        from backend.realtime.socket_manager import broadcast_goal_created
                        await broadcast_goal_created(int(user_id), {
                            "id": str(plan.id),
                            "title": plan.name,
                            "description": plan.description,
                            "category": plan.schedule.get('category', 'Personal'),
                            "created_at": plan.created_at.isoformat() if plan.created_at else None,
                        })
                    elif plan.plan_type == 'task':
                        from backend.realtime.socket_manager import broadcast_task_created
                        await broadcast_task_created(int(user_id), {
                            "id": str(plan.id),
                            "title": plan.name,
                            "description": plan.description,
                            "status": plan.schedule.get('status', 'pending'),
                            "created_at": plan.created_at.isoformat() if plan.created_at else None,
                        })
                except Exception as e:
                    logger.error(f"Failed to broadcast {plan.plan_type} creation: {e}")

                return {
                    "id": str(plan.id),
                    "user_id": str(plan.user_id),
                    "name": plan.name,
                    "description": plan.description,
                    "plan_type": plan.plan_type,
                    "schedule": plan.schedule,
                    "created_at": plan.created_at.isoformat() if plan.created_at else None
                }

        except Exception as e:
            logger.error(f"Plan persistence failed: {e}")
            return {"error": str(e)}

    async def get_latest_session(self, user_id: str) -> Optional[dict[str, Any]]:
        """
        Fetch latest deep work session.
        """
        try:
            async for db in get_db():
                result = await db.execute(
                    """
                    SELECT created_at, schedule
                    FROM plans
                    WHERE user_id = :user_id
                      AND plan_type = 'deep_work'
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    {"user_id": int(user_id)},
                )

                row = result.fetchone()
                if not row:
                    return None

                return {
                    "started_at": row[0].isoformat(),
                    "data": row[1],
                    "status": "active",
                }

        except Exception as e:
            logger.warning(f"Failed to fetch deep work session: {e}")
            return None

    async def get_latest_plan(self, user_id: str) -> Optional[dict[str, Any]]:
        """
        Fetch latest plan.
        """
        try:
            async for db in get_db():
                result = await db.execute(
                    """
                    SELECT created_at, plan_type, schedule
                    FROM plans
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    {"user_id": int(user_id)},
                )

                row = result.fetchone()
                if not row:
                    return None

                return {
                    "created_at": row[0].isoformat(),
                    "plan_type": row[1],
                    "data": row[2],
                }

        except Exception as e:
            logger.warning(f"Failed to fetch plan: {e}")
            return None

    # ─────────────────────────────────────────────────────────────
    # GOALS CRUD
    # ─────────────────────────────────────────────────────────────
    
    async def create_goal(self, user_id: str, goal_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new goal."""
        from backend.db.models import Goal
        from datetime import timezone, datetime
        
        try:
            async for db in get_db():
                # Parse target_date properly
                target_date_val = goal_data.get("target_date")
                if isinstance(target_date_val, str):
                    try:
                        # Try parsing as ISO format (or YYYY-MM-DD)
                        if len(target_date_val) == 10: # Simple date
                             target_date_val = datetime.fromisoformat(f"{target_date_val}T23:59:59").replace(tzinfo=timezone.utc)
                        else:
                            parsed_date = datetime.fromisoformat(target_date_val.replace('Z', '+00:00'))
                            if parsed_date.tzinfo is None:
                                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                            target_date_val = parsed_date
                    except ValueError:
                        logger.warning(f"Failed to parse target_date '{target_date_val}': default None")
                        target_date_val = None

                goal = Goal(
                    user_id=int(user_id),
                    title=goal_data.get("title", "New Goal"),
                    description=goal_data.get("description"),
                    category=goal_data.get("category", "personal"),
                    target_date=target_date_val,
                    current_progress=goal_data.get("current_progress", 0),
                    milestones=goal_data.get("milestones", []),
                    ai_suggestions=goal_data.get("ai_suggestions", []),
                    is_tracked=goal_data.get("is_tracked", False),
                    probability_status=goal_data.get("probability_status", "Medium"),
                )
                db.add(goal)
                await db.commit()
                await db.refresh(goal)
                
                # Broadcast goal creation
                try:
                    from backend.realtime.socket_manager import broadcast_goal_created
                    # target_date is now a datetime object on the model (or None)
                    t_date_str = goal.target_date.isoformat() if goal.target_date else None
                    if not t_date_str and target_date_val and isinstance(target_date_val, str):
                         # Fallback if model refresh didn't update it but we had a string
                         t_date_str = target_date_val

                    goal_dict = {
                        "id": str(goal.id),
                        "title": goal.title,
                        "description": goal.description,
                        "category": goal.category,
                        "target_date": t_date_str,
                        "current_progress": goal.current_progress,
                        "milestones": goal.milestones,
                        "created_at": goal.created_at.isoformat() if goal.created_at else None,
                    }
                    await broadcast_goal_created(int(user_id), goal_dict)
                except Exception as e:
                    logger.error(f"Failed to broadcast goal creation: {e}")
                
                return goal_dict
        except Exception as e:
            logger.error(f"Failed to create goal: {e}")
            return {"error": str(e)}

    async def get_user_goals(self, user_id: str) -> list[dict[str, Any]]:
        """Get all goals for a user."""
        from backend.db.models import Goal
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Goal).where(Goal.user_id == int(user_id)).order_by(Goal.created_at.desc())
                )
                goals = result.scalars().all()
                
                return [
                    {
                        "id": str(g.id),
                        "title": g.title,
                        "description": g.description,
                        "category": g.category,
                        "target_date": g.target_date.isoformat() if g.target_date else None,
                        "current_progress": g.current_progress,
                        "milestones": g.milestones,
                        "ai_suggestions": g.ai_suggestions,
                        "is_tracked": g.is_tracked,
                        "probability_status": g.probability_status,
                        "created_at": g.created_at.isoformat() if g.created_at else None,
                    }
                    for g in goals
                ]
        except Exception as e:
            logger.error(f"Failed to get goals: {e}")
            return []

    async def toggle_goal_tracking(self, user_id: str, goal_id: str) -> dict[str, Any]:
        """Toggle goal tracking (Max 3 active)."""
        try:
            async for db in get_db():
                result = await db.execute(select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id)))
                goal = result.scalar_one_or_none()
                
                if not goal:
                    return {"error": "Goal not found"}
                
                # For now, just return success without tracking logic
                # TODO: Implement tracking when database schema is updated
                return {
                    "goal_id": goal_id, 
                    "message": "Goal tracking temporarily disabled due to database schema update"
                }
        except Exception as e:
            logger.error(f"Failed to toggle tracking: {e}")
            return {"error": str(e)}

    async def track_goal_progress(self, user_id: str, goal_id: str, old_progress: int, new_progress: int) -> bool:
        """Update goal progress."""
        from backend.db.models import Goal
        from sqlalchemy import select, update
        
        try:
            async for db in get_db():
                # Get current progress before updating
                result = await db.execute(
                    select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id))
                )
                goal = result.scalar_one_or_none()
                
                if not goal:
                    return False
                
                old_progress = goal.current_progress or 0
                new_progress = min(100, max(0, new_progress))
                
                await db.execute(
                    update(Goal)
                    .where(Goal.id == int(goal_id), Goal.user_id == int(user_id))
                    .values(current_progress=new_progress)
                )
                await db.commit()
                
                # 🔥 ANALYTICS TRACKING: Track goal progress
                try:
                    # Track any progress change
                    await realtime_analytics.track_event(
                        user_id=int(user_id),
                        event_type='goal_progress',
                        metadata={
                            'goal_id': goal_id,
                            'old_progress': old_progress,
                            'new_progress': new_progress
                        }
                    )
                    
                    # Track milestones (25%, 50%, 75%, 100%)
                    milestones = [25, 50, 75, 100]
                    for milestone in milestones:
                        if old_progress < milestone <= new_progress:
                            await realtime_analytics.track_event(
                                user_id=int(user_id),
                                event_type='goal_milestone',
                                metadata={
                                    'goal_id': goal_id,
                                    'milestone': milestone,
                                    'progress': new_progress
                                }
                            )
                            logger.info(f"Tracked goal_milestone {milestone}% for goal {goal_id}")
                    
                    logger.info(f"Tracked goal_progress event for goal {goal_id}: {old_progress}% → {new_progress}%")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")
                
                return True
        except Exception as e:
            logger.error(f"Failed to update goal progress: {e}")
            return False

    async def get_goal_timeline(self, user_id: str) -> list[dict[str, Any]]:
        """Get goals organized by timeline."""
        goals = await self.get_user_goals(user_id)
        # Sort by target_date
        return sorted(goals, key=lambda g: g.get("target_date") or "9999-12-31")

    # ─────────────────────────────────────────────────────────────
    # HABITS CRUD
    # ─────────────────────────────────────────────────────────────
    
    async def get_user_habits(self, user_id: str, timezone_name: Optional[str] = "UTC") -> list[dict[str, Any]]:
        """Get user habits (stored as plans with type='habit')."""
        try:
            from sqlalchemy import select
            async for db in get_db():
                result = await db.execute(
                    select(Plan)
                    .where(
                        Plan.user_id == int(user_id),
                        Plan.plan_type == "habit",
                    )
                    .order_by(Plan.created_at.desc())
                )
                plans = result.scalars().all()
                habits = []
                now_local_key = self._date_key_in_timezone(self._utc_now(), timezone_name)
                
                for plan in plans:
                    schedule = self._normalize_habit_schedule(plan.schedule)
                    streak = schedule.get("streak", 0)
                    longest_streak = schedule.get("longestStreak", 0)
                    last_completed_str = schedule.get("lastCompleted")
                    
                    if last_completed_str and streak > 0:
                        last_completed = datetime.fromisoformat(last_completed_str.replace("Z", "+00:00"))
                        if last_completed.tzinfo is None:
                            last_completed = last_completed.replace(tzinfo=timezone.utc)
                        last_key = self._date_key_in_timezone(last_completed, timezone_name)
                        delta = (date.fromisoformat(now_local_key) - date.fromisoformat(last_key)).days
                        if delta > 1:
                            streak = 0  # Streak broken
                    
                    # Ensure longestStreak is at least as high as current streak
                    if streak > longest_streak:
                        longest_streak = streak
                    
                    habits.append({
                        "id": str(plan.id),
                        "name": plan.name,
                        "description": plan.description,
                        "goal_id": str(plan.goal_id) if plan.goal_id else None,
                        "frequency": schedule.get("frequency", "daily"),
                        "category": schedule.get("category", "Wellness"),
                        "targetCount": schedule.get("target", 1),
                        "currentStreak": streak,
                        "longestStreak": longest_streak,
                        "status": "active",
                        "createdAt": plan.created_at.isoformat() if plan.created_at else None,
                        "updatedAt": plan.created_at.isoformat() if plan.created_at else None,
                        "lastCompleted": last_completed_str,
                        "history": schedule.get("history", []),  # Return real history
                    })
                return habits
        except Exception as e:
            logger.error(f"Failed to get habits: {e}")
            return []

    async def track_habit(self, user_id: str, habit_id: str, timezone_name: Optional[str] = "UTC") -> dict[str, Any]:
        """Mark a habit as completed today and update streak."""
        try:
            from sqlalchemy import select
            async for db in get_db():
                # Get current habit data
                result = await db.execute(
                    select(Plan).where(
                        Plan.id == int(habit_id),
                        Plan.user_id == int(user_id),
                        Plan.plan_type == "habit",
                    )
                )
                plan = result.scalar_one_or_none()
                if not plan:
                    return {"error": "Habit not found", "streak": 0}
                
                schedule = self._normalize_habit_schedule(plan.schedule)
                current_streak = schedule.get("streak", 0)
                longest_streak = schedule.get("longestStreak", 0)
                last_completed_str = schedule.get("lastCompleted")
                
                now_utc = self._utc_now()
                today_local_key = self._date_key_in_timezone(now_utc, timezone_name)
                new_streak = 1
                
                if last_completed_str:
                    last_completed = datetime.fromisoformat(last_completed_str.replace("Z", "+00:00"))
                    if last_completed.tzinfo is None:
                        last_completed = last_completed.replace(tzinfo=timezone.utc)
                    last_local_key = self._date_key_in_timezone(last_completed, timezone_name)
                    delta = (date.fromisoformat(today_local_key) - date.fromisoformat(last_local_key)).days
                    
                    if delta == 0:
                        # Already done today, don't increment but keeps current
                        new_streak = current_streak
                    elif delta == 1:
                        # Done yesterday, increment
                        new_streak = current_streak + 1
                    else:
                        # Missed at least one day (delta > 1), reset to 1
                        new_streak = 1
                else:
                    # First time
                    new_streak = 1
                
                # Update longest/best streak if current exceeds it
                if new_streak > longest_streak:
                    longest_streak = new_streak
                
                # Update history (keep last 30 days)
                history = schedule.get("history")
                if not isinstance(history, list):
                    history = []
                
                if today_local_key not in history:
                    history.append(today_local_key)
                    # Sort and keep last 30
                    history.sort()
                    if len(history) > 30:
                        history = history[-30:]
                
                # Update schedule with new streak, best streak, and history
                schedule["streak"] = new_streak
                schedule["longestStreak"] = longest_streak
                schedule["history"] = history
                schedule["lastCompleted"] = now_utc.isoformat()
                schedule["last_completed"] = schedule["lastCompleted"]
                schedule["completedToday"] = True
                schedule["completed_today"] = True

                import copy
                plan.schedule = copy.deepcopy(schedule)
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(plan, 'schedule')
                await db.commit()
                await db.refresh(plan)
                
                # 🔥 ANALYTICS TRACKING: Track habit completion
                try:
                    await realtime_analytics.track_event(
                        user_id=int(user_id),
                        event_type='habit_completed',
                        metadata={
                            'habit_id': habit_id,
                            'streak': new_streak,
                            'best_streak': longest_streak
                        }
                    )
                    logger.info(f"Tracked habit_completed event for habit {habit_id}, streak: {new_streak}, best: {longest_streak}")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")
                
                return {"streak": new_streak, "best_streak": longest_streak, "habit_id": habit_id}
        except Exception as e:
            logger.error(f"Failed to track habit: {e}")
            return {"error": str(e), "streak": 0}

    async def create_habit(self, user_id: str, habit_data: Any) -> dict[str, Any]:
        """Create a new habit."""
        from backend.db.models import Plan

        try:
            async for db in get_db():
                input_data = habit_data.dict() if hasattr(habit_data, "dict") else habit_data
                goal_id = input_data.get("goal_id") or input_data.get("goalId")
                await self._enforce_goal_id_ultra(user_id, goal_id)

                plan = Plan(
                    user_id=int(user_id),
                    name=input_data.get("name", input_data.get("title", "New Habit")),
                    description=input_data.get("description"),
                    plan_type="habit",
                    date=self._utc_now(),
                    goal_id=int(goal_id) if goal_id not in (None, "") else None,
                    schedule={
                        "frequency": input_data.get("frequency", "daily"),
                        "streak": 0,
                        "longestStreak": 0,
                        "target": input_data.get("target", 1),
                        "category": input_data.get("category", "Wellness"),
                        "goal_link": input_data.get("goal_link"),
                        "completedToday": False,
                        "completed_today": False,
                        "lastCompleted": None,
                        "last_completed": None,
                    },
                    recommendations=[]
                )

                db.add(plan)
                await db.commit()
                await db.refresh(plan)

                # Broadcast habit creation
                try:
                    from backend.realtime.socket_manager import broadcast_habit_created
                    await broadcast_habit_created(int(user_id), {
                        "id": str(plan.id),
                        "name": plan.name,
                        "description": plan.description,
                        "category": plan.schedule.get('category', 'Wellness'),
                        "frequency": plan.schedule.get('frequency', 'daily'),
                        "streak": plan.schedule.get('streak', 0),
                        "created_at": plan.created_at.isoformat() if plan.created_at else None,
                    })
                except Exception as e:
                    logger.error(f"Failed to broadcast habit creation: {e}")

                return {
                    "id": str(plan.id),
                    "user_id": str(plan.user_id),
                    "name": plan.name,
                    "title": plan.name,  # Add title field for frontend compatibility
                    "description": plan.description,
                    "goal_id": str(plan.goal_id) if plan.goal_id else None,
                    "plan_type": plan.plan_type,
                    "schedule": plan.schedule,
                    "created_at": plan.created_at.isoformat() if plan.created_at else None
                }
        except Exception as e:
            logger.error(f"Failed to create habit: {e}")
            return {"error": str(e)}

    # ─────────────────────────────────────────────────────────────
    # TASKS CRUD (for API & AI tools)
    # ─────────────────────────────────────────────────────────────

    async def start_task(self, user_id: str, task_id: str) -> dict[str, Any]:
        """Start a task (initial start or retry)."""
        from backend.db.models import Task
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                # Get task
                result = await db.execute(
                    select(Task).where(Task.id == int(task_id), Task.user_id == int(user_id))
                )
                task = result.scalar_one_or_none()
                if not task:
                    raise Exception("Task not found")

                # Update metadata
                meta = dict(task.meta or {})
                now = self._utc_now()
                
                # Check if this is a retry
                if task.status in ['overdue', 'failed']:
                     meta['retry_count'] = meta.get('retry_count', 0) + 1
                     meta['last_retry_at'] = now.isoformat()
                
                # Always update started_at if not set, or update last_started_at
                if not meta.get('started_at'):
                    meta['started_at'] = now.isoformat()
                meta['last_started_at'] = now.isoformat()

                task.meta = meta
                task.status = "in-progress"
                
                # Force update
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(task, 'meta')
                
                await db.commit()
                await db.refresh(task)
                
                # Analytics
                await realtime_analytics.track_event(
                    user_id=int(user_id), 
                    event_type='task_started',
                    metadata={'task_id': task_id, 'retry': meta.get('retry_count', 0)}
                )

                return self._task_to_dict(task)
        except Exception as e:
            logger.error(f"Failed to start task: {e}")
            return {"error": str(e)}
    
    async def create_task(self, user_id: str, task_data: Any) -> Any:
        """Create a new task."""
        from backend.db.models import Task
        
        try:
            async for db in get_db():
                # Support both Pydantic model and Dict
                input_data = task_data.dict() if hasattr(task_data, 'dict') else task_data
                await self._enforce_goal_id_ultra(user_id, input_data.get("goal_id"))
                
                # Map API status values to database status values
                status_map = {
                    "todo": "pending",
                    "in-progress": "in_progress",
                    "done": "completed",
                    "planned": "planned",
                    "overdue": "overdue",
                }
                db_status = status_map.get(input_data.get("status"), input_data.get("status", "pending"))

                # Normalize estimated duration field names
                if "estimated_duration_minutes" not in input_data and "estimated_minutes" in input_data:
                    input_data["estimated_duration_minutes"] = input_data.get("estimated_minutes")

                due_date_value = self._parse_due_datetime(input_data)
                goal_id_raw = input_data.get("goal_id")
                goal_id_value = int(goal_id_raw) if goal_id_raw not in (None, "") else None

                task = Task(
                    user_id=int(user_id),
                    title=input_data.get("title", "New Task"),
                    description=input_data.get("description"),
                    status=db_status,
                    priority=input_data.get("priority"),
                    due_date=due_date_value,
                    estimated_minutes=input_data.get("estimated_duration_minutes"),
                    tags=input_data.get("tags", []),
                    category=input_data.get("category"),
                    goal_id=goal_id_value,
                    meta={
                        **input_data.get("meta", {}),
                        "energy": input_data.get("energy", "medium")
                    }
                )
                db.add(task)
                await db.commit()
                await db.refresh(task)
                
                # Reload task to get complete task data (without goal relationship to avoid schema issues)
                from sqlalchemy import select
                
                result = await db.execute(
                    select(Task).where(Task.id == task.id)
                )
                task = result.scalar_one()
                
                # Broadcast task creation
                try:
                    from backend.realtime.socket_manager import broadcast_task_created
                    await broadcast_task_created(int(user_id), {
                        "id": str(task.id),
                        "title": task.title,
                        "status": task.status,
                        "priority": task.priority
                    })
                except Exception as e:
                    logger.error(f"Failed to broadcast task creation: {e}")
                
                # 🔥 ANALYTICS TRACKING: Track task creation
                try:
                    await realtime_analytics.track_event(
                        user_id=int(user_id),
                        event_type='task_created',
                        metadata={
                            'task_id': str(task.id),
                            'priority': task.priority,
                            'has_due_date': due_date_value is not None
                        }
                    )
                    logger.info(f"Tracked task_created event for task {task.id}")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")

                return self._task_to_dict(task)
        except Exception as e:
            logger.error(f"Failed to create task: {e}")
            return {"error": str(e)}

    def _task_to_dict(self, task: Any) -> dict[str, Any]:
        """Convert Task model to dictionary."""
        return {
            "id": str(task.id),
            "user_id": str(task.user_id),
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "category": task.category,
            "energy": task.meta.get("energy", "medium") if task.meta else "medium",
            "estimated_duration_minutes": task.estimated_minutes,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "tags": task.tags,
            "related_goal_id": str(task.goal_id) if task.goal_id else None,
            "goal_title": task.goal.title if hasattr(task, 'goal') and task.goal else None,
            "meta": task.meta or {},
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        }

    async def get_tasks(
        self,
        user_id: str,
        status: Optional[str] = None,
        local_day: Optional[date] = None,
        timezone_name: Optional[str] = "UTC",
        due_date_from: Optional[date] = None,
        due_date_to: Optional[date] = None,
        limit: int = 50,
        offset: int = 0
    ) -> list[Any]:
        """List tasks for a user with filters."""
        from backend.db.models import Task
        from sqlalchemy import select, and_
        from sqlalchemy.orm import joinedload
        
        try:
            async for db in get_db():
                status_map = {
                    "todo": "pending",
                    "done": "completed",
                    "in-progress": "in_progress"
                }
                db_status = status_map.get(status, status) if status else None

                query = select(Task).where(Task.user_id == int(user_id)).options(joinedload(Task.goal))
                
                if db_status:
                    query = query.where(Task.status == db_status)
                if local_day:
                    day_start_utc, day_end_utc = self._local_day_bounds_to_utc(local_day, timezone_name)
                    query = query.where(Task.due_date >= day_start_utc, Task.due_date <= day_end_utc)
                if due_date_from:
                    from_start_utc, _ = self._local_day_bounds_to_utc(due_date_from, timezone_name)
                    query = query.where(Task.due_date >= from_start_utc)
                if due_date_to:
                    _, to_end_utc = self._local_day_bounds_to_utc(due_date_to, timezone_name)
                    query = query.where(Task.due_date <= to_end_utc)
                
                query = query.order_by(Task.created_at.desc()).offset(offset).limit(limit)
                
                result = await db.execute(query)
                tasks = result.scalars().all()
                return tasks
        except Exception as e:
            logger.error(f"Failed to get tasks: {e}")
            return []

    async def get_task_by_id(self, user_id: str, task_id: str) -> Optional[Any]:
        """Get a specific task by ID."""
        from backend.db.models import Task
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Task).where(Task.id == int(task_id), Task.user_id == int(user_id)).options(joinedload(Task.goal))
                )
                return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Failed to get task {task_id}: {e}")
            return None

    async def update_task(self, user_id: str, task_id: str, updates: Any) -> Optional[Any]:
        """Update a task."""
        from backend.db.models import Task
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Task).where(Task.id == int(task_id), Task.user_id == int(user_id)).options(joinedload(Task.goal))
                )
                task = result.scalar_one_or_none()
                if not task:
                    return None
                
                update_data = updates.dict(exclude_unset=True) if hasattr(updates, 'dict') else updates
                await self._enforce_goal_id_ultra(user_id, update_data.get("goal_id"))
                
                # Track previous status for analytics
                previous_status = task.status
                
                if "status" in update_data:
                    # Map API status values to database status values
                    status_map = {
                        "todo": "pending",
                        "in-progress": "in_progress",
                        "done": "completed",
                        "planned": "planned",
                        "overdue": "overdue",
                    }
                    update_data["status"] = status_map.get(update_data["status"], update_data["status"])

                # Map frontend fields to DB fields
                if "estimated_duration_minutes" in update_data:
                    update_data["estimated_minutes"] = update_data.pop("estimated_duration_minutes")

                if "due_date" in update_data or "due_local_date" in update_data or "due_local_time" in update_data:
                    parsed_due_date = self._parse_due_datetime(update_data)
                    if parsed_due_date is None:
                        update_data.pop("due_date", None)
                    else:
                        update_data["due_date"] = parsed_due_date
                update_data.pop("due_local_date", None)
                update_data.pop("due_local_time", None)
                update_data.pop("timezone", None)
                if "goal_id" in update_data:
                    raw_goal_id = update_data.get("goal_id")
                    update_data["goal_id"] = int(raw_goal_id) if raw_goal_id not in (None, "") else None

                for key, value in update_data.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                
                task.updated_at = self._utc_now()
                await db.commit()
                await db.refresh(task)
                
                # 🔥 ANALYTICS TRACKING: Track task completion
                if previous_status != "completed" and task.status == "completed":
                    try:
                        await realtime_analytics.track_event(
                            user_id=int(user_id),
                            event_type='task_completed',
                            metadata={
                                'task_id': str(task_id),
                                'priority': task.priority or 'medium',
                                'duration': task.actual_minutes or 0,
                                'category': task.category
                            }
                        )
                        logger.info(f"Tracked task_completed event for task {task_id}")
                    except Exception as e:
                        logger.error(f"Failed to track analytics event: {e}")

                # 🧠 GOAL INTELLIGENCE: Update probability if linked to a goal
                if task.goal_id:
                    try:
                        # Avoid circular import
                        from backend.services.goal_intelligence_service import goal_intelligence_service
                        # Run in background or await directly? Await for now to ensure consistency.
                        await goal_intelligence_service.update_goal_probability(user_id, str(task.goal_id))
                    except Exception as e:
                        logger.error(f"Failed to update goal probability for task {task_id}: {e}")
                
                return task
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            return None

    async def delete_task(self, user_id: str, task_id: str) -> bool:
        """Delete a task."""
        from backend.db.models import Task
        from sqlalchemy import delete
        
        try:
            async for db in get_db():
                result = await db.execute(
                    delete(Task).where(Task.id == int(task_id), Task.user_id == int(user_id))
                )
                await db.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False

    async def get_active_tasks(self, user_id: str) -> list:
        """Get pending tasks for AI tools."""
        return await self.get_tasks(user_id, status="todo")

    async def complete_task(self, user_id: str, task_id: str):
        """Mark a task as completed."""
        return await self.update_task(user_id, task_id, {"status": "completed"})

    # ─────────────────────────────────────────────────────────────
    # DEEP WORK CRUD
    # ─────────────────────────────────────────────────────────────

    async def start_deep_work(self, user_id: str, data: Any) -> Any:
        """Start an IMMEDIATE deep work session."""
        from backend.db.models import Plan
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                # OVERLAPPING CONFLICT RULE 3: Only ONE Active/Paused session
                result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == int(user_id),
                        Plan.plan_type == "deep_work"
                    ).order_by(Plan.created_at.desc())
                )
                sessions = result.scalars().all()
                for session in sessions:
                    sched = session.schedule if isinstance(session.schedule, dict) else {}
                    if sched.get("status") in ["active", "paused"]:
                        return {"error": "You already have an active or paused deep work session."}
                
                input_data = data.dict() if hasattr(data, "dict") else data
                goal_id = input_data.get("goal_id")
                await self._enforce_goal_id_ultra(user_id, goal_id)
                
                planned_dur = input_data.get("planned_duration_minutes")
                if planned_dur is None or int(planned_dur) < 60:
                    planned_dur = 60
                
                # We do NOT use explicit scheduling for this, start it right now
                now_utc = datetime.now(timezone.utc)
                
                new_session = Plan(
                    user_id=int(user_id),
                    name="Deep Work",
                    plan_type="deep_work",
                    date=now_utc,
                    goal_id=int(goal_id) if goal_id not in (None, "") else None,
                    schedule={
                        "planned_duration": planned_dur,
                        "focus_goal": input_data.get("focus_goal"),
                        "notes": input_data.get("notes"),
                        "status": "active",
                        "started_at": now_utc.isoformat(),
                        "accumulated_pause_seconds": 0
                    }
                )
                db.add(new_session)
                await db.commit()
                await db.refresh(new_session)
                return self._map_to_deep_work_out(new_session)
        except Exception as e:
            logger.error(f"Failed to start deep work: {e}")
            return None

    async def schedule_deep_work(self, user_id: str, data: Any) -> list[Any]:
        """Schedule deep work blocks within the next 7 local days."""
        from backend.db.models import Plan

        input_data = data.dict() if hasattr(data, "dict") else data
        days_of_week = sorted(set(input_data.get("days_of_week", [])))
        explicit_local_dates = input_data.get("local_dates") or []
        start_time_value = input_data.get("start_time")
        duration_minutes = input_data.get("duration_minutes")
        if duration_minutes is None or int(duration_minutes) < 60:
            duration_minutes = 60
            
        timezone_name = input_data.get("timezone") or "UTC"
        goal_id = input_data.get("goal_id")
        await self._enforce_goal_id_ultra(user_id, goal_id)

        tz = self._get_timezone(timezone_name)
        now_local = self._utc_now().astimezone(tz)
        window_end_local = now_local + timedelta(days=7)
        hour = int(start_time_value[:2])
        minute = int(start_time_value[3:])

        selected_dates: list[date] = []
        if explicit_local_dates:
            for local_date in explicit_local_dates:
                if isinstance(local_date, str):
                    local_date = date.fromisoformat(local_date)
                selected_dates.append(local_date)
        else:
            for day_offset in range(0, 7):
                candidate = (now_local + timedelta(days=day_offset)).date()
                # Convert python weekday (Mon=0) to Sun=0..Sat=6
                candidate_js_day = (candidate.weekday() + 1) % 7
                if candidate_js_day in days_of_week:
                    selected_dates.append(candidate)

        if not selected_dates:
            raise HTTPException(status_code=422, detail="Selected days are outside the next 7 days")

        created: list[Any] = []
        try:
            async for db in get_db():
                for local_date in selected_dates:
                    local_dt = datetime.combine(local_date, time(hour, minute), tzinfo=tz)
                    if local_dt < now_local or local_dt > window_end_local:
                        raise HTTPException(status_code=422, detail="Selected schedule must be within the next 7 days")
                    scheduled_utc = local_dt.astimezone(timezone.utc)
                    session = Plan(
                        user_id=int(user_id),
                        name="Deep Work",
                        plan_type="deep_work",
                        goal_id=int(goal_id) if goal_id not in (None, "") else None,
                        date=scheduled_utc,
                        schedule={
                            "planned_duration": duration_minutes,
                            "focus_goal": input_data.get("focus_goal"),
                            "notes": input_data.get("notes"),
                            "status": "scheduled",
                            "scheduled_start_at": scheduled_utc.isoformat(),
                            "timezone": timezone_name,
                            "scheduled_local_date": local_date.isoformat(),
                            "scheduled_local_time": start_time_value,
                            "accumulated_pause_seconds": 0
                        },
                    )
                    db.add(session)
                    created.append(session)
                await db.commit()
                for session in created:
                    await db.refresh(session)
                return [self._map_to_deep_work_out(session) for session in created]
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to schedule deep work: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to schedule deep work")

    async def complete_deep_work(self, user_id: str, session_id: str, actual_duration_minutes: int) -> Any:
        """Complete a deep work session."""
        from backend.db.models import Plan
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Plan).where(
                        Plan.id == int(session_id), 
                        Plan.user_id == int(user_id),
                        Plan.plan_type == "deep_work"
                    )
                )
                session = result.scalar_one_or_none()
                if not session:
                    return None
                
                schedule = dict(session.schedule) if session.schedule else {}
                
                # If they try to complete a scheduled session that was never started
                if schedule.get("status") == "scheduled":
                     schedule["status"] = "missed"
                     session.schedule = schedule
                     await db.commit()
                     return {"error": "Cannot complete a session that hasn't started."}
                
                now_utc = datetime.now(timezone.utc)
                schedule["status"] = "completed"
                schedule["completed_at"] = now_utc.isoformat()
                
                # Invariant Enforcement: Actual duration MUST be exactly the difference MINUS pause time
                # We default to actual_duration_minutes if missing started_at, but we prefer strict math.
                started_at_str = schedule.get("started_at")
                if started_at_str:
                    started_time = datetime.fromisoformat(started_at_str).replace(tzinfo=timezone.utc)
                    total_seconds_lived = (now_utc - started_time).total_seconds()
                    pause_seconds = int(schedule.get("accumulated_pause_seconds", 0))
                    net_active_minutes = max(0, int((total_seconds_lived - pause_seconds) / 60.0))
                    # Bound their self-reported actuals
                    if abs(net_active_minutes - actual_duration_minutes) <= 2: 
                        schedule["actual_duration"] = actual_duration_minutes
                    else:
                        schedule["actual_duration"] = net_active_minutes
                else:
                    schedule["actual_duration"] = actual_duration_minutes
                
                session.schedule = schedule
                await db.commit()
                await db.refresh(session)
                
                # 🔥 ANALYTICS TRACKING: Track deep work session completion
                try:
                    await realtime_analytics.track_event(
                        user_id=int(user_id),
                        event_type='deep_work_session',
                        metadata={
                            'session_id': session_id,
                            'duration': schedule["actual_duration"],
                            'interruptions': schedule.get('interruptions', 0),
                            'quality_score': schedule.get('quality_score', 0)
                        }
                    )
                    logger.info(f"Tracked deep_work_session event for session {session_id}: {schedule['actual_duration']} min")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")
                
                return self._map_to_deep_work_out(session)
        except Exception as e:
            logger.error(f"Failed to complete deep work: {e}")
            return None

    async def pause_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        async for db in get_db():
            result = await db.execute(select(Plan).where(Plan.id == int(session_id), Plan.user_id == int(user_id)))
            session = result.scalar_one_or_none()
            if not session: return None
            sched = dict(session.schedule)
            if sched.get("status") != "active": return {"error": "Can only pause 'active' sessions."}
            sched["status"] = "paused"
            sched["paused_at"] = datetime.now(timezone.utc).isoformat()
            session.schedule = sched
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)
            
    async def resume_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        async for db in get_db():
            result = await db.execute(select(Plan).where(Plan.id == int(session_id), Plan.user_id == int(user_id)))
            session = result.scalar_one_or_none()
            if not session: return None
            sched = dict(session.schedule)
            if sched.get("status") != "paused": return {"error": "Can only resume 'paused' sessions."}
            
            paused_at_str = sched.get("paused_at")
            if paused_at_str:
                paused_time = datetime.fromisoformat(paused_at_str).replace(tzinfo=timezone.utc)
                now_time = datetime.now(timezone.utc)
                pause_delta = int((now_time - paused_time).total_seconds())
                sched["accumulated_pause_seconds"] = int(sched.get("accumulated_pause_seconds", 0)) + pause_delta
                
            sched["status"] = "active"
            sched["paused_at"] = None
            session.schedule = sched
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)

    async def cancel_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        async for db in get_db():
            result = await db.execute(select(Plan).where(Plan.id == int(session_id), Plan.user_id == int(user_id)))
            session = result.scalar_one_or_none()
            if not session: return None
            sched = dict(session.schedule)
            sched["status"] = "cancelled"
            session.schedule = sched
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)

    async def get_active_deep_work(self, user_id: str) -> Optional[Any]:
        """Get active deep work session."""
        from backend.db.models import Plan
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == int(user_id),
                        Plan.plan_type == "deep_work"
                    ).order_by(Plan.created_at.desc())
                )
                sessions = result.scalars().all()
                for session in sessions:
                    schedule = session.schedule if isinstance(session.schedule, dict) else {}
                    if schedule.get("status") == "active":
                        return self._map_to_deep_work_out(session)
                return None
        except Exception:
            return None

    def _map_to_deep_work_out(self, session: Any) -> Any:
        """Helper to map Plan model to DeepWorkOut shape."""
        schedule = session.schedule or {}
        
        def safe_iso(dt_str):
            if not dt_str: return None
            return datetime.fromisoformat(dt_str)

        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "planned_duration_minutes": schedule.get("planned_duration", 0),
            "focus_goal": schedule.get("focus_goal"),
            "notes": schedule.get("notes"),
            "goal_id": str(session.goal_id) if session.goal_id else None,
            "scheduled_start_at": safe_iso(schedule.get("scheduled_start_at")),
            "started_at": safe_iso(schedule.get("started_at")) or (session.date if schedule.get("status") in ("active", "completed") else None),
            "paused_at": safe_iso(schedule.get("paused_at")),
            "completed_at": safe_iso(schedule.get("completed_at")),
            "ended_at": safe_iso(schedule.get("completed_at")), 
            "actual_duration_minutes": schedule.get("actual_duration"),
            "accumulated_pause_seconds": schedule.get("accumulated_pause_seconds", 0),
            "status": schedule.get("status", "active"),
            "created_at": session.created_at,
        }

    async def is_user_in_session(self, user_id: str) -> bool:
        """Check if user has an active deep work session."""
        session = await self.get_active_deep_work(user_id)
        return session is not None

    async def delete_goal(self, user_id: str, goal_id: str) -> bool:
        """Delete a goal."""
        from backend.db.models import Goal
        from sqlalchemy import delete
        
        try:
            async for db in get_db():
                # Verify ownership and existence
                result = await db.execute(
                    delete(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id))
                )
                await db.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete goal {goal_id}: {e}")
            return False

    async def delete_habit(self, user_id: str, habit_id: str) -> bool:
        """Delete a habit."""
        from backend.db.models import Plan
        from sqlalchemy import delete
        
        try:
            # Habits are stored in plans table with plan_type='habit'
            async for db in get_db():
                result = await db.execute(
                    delete(Plan).where(
                        Plan.id == int(habit_id), 
                        Plan.user_id == int(user_id),
                        Plan.plan_type == 'habit'
                    )
                )
                await db.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete habit {habit_id}: {e}")
            return False

    # Singleton instance
planner_service = PlannerService()
