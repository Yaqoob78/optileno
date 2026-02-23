"""
Goal Progress Engine V2 — Horizon-aware, typed, explainable scoring.

Uses completion + pace + quality − risk model with capacity-vs-demand
probability estimation.  Backward compatible via scoring_version gate.
"""

from __future__ import annotations

import logging
import math
import inspect
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    Goal,
    GoalComponent,
    GoalProgressSnapshot,
    Task,
    Plan,
)
from backend.services.deep_work_utils import extract_deep_work_session_metrics

logger = logging.getLogger(__name__)

# ── Helpers ──────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _sigmoid(x: float, midpoint: float = 0.0, steepness: float = 1.0) -> float:
    """Logistic sigmoid scaled to 0-1."""
    try:
        return 1.0 / (1.0 + math.exp(-steepness * (x - midpoint)))
    except OverflowError:
        return 0.0 if x < midpoint else 1.0


# ── Trajectory curves ───────────────────────────────────────────────────

def _expected_pct_at(elapsed_frac: float, trajectory: str) -> float:
    """Return expected completion % [0-100] at *elapsed_frac* of horizon."""
    t = _clamp(elapsed_frac, 0.0, 1.0)
    if trajectory == "front_loaded":
        return _clamp(100.0 * (1.0 - (1.0 - t) ** 2))
    elif trajectory == "back_loaded":
        return _clamp(100.0 * (t ** 2))
    elif trajectory == "milestone":
        # Step function: 25-50-75-100 at quartiles
        if t < 0.25:
            return t / 0.25 * 25.0
        elif t < 0.50:
            return 25.0 + (t - 0.25) / 0.25 * 25.0
        elif t < 0.75:
            return 50.0 + (t - 0.50) / 0.25 * 25.0
        else:
            return 75.0 + (t - 0.75) / 0.25 * 25.0
    # default: linear
    return _clamp(100.0 * t)


# ── Result dataclass ────────────────────────────────────────────────────

@dataclass
class GoalProgressV2Result:
    goal_id: int
    scoring_version: str = "v2"
    completion_score: float = 0.0       # 0-100
    pace_score: float = 0.0             # 0-100
    quality_score: float = 0.0          # 0-100
    risk_score: float = 0.0             # 0-100 (higher = more risk)
    composite_score: float = 0.0        # 0-100 weighted aggregate

    success_probability: float = 0.0    # 0-100
    confidence: float = 0.2             # 0-1
    confidence_state: str = "calibrating"  # calibrating | established | high

    probability_status: str = "Medium"

    # Explainability
    explanation: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── Constants ────────────────────────────────────────────────────────────

DIMENSION_WEIGHTS = {
    "completion": 0.40,
    "pace": 0.25,
    "quality": 0.20,
    "risk": 0.15,   # subtracted
}

COMPONENT_DEFAULTS = {
    "task":      {"weight": 1.0, "quality_weight": 1.0},
    "habit":     {"weight": 0.8, "quality_weight": 1.0},
    "deep_work": {"weight": 1.2, "quality_weight": 1.0},
    "milestone": {"weight": 1.5, "quality_weight": 1.0},
    "metric":    {"weight": 1.0, "quality_weight": 1.0},
}


# ── Engine ───────────────────────────────────────────────────────────────

