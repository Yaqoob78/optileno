"""
Planner service.

Raw persistence layer for plans and deep work sessions.
No business logic. No validation. No ORM exposure.
"""

from __future__ import annotations

from typing import Any, Optional
from datetime import datetime, date, timedelta
import logging
import json

from backend.db.database import get_db
from backend.db.models import Plan

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

    async def start_deep_work_session(
        self,
        user_id: str,
        duration_minutes: Optional[int] = None,
    ) -> dict[str, Any]:
        """
        Persist a deep work session as a Plan record.
        """
        plan_data = {
            "type": "deep_work",
            "duration_minutes": duration_minutes,
            "started_at": datetime.utcnow().isoformat(),
        }

        try:
            async for db in get_db():
                plan = Plan(
                    user_id=int(user_id),
                    name="Deep Work Session",
                    description="AI-triggered deep work session",
                    plan_type="deep_work",
                    date=datetime.utcnow(),
                    duration_hours=(
                        duration_minutes / 60 if duration_minutes else None
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
                    date=plan_data.get("date", datetime.utcnow()),
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
                new_progress = min(100, max(0, progress))
                
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
    
    async def get_user_habits(self, user_id: str) -> list[dict[str, Any]]:
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
                now_date = datetime.utcnow().date()
                
                for plan in plans:
                    schedule = self._normalize_habit_schedule(plan.schedule)
                    streak = schedule.get("streak", 0)
                    longest_streak = schedule.get("longestStreak", 0)
                    last_completed_str = schedule.get("lastCompleted")
                    
                    if last_completed_str and streak > 0:
                        last_completed = datetime.fromisoformat(last_completed_str).date()
                        delta = (now_date - last_completed).days
                        if delta > 1:
                            streak = 0  # Streak broken
                    
                    # Ensure longestStreak is at least as high as current streak
                    if streak > longest_streak:
                        longest_streak = streak
                    
                    habits.append({
                        "id": str(plan.id),
                        "name": plan.name,
                        "description": plan.description,
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

    async def track_habit(self, user_id: str, habit_id: str) -> dict[str, Any]:
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
                
                now = datetime.utcnow()
                new_streak = 1
                
                if last_completed_str:
                    last_completed = datetime.fromisoformat(last_completed_str)
                    delta = (now.date() - last_completed.date()).days
                    
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
                
                today_str = now.date().isoformat()
                if today_str not in history:
                    history.append(today_str)
                    # Sort and keep last 30
                    history.sort()
                    if len(history) > 30:
                        history = history[-30:]
                
                # Update schedule with new streak, best streak, and history
                schedule["streak"] = new_streak
                schedule["longestStreak"] = longest_streak
                schedule["history"] = history
                schedule["lastCompleted"] = now.isoformat()
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

    async def create_habit(self, user_id: str, habit_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new habit."""
        from backend.db.models import Plan
        from datetime import timezone

        try:
            async for db in get_db():
                # Create Plan without goal_id to avoid database schema issues
                plan = Plan(
                    user_id=int(user_id),
                    name=habit_data.get("name", habit_data.get("title", "New Habit")),
                    description=habit_data.get("description"),
                    plan_type="habit",
                    date=datetime.utcnow(),
                    schedule={
                        "frequency": habit_data.get("frequency", "daily"),
                        "streak": 0,
                        "longestStreak": 0,
                        "target": habit_data.get("target", 1),
                        "category": habit_data.get("category", "Wellness"),
                        "goal_link": habit_data.get("goal_link"),
                        "completedToday": False,
                        "completed_today": False,
                        "lastCompleted": None,
                        "last_completed": None,
                    },
                    recommendations=[]
                )
                # Note: goal_id is not set here to avoid database schema issues
                # It will be handled separately when the database is properly migrated

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
                now = datetime.utcnow()
                
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
        from datetime import timezone
        
        try:
            async for db in get_db():
                # Support both Pydantic model and Dict
                input_data = task_data.dict() if hasattr(task_data, 'dict') else task_data
                
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

                # Parse due_date properly - handle ISO strings and natural language
                due_date_value = input_data.get("due_date")
                if due_date_value:
                    if isinstance(due_date_value, str):
                        try:
                            # Try parsing as ISO format
                            parsed_date = datetime.fromisoformat(due_date_value.replace('Z', '+00:00'))
                            # If no timezone info, assume UTC
                            if parsed_date.tzinfo is None:
                                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                            due_date_value = parsed_date
                        except (ValueError, AttributeError):
                            # Try natural language parsing
                            try:
                                now = datetime.now(timezone.utc)
                                target_date = now.date()
                                time_lower = due_date_value.lower().strip()
                                target_time = None
                                
                                if "tomorrow" in time_lower:
                                    target_date = target_date + timedelta(days=1)
                                    time_lower = time_lower.replace("tomorrow", "").strip()

                                if "morning" in time_lower:
                                    target_time = datetime.strptime("09:00", "%H:%M").time()
                                elif "afternoon" in time_lower:
                                    target_time = datetime.strptime("14:00", "%H:%M").time()
                                elif "evening" in time_lower:
                                    target_time = datetime.strptime("18:00", "%H:%M").time()
                                elif "tonight" in time_lower:
                                    target_time = datetime.strptime("20:00", "%H:%M").time()
                                elif ":" in time_lower:
                                    fmt = "%H:%M"
                                    if "am" in time_lower or "pm" in time_lower:
                                        fmt = "%I:%M%p"
                                        time_lower = time_lower.replace(" ", "")
                                    target_time = datetime.strptime(time_lower, fmt).time()
                                else:
                                    # Integer hour check
                                    hour_str = ''.join(filter(str.isdigit, time_lower))
                                    if hour_str:
                                        hour = int(hour_str)
                                        if "pm" in time_lower and hour < 12: hour += 12
                                        elif "am" in time_lower and hour == 12: hour = 0
                                        elif hour <= 6 and "am" not in time_lower: hour += 12
                                        target_time = datetime.strptime(f"{hour}:00", "%H:%M").time()

                                if target_time:
                                    due_date_value = datetime.combine(target_date, target_time).replace(tzinfo=timezone.utc)
                                else:
                                    # Fallback: Just date if "tomorrow" was only thing
                                    if "tomorrow" in due_date_value.lower() and not target_time:
                                        due_date_value = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                                    else:
                                        logger.warning(f"Could not parse natural date: {due_date_value}")
                                        due_date_value = None
                            except Exception as e:
                                logger.warning(f"Failed to parse due_date '{due_date_value}': {e}")
                                due_date_value = None

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
                    goal_id=input_data.get("goal_id"),
                    meta={
                        **input_data.get("meta", {}),
                        "energy": input_data.get("energy", "medium")
                    }
                )
                db.add(task)
                await db.commit()
                
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
                    "in-progress": "in-progress"
                }
                db_status = status_map.get(status, status) if status else None

                query = select(Task).where(Task.user_id == int(user_id)).options(joinedload(Task.goal))
                
                if db_status:
                    query = query.where(Task.status == db_status)
                if due_date_from:
                    query = query.where(Task.due_date >= datetime.combine(due_date_from, datetime.min.time()))
                if due_date_to:
                    query = query.where(Task.due_date <= datetime.combine(due_date_to, datetime.max.time()))
                
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

                # Parse due_date properly - handle both ISO strings with and without timezone
                if "due_date" in update_data:
                    due_date_value = update_data["due_date"]
                    if due_date_value and isinstance(due_date_value, str):
                        try:
                            from datetime import timezone
                            # Try parsing as ISO format
                            parsed_date = datetime.fromisoformat(due_date_value.replace('Z', '+00:00'))
                            # If no timezone info, assume UTC
                            if parsed_date.tzinfo is None:
                                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                            update_data["due_date"] = parsed_date
                        except (ValueError, AttributeError) as e:
                            logger.warning(f"Failed to parse due_date '{due_date_value}': {e}")
                            update_data.pop("due_date", None)

                for key, value in update_data.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                
                task.updated_at = datetime.utcnow()
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
        """Start a new deep work session."""
        from backend.db.models import Plan
        
        try:
            async for db in get_db():
                session = Plan(
                    user_id=int(user_id),
                    name="Deep Work",
                    plan_type="deep_work",
                    date=datetime.utcnow(),
                    schedule={
                        "planned_duration": data.planned_duration_minutes,
                        "focus_goal": data.focus_goal,
                        "notes": data.notes,
                        "status": "active"
                    }
                )
                db.add(session)
                await db.commit()
                await db.refresh(session)
                return self._map_to_deep_work_out(session)
        except Exception as e:
            logger.error(f"Failed to start deep work: {e}")
            return None

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
                
                schedule = session.schedule.copy()
                schedule["status"] = "completed"
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
                            'duration': actual_duration_minutes,
                            'interruptions': schedule.get('interruptions', 0),
                            'quality_score': schedule.get('quality_score', 0)
                        }
                    )
                    logger.info(f"Tracked deep_work_session event for session {session_id}: {actual_duration_minutes} min")
                except Exception as e:
                    logger.error(f"Failed to track analytics event: {e}")
                
                return self._map_to_deep_work_out(session)
        except Exception as e:
            logger.error(f"Failed to complete deep work: {e}")
            return None

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
                session = result.scalars().first()
                if session and session.schedule.get("status") == "active":
                    return self._map_to_deep_work_out(session)
                return None
        except Exception:
            return None

    def _map_to_deep_work_out(self, session: Any) -> Any:
        """Helper to map Plan model to DeepWorkOut shape."""
        schedule = session.schedule or {}
        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "planned_duration_minutes": schedule.get("planned_duration", 0),
            "focus_goal": schedule.get("focus_goal"),
            "notes": schedule.get("notes"),
            "started_at": session.created_at,
            "status": schedule.get("status", "active"),
            "created_at": session.created_at
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
