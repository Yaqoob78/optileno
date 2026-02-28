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
from backend.db.database import AsyncSessionLocal, get_db
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
        timezone_aliases = {
            "Asia/Calcutta": "Asia/Kolkata",
            "Asia/Katmandu": "Asia/Kathmandu",
            "US/Eastern": "America/New_York",
            "US/Central": "America/Chicago",
            "US/Mountain": "America/Denver",
            "US/Pacific": "America/Los_Angeles",
        }
        normalized_timezone = timezone_aliases.get(str(timezone_name), str(timezone_name))
        try:
            return ZoneInfo(normalized_timezone)
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
            async with AsyncSessionLocal() as db:
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
                goal_id_raw = plan_data.get("goal_id")
                goal_id_value: Optional[int] = None
                if goal_id_raw not in (None, ""):
                    try:
                        goal_id_value = int(goal_id_raw)
                    except (TypeError, ValueError):
                        raise HTTPException(status_code=422, detail="goal_id must be a numeric identifier")
                await self._enforce_goal_id_ultra(user_id, goal_id_value)

                plan = Plan(
                    user_id=int(user_id),
                    name=plan_data.get("name", "AI Plan"),
                    description=plan_data.get("description"),
                    plan_type=plan_data.get("plan_type", "custom"),
                    date=self._ensure_utc(plan_data["date"]) if isinstance(plan_data.get("date"), datetime) else self._utc_now(),
                    duration_hours=plan_data.get("duration_hours"),
                    focus_areas=plan_data.get("focus_areas", []),
                    schedule=plan_data.get("schedule", {}),
                    goal_id=goal_id_value,
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
                    "goal_id": str(plan.goal_id) if plan.goal_id else None,
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

    async def get_plan_history(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """Fetch plan history in descending creation order."""
        from sqlalchemy import select

        try:
            async for db in get_db():
                result = await db.execute(
                    select(Plan)
                    .where(Plan.user_id == int(user_id))
                    .order_by(Plan.created_at.desc())
                    .limit(limit)
                )
                plans = result.scalars().all()
                history: list[dict[str, Any]] = []
                for plan in plans:
                    history.append(
                        {
                            "id": str(plan.id),
                            "name": plan.name,
                            "description": plan.description,
                            "plan_type": plan.plan_type,
                            "goal_id": str(plan.goal_id) if plan.goal_id else None,
                            "date": plan.date.isoformat() if plan.date else None,
                            "schedule": plan.schedule or {},
                            "created_at": plan.created_at.isoformat() if plan.created_at else None,
                        }
                    )
                return history
        except Exception as exc:
            logger.error("Failed to fetch plan history: %s", exc)
            return []

    # ─────────────────────────────────────────────────────────────
    # GOALS CRUD
    # ─────────────────────────────────────────────────────────────
    
    async def create_goal(self, user_id: str, goal_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new goal with optional V2 profile fields."""
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

                # Compute horizon_days if target_date given
                horizon_days = goal_data.get("horizon_days")
                if not horizon_days and target_date_val:
                    horizon_days = max(1, (target_date_val - self._utc_now()).days)

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
                    # V2 profile fields
                    scoring_version=goal_data.get("scoring_version", "v2"),
                    goal_type=goal_data.get("goal_type") or goal_data.get("category", "custom"),
                    horizon_days=horizon_days,
                    primary_metric_name=goal_data.get("primary_metric_name"),
                    primary_metric_unit=goal_data.get("primary_metric_unit"),
                    baseline_value=goal_data.get("baseline_value"),
                    target_value=goal_data.get("target_value"),
                    trajectory_type=goal_data.get("trajectory_type", "linear"),
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
                        "scoring_version": goal.scoring_version,
                        "goal_type": goal.goal_type,
                        "trajectory_type": goal.trajectory_type,
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
        """Get all goals for a user. Gates detailed metrics for non-ultra."""
        from backend.db.models import Goal, User
        from sqlalchemy import select
        
        try:
            async for db in get_db():
                # Check ultra
                usr_res = await db.execute(select(User).where(User.id == int(user_id)))
                usr = usr_res.scalar()
                is_ultra = usr.plan_type == 'ULTRA' if usr else False

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
                        "is_tracked": g.is_tracked if is_ultra else False,
                        "probability_status": g.probability_status if is_ultra else "Medium",
                        "created_at": g.created_at.isoformat() if g.created_at else None,
                    }
                    for g in goals
                ]
        except Exception as e:
            logger.error(f"Failed to get goals: {e}")
            return []

    async def toggle_goal_tracking(self, user_id: str, goal_id: str) -> dict[str, Any]:
        """Toggle goal tracking (Max 3 active)."""
        from backend.db.models import Goal, User
        from sqlalchemy import select, func
        
        try:
            async for db in get_db():
                # Enforce ultra only
                usr_res = await db.execute(select(User).where(User.id == int(user_id)))
                usr = usr_res.scalar()
                if not usr or usr.plan_type != 'ULTRA':
                    return {"error": "Advanced goal tracking is only available on the ULTRA plan."}

                result = await db.execute(select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id)))
                goal = result.scalar_one_or_none()
                
                if not goal:
                    return {"error": "Goal not found"}
                
                if not goal.is_tracked:
                    # check how many are tracked
                    tracked_res = await db.execute(select(func.count(Goal.id)).where(Goal.user_id == int(user_id), Goal.is_tracked == True))
                    if tracked_res.scalar() >= 3:
                        return {"error": "Maximum of 3 goals can be tracked simultaneously."}
                    goal.is_tracked = True
                else:
                    goal.is_tracked = False
                    
                await db.commit()
                return {"goal_id": goal_id, "is_tracked": goal.is_tracked}
        except Exception as e:
            logger.error(f"Failed to toggle tracking: {e}")
            return {"error": str(e)}

    async def track_goal_progress(self, user_id: str, goal_id: str, old_progress: int, new_progress: int) -> bool:
        """Update goal progress manually (fallback if no linked items) or via engine.
        
        Requires ULTRA plan. Explorer users are blocked at the service level.
        """
        from backend.db.models import Goal, User
        from sqlalchemy import select

        # ── ULTRA gate (service-level bypass prevention) ─────────
        if not await self._is_ultra_user_by_id(user_id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail={"code": "PLAN_UPGRADE_REQUIRED", "feature": "goal_progress_detailed"},
            )

        try:
            async for db in get_db():
                # Get current progress before updating
                result = await db.execute(
                    select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id))
                )
                goal = result.scalar_one_or_none()
                
                if not goal:
                    return False
                
                new_progress = min(100, max(0, new_progress))
                
                # First save manual update so engine can use it as fallback if 0 linked items
                goal.current_progress = new_progress
                await db.flush()
                
                usr_res = await db.execute(select(User).where(User.id == int(user_id)))
                usr = usr_res.scalar()
                is_ultra = usr.plan_type == 'ULTRA' if usr else False

                scoring_version = str(getattr(goal, "scoring_version", "v1") or "v1").lower()
                if scoring_version == "v2":
                    from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
                    await GoalProgressEngineV2.calculate(
                        db,
                        int(goal_id),
                        int(user_id),
                        is_ultra=is_ultra,
                        save_snapshot=True,
                    )
                    await db.commit()
                    await db.refresh(goal)
                else:
                    from backend.services.goal_progress_engine import GoalProgressEngine
                    await GoalProgressEngine.calculate_progress(
                        db, int(goal_id), int(user_id), is_ultra=is_ultra
                    )
                
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

    async def update_goal_progress(self, user_id: str, goal_id: str, progress: int) -> bool:
        """Public goal progress updater used by API and AI tools.
        
        Requires ULTRA plan. Explorer users are blocked at the service level.
        """
        # ULTRA enforcement is applied inside track_goal_progress,
        # but we also check here for a fast-fail on direct callers.
        if not await self._is_ultra_user_by_id(user_id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail={"code": "PLAN_UPGRADE_REQUIRED", "feature": "goal_progress_detailed"},
            )
        bounded_progress = min(100, max(0, int(progress)))
        return await self.track_goal_progress(user_id, goal_id, 0, bounded_progress)

    async def breakdown_goal(
        self,
        user_id: str,
        goal_id: str,
        auto_create_tasks: bool = True,
        auto_create_habits: bool = True,
        propose_deep_work: bool = True,
        preferred_task_time: Optional[str] = None,
        preferred_deep_work_time: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Break down an existing goal into tasks/habits/deep-work using AI cascade.
        Persists GoalComponent definitions for V2 scoring.
        """
        goals = await self.get_user_goals(user_id)
        goal = next((g for g in goals if str(g.get("id")) == str(goal_id)), None)
        if not goal:
            return {"error": "Goal not found"}

        target_date = goal.get("target_date")
        remaining_days = 30
        if target_date:
            try:
                parsed_target = datetime.fromisoformat(str(target_date).replace("Z", "+00:00"))
                if parsed_target.tzinfo is None:
                    parsed_target = parsed_target.replace(tzinfo=timezone.utc)
                remaining_days = max(1, (parsed_target.astimezone(timezone.utc) - self._utc_now()).days)
            except Exception:
                remaining_days = 30

        if remaining_days <= 7:
            timeframe = "week"
        elif remaining_days <= 45:
            timeframe = "month"
        elif remaining_days <= 120:
            timeframe = "quarter"
        else:
            timeframe = "year"

        from backend.ai.tools.goal_automation import create_goal_with_cascade

        payload: dict[str, Any] = {
            "title": goal.get("title", "Goal"),
            "description": goal.get("description") or "",
            "category": goal.get("category", "personal") or "personal",
            "target_date": target_date,
            "timeframe": timeframe,
            "complexity": "medium",
            "create_new_goal": False,
            "existing_goal_id": str(goal.get("id")),
            "auto_create_tasks": bool(auto_create_tasks),
            "auto_create_habits": bool(auto_create_habits),
            "propose_deep_work": bool(propose_deep_work),
            "preferred_task_time": preferred_task_time,
            "preferred_deep_work_time": preferred_deep_work_time,
        }

        result = await create_goal_with_cascade(user_id, payload)
        if result.get("status") == "error":
            return {"error": result.get("message", "Failed to break down goal")}

        # ── V2: Persist GoalComponent definitions from cascade result ──
        await self._persist_breakdown_components(user_id, goal_id, result)

        return result

    async def _persist_breakdown_components(
        self,
        user_id: str,
        goal_id: str,
        cascade_result: dict[str, Any],
    ) -> None:
        """Take the cascade result and persist GoalComponent rows for V2 scoring.

        Uses a single batch query to check existing components instead of N+1.
        """
        from backend.db.models import GoalComponent
        from sqlalchemy import select

        try:
            async for db in get_db():
                gid = int(goal_id)

                # Batch pre-fetch: get all existing components for this goal
                existing_rows = (await db.execute(
                    select(GoalComponent.source_id, GoalComponent.component_type)
                    .where(GoalComponent.goal_id == gid)
                )).all()
                existing_keys = {(row[0], row[1]) for row in existing_rows}

                added = 0

                # Tasks
                for task_info in cascade_result.get("tasks_created", []):
                    tid = task_info.get("id") or task_info.get("task_id")
                    if not tid:
                        continue
                    if (int(tid), "task") in existing_keys:
                        continue
                    db.add(GoalComponent(
                        goal_id=gid,
                        component_type="task",
                        source_id=int(tid),
                        weight=1.0,
                        target_total=1.0,
                        current_total=0.0,
                        required=str(task_info.get("priority", "")).lower() in ("high", "urgent"),
                        quality_weight=1.0,
                        overdue_penalty_per_day=0.02,
                    ))
                    added += 1

                # Habits
                for habit_info in cascade_result.get("habits_created", []):
                    hid = habit_info.get("id") or habit_info.get("habit_id")
                    if not hid:
                        continue
                    if (int(hid), "habit") in existing_keys:
                        continue
                    db.add(GoalComponent(
                        goal_id=gid,
                        component_type="habit",
                        source_id=int(hid),
                        weight=0.8,
                        target_total=30.0,
                        current_total=0.0,
                        required=False,
                        quality_weight=1.0,
                        overdue_penalty_per_day=0.0,
                    ))
                    added += 1

                # Deep work
                for dw_info in cascade_result.get("deep_work_sessions", []):
                    did = dw_info.get("id") or dw_info.get("session_id")
                    if not did:
                        continue
                    if (int(did), "deep_work") in existing_keys:
                        continue
                    db.add(GoalComponent(
                        goal_id=gid,
                        component_type="deep_work",
                        source_id=int(did),
                        weight=1.2,
                        target_total=1.0,
                        current_total=0.0,
                        required=False,
                        quality_weight=1.0,
                        overdue_penalty_per_day=0.01,
                    ))
                    added += 1

                if added > 0:
                    logger.info(f"Persisted {added} breakdown components for goal {goal_id}")

                await db.commit()

                # Trigger initial V2 recalc
                try:
                    from backend.services.goal_lifecycle import recompute_if_linked
                    await recompute_if_linked(db, int(user_id), gid)
                except Exception as e:
                    logger.error(f"V2 lifecycle recompute after breakdown failed: {e}")

        except Exception as e:
            logger.error(f"Failed to persist breakdown components for goal {goal_id}: {e}")

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
                    
                # Update goal probability if habit is linked to a goal
                if plan.goal_id:
                    try:
                        from backend.services.goal_intelligence_service import goal_intelligence_service
                        await goal_intelligence_service.update_goal_probability(user_id, str(plan.goal_id))
                    except Exception as e:
                        logger.error(f"Failed to update goal probability from habit tracker: {e}")

                    # 🔄 V2 LIFECYCLE: sync habit component + recompute
                    try:
                        from backend.services.goal_lifecycle import sync_habit_component, recompute_if_linked
                        await sync_habit_component(db, plan.goal_id, int(habit_id), float(new_streak))
                        await recompute_if_linked(db, int(user_id), plan.goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on track_habit: {e}")
            
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

                # 🔄 V2 LIFECYCLE: recompute goal progress if linked
                if plan.goal_id:
                    try:
                        from backend.services.goal_lifecycle import recompute_if_linked
                        await recompute_if_linked(db, int(user_id), plan.goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on create_habit: {e}")

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

                # --- TASK INTELLIGENCE ---
                subtasks = input_data.get("subtasks", [])
                subtasks = [s.dict() if hasattr(s, "dict") else s for s in subtasks] if subtasks else []
                depends_on_task_id = input_data.get("depends_on_task_id")
                recurring = input_data.get("recurring", False)
                recurrence_config = input_data.get("recurrence_config") or {}
                
                pattern_id = None
                if recurring:
                    from backend.db.models import User
                    import uuid
                    pattern_id = f"trt_{uuid.uuid4().hex[:8]}"
                    user_res = await db.execute(select(User).where(User.id == int(user_id)))
                    user_obj = user_res.scalar_one_or_none()
                    if user_obj:
                        prefs = user_obj.preferences or {}
                        if "task_recurrence" not in prefs:
                            prefs["task_recurrence"] = []
                        
                        prefs["task_recurrence"].append({
                            "id": pattern_id,
                            "title": input_data.get("title"),
                            "description": input_data.get("description"),
                            "priority": input_data.get("priority"),
                            "category": input_data.get("category"),
                            "estimated_minutes": input_data.get("estimated_duration_minutes"),
                            "time": input_data.get("due_local_time"),
                            "timezone": input_data.get("timezone", "UTC"),
                            "recurrence_config": recurrence_config,
                            "subtasks": subtasks,
                            "created_at": self._utc_now().isoformat(),
                            "active": True
                        })
                        user_obj.preferences = prefs
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(user_obj, "preferences")
                # --- END TASK INTELLIGENCE ---

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
                        "energy": input_data.get("energy", "medium"),
                        "subtasks": subtasks,
                        "depends_on_task_id": depends_on_task_id,
                        "is_recurring": recurring,
                        "recurrence_pattern_id": pattern_id
                    }
                )
                db.add(task)
                await db.commit()
                await db.refresh(task)
                
                # We don't need to do a fresh select to get the ID, we already did db.refresh(task)
                # However if we need to eager load goal, we would do it here. But _task_to_dict uses goal_id.
                
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

                # 🔄 V2 LIFECYCLE: recompute goal progress if linked
                if task.goal_id:
                    try:
                        from backend.services.goal_lifecycle import recompute_if_linked
                        await recompute_if_linked(db, int(user_id), task.goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on create_task: {e}")

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
            "goal_title": task.goal.title if 'goal' in task.__dict__ and task.goal else None,
            "meta": task.meta or {},
            "subtasks": task.meta.get("subtasks", []) if task.meta else [],
            "depends_on_task_id": task.meta.get("depends_on_task_id") if task.meta else None,
            "is_recurring": task.meta.get("is_recurring", False) if task.meta else False,
            "recurrence_pattern_id": task.meta.get("recurrence_pattern_id") if task.meta else None,
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
                await self._auto_renew_recurring_tasks(user_id, db)

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
                return [self._task_to_dict(task) for task in tasks]
        except Exception as e:
            logger.error(f"Failed to get tasks: {e}")
            return []

    async def _auto_renew_recurring_tasks(self, user_id: str, db: AsyncSession):
        """Automatically generate upcoming task rows mapped to recurrences."""
        from backend.db.models import User, Task
        from sqlalchemy import select, text
        import pytz
        from datetime import datetime, timedelta

        user_res = await db.execute(select(User).where(User.id == int(user_id)))
        user = user_res.scalar_one_or_none()
        if not user or not user.preferences:
            return

        patterns = user.preferences.get("task_recurrence", [])
        active_patterns = [p for p in patterns if p.get("active", True)]
        if not active_patterns:
            return

        tz_str = active_patterns[0].get("timezone", "UTC")
        try:
            user_tz = pytz.timezone(tz_str)
        except:
            user_tz = pytz.UTC

        now = datetime.now(user_tz)
        today = now.date()

        for pattern in active_patterns:
            config = pattern.get("recurrence_config", {})
            rtype = config.get("type", "weekly")
            days_of_week = config.get("days_of_week", [])  # 0=Sunday, 1=Monday... (or JS mapping)

            # Map the next 7 days
            for offset in range(8):
                target_date = today + timedelta(days=offset)
                
                # Check if we should spawn for this day
                should_spawn = False
                if rtype == "daily":
                    should_spawn = True
                elif rtype == "weekly":
                    # Let's assume days_of_week matches JS (0=Sun, 1=Mon ... 6=Sat) 
                    # Python's weekday() is 0=Mon, ... 6=Sun. 
                    # Conversion: JS day = (Python weekday() + 1) % 7
                    py_weekday = target_date.weekday()
                    js_weekday = (py_weekday + 1) % 7
                    if str(js_weekday) in [str(d) for d in days_of_week]:
                        should_spawn = True
                
                if not should_spawn:
                    continue
                
                # Check DB to see if a task already exists for this pattern on this target_date
                # Build target range 00:00 to 23:59 UTC
                target_dt_start = user_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.UTC).replace(tzinfo=None)
                target_dt_end = user_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.UTC).replace(tzinfo=None)

                # Use JSON extraction or cast text to find existing pattern match
                # sqlite cross-compatibility: text(meta) like "%recurrence_pattern_id...%"
                pattern_id = pattern.get("id")
                
                check_res = await db.execute(
                    select(Task.id).where(
                        Task.user_id == int(user_id),
                        Task.due_date >= target_dt_start,
                        Task.due_date <= target_dt_end,
                        text(f"meta LIKE '%\"recurrence_pattern_id\": \"{pattern_id}\"%'")
                    )
                )
                existing = check_res.first()
                if existing:
                    continue  # Already exists
                
                # We need to spawn
                time_str = pattern.get("time", "09:00")
                if ":" in time_str:
                    hh, mm = map(int, time_str.split(":", 1)[:2])
                else:
                    hh, mm = 9, 0
                
                target_dt = user_tz.localize(datetime.combine(target_date, datetime.min.time().replace(hour=hh, minute=mm))).astimezone(pytz.UTC).replace(tzinfo=None)

                new_meta = {
                    "is_recurring": True,
                    "recurrence_pattern_id": pattern_id,
                    "subtasks": pattern.get("subtasks", [])
                }

                new_task = Task(
                    user_id=int(user_id),
                    title=pattern.get("title"),
                    description=pattern.get("description"),
                    status="pending",
                    priority=pattern.get("priority", "medium"),
                    due_date=target_dt,
                    estimated_minutes=pattern.get("estimated_minutes", 60),
                    category=pattern.get("category"),
                    meta=new_meta
                )
                db.add(new_task)
        
        try:
            await db.commit()
        except Exception as e:
            logger.error(f"Failed auto-renewing tasks: {e}")
            await db.rollback()

    async def get_task_by_id(self, user_id: str, task_id: str) -> Optional[Any]:
        """Get a specific task by ID."""
        from backend.db.models import Task
        from sqlalchemy.orm import joinedload
        
        try:
            async for db in get_db():
                result = await db.execute(
                    select(Task).where(Task.id == int(task_id), Task.user_id == int(user_id)).options(joinedload(Task.goal))
                )
                task = result.scalar_one_or_none()
                return self._task_to_dict(task) if task else None
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
                    new_status = status_map.get(update_data["status"], update_data["status"])
                    if new_status == "completed" and previous_status != "completed":
                        # Check dependency
                        depends_id = task.meta.get("depends_on_task_id") if task.meta else None
                        if depends_id:
                            blocker_res = await db.execute(select(Task).where(Task.id == int(depends_id)))
                            blocker = blocker_res.scalar_one_or_none()
                            if blocker and blocker.status != "completed":
                                raise ValueError(f"Task is blocked by incomplete task {depends_id}")
                    update_data["status"] = new_status

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

                # Handle meta fields explicitly
                if any(k in update_data for k in ["subtasks", "depends_on_task_id"]):
                    new_meta = dict(task.meta) if task.meta else {}
                    if "subtasks" in update_data:
                        # Convert dicts or objects into native dicts
                        raw_subtasks = update_data["subtasks"]
                        new_meta["subtasks"] = [s.dict() if hasattr(s, "dict") else dict(s) for s in raw_subtasks] if raw_subtasks else []
                        
                        # --- ANALYTICS: Track subtask completion ---
                        # In the future we can track individual subtask completion events here
                        
                    if "depends_on_task_id" in update_data:
                        new_meta["depends_on_task_id"] = update_data["depends_on_task_id"]
                    
                    # Workaround for SQLAlchemy JSON mutation detection
                    task.meta = new_meta
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(task, "meta")
                
                for key, value in update_data.items():
                    if hasattr(task, key) and key not in ["subtasks", "depends_on_task_id"]:
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
                                'category': task.category,
                                'is_recurring': task.meta.get("is_recurring", False) if task.meta else False,
                                'depends_on_task_id': task.meta.get("depends_on_task_id") if task.meta else None
                            }
                        )
                        logger.info(f"Tracked task_completed event for task {task_id}")
                    except Exception as e:
                        logger.error(f"Failed to track analytics event: {e}")

                # 🧠 GOAL INTELLIGENCE: Update probability if linked to a goal
                if task.goal_id:
                    try:
                        from backend.services.goal_intelligence_service import goal_intelligence_service
                        await goal_intelligence_service.update_goal_probability(user_id, str(task.goal_id))
                    except Exception as e:
                        logger.error(f"Failed to update goal probability for task {task_id}: {e}")

                    # 🔄 V2 LIFECYCLE: sync component + recompute
                    try:
                        from backend.services.goal_lifecycle import sync_task_component, recompute_if_linked
                        await sync_task_component(db, task.goal_id, int(task_id), task.status or "pending")
                        await recompute_if_linked(db, int(user_id), task.goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on update_task: {e}")
                
                return self._task_to_dict(task)
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            return None

    async def delete_task(self, user_id: str, task_id: str) -> bool:
        """Delete a task and recompute linked goal progress."""
        from backend.db.models import Task
        from sqlalchemy import delete, select
        
        try:
            async for db in get_db():
                # Fetch goal_id before deletion
                task_row = (await db.execute(
                    select(Task.goal_id).where(Task.id == int(task_id), Task.user_id == int(user_id))
                )).first()
                linked_goal_id = task_row[0] if task_row else None

                result = await db.execute(
                    delete(Task).where(Task.id == int(task_id), Task.user_id == int(user_id))
                )
                if result.rowcount == 0:
                    return False

                # 🔄 V2 LIFECYCLE: remove component + recompute
                if linked_goal_id:
                    try:
                        from backend.services.goal_lifecycle import (
                            remove_component_for_source, recompute_if_linked,
                        )
                        await remove_component_for_source(db, linked_goal_id, int(task_id), "task")
                        await recompute_if_linked(db, int(user_id), linked_goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on delete_task: {e}")

                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False

    async def get_active_tasks(self, user_id: str) -> list:
        """Get pending tasks for AI tools."""
        return await self.get_tasks(user_id, status="todo")

    async def get_all_tasks(self, user_id: str, limit: int = 200) -> list[dict[str, Any]]:
        """Get recent tasks as dictionaries (legacy helper for AI tools)."""
        tasks = await self.get_tasks(user_id, limit=limit, offset=0)
        return [self._task_to_dict(task) if not isinstance(task, dict) else task for task in tasks]

    async def find_task_by_title(self, user_id: str, title: str) -> str:
        """Resolve a task id by exact or partial title match."""
        from backend.db.models import Task
        from sqlalchemy import select, func

        normalized = (title or "").strip().lower()
        if not normalized:
            return ""

        try:
            async for db in get_db():
                exact_result = await db.execute(
                    select(Task)
                    .where(Task.user_id == int(user_id), func.lower(Task.title) == normalized)
                    .order_by(Task.created_at.desc())
                    .limit(1)
                )
                task = exact_result.scalar_one_or_none()
                if not task:
                    fuzzy_result = await db.execute(
                        select(Task)
                        .where(Task.user_id == int(user_id), Task.title.ilike(f"%{title}%"))
                        .order_by(Task.created_at.desc())
                        .limit(1)
                    )
                    task = fuzzy_result.scalar_one_or_none()
                return str(task.id) if task else ""
        except Exception as exc:
            logger.error("Failed to resolve task by title '%s': %s", title, exc)
            return ""

    async def get_recent_sessions(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        """Get recent deep-work sessions for analytics insight generation."""
        from sqlalchemy import select
        from backend.services.deep_work_utils import extract_deep_work_session_metrics

        try:
            async for db in get_db():
                result = await db.execute(
                    select(Plan)
                    .where(Plan.user_id == int(user_id), Plan.plan_type == "deep_work")
                    .order_by(Plan.created_at.desc())
                    .limit(limit)
                )
                sessions = result.scalars().all()
                mapped: list[dict[str, Any]] = []
                for session in sessions:
                    schedule = session.schedule if isinstance(session.schedule, dict) else {}
                    metrics = extract_deep_work_session_metrics(session)
                    duration = schedule.get("actual_duration") or schedule.get("planned_duration")
                    if duration is None:
                        duration = int(metrics["effective_minutes"] or metrics["planned_minutes"] or 0)
                    mapped.append(
                        {
                            "id": str(session.id),
                            "status": schedule.get("status", "scheduled"),
                            "duration": int(duration or 0),
                            "goal_id": str(session.goal_id) if session.goal_id else None,
                            "created_at": session.created_at.isoformat() if session.created_at else None,
                            "date": session.date.isoformat() if session.date else None,
                        }
                    )
                return mapped
        except Exception as exc:
            logger.error("Failed to fetch recent deep-work sessions: %s", exc)
            return []

    async def get_recent_plans(self, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
        """Get recent plans for analytics insight generation."""
        from sqlalchemy import select

        try:
            async for db in get_db():
                result = await db.execute(
                    select(Plan)
                    .where(Plan.user_id == int(user_id))
                    .order_by(Plan.created_at.desc())
                    .limit(limit)
                )
                plans = result.scalars().all()
                return [
                    {
                        "id": str(plan.id),
                        "name": plan.name,
                        "plan_type": plan.plan_type,
                        "goal_id": str(plan.goal_id) if plan.goal_id else None,
                        "date": plan.date.isoformat() if plan.date else None,
                        "created_at": plan.created_at.isoformat() if plan.created_at else None,
                        "status": (plan.schedule or {}).get("status") if isinstance(plan.schedule, dict) else None,
                    }
                    for plan in plans
                ]
        except Exception as exc:
            logger.error("Failed to fetch recent plans: %s", exc)
            return []

    async def get_habits_overview(self, user_id: str, timezone_name: Optional[str] = "UTC") -> dict[str, Any]:
        """Aggregate habit metrics for analytics insight generation."""
        habits = await self.get_user_habits(user_id, timezone_name=timezone_name)
        today_key = self._date_key_in_timezone(self._utc_now(), timezone_name)
        completed_today = 0
        longest_streak = 0

        for habit in habits:
            longest_streak = max(longest_streak, int(habit.get("longestStreak", 0) or 0))
            last_completed = habit.get("lastCompleted")
            if isinstance(last_completed, str) and last_completed:
                try:
                    completed_key = self._date_key_in_timezone(
                        datetime.fromisoformat(last_completed.replace("Z", "+00:00")),
                        timezone_name,
                    )
                    if completed_key == today_key:
                        completed_today += 1
                except Exception:
                    continue

        active_habits = [h for h in habits if h.get("status") != "archived"]
        return {
            "total_habits": len(habits),
            "active_habits": len(active_habits),
            "completed_today": completed_today,
            "longest_streak": longest_streak,
        }

    async def complete_task(self, user_id: str, task_id: str):
        """Mark a task as completed."""
        return await self.update_task(user_id, task_id, {"status": "completed"})

    # ─────────────────────────────────────────────────────────────
    # DEEP WORK CRUD
    # ─────────────────────────────────────────────────────────────

    def _deep_work_schedule(self, session: Any) -> dict[str, Any]:
        schedule = getattr(session, "schedule", None)
        if isinstance(schedule, str):
            import json
            try:
                schedule = json.loads(schedule)
            except Exception:
                return {}
        if isinstance(schedule, dict):
            return dict(schedule)
        return {}

    def _parse_deep_work_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return self._ensure_utc(value)
        if isinstance(value, str):
            try:
                return self._ensure_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
            except Exception:
                return None
        return None

    def _planned_deep_work_minutes(self, schedule: dict[str, Any]) -> int:
        raw = schedule.get("planned_duration")
        if raw is None:
            raw = schedule.get("planned_duration_minutes")
        try:
            minutes = int(raw)
        except Exception:
            minutes = 60
        return max(1, min(720, minutes))

    def _scheduled_window_end_utc(self, schedule: dict[str, Any]) -> Optional[datetime]:
        scheduled_start = self._parse_deep_work_datetime(schedule.get("scheduled_start_at"))
        if not scheduled_start:
            return None
        return scheduled_start + timedelta(minutes=self._planned_deep_work_minutes(schedule))

    async def _track_missed_deep_work(
        self,
        user_id: str,
        session_id: str,
        schedule: dict[str, Any],
    ) -> None:
        penalty_points = int(schedule.get("penalty_points") or 8)
        try:
            await realtime_analytics.track_event(
                user_id=int(user_id),
                event_type="deep_work_missed",
                metadata={
                    "session_id": session_id,
                    "penalty_points": penalty_points,
                    "scheduled_start_at": schedule.get("scheduled_start_at"),
                    "planned_duration_minutes": self._planned_deep_work_minutes(schedule),
                    "reason": schedule.get("missed_reason") or "window_expired",
                },
            )
        except Exception as exc:
            logger.error("Failed to track deep_work_missed for session %s: %s", session_id, exc)

    async def _mark_session_missed(
        self,
        db: Any,
        session: Any,
        now_utc: datetime,
        *,
        reason: str = "window_expired",
    ) -> tuple[dict[str, Any], bool]:
        schedule = self._deep_work_schedule(session)
        if schedule.get("status") == "missed":
            return schedule, False

        schedule["status"] = "missed"
        schedule["missed_at"] = now_utc.isoformat()
        schedule["missed_reason"] = reason
        if not schedule.get("penalty_applied"):
            schedule["penalty_applied"] = True
            schedule["penalty_points"] = int(schedule.get("penalty_points") or 8)
            penalty_just_applied = True
        else:
            schedule["penalty_points"] = int(schedule.get("penalty_points") or 8)
            penalty_just_applied = False

        session.schedule = schedule
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(session, "schedule")
        await db.flush()
        return schedule, penalty_just_applied

    def _auto_complete_active_if_elapsed(
        self,
        session: Any,
        schedule: dict[str, Any],
        now_utc: datetime,
    ) -> Optional[dict[str, Any]]:
        if schedule.get("status") != "active":
            return None

        started_at = self._parse_deep_work_datetime(schedule.get("started_at")) or self._parse_deep_work_datetime(session.date)
        if not started_at:
            return None

        total_elapsed_seconds = int((now_utc - started_at).total_seconds())
        pause_seconds = max(0, int(schedule.get("accumulated_pause_seconds", 0) or 0))
        active_elapsed_seconds = max(0, total_elapsed_seconds - pause_seconds)

        planned_seconds = self._planned_deep_work_minutes(schedule) * 60
        if active_elapsed_seconds < planned_seconds:
            return None

        schedule["status"] = "completed"
        schedule["completed_at"] = now_utc.isoformat()
        schedule["actual_duration"] = max(1, int(active_elapsed_seconds / 60))
        return schedule

    async def start_deep_work(self, user_id: str, data: Any) -> Any:
        """Start an immediate deep work session."""
        from backend.db.models import Plan
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return {"error": "Invalid user id."}

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work",
                    ).order_by(Plan.created_at.desc())
                )
                sessions = result.scalars().all()
                for session in sessions:
                    schedule = self._deep_work_schedule(session)
                    if schedule.get("status") in {"active", "paused"}:
                        return {"error": "You already have an active or paused deep work session."}

                input_data = data.dict() if hasattr(data, "dict") else data
                goal_id = input_data.get("goal_id", input_data.get("goalId"))
                await self._enforce_goal_id_ultra(user_id, goal_id)

                try:
                    planned_duration = int(
                        input_data.get("planned_duration_minutes", input_data.get("plannedDurationMinutes"))
                    )
                except Exception:
                    planned_duration = 60
                planned_duration = max(60, min(720, planned_duration))

                now_utc = self._utc_now()
                new_session = Plan(
                    user_id=user_id_int,
                    name="Deep Work",
                    plan_type="deep_work",
                    date=now_utc,
                    goal_id=int(goal_id) if goal_id not in (None, "") else None,
                    schedule={
                        "planned_duration": planned_duration,
                        "focus_goal": input_data.get("focus_goal", input_data.get("focusGoal")),
                        "notes": input_data.get("notes"),
                        "status": "active",
                        "started_at": now_utc.isoformat(),
                        "accumulated_pause_seconds": 0,
                    },
                )
                db.add(new_session)
                await db.commit()
                await db.refresh(new_session)
                return self._map_to_deep_work_out(new_session)
        except Exception as exc:
            logger.error("Failed to start deep work: %s", exc, exc_info=True)
            return None

    async def schedule_deep_work(self, user_id: str, data: Any) -> list[Any]:
        """Schedule deep work blocks within the next 7 local days.
        
        If recurring=True, also saves a recurrence pattern to user preferences
        so sessions auto-renew every week.
        """
        from backend.db.models import Plan, User
        import uuid

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid user id")

        input_data = data.dict() if hasattr(data, "dict") else data
        days_of_week = sorted(set(input_data.get("days_of_week", [])))
        explicit_local_dates = input_data.get("local_dates") or []
        start_time_value = input_data.get("start_time")
        duration_minutes = input_data.get("duration_minutes")
        if duration_minutes is None or int(duration_minutes) < 60:
            duration_minutes = 60
        is_recurring = bool(input_data.get("recurring", False))
            
        timezone_name = input_data.get("timezone") or "UTC"
        goal_id = input_data.get("goal_id")
        await self._enforce_goal_id_ultra(user_id, goal_id)

        tz = self._get_timezone(timezone_name)
        now_local = self._utc_now().astimezone(tz)
        window_end_local = now_local + timedelta(days=7)
        hour = int(start_time_value[:2])
        minute = int(start_time_value[3:])

        # Generate a recurrence pattern ID if recurring
        pattern_id = f"rp_{uuid.uuid4().hex[:12]}" if is_recurring else None

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
            async with AsyncSessionLocal() as db:
                for local_date in selected_dates:
                    local_dt = datetime.combine(local_date, time(hour, minute), tzinfo=tz)
                    if local_dt < now_local:
                        rolled_dt = local_dt + timedelta(days=7)
                        if rolled_dt <= window_end_local:
                            local_dt = rolled_dt
                            local_date = rolled_dt.date()
                        else:
                            continue

                    if local_dt > window_end_local:
                        continue

                    scheduled_utc = local_dt.astimezone(timezone.utc)
                    session_schedule = {
                        "planned_duration": duration_minutes,
                        "focus_goal": input_data.get("focus_goal"),
                        "notes": input_data.get("notes"),
                        "status": "scheduled",
                        "scheduled_start_at": scheduled_utc.isoformat(),
                        "timezone": timezone_name,
                        "scheduled_local_date": local_date.isoformat(),
                        "scheduled_local_time": start_time_value,
                        "accumulated_pause_seconds": 0,
                    }
                    if pattern_id:
                        session_schedule["recurrence_pattern_id"] = pattern_id

                    session = Plan(
                        user_id=user_id_int,
                        name="Deep Work",
                        plan_type="deep_work",
                        goal_id=int(goal_id) if goal_id not in (None, "") else None,
                        date=scheduled_utc,
                        schedule=session_schedule,
                    )
                    db.add(session)
                    created.append(session)

                if not created:
                    raise HTTPException(status_code=422, detail="Selected schedule must be within the next 7 days")

                # Save recurrence pattern to user preferences
                if is_recurring and pattern_id:
                    user_result = await db.execute(
                        select(User).where(User.id == user_id_int)
                    )
                    user = user_result.scalar_one_or_none()
                    if user:
                        prefs = dict(user.preferences) if isinstance(user.preferences, dict) else {}
                        patterns = list(prefs.get("deep_work_recurrence", []))
                        patterns.append({
                            "id": pattern_id,
                            "days_of_week": days_of_week,
                            "start_time": start_time_value,
                            "duration_minutes": int(duration_minutes),
                            "timezone": timezone_name,
                            "goal_id": str(goal_id) if goal_id not in (None, "") else None,
                            "focus_goal": input_data.get("focus_goal"),
                            "notes": input_data.get("notes"),
                            "active": True,
                            "created_at": self._utc_now().isoformat(),
                        })
                        prefs["deep_work_recurrence"] = patterns
                        user.preferences = prefs
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(user, "preferences")

                await db.commit()
                for session in created:
                    await db.refresh(session)
                return [self._map_to_deep_work_out(session) for session in created]
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to schedule deep work: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to schedule deep work")

    async def _auto_renew_recurring_deep_work(self, user_id: int, db: Any) -> int:
        """Auto-create next week's sessions from saved recurrence patterns.
        
        Called during get_scheduled_deep_work(). For each active pattern,
        looks 7 days ahead and creates missing sessions. Returns count of
        sessions created.
        """
        from backend.db.models import User, Plan
        from sqlalchemy import select

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            return 0

        prefs = user.preferences if isinstance(user.preferences, dict) else {}
        patterns = prefs.get("deep_work_recurrence", [])
        if not patterns:
            return 0

        now_utc = self._utc_now()
        created_count = 0

        # Fetch all existing scheduled/active/paused sessions within the next 7 days
        existing_result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == "deep_work",
                Plan.date >= now_utc,
                Plan.date <= now_utc + timedelta(days=8),
            )
        )
        existing_sessions = existing_result.scalars().all()

        # Build a set of (pattern_id, local_date) already scheduled
        already_scheduled: set[tuple[str, str]] = set()
        for session in existing_sessions:
            schedule = self._deep_work_schedule(session)
            pid = schedule.get("recurrence_pattern_id")
            local_date = schedule.get("scheduled_local_date")
            status = schedule.get("status")
            if pid and local_date and status in ("scheduled", "active", "paused"):
                already_scheduled.add((pid, local_date))

        for pattern in patterns:
            if not isinstance(pattern, dict) or not pattern.get("active", True):
                continue

            pattern_id = pattern.get("id")
            if not pattern_id:
                continue

            days = pattern.get("days_of_week", [])
            start_time_str = pattern.get("start_time", "09:00")
            duration = max(60, int(pattern.get("duration_minutes", 60) or 60))
            tz_name = pattern.get("timezone", "UTC")
            tz = self._get_timezone(tz_name)
            now_local = now_utc.astimezone(tz)
            hour = int(start_time_str[:2])
            minute = int(start_time_str[3:])

            for day_offset in range(0, 8):
                candidate_local = (now_local + timedelta(days=day_offset)).date()
                candidate_js_day = (candidate_local.weekday() + 1) % 7
                if candidate_js_day not in days:
                    continue

                local_date_key = candidate_local.isoformat()
                if (pattern_id, local_date_key) in already_scheduled:
                    continue

                local_dt = datetime.combine(candidate_local, time(hour, minute), tzinfo=tz)
                if local_dt < now_local:
                    continue  # Don't create sessions in the past

                scheduled_utc = local_dt.astimezone(timezone.utc)
                session = Plan(
                    user_id=user_id,
                    name="Deep Work",
                    plan_type="deep_work",
                    goal_id=int(pattern.get("goal_id")) if pattern.get("goal_id") not in (None, "", "None") else None,
                    date=scheduled_utc,
                    schedule={
                        "planned_duration": duration,
                        "focus_goal": pattern.get("focus_goal"),
                        "notes": pattern.get("notes"),
                        "status": "scheduled",
                        "scheduled_start_at": scheduled_utc.isoformat(),
                        "timezone": tz_name,
                        "scheduled_local_date": local_date_key,
                        "scheduled_local_time": start_time_str,
                        "accumulated_pause_seconds": 0,
                        "recurrence_pattern_id": pattern_id,
                        "auto_renewed": True,
                    },
                )
                db.add(session)
                created_count += 1
                already_scheduled.add((pattern_id, local_date_key))

        if created_count > 0:
            await db.flush()
            logger.info("Auto-renewed %d recurring deep work sessions for user %d", created_count, user_id)

        return created_count

    async def get_scheduled_deep_work(
        self,
        user_id: str,
        *,
        include_missed: bool = True,
        days_ahead: int = 14,
    ) -> list[Any]:
        """List scheduled deep work sessions and optionally recent missed sessions."""
        from backend.db.models import Plan
        from sqlalchemy import select

        now_utc = self._utc_now()
        days_ahead = max(1, min(30, int(days_ahead)))
        upcoming_cutoff = now_utc + timedelta(days=days_ahead)
        recent_missed_cutoff = now_utc - timedelta(days=2)

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return []

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work",
                    ).order_by(Plan.date.asc(), Plan.created_at.asc())
                )
                sessions = result.scalars().all()

                # Auto-renew recurring patterns before processing
                renewed = await self._auto_renew_recurring_deep_work(user_id_int, db)
                if renewed > 0:
                    # Re-fetch so we include newly created sessions
                    result = await db.execute(
                        select(Plan).where(
                            Plan.user_id == user_id_int,
                            Plan.plan_type == "deep_work",
                        ).order_by(Plan.date.asc(), Plan.created_at.asc())
                    )
                    sessions = result.scalars().all()

                newly_missed_for_tracking: list[tuple[str, dict[str, Any]]] = []
                touched = False
                output: list[Any] = []

                for session in sessions:
                    schedule = self._deep_work_schedule(session)
                    status = schedule.get("status")

                    if status == "scheduled":
                        window_end = self._scheduled_window_end_utc(schedule)
                        if window_end and now_utc >= window_end:
                            schedule, penalty_just_applied = await self._mark_session_missed(db, session, now_utc)
                            touched = True
                            status = "missed"
                            if penalty_just_applied:
                                newly_missed_for_tracking.append((str(session.id), schedule))

                    if status == "scheduled":
                        scheduled_start = self._parse_deep_work_datetime(schedule.get("scheduled_start_at")) or self._parse_deep_work_datetime(session.date)
                        if scheduled_start and scheduled_start <= upcoming_cutoff:
                            output.append(session)
                        continue

                    if include_missed and status == "missed":
                        missed_at = self._parse_deep_work_datetime(schedule.get("missed_at")) or self._scheduled_window_end_utc(schedule)
                        if missed_at and missed_at >= recent_missed_cutoff:
                            output.append(session)

                if touched:
                    await db.commit()
                    for session in output:
                        await db.refresh(session)

                for missed_session_id, missed_schedule in newly_missed_for_tracking:
                    await self._track_missed_deep_work(user_id, missed_session_id, missed_schedule)

                return [self._map_to_deep_work_out(session) for session in output]
        except Exception as exc:
            logger.error("Failed to fetch scheduled deep work: %s", exc, exc_info=True)
            return []

    async def start_scheduled_deep_work(self, user_id: str, session_id: str) -> Any:
        """Start a scheduled deep work session when its window is due."""
        from backend.db.models import Plan
        from sqlalchemy import select

        now_utc = self._utc_now()
        try:
            user_id_int = int(user_id)
            session_id_int = int(session_id)
        except (TypeError, ValueError):
            return {"error": "Invalid deep work session id."}

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Plan).where(
                        Plan.id == session_id_int,
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work",
                    )
                )
                session = result.scalar_one_or_none()
                if not session:
                    return None

                schedule = self._deep_work_schedule(session)
                if schedule.get("status") != "scheduled":
                    return {"error": "Only scheduled deep work sessions can be started this way."}

                scheduled_start = self._parse_deep_work_datetime(schedule.get("scheduled_start_at")) or self._parse_deep_work_datetime(session.date)
                if scheduled_start and now_utc < scheduled_start:
                    return {"error": "This deep work block is not due yet."}

                window_end = self._scheduled_window_end_utc(schedule)
                if window_end and now_utc >= window_end:
                    updated_schedule, penalty_just_applied = await self._mark_session_missed(
                        db,
                        session,
                        now_utc,
                        reason="not_started_in_window",
                    )
                    await db.commit()
                    await db.refresh(session)
                    if penalty_just_applied:
                        await self._track_missed_deep_work(user_id, str(session.id), updated_schedule)
                    return {"error": "Scheduled window has passed. Session marked as missed."}

                conflict_result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work",
                    ).order_by(Plan.created_at.desc())
                )
                for candidate in conflict_result.scalars().all():
                    if int(candidate.id) == int(session.id):
                        continue
                    candidate_schedule = self._deep_work_schedule(candidate)
                    if candidate_schedule.get("status") in {"active", "paused"}:
                        return {"error": "You already have an active or paused deep work session."}

                schedule["status"] = "active"
                schedule["started_at"] = now_utc.isoformat()
                schedule["paused_at"] = None
                schedule["accumulated_pause_seconds"] = max(0, int(schedule.get("accumulated_pause_seconds", 0) or 0))
                schedule["started_from_schedule"] = True
                session.date = now_utc
                session.schedule = schedule
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(session, "schedule")

                await db.commit()
                await db.refresh(session)
                return self._map_to_deep_work_out(session)
        except Exception as exc:
            logger.error("Failed to start scheduled deep work %s: %s", session_id, exc, exc_info=True)
            return None

    async def complete_deep_work(self, user_id: str, session_id: str, actual_duration_minutes: int) -> Any:
        """Complete a deep work session."""
        from backend.db.models import Plan
        from sqlalchemy import select
        try:
            user_id_int = int(user_id)
            session_id_int = int(session_id)
        except (TypeError, ValueError):
            return {"error": "Invalid deep work session id."}

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Plan).where(
                        Plan.id == session_id_int,
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work"
                    )
                )
                session = result.scalar_one_or_none()
                if not session:
                    return None
                
                schedule = self._deep_work_schedule(session)
                status = schedule.get("status")
                if status == "completed":
                    return self._map_to_deep_work_out(session)
                if status in {"cancelled", "missed"}:
                    return {"error": f"Cannot complete a {status} deep work session."}

                # If they try to complete a scheduled session that was never started
                if status == "scheduled":
                    updated_schedule, penalty_just_applied = await self._mark_session_missed(
                        db,
                        session,
                        self._utc_now(),
                        reason="completed_without_start",
                    )
                    await db.commit()
                    await db.refresh(session)
                    if penalty_just_applied:
                        await self._track_missed_deep_work(user_id, str(session.id), updated_schedule)
                    return {"error": "Cannot complete a session that has not started."}

                if status not in {"active", "paused"}:
                    return {"error": "Only active or paused sessions can be completed."}

                now_utc = self._utc_now()
                schedule["status"] = "completed"
                schedule["completed_at"] = now_utc.isoformat()
                
                # Invariant Enforcement: Actual duration MUST be exactly the difference MINUS pause time
                # We default to actual_duration_minutes if missing started_at, but we prefer strict math.
                started_time = self._parse_deep_work_datetime(schedule.get("started_at")) or self._parse_deep_work_datetime(session.date)
                if started_time:
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
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(session, "schedule")
                await db.commit()
                await db.refresh(session)
                
                # 🔥 ANALYTICS TRACKING: Track deep work session completion
                try:
                    is_recurring = bool(schedule.get("recurrence_pattern_id"))
                    await realtime_analytics.track_event(
                        user_id=user_id_int,
                        event_type='deep_work_session',
                        metadata={
                            'session_id': session_id,
                            'duration': schedule["actual_duration"],
                            'interruptions': schedule.get('interruptions', 0),
                            'quality_score': schedule.get('quality_score', 0),
                            'is_recurring': is_recurring,
                            'recurrence_pattern_id': schedule.get('recurrence_pattern_id'),
                        }
                    )
                    logger.info(f"Tracked deep_work_session event for session {session_id}: {schedule['actual_duration']} min (recurring={is_recurring})")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")
                    
                # Update goal probability if deep work is linked to a goal
                if getattr(session, 'goal_id', None) or schedule.get('goal_id'):
                    try:
                        from backend.services.goal_intelligence_service import goal_intelligence_service
                        goal_id = getattr(session, 'goal_id', None) or schedule.get('goal_id')
                        await goal_intelligence_service.update_goal_probability(user_id, str(goal_id))
                    except Exception as e:
                        logger.error(f"Failed to update goal probability from deep work tracker: {e}")
                
                return self._map_to_deep_work_out(session)
        except Exception as e:
            logger.error(f"Failed to complete deep work: {e}")
            return None

    async def pause_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        try:
            user_id_int = int(user_id)
            session_id_int = int(session_id)
        except (TypeError, ValueError):
            return {"error": "Invalid deep work session id."}

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Plan).where(
                    Plan.id == session_id_int,
                    Plan.user_id == user_id_int,
                    Plan.plan_type == "deep_work",
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                return None
            schedule = self._deep_work_schedule(session)
            if schedule.get("status") != "active":
                return {"error": "Can only pause active sessions."}
            schedule["status"] = "paused"
            schedule["paused_at"] = self._utc_now().isoformat()
            session.schedule = schedule
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(session, "schedule")
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)
            
    async def resume_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        try:
            user_id_int = int(user_id)
            session_id_int = int(session_id)
        except (TypeError, ValueError):
            return {"error": "Invalid deep work session id."}

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Plan).where(
                    Plan.id == session_id_int,
                    Plan.user_id == user_id_int,
                    Plan.plan_type == "deep_work",
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                return None
            schedule = self._deep_work_schedule(session)
            if schedule.get("status") != "paused":
                return {"error": "Can only resume paused sessions."}
            
            paused_at_str = schedule.get("paused_at")
            if paused_at_str:
                paused_time = self._parse_deep_work_datetime(paused_at_str)
                if paused_time:
                    now_time = self._utc_now()
                    pause_delta = int((now_time - paused_time).total_seconds())
                    schedule["accumulated_pause_seconds"] = int(schedule.get("accumulated_pause_seconds", 0)) + pause_delta
                
            schedule["status"] = "active"
            schedule["paused_at"] = None
            session.schedule = schedule
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(session, "schedule")
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)

    async def cancel_deep_work(self, user_id: str, session_id: str) -> Any:
        from backend.db.models import Plan
        from sqlalchemy import select
        try:
            user_id_int = int(user_id)
            session_id_int = int(session_id)
        except (TypeError, ValueError):
            return {"error": "Invalid deep work session id."}

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Plan).where(
                    Plan.id == session_id_int,
                    Plan.user_id == user_id_int,
                    Plan.plan_type == "deep_work",
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                return None
            schedule = self._deep_work_schedule(session)
            current_status = schedule.get("status")
            # Only block cancel for truly terminal statuses
            if current_status in {"completed", "cancelled", "missed"}:
                return {"error": f"This deep work session cannot be cancelled (status: {current_status})."}
            schedule["status"] = "cancelled"
            schedule["cancelled_at"] = self._utc_now().isoformat()
            session.schedule = schedule
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(session, "schedule")
            await db.commit()
            await db.refresh(session)
            return self._map_to_deep_work_out(session)

    async def get_active_deep_work(self, user_id: str) -> Optional[Any]:
        """Get active or paused deep work session and clean stale schedule states."""
        from backend.db.models import Plan
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return None

        try:
            now_utc = self._utc_now()
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Plan).where(
                        Plan.user_id == user_id_int,
                        Plan.plan_type == "deep_work"
                    ).order_by(Plan.created_at.desc())
                )
                sessions = result.scalars().all()
                touched = False
                newly_missed_for_tracking: list[tuple[str, dict[str, Any]]] = []
                auto_completed_for_tracking: list[tuple[str, int]] = []

                for session in sessions:
                    schedule = self._deep_work_schedule(session)
                    status = schedule.get("status")

                    if status == "scheduled":
                        window_end = self._scheduled_window_end_utc(schedule)
                        if window_end and now_utc >= window_end:
                            updated_schedule, penalty_just_applied = await self._mark_session_missed(db, session, now_utc)
                            touched = True
                            if penalty_just_applied:
                                newly_missed_for_tracking.append((str(session.id), updated_schedule))
                        continue

                    if status == "active":
                        maybe_completed_schedule = self._auto_complete_active_if_elapsed(session, schedule, now_utc)
                        if maybe_completed_schedule is not None:
                            session.schedule = maybe_completed_schedule
                            from sqlalchemy.orm.attributes import flag_modified
                            flag_modified(session, "schedule")
                            touched = True
                            auto_completed_for_tracking.append(
                                (str(session.id), int(maybe_completed_schedule.get("actual_duration", 0) or 0))
                            )
                            continue

                        if touched:
                            await db.commit()
                            await db.refresh(session)

                        for missed_session_id, missed_schedule in newly_missed_for_tracking:
                            await self._track_missed_deep_work(user_id, missed_session_id, missed_schedule)
                        for completed_session_id, completed_minutes in auto_completed_for_tracking:
                            try:
                                await realtime_analytics.track_event(
                                    user_id=user_id_int,
                                    event_type="deep_work_session",
                                    metadata={
                                        "session_id": completed_session_id,
                                        "duration": completed_minutes,
                                        "interruptions": 0,
                                        "quality_score": 0,
                                        "auto_completed": True,
                                    },
                                )
                            except Exception as exc:
                                logger.error("Failed to track auto-completed deep work %s: %s", completed_session_id, exc)
                        return self._map_to_deep_work_out(session)

                    if status == "paused":
                        if touched:
                            await db.commit()
                            await db.refresh(session)

                        for missed_session_id, missed_schedule in newly_missed_for_tracking:
                            await self._track_missed_deep_work(user_id, missed_session_id, missed_schedule)
                        for completed_session_id, completed_minutes in auto_completed_for_tracking:
                            try:
                                await realtime_analytics.track_event(
                                    user_id=user_id_int,
                                    event_type="deep_work_session",
                                    metadata={
                                        "session_id": completed_session_id,
                                        "duration": completed_minutes,
                                        "interruptions": 0,
                                        "quality_score": 0,
                                        "auto_completed": True,
                                    },
                                )
                            except Exception as exc:
                                logger.error("Failed to track auto-completed deep work %s: %s", completed_session_id, exc)
                        return self._map_to_deep_work_out(session)

                if touched:
                    await db.commit()

                for missed_session_id, missed_schedule in newly_missed_for_tracking:
                    await self._track_missed_deep_work(user_id, missed_session_id, missed_schedule)

                for completed_session_id, completed_minutes in auto_completed_for_tracking:
                    try:
                        await realtime_analytics.track_event(
                            user_id=user_id_int,
                            event_type="deep_work_session",
                            metadata={
                                "session_id": completed_session_id,
                                "duration": completed_minutes,
                                "interruptions": 0,
                                "quality_score": 0,
                                "auto_completed": True,
                            },
                        )
                    except Exception as exc:
                        logger.error("Failed to track auto-completed deep work %s: %s", completed_session_id, exc)

                return None
        except Exception as exc:
            logger.error("Failed to fetch active deep work for user %s: %s", user_id, exc, exc_info=True)
            return None

    def _map_to_deep_work_out(self, session: Any) -> Any:
        """Helper to map Plan model to DeepWorkOut shape."""
        schedule = self._deep_work_schedule(session)
        
        def safe_iso(dt_str):
            return self._parse_deep_work_datetime(dt_str)

        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "planned_duration_minutes": self._planned_deep_work_minutes(schedule),
            "focus_goal": schedule.get("focus_goal"),
            "notes": schedule.get("notes"),
            "goal_id": str(session.goal_id) if session.goal_id else None,
            "scheduled_start_at": safe_iso(schedule.get("scheduled_start_at")),
            "started_at": safe_iso(schedule.get("started_at")) or (session.date if schedule.get("status") in ("active", "paused", "completed") else None),
            "paused_at": safe_iso(schedule.get("paused_at")),
            "completed_at": safe_iso(schedule.get("completed_at")),
            "ended_at": safe_iso(schedule.get("completed_at")), 
            "actual_duration_minutes": schedule.get("actual_duration"),
            "accumulated_pause_seconds": schedule.get("accumulated_pause_seconds", 0),
            "status": schedule.get("status", "active"),
            "created_at": session.created_at,
            "is_recurring": bool(schedule.get("recurrence_pattern_id")),
            "recurrence_pattern_id": schedule.get("recurrence_pattern_id"),
        }

    async def is_user_in_session(self, user_id: str) -> bool:
        """Check if user has an active deep work session."""
        session = await self.get_active_deep_work(user_id)
        return session is not None

    async def delete_goal(self, user_id: str, goal_id: str) -> bool:
        """Delete a goal and all associated V2 components/snapshots."""
        from backend.db.models import Goal, GoalComponent, GoalProgressSnapshot
        from sqlalchemy import delete
        
        try:
            async for db in get_db():
                # Cascade-delete V2 data first
                try:
                    await db.execute(
                        delete(GoalProgressSnapshot).where(GoalProgressSnapshot.goal_id == int(goal_id))
                    )
                    await db.execute(
                        delete(GoalComponent).where(GoalComponent.goal_id == int(goal_id))
                    )
                except Exception as e:
                    logger.warning(f"Failed to clean up V2 data for goal {goal_id}: {e}")

                result = await db.execute(
                    delete(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id))
                )
                await db.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete goal {goal_id}: {e}")
            return False

    async def delete_habit(self, user_id: str, habit_id: str) -> bool:
        """Delete a habit and recompute linked goal progress."""
        from backend.db.models import Plan
        from sqlalchemy import delete, select
        
        try:
            async for db in get_db():
                # Fetch goal_id before deletion
                plan_row = (await db.execute(
                    select(Plan.goal_id).where(
                        Plan.id == int(habit_id),
                        Plan.user_id == int(user_id),
                        Plan.plan_type == 'habit',
                    )
                )).first()
                linked_goal_id = plan_row[0] if plan_row else None

                result = await db.execute(
                    delete(Plan).where(
                        Plan.id == int(habit_id), 
                        Plan.user_id == int(user_id),
                        Plan.plan_type == 'habit'
                    )
                )
                if result.rowcount == 0:
                    return False

                # 🔄 V2 LIFECYCLE: remove component + recompute
                if linked_goal_id:
                    try:
                        from backend.services.goal_lifecycle import (
                            remove_component_for_source, recompute_if_linked,
                        )
                        await remove_component_for_source(db, linked_goal_id, int(habit_id), "habit")
                        await recompute_if_linked(db, int(user_id), linked_goal_id)
                    except Exception as e:
                        logger.error(f"V2 lifecycle recompute failed on delete_habit: {e}")

                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to delete habit {habit_id}: {e}")
            return False

    # ── Recurring deep work pattern management ───────────────────────

    async def get_recurrence_patterns(self, user_id: str) -> list[dict[str, Any]]:
        """Get all active recurring deep work patterns for a user."""
        from backend.db.models import User
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return []

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id_int))
                user = result.scalar_one_or_none()
                if not user:
                    return []
                prefs = user.preferences if isinstance(user.preferences, dict) else {}
                patterns = prefs.get("deep_work_recurrence", [])
                return [p for p in patterns if isinstance(p, dict) and p.get("active", True)]
        except Exception as e:
            logger.error(f"Failed to get recurrence patterns: {e}")
            return []

    async def deactivate_recurrence_pattern(self, user_id: str, pattern_id: str) -> bool:
        """Deactivate a recurring deep work pattern (stops future auto-renewals)."""
        from backend.db.models import User
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return False

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id_int))
                user = result.scalar_one_or_none()
                if not user:
                    return False
                prefs = dict(user.preferences) if isinstance(user.preferences, dict) else {}
                patterns = list(prefs.get("deep_work_recurrence", []))
                
                found = False
                for pattern in patterns:
                    if isinstance(pattern, dict) and pattern.get("id") == pattern_id:
                        pattern["active"] = False
                        pattern["deactivated_at"] = self._utc_now().isoformat()
                        found = True
                        break
                
                if not found:
                    return False

                prefs["deep_work_recurrence"] = patterns
                user.preferences = prefs
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(user, "preferences")
                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to deactivate recurrence pattern {pattern_id}: {e}")
            return False

    # Singleton instance

    async def get_task_recurrence_patterns(self, user_id: str) -> list[dict]:
        from backend.db.session import AsyncSessionLocal
        from backend.db.models import User
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return []

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id_int))
                user = result.scalar_one_or_none()
                if not user:
                    return []
                prefs = dict(user.preferences) if isinstance(user.preferences, dict) else {}
                patterns = prefs.get("task_recurrence", [])
                return [p for p in patterns if isinstance(p, dict) and p.get("active", True)]
        except Exception as e:
            logger.error(f"Failed to fetch task recurring patterns: {e}")
            return []

    async def deactivate_task_recurrence_pattern(self, user_id: str, pattern_id: str) -> bool:
        from backend.db.session import AsyncSessionLocal
        from backend.db.models import User
        from sqlalchemy import select

        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            return False

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == user_id_int))
                user = result.scalar_one_or_none()
                if not user:
                    return False
                prefs = dict(user.preferences) if isinstance(user.preferences, dict) else {}
                patterns = list(prefs.get("task_recurrence", []))
                
                found = False
                for pattern in patterns:
                    if isinstance(pattern, dict) and pattern.get("id") == pattern_id:
                        pattern["active"] = False
                        pattern["deactivated_at"] = self._utc_now().isoformat()
                        found = True
                        break
                
                if not found:
                    return False

                prefs["task_recurrence"] = patterns
                user.preferences = prefs
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(user, "preferences")
                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to deactivate task recurrence pattern: {e}")
            return False


planner_service = PlannerService()