class GoalProgressEngineV2:
    """Stateless engine; every method is static or classmethod."""

    @staticmethod
    def _expected_pct_at(elapsed_frac: float, trajectory: str) -> float:
        """Compatibility wrapper also used by unit tests via patching."""
        return _expected_pct_at(elapsed_frac, trajectory)

    @staticmethod
    async def _scalars_all(result: Any) -> List[Any]:
        """Return scalar rows from SQLAlchemy results and async-mocked doubles."""
        scalars_fn = getattr(result, "scalars", None)
        if not callable(scalars_fn):
            return []

        scalars_result = scalars_fn()
        if inspect.isawaitable(scalars_result):
            scalars_result = await scalars_result
        if scalars_result is None:
            return []

        all_fn = getattr(scalars_result, "all", None)
        if callable(all_fn):
            rows = all_fn()
            if inspect.isawaitable(rows):
                rows = await rows
        else:
            rows = scalars_result

        if rows is None:
            return []
        if isinstance(rows, list):
            return rows
        if isinstance(rows, tuple):
            return list(rows)
        if inspect.isawaitable(rows):
            rows = await rows
            if rows is None:
                return []
            if isinstance(rows, (list, tuple)):
                return list(rows)
        return []

    @staticmethod
    async def _scalar_one_or_none(result: Any) -> Any:
        """Return one scalar row from SQLAlchemy results and async-mocked doubles."""
        scalar_fn = getattr(result, "scalar_one_or_none", None)
        if not callable(scalar_fn):
            return None
        row = scalar_fn()
        if inspect.isawaitable(row):
            row = await row
        return row

    # ── Public entry point ───────────────────────────────────────────

    @staticmethod
    async def calculate(
        db: AsyncSession,
        goal_id: int,
        user_id: int,
        *,
        is_ultra: bool = False,
        save_snapshot: bool = True,
    ) -> GoalProgressV2Result:
        """Full V2 calculation.  Non-ULTRA users get a minimal fallback."""

        # Explorer fallback
        if not is_ultra:
            return GoalProgressV2Result(
                goal_id=goal_id,
                confidence_state="calibrating",
                explanation={"blocked": "ULTRA_REQUIRED"},
            )

        # 1. Fetch goal
        goal_result = await db.execute(
            select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
        )
        goal = await GoalProgressEngineV2._scalar_one_or_none(goal_result)
        if not goal:
            return GoalProgressV2Result(goal_id=goal_id, explanation={"error": "goal_not_found"})

        now = datetime.now(timezone.utc)
        today = now.date()

        # 2. Fetch components
        components_result = await db.execute(
            select(GoalComponent).where(GoalComponent.goal_id == goal_id)
        )
        components: List[GoalComponent] = await GoalProgressEngineV2._scalars_all(
            components_result
        )

        # 3. Fallback: if no components, derive from raw tasks/plans and persist
        if not components:
            components = await GoalProgressEngineV2._auto_derive_and_persist(
                db, goal_id, user_id
            )

        # 4. Horizon
        horizon_days = goal.horizon_days
        if not horizon_days and goal.target_date:
            created = goal.created_at or now
            if not getattr(created, "tzinfo", None):
                created = created.replace(tzinfo=timezone.utc)
            target = goal.target_date
            if not getattr(target, "tzinfo", None):
                target = target.replace(tzinfo=timezone.utc)
            horizon_days = max(1, (target - created).days)
        horizon_days = horizon_days or 30  # default

        elapsed_days = 0
        if goal.created_at:
            created = goal.created_at
            if not getattr(created, "tzinfo", None):
                created = created.replace(tzinfo=timezone.utc)
            elapsed_days = max(0, (now - created).days)

        elapsed_frac = min(1.0, elapsed_days / max(horizon_days, 1))
        trajectory = goal.trajectory_type or "linear"

        # 5. Compute dimensions
        completion = GoalProgressEngineV2._completion_score(components)
        pace = GoalProgressEngineV2._pace_score(completion, elapsed_frac, trajectory)
        quality = GoalProgressEngineV2._quality_score(components, today)
        risk = GoalProgressEngineV2._risk_score(components, today, elapsed_frac, goal)

        # 6. Composite
        composite = _clamp(
            completion * DIMENSION_WEIGHTS["completion"]
            + pace * DIMENSION_WEIGHTS["pace"]
            + quality * DIMENSION_WEIGHTS["quality"]
            - risk * DIMENSION_WEIGHTS["risk"]
        )

        # 7. Probability (capacity-vs-demand)
        probability = GoalProgressEngineV2._success_probability(
            completion, pace, risk, elapsed_frac, horizon_days, elapsed_days
        )

        # 8. Confidence
        confidence, conf_state = GoalProgressEngineV2._confidence_model(
            components, elapsed_days, horizon_days
        )

        if conf_state == "calibrating":
            probability = min(probability, 70.0)

        # 9. Probability status label
        prob_status = GoalProgressEngineV2._prob_label(probability)

        # 10. Build explanation
        explanation: Dict[str, Any] = {
            "horizon_days": horizon_days,
            "elapsed_days": elapsed_days,
            "elapsed_fraction": round(elapsed_frac, 3),
            "trajectory": trajectory,
            "component_count": len(components),
            "dimensions": {
                "completion": round(completion, 1),
                "pace": round(pace, 1),
                "quality": round(quality, 1),
                "risk": round(risk, 1),
            },
            "weights": DIMENSION_WEIGHTS,
        }

        result = GoalProgressV2Result(
            goal_id=goal_id,
            completion_score=round(completion, 1),
            pace_score=round(pace, 1),
            quality_score=round(quality, 1),
            risk_score=round(risk, 1),
            composite_score=round(composite, 1),
            success_probability=round(probability, 1),
            confidence=round(confidence, 2),
            confidence_state=conf_state,
            probability_status=prob_status,
            explanation=explanation,
        )

        # 11. Persist to goal row — time-aware smoothing
        prev_progress = goal.current_progress or 0
        new_progress = int(round(completion))

        # Compute hours since last analysis for adaptive smoothing
        hours_since_last = 24.0  # default: treat as 1 day
        if goal.last_analyzed_at:
            last_at = goal.last_analyzed_at
            if not getattr(last_at, "tzinfo", None):
                last_at = last_at.replace(tzinfo=timezone.utc)
            hours_since_last = max(0.1, (now - last_at).total_seconds() / 3600.0)

        # Adaptive delta limits: wider window when more time has passed
        # 1 hour → max +5/-3, 24 hours → max +15/-8, 48+ hours → max +25/-12
        max_up = min(25, int(5 + hours_since_last * 0.4))
        max_down = min(12, int(3 + hours_since_last * 0.2))

        delta = new_progress - prev_progress
        if delta > max_up:
            new_progress = prev_progress + max_up
        elif delta < -max_down:
            new_progress = prev_progress - max_down

        # Hysteresis: skip noise < 1 for short intervals, < 2 for longer
        noise_threshold = 1 if hours_since_last < 2.0 else 2
        if abs(new_progress - prev_progress) < noise_threshold and new_progress not in (0, 100):
            new_progress = prev_progress

        goal.current_progress = _clamp(new_progress, 0, 100)
        goal.probability_status = prob_status
        goal.last_analyzed_at = now
        await db.flush()

        # 12. Snapshot
        if save_snapshot:
            await GoalProgressEngineV2._save_snapshot(
                db, goal_id, today, result
            )

        return result

    # ── Dimension calculators ────────────────────────────────────────

    @staticmethod
    def _completion_score(components: List[GoalComponent]) -> float:
        """Weighted completion across all components."""
        if not components:
            return 0.0
        total_weight = 0.0
        earned = 0.0
        for c in components:
            w = c.weight or 1.0
            target = c.target_total or 1.0
            current = c.current_total or 0.0
            ratio = min(current / max(target, 0.01), 1.0)
            earned += ratio * w
            total_weight += w
        if total_weight <= 0:
            return 0.0
        return _clamp((earned / total_weight) * 100.0)

    @staticmethod
    def _pace_score(
        completion: float, elapsed_frac: float, trajectory: str
    ) -> float:
        """Are we on track vs the expected trajectory?"""
        expected = GoalProgressEngineV2._expected_pct_at(elapsed_frac, trajectory)
        if expected <= 0:
            return 100.0 if completion >= 0 else 50.0
        # SPI analogue
        spi = completion / max(expected, 1.0)
        # Translate SPI to 0-100 with sigmoid
        # spi=1 → 70, spi≥1.3 → 95, spi=0.5 → 30
        pace = _clamp(_sigmoid(spi, midpoint=0.85, steepness=5.0) * 100.0)
        return pace

    @staticmethod
    def _quality_score(components: List[GoalComponent], today: date) -> float:
        """Quality = quality_weight * on-time fraction."""
        if not components:
            return 50.0  # neutral
        quality_sum = 0.0
        quality_weights = 0.0
        for c in components:
            qw = c.quality_weight or 1.0
            target = c.target_total or 1.0
            current = c.current_total or 0.0
            ratio = min(current / max(target, 0.01), 1.0)
            # Penalize overdue components
            penalty = 0.0
            if c.due_date and today > c.due_date and ratio < 1.0:
                overdue_days = (today - c.due_date).days
                penalty = min(0.5, overdue_days * (c.overdue_penalty_per_day or 0.02))
            adjusted = max(0.0, ratio * qw - penalty)
            quality_sum += adjusted
            quality_weights += qw
        if quality_weights <= 0:
            return 50.0
        return _clamp((quality_sum / quality_weights) * 100.0)

    @staticmethod
    def _risk_score(
        components: List[GoalComponent],
        today: date,
        elapsed_frac: float,
        goal: Goal,
    ) -> float:
        """Higher = more risk of failure."""
        risk = 0.0

        # Risk 1: Required components not started
        required = [c for c in components if c.required]
        if required:
            not_started = sum(1 for c in required if (c.current_total or 0) == 0)
            risk += (not_started / len(required)) * 30.0

        # Risk 2: Time pressure — past halfway with < 30% done
        if elapsed_frac > 0.5:
            overall_completion = GoalProgressEngineV2._completion_score(components)
            if overall_completion < 30:
                risk += 25.0
            elif overall_completion < 50:
                risk += 10.0

        # Risk 3: Overdue target date
        if goal.target_date:
            target_dt = goal.target_date
            if not getattr(target_dt, "tzinfo", None):
                target_dt = target_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > target_dt:
                overall_completion = GoalProgressEngineV2._completion_score(components)
                if overall_completion < 100:
                    risk += 30.0

        # Risk 4: Overdue components
        overdue_count = sum(
            1 for c in components
            if c.due_date and today > c.due_date and (c.current_total or 0) < (c.target_total or 1)
        )
        if components:
            risk += (overdue_count / len(components)) * 15.0

        return _clamp(risk)

    # ── Probability ──────────────────────────────────────────────────

    @staticmethod
    def _success_probability(
        completion: float,
        pace: float,
        risk: float,
        elapsed_frac: float,
        horizon_days: int,
        elapsed_days: int,
    ) -> float:
        """Capacity-vs-demand probability estimation."""
        remaining_frac = max(0.0, 1.0 - elapsed_frac)
        remaining_needed = max(0.0, 100.0 - completion)

        if remaining_needed <= 0:
            return 99.0

        if remaining_frac <= 0:
            # Past deadline
            return max(5.0, completion * 0.5)

        # Daily velocity needed vs daily velocity achieved
        daily_completed = completion / max(elapsed_days, 1)
        daily_needed = remaining_needed / max(remaining_frac * horizon_days, 1)

        if daily_needed > 0:
            velocity_ratio = daily_completed / daily_needed
        else:
            velocity_ratio = 2.0

        # Base probability from velocity ratio
        base = _sigmoid(velocity_ratio, midpoint=0.8, steepness=4.0) * 80.0

        # Pace bonus/penalty
        pace_adj = (pace - 50.0) * 0.2

        # Risk penalty
        risk_penalty = risk * 0.15

        prob = _clamp(base + pace_adj - risk_penalty + 10.0, 1.0, 99.0)
        return prob

    # ── Confidence ───────────────────────────────────────────────────

    @staticmethod
    def _confidence_model(
        components: List[GoalComponent],
        elapsed_days: int,
        horizon_days: int,
    ) -> tuple[float, str]:
        """Return (confidence 0-1, state label)."""
        n = len(components)
        if n == 0:
            return 0.1, "calibrating"

        # More components and more elapsed days = higher confidence
        component_signal = min(n / 5.0, 1.0) * 0.4
        time_signal = min(elapsed_days / max(horizon_days * 0.3, 1), 1.0) * 0.4

        # Data density: how many components have non-zero current_total
        active = sum(1 for c in components if (c.current_total or 0) > 0)
        density_signal = (active / max(n, 1)) * 0.2

        conf = _clamp(component_signal + time_signal + density_signal, 0.05, 0.99)

        if conf >= 0.7:
            state = "high"
        elif conf >= 0.4:
            state = "established"
        else:
            state = "calibrating"

        return round(conf, 2), state

    # ── Label ────────────────────────────────────────────────────────

    @staticmethod
    def _prob_label(prob: float) -> str:
        if prob < 20:
            return "Very Low"
        elif prob < 40:
            return "Low"
        elif prob < 60:
            return "Medium"
        elif prob < 80:
            return "High"
        elif prob < 95:
            return "Very High"
        return "Extremely High"

    # ── Auto-derive + persist components from raw tasks/plans ──────

    @staticmethod
    async def _auto_derive_and_persist(
        db: AsyncSession, goal_id: int, user_id: int
    ) -> List[GoalComponent]:
        """Derive GoalComponent objects from linked tasks/plans AND persist them.

        This runs once per goal (on first V2 calculation) — subsequent calls
        will find the persisted rows and skip this path.
        """
        components: List[GoalComponent] = []

        # Tasks
        tasks_result = await db.execute(
            select(Task).where(Task.goal_id == goal_id, Task.user_id == user_id)
        )
        tasks = await GoalProgressEngineV2._scalars_all(tasks_result)

        for t in tasks:
            status = str(t.status).lower().replace("-", "_")
            current = 1.0 if status == "completed" else (0.2 if status == "in_progress" else 0.0)
            comp = GoalComponent(
                goal_id=goal_id,
                component_type="task",
                source_id=t.id,
                weight=1.0,
                target_total=1.0,
                current_total=current,
                due_date=t.due_date.date() if t.due_date else None,
                required=str(t.priority).lower() in ("high", "urgent"),
                quality_weight=1.0,
                overdue_penalty_per_day=0.02,
            )
            db.add(comp)
            components.append(comp)

        # Plans (habits + deep_work)
        plans_result = await db.execute(
            select(Plan).where(Plan.goal_id == goal_id, Plan.user_id == user_id)
        )
        plans = await GoalProgressEngineV2._scalars_all(plans_result)

        for p in plans:
            ptype = str(p.plan_type).lower()
            if ptype == "habit":
                schedule = p.schedule if isinstance(p.schedule, dict) else {}
                streak = float(schedule.get("streak", 0))
                target = float(schedule.get("target", 30))
                comp = GoalComponent(
                    goal_id=goal_id,
                    component_type="habit",
                    source_id=p.id,
                    weight=0.8,
                    target_total=max(target, 1.0),
                    current_total=min(streak, target),
                    required=False,
                    quality_weight=1.0,
                    overdue_penalty_per_day=0.0,
                )
                db.add(comp)
                components.append(comp)
            elif ptype == "deep_work":
                metrics = extract_deep_work_session_metrics(p)
                completed = 1.0 if metrics["completed"] else 0.0
                duration = float(metrics["weight_hours"])
                comp = GoalComponent(
                    goal_id=goal_id,
                    component_type="deep_work",
                    source_id=p.id,
                    weight=1.2,
                    target_total=1.0,
                    current_total=completed,
                    required=False,
                    quality_weight=max(0.5, min(2.0, duration)),
                    overdue_penalty_per_day=0.01,
                )
                db.add(comp)
                components.append(comp)

        if components:
            try:
                await db.flush()
                logger.info(
                    "Auto-derived and persisted %d components for goal %d",
                    len(components), goal_id,
                )
            except Exception as exc:
                logger.warning("Failed to persist auto-derived components: %s", exc)

        return components

    # ── Snapshot persistence ─────────────────────────────────────────

    @staticmethod
    async def _save_snapshot(
        db: AsyncSession,
        goal_id: int,
        today: date,
        result: GoalProgressV2Result,
    ) -> None:
        """Upsert daily snapshot."""
        try:
            existing_result = await db.execute(
                select(GoalProgressSnapshot).where(
                    GoalProgressSnapshot.goal_id == goal_id,
                    GoalProgressSnapshot.date == today,
                )
            )
            existing = await GoalProgressEngineV2._scalar_one_or_none(
                existing_result
            )

            if existing:
                existing.completion_score = result.completion_score
                existing.pace_score = result.pace_score
                existing.quality_score = result.quality_score
                existing.risk_score = result.risk_score
                existing.success_probability = result.success_probability
                existing.confidence = result.confidence
                existing.meta = result.explanation
            else:
                snap = GoalProgressSnapshot(
                    goal_id=goal_id,
                    date=today,
                    completion_score=result.completion_score,
                    pace_score=result.pace_score,
                    quality_score=result.quality_score,
                    risk_score=result.risk_score,
                    success_probability=result.success_probability,
                    confidence=result.confidence,
                    meta=result.explanation,
                )
                db.add(snap)
            await db.flush()
        except Exception as exc:
            logger.warning("Failed to save goal progress snapshot: %s", exc)
