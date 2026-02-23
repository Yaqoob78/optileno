from __future__ import annotations

from typing import Any, Dict, Optional


def _to_positive_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def _first_valid_minutes(payload: Dict[str, Any], keys: list[str]) -> Optional[float]:
    for key in keys:
        value = _to_positive_float(payload.get(key))
        if value is not None:
            return value
    return None


def extract_deep_work_session_metrics(session: Any) -> Dict[str, Any]:
    """Normalize deep-work duration signals across legacy and current formats."""
    schedule = session.schedule if isinstance(getattr(session, "schedule", None), dict) else {}
    status = str(schedule.get("status") or "").strip().lower()

    planned = _first_valid_minutes(
        schedule,
        ["planned_duration", "planned_duration_minutes", "planned_minutes", "duration_minutes"],
    )
    actual = _first_valid_minutes(
        schedule,
        ["actual_duration", "actual_duration_minutes", "actual_minutes", "tracked_minutes"],
    )

    # Ignore ORM model default (8.0 hours) unless it's explicitly meaningful.
    duration_hours = _to_positive_float(getattr(session, "duration_hours", None))
    if duration_hours is not None and abs(duration_hours - 8.0) > 1e-6:
        legacy_minutes = duration_hours * 60.0
        if planned is None:
            planned = legacy_minutes
        if actual is None and (status == "completed" or schedule.get("completed") or schedule.get("completed_at")):
            actual = legacy_minutes

    completed = bool(
        status == "completed"
        or schedule.get("completed")
        or schedule.get("completed_at")
    )

    if planned is None and actual is not None:
        planned = actual
    if actual is None and planned is not None and completed:
        actual = planned

    planned_minutes = float(max(0.0, min(720.0, planned or 0.0)))
    actual_minutes = float(max(0.0, min(720.0, actual or 0.0)))
    has_execution = actual_minutes > 0 or completed

    include_for_analytics = has_execution and status not in {"scheduled", "cancelled", "missed"}
    effective_minutes = actual_minutes if actual_minutes > 0 else (planned_minutes if completed else 0.0)
    weight_hours = max(0.5, (planned_minutes / 60.0) if planned_minutes > 0 else 1.0)

    return {
        "status": status,
        "planned_minutes": planned_minutes,
        "actual_minutes": actual_minutes,
        "effective_minutes": float(max(0.0, min(720.0, effective_minutes))),
        "completed": completed,
        "has_execution": has_execution,
        "include_for_analytics": include_for_analytics,
        "weight_hours": weight_hours,
    }

