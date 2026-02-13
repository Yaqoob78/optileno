import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import Notification, User
from backend.utils.user_profile import merge_preferences
from .schemas import AgentDecision, AgentAction

logger = logging.getLogger(__name__)


def _set_path(data: Dict[str, Any], path: str, value: Any) -> None:
    parts = [p for p in path.split('.') if p]
    if not parts:
        return
    cur = data
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def _adjust_difficulty(prefs: Dict[str, Any], delta: float) -> None:
    behavior = prefs.get("behavior") if isinstance(prefs.get("behavior"), dict) else {}
    current = behavior.get("difficulty_adjustment", 0.0)
    updated = max(-100.0, min(100.0, float(current) + float(delta)))
    behavior["difficulty_adjustment"] = updated
    prefs["behavior"] = behavior


def _schedule_check(prefs: Dict[str, Any], after_hours: int) -> None:
    agentic = prefs.get("agentic") if isinstance(prefs.get("agentic"), dict) else {}
    run_at = datetime.now(timezone.utc) + timedelta(hours=max(1, int(after_hours)))
    agentic["next_check_at"] = run_at.isoformat()
    prefs["agentic"] = agentic


def _build_notification(action: AgentAction, user_id: int) -> Notification:
    payload = action.payload or {}
    title = payload.get("title") or "Optileno Update"
    message = payload.get("message") or "Your plan was adjusted to keep you on track."
    notification_type = payload.get("notification_type") or "system"
    priority = payload.get("priority") or "normal"
    action_url = payload.get("action_url")

    return Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        channel="in_app",
        priority=priority,
        data=payload,
        action_url=action_url,
    )


async def enforce_decision(
    db: AsyncSession,
    user: User,
    decision: AgentDecision
) -> Dict[str, Any]:
    applied: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    if not decision.actions:
        return {"applied": applied, "skipped": skipped}

    prefs = merge_preferences(user.preferences or {})
    prefs_changed = False

    for action in decision.actions:
        action_type = (action.type or "").upper()
        try:
            if action_type == "SET_PREFERENCE":
                path = (action.payload or {}).get("path")
                value = (action.payload or {}).get("value")
                if not path:
                    skipped.append({"type": action.type, "reason": "missing path"})
                    continue
                _set_path(prefs, path, value)
                prefs_changed = True
                applied.append({"type": action.type})

            elif action_type == "ADJUST_DIFFICULTY":
                if action.value is None:
                    skipped.append({"type": action.type, "reason": "missing value"})
                    continue
                _adjust_difficulty(prefs, action.value)
                prefs_changed = True
                applied.append({"type": action.type, "value": action.value})

            elif action_type == "SCHEDULE_CHECK":
                if action.after_hours is None:
                    skipped.append({"type": action.type, "reason": "missing after_hours"})
                    continue
                _schedule_check(prefs, action.after_hours)
                prefs_changed = True
                applied.append({"type": action.type, "after_hours": action.after_hours})

            elif action_type == "CREATE_NOTIFICATION":
                notification = _build_notification(action, user.id)
                db.add(notification)
                applied.append({"type": action.type})

            else:
                skipped.append({"type": action.type, "reason": "unsupported action"})
        except Exception as exc:
            logger.error(f"Failed to apply action {action.type}: {exc}")
            skipped.append({"type": action.type, "reason": "error"})

    if prefs_changed:
        user.preferences = prefs

    if prefs_changed or applied:
        await db.commit()
        await db.refresh(user)

    return {"applied": applied, "skipped": skipped}
