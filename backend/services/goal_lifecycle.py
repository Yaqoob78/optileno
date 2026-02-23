"""
Goal Lifecycle Hooks — recompute progress on every create/update/delete event.

Call `recompute_if_linked(db, user_id, goal_id)` from any mutation path.
For non-ULTRA users the call is a no-op.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import Goal, GoalComponent, User

logger = logging.getLogger(__name__)


async def recompute_if_linked(
    db: AsyncSession,
    user_id: int,
    goal_id: Optional[int],
    *,
    save_snapshot: bool = True,
) -> None:
    """Recompute goal progress V2 if goal_id is set and user is ULTRA.

    Safe to call unconditionally — silently exits for non-ULTRA or
    missing goal_id.
    """
    if not goal_id:
        return

    try:
        from backend.services.entitlements_service import is_ultra_user

        user = (
            await db.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if not user or not is_ultra_user(user):
            return

        goal = (
            await db.execute(select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id))
        ).scalar_one_or_none()
        if not goal:
            return

        # Route to correct engine based on scoring_version
        scoring_version = getattr(goal, "scoring_version", None) or "v1"

        if scoring_version == "v2":
            from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
            await GoalProgressEngineV2.calculate(
                db, goal_id, user_id, is_ultra=True, save_snapshot=save_snapshot,
            )
        else:
            # V1 fallback
            from backend.services.goal_progress_engine import GoalProgressEngine
            await GoalProgressEngine.calculate_progress(db, goal_id, user_id, is_ultra=True)

    except Exception as exc:
        logger.error("Goal lifecycle recompute failed for goal %s: %s", goal_id, exc)


async def sync_task_component(
    db: AsyncSession,
    goal_id: int,
    task_id: int,
    status: str,
) -> None:
    """Update the GoalComponent row linked to a task after status change."""
    try:
        comp = (
            await db.execute(
                select(GoalComponent).where(
                    GoalComponent.goal_id == goal_id,
                    GoalComponent.source_id == task_id,
                    GoalComponent.component_type == "task",
                )
            )
        ).scalar_one_or_none()

        if not comp:
            return

        normalized = status.lower().replace("-", "_")
        if normalized == "completed":
            comp.current_total = comp.target_total or 1.0
        elif normalized == "in_progress":
            comp.current_total = (comp.target_total or 1.0) * 0.2
        else:
            comp.current_total = 0.0
        await db.flush()
    except Exception as exc:
        logger.warning("sync_task_component failed: %s", exc)


async def sync_habit_component(
    db: AsyncSession,
    goal_id: int,
    plan_id: int,
    streak: float,
) -> None:
    """Update the GoalComponent row linked to a habit after tracking."""
    try:
        comp = (
            await db.execute(
                select(GoalComponent).where(
                    GoalComponent.goal_id == goal_id,
                    GoalComponent.source_id == plan_id,
                    GoalComponent.component_type == "habit",
                )
            )
        ).scalar_one_or_none()

        if not comp:
            return

        comp.current_total = min(streak, comp.target_total or 30.0)
        await db.flush()
    except Exception as exc:
        logger.warning("sync_habit_component failed: %s", exc)


async def sync_deep_work_component(
    db: AsyncSession,
    goal_id: int,
    plan_id: int,
    completed: bool,
) -> None:
    """Update the GoalComponent row linked to a deep work session."""
    try:
        comp = (
            await db.execute(
                select(GoalComponent).where(
                    GoalComponent.goal_id == goal_id,
                    GoalComponent.source_id == plan_id,
                    GoalComponent.component_type == "deep_work",
                )
            )
        ).scalar_one_or_none()

        if not comp:
            return

        comp.current_total = (comp.target_total or 1.0) if completed else 0.0
        await db.flush()
    except Exception as exc:
        logger.warning("sync_deep_work_component failed: %s", exc)


async def remove_component_for_source(
    db: AsyncSession,
    goal_id: int,
    source_id: int,
    component_type: str,
) -> None:
    """Delete a GoalComponent when its source entity is deleted."""
    try:
        from sqlalchemy import delete as sa_delete
        await db.execute(
            sa_delete(GoalComponent).where(
                GoalComponent.goal_id == goal_id,
                GoalComponent.source_id == source_id,
                GoalComponent.component_type == component_type,
            )
        )
        await db.flush()
    except Exception as exc:
        logger.warning("remove_component_for_source failed: %s", exc)
