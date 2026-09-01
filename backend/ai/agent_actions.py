# backend/ai/agent_actions.py
"""
AI Agent Action System with User Confirmation.

CRITICAL DESIGN PRINCIPLE:
AI can SUGGEST anything but NEVER executes without user confirmation.

This module provides:
1. Suggestion generation (no confirmation needed - just advice)
2. Action requests (require user confirmation)
3. Action execution (after confirmation)
4. Pending action tracking
"""

from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid
import logging
import inspect
import json
import time
import re
import asyncio

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.ai.tool_contracts import validate_tool_payload, ToolExecutionError

logger = logging.getLogger(__name__)

MAX_PAYLOAD_SUMMARY_BYTES = 2048
_SENSITIVE_KEY_PATTERN = re.compile(
    r"(password|pass|token|secret|api[_-]?key|authorization|cookie|session|credential)",
    re.IGNORECASE,
)

try:
    from prometheus_client import Counter, Histogram, REGISTRY
except Exception:  # pragma: no cover - optional dependency
    Counter = None
    Histogram = None
    REGISTRY = None


def _build_counter(name: str, documentation: str, labelnames: List[str]):
    if Counter is None:
        return None
    try:
        return Counter(name, documentation, labelnames=labelnames)
    except ValueError:
        collector = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
        return collector if collector is not None else None


def _build_histogram(name: str, documentation: str, labelnames: List[str]):
    if Histogram is None:
        return None
    try:
        return Histogram(
            name,
            documentation,
            labelnames=labelnames,
            buckets=(1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000),
        )
    except ValueError:
        collector = getattr(REGISTRY, "_names_to_collectors", {}).get(name)
        return collector if collector is not None else None


TOOL_CALLS_TOTAL = _build_counter(
    "tool_calls_total",
    "Total Leno tool calls by tool and success outcome",
    ["tool", "success"],
)

TOOL_LATENCY_MS = _build_histogram(
    "tool_latency_ms",
    "Leno tool execution latency in milliseconds",
    ["tool"],
)


class ActionType(str, Enum):
    """Types of actions AI can propose."""
    CREATE_GOAL = "CREATE_GOAL"
    UPDATE_GOAL = "UPDATE_GOAL"
    DELETE_GOAL = "DELETE_GOAL"
    CREATE_TASK = "CREATE_TASK"
    UPDATE_TASK = "UPDATE_TASK"
    COMPLETE_TASK = "COMPLETE_TASK"
    CREATE_HABIT = "CREATE_HABIT"
    UPDATE_HABIT = "UPDATE_HABIT"
    COMPLETE_HABIT = "COMPLETE_HABIT"
    START_DEEP_WORK = "START_DEEP_WORK"
    SCHEDULE_DEEP_WORK = "SCHEDULE_DEEP_WORK"
    CREATE_PLAN = "CREATE_PLAN"
    RESCHEDULE_TASK = "RESCHEDULE_TASK"


class ActionStatus(str, Enum):
    """Status of proposed actions."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    EXECUTED = "executed"
    EXPIRED = "expired"


# In-memory storage for pending actions (In production, use Redis or DB)
PENDING_ACTIONS: Dict[str, Dict[str, Any]] = {}


class AIAgentActions:
    """
    AI Agent with FULL ACCESS but REQUIRES USER CONFIRMATION.
    
    The AI can see everything and suggest anything, but the user
    always has the final say before any action is executed.
    """
    
    # ══════════════════════════════════════════════════════════════════════════
    # SUGGESTION METHODS (No confirmation needed - just advice)
    # ══════════════════════════════════════════════════════════════════════════
    
    @staticmethod
    def _normalize_tool_name(tool_name: Optional[str]) -> str:
        return str(tool_name or "unknown").strip().lower()

    @staticmethod
    def _normalize_plan_tier(plan_tier: Optional[str]) -> str:
        return str(plan_tier or "unknown").strip().lower()

    def _redact_payload(self, payload: Any, depth: int = 0) -> Any:
        if depth > 4:
            return "[max_depth]"

        if isinstance(payload, dict):
            redacted: Dict[str, Any] = {}
            for key, value in list(payload.items())[:50]:
                key_str = str(key)
                if _SENSITIVE_KEY_PATTERN.search(key_str):
                    redacted[key_str] = "[REDACTED]"
                    continue
                redacted[key_str] = self._redact_payload(value, depth + 1)
            if len(payload) > 50:
                redacted["__truncated_keys__"] = len(payload) - 50
            return redacted

        if isinstance(payload, list):
            preview = [self._redact_payload(item, depth + 1) for item in payload[:25]]
            if len(payload) > 25:
                preview.append(f"[+{len(payload) - 25} more items]")
            return preview

        if isinstance(payload, str):
            return f"[str:{len(payload)}]"
        if isinstance(payload, bytes):
            return f"[bytes:{len(payload)}]"
        if isinstance(payload, datetime):
            return payload.isoformat()
        if isinstance(payload, (int, float, bool)) or payload is None:
            return payload

        return f"[{type(payload).__name__}]"

    def _summarize_payload(self, payload: Any) -> str:
        try:
            summary = json.dumps(
                self._redact_payload(payload),
                ensure_ascii=True,
                separators=(",", ":"),
                sort_keys=True,
            )
        except Exception:
            summary = json.dumps({"unserializable_payload_type": type(payload).__name__})

        encoded = summary.encode("utf-8")
        if len(encoded) <= MAX_PAYLOAD_SUMMARY_BYTES:
            return summary

        suffix = "[truncated]"
        trimmed = encoded[: MAX_PAYLOAD_SUMMARY_BYTES - len(suffix)].decode(
            "utf-8",
            errors="ignore",
        )
        return f"{trimmed}{suffix}"

    @staticmethod
    async def _await_if_needed(value: Any) -> Any:
        if inspect.isawaitable(value):
            return await value
        return value

    async def _invoke_tool_callable(
        self,
        tool_callable: Callable[..., Any],
        user_id: str,
        payload: Any,
    ) -> Any:
        if isinstance(payload, dict):
            try:
                return await self._await_if_needed(tool_callable(user_id, **payload))
            except TypeError:
                return await self._await_if_needed(tool_callable(user_id, payload))
        return await self._await_if_needed(tool_callable(user_id, payload))

    def _record_tool_metrics(self, tool_name: str, success: bool, latency_ms: float) -> None:
        if TOOL_CALLS_TOTAL is not None:
            TOOL_CALLS_TOTAL.labels(tool=tool_name, success=str(success).lower()).inc()
        if TOOL_LATENCY_MS is not None:
            TOOL_LATENCY_MS.labels(tool=tool_name).observe(latency_ms)

    def _log_tool_execution(
        self,
        *,
        user_id: str,
        plan_tier: str,
        tool_name: str,
        payload_summary: str,
        success: bool,
        error_type: Optional[str],
        latency_ms: float,
        request_id: str,
    ) -> None:
        event = {
            "request_id": request_id,
            "user_id": str(user_id),
            "plan_tier": plan_tier,
            "tool_name": tool_name,
            "payload_summary": payload_summary,
            "success": success,
            "error_type": error_type,
            "latency_ms": latency_ms,
        }
        logger.info(
            "leno_tool_execution %s",
            json.dumps(event, ensure_ascii=True, separators=(",", ":"), sort_keys=True),
        )

    async def execute_tool(
        self,
        *,
        tool_name: str,
        user_id: str,
        payload: Any,
        tool_callable: Callable[..., Any],
        plan_tier: str = "unknown",
        request_id: Optional[str] = None,
    ) -> Any:
        normalized_tool_name = self._normalize_tool_name(tool_name)
        normalized_plan_tier = self._normalize_plan_tier(plan_tier)
        effective_request_id = request_id or str(uuid.uuid4())
        
        try:
            # 1. Pipeline Validation Layer (Tier & Schema)
            # Will raise ToolExecutionError if invalid
            validated_payload = validate_tool_payload(
                tool_name=tool_name.upper(), 
                payload=payload, 
                plan_tier=normalized_plan_tier
            )
        except ToolExecutionError as e:
            # Re-raise so the AI Client can catch the strict format error and retry
            raise 

        payload_summary = self._summarize_payload(validated_payload)

        started_at = time.perf_counter()
        success = False
        error_type: Optional[str] = None
        try:
            result = await asyncio.wait_for(
                self._invoke_tool_callable(tool_callable, user_id, validated_payload),
                timeout=12.0,
            )
            success = True
            return result
        except asyncio.TimeoutError as te:
            error_type = "TimeoutError"
            raise ToolExecutionError(f"Tool '{tool_name}' execution timed out after 12 seconds.") from te
        except Exception as exc:
            error_type = type(exc).__name__
            raise
        finally:
            latency_ms = round((time.perf_counter() - started_at) * 1000, 2)
            self._record_tool_metrics(normalized_tool_name, success, latency_ms)
            self._log_tool_execution(
                user_id=user_id,
                plan_tier=normalized_plan_tier,
                tool_name=normalized_tool_name,
                payload_summary=payload_summary,
                success=success,
                error_type=error_type,
                latency_ms=latency_ms,
                request_id=effective_request_id,
            )

    @staticmethod
    async def _complete_task_by_payload(
        user_id: str,
        task_id: str,
        **_: Any,
    ) -> Dict[str, Any]:
        return await planner_service.complete_task(user_id, task_id)

    @staticmethod
    async def _reschedule_task_by_payload(
        user_id: str,
        task_id: str,
        new_time: str,
        reason: Optional[str] = None,
        **_: Any,
    ) -> Dict[str, Any]:
        task = await planner_service.get_task_by_id(user_id, task_id)
        if task and (task.get("is_locked") or task.get("meta", {}).get("is_locked")):
            return {
                "error": f"Task '{task.get('title', task_id)}' is locked to its time slot and cannot be automatically rescheduled.",
                "is_locked": True,
                "task_id": task_id
            }

        updates = {
            "due_date": new_time,
            "reschedule_reason": reason or "Optimized to protect focus time and avoid conflicts"
        }
        res = await planner_service.update_task(user_id, task_id, updates)
        return res or {"success": True, "task_id": task_id}

    @staticmethod
    async def _create_multiple_tasks(
        user_id: str,
        tasks: List[Dict[str, Any]],
        **_: Any,
    ) -> Dict[str, Any]:
        results = []
        for task_data in tasks:
            result = await planner_service.create_task(user_id, task_data)
            results.append(result)
        return {"created_count": len(results), "tasks": results}

    async def suggest_goal(
        self,
        user_id: str,
        context: Dict[str, Any],
        suggestion_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Suggest a new goal based on user patterns and context.
        Returns a suggestion that can be presented to the user.
        """
        goal_data = {
            "title": suggestion_data.get("title", "New Goal"),
            "description": suggestion_data.get("description", ""),
            "category": suggestion_data.get("category", "personal"),
            "target_date": suggestion_data.get("target_date"),
            "reasoning": suggestion_data.get("reasoning", "Based on your recent activity"),
        }
        
        return {
            "type": "SUGGESTION",
            "action_type": ActionType.CREATE_GOAL.value,
            "data": goal_data,
            "can_confirm": True,
            "message": f"I'd suggest setting a goal: '{goal_data['title']}'. Would you like me to create it?",
        }
    
    async def suggest_task(
        self,
        user_id: str,
        goal_id: Optional[str],
        task_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Suggest a task that helps achieve a goal.
        """
        data = {
            "title": task_data.get("title", "New Task"),
            "description": task_data.get("description", ""),
            "priority": task_data.get("priority", "medium"),
            "estimated_minutes": task_data.get("estimated_minutes", 60),
            "due_date": task_data.get("due_date"),
            "goal_link": goal_id,
            "reasoning": task_data.get("reasoning", "This will help your progress"),
        }
        
        return {
            "type": "SUGGESTION",
            "action_type": ActionType.CREATE_TASK.value,
            "data": data,
            "can_confirm": True,
            "message": f"I recommend adding this task: '{data['title']}'. Shall I add it?",
        }
    
    async def suggest_habit(
        self,
        user_id: str,
        goal_id: Optional[str],
        habit_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Suggest a habit to support goal achievement.
        """
        data = {
            "name": habit_data.get("name", "New Habit"),
            "description": habit_data.get("description", ""),
            "frequency": habit_data.get("frequency", "daily"),
            "goal_link": goal_id,
            "reasoning": habit_data.get("reasoning", "This habit will support your goal"),
        }
        
        return {
            "type": "SUGGESTION",
            "action_type": ActionType.CREATE_HABIT.value,
            "data": data,
            "can_confirm": True,
            "message": f"I suggest developing this habit: '{data['name']}'. Want me to add it to your tracker?",
        }
    
    async def suggest_schedule_optimization(
        self,
        user_id: str,
        analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Suggest schedule improvements based on patterns.
        This is purely advisory - no action needed.
        """
        return {
            "type": "INSIGHT",
            "message": analysis.get("message", "Here are some schedule optimizations..."),
            "insights": analysis.get("insights", []),
            "can_confirm": False,  # Just information, no action
        }
    
    # ══════════════════════════════════════════════════════════════════════════
    # ACTION REQUEST METHODS (Require user confirmation)
    # ══════════════════════════════════════════════════════════════════════════
    
    async def request_create_goal(
        self,
        user_id: str,
        goal_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Request to create a goal. Returns a pending action ID for confirmation.
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": ActionType.CREATE_GOAL.value,
            "status": ActionStatus.PENDING.value,
            "data": goal_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        return {
            "action": ActionType.CREATE_GOAL.value,
            "action_id": action_id,
            "requires_confirmation": True,
            "data": goal_data,
            "message": f"I'd like to create this goal for you:\n\n**{goal_data.get('title', 'New Goal')}**\n\n_{goal_data.get('description', '')}_\n\nCategory: {goal_data.get('category', 'Personal')}\nTarget: {goal_data.get('target_date', 'No deadline')}\n\nShall I proceed?",
            "confirm_buttons": ["Yes, create it!", "Let me modify", "No, cancel"],
        }
    
    async def request_create_task(
        self,
        user_id: str,
        task_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Request to create a task. Returns a pending action ID.
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": ActionType.CREATE_TASK.value,
            "status": ActionStatus.PENDING.value,
            "data": task_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        priority_emoji = {"urgent": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(
            task_data.get("priority", "medium"), "🟡"
        )
        
        return {
            "action": ActionType.CREATE_TASK.value,
            "action_id": action_id,
            "requires_confirmation": True,
            "data": task_data,
            "message": f"I'll add this task to help you:\n\n{priority_emoji} **{task_data.get('title', 'New Task')}**\n\n{task_data.get('description', '')}\n\nPriority: {task_data.get('priority', 'medium').title()}\nDue: {task_data.get('due_date', 'No deadline')}\n\nIs that okay?",
            "confirm_buttons": ["Yes, add it!", "Modify first", "Cancel"],
        }
    
    async def request_create_habit(
        self,
        user_id: str,
        habit_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Request to create a habit. Returns a pending action ID.
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": ActionType.CREATE_HABIT.value,
            "status": ActionStatus.PENDING.value,
            "data": habit_data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        freq_text = habit_data.get("frequency", "daily").title()
        
        return {
            "action": ActionType.CREATE_HABIT.value,
            "action_id": action_id,
            "requires_confirmation": True,
            "data": habit_data,
            "message": f"I recommend adding this habit to your tracker:\n\n🔄 **{habit_data.get('name', 'New Habit')}**\n\n{habit_data.get('description', '')}\n\nFrequency: {freq_text}\n\nThis will help you build consistency. Shall I create it?",
            "confirm_buttons": ["Create habit", "Edit first", "No thanks"],
        }
    
    async def request_create_multiple_tasks(
        self,
        user_id: str,
        tasks: List[Dict[str, Any]],
        goal_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Request to create multiple tasks at once (e.g., for a goal roadmap).
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": "CREATE_MULTIPLE_TASKS",
            "status": ActionStatus.PENDING.value,
            "data": {"tasks": tasks, "goal_title": goal_title},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        task_list = "\n".join([f"• {t.get('title', 'Task')}" for t in tasks[:5]])
        if len(tasks) > 5:
            task_list += f"\n... and {len(tasks) - 5} more"
        
        goal_context = f" for **{goal_title}**" if goal_title else ""
        
        return {
            "action": "CREATE_MULTIPLE_TASKS",
            "action_id": action_id,
            "requires_confirmation": True,
            "data": {"tasks": tasks, "count": len(tasks)},
            "message": f"I've prepared a roadmap{goal_context} with {len(tasks)} tasks:\n\n{task_list}\n\nWould you like me to add all of these?",
            "confirm_buttons": ["Add all tasks", "Let me review each", "Cancel"],
        }
    
    async def request_complete_task(
        self,
        user_id: str,
        task_id: str,
        task_title: str
    ) -> Dict[str, Any]:
        """
        Request to mark a task as complete.
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": ActionType.COMPLETE_TASK.value,
            "status": ActionStatus.PENDING.value,
            "data": {"task_id": task_id, "task_title": task_title},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        return {
            "action": ActionType.COMPLETE_TASK.value,
            "action_id": action_id,
            "requires_confirmation": True,
            "data": {"task_id": task_id},
            "message": f"Shall I mark **{task_title}** as completed? ✅",
            "confirm_buttons": ["Yes, complete it!", "No, not yet"],
        }
    
    async def request_reschedule_task(
        self,
        user_id: str,
        task_id: str,
        task_title: str,
        new_time: str
    ) -> Dict[str, Any]:
        """
        Request to reschedule a task.
        """
        action_id = str(uuid.uuid4())
        
        pending_action = {
            "action_id": action_id,
            "user_id": user_id,
            "action_type": ActionType.RESCHEDULE_TASK.value,
            "status": ActionStatus.PENDING.value,
            "data": {"task_id": task_id, "task_title": task_title, "new_time": new_time},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        
        PENDING_ACTIONS[action_id] = pending_action
        
        return {
            "action": ActionType.RESCHEDULE_TASK.value,
            "action_id": action_id,
            "requires_confirmation": True,
            "data": {"task_id": task_id, "new_time": new_time},
            "message": f"I suggest rescheduling **{task_title}** to {new_time}. Does that work for you?",
            "confirm_buttons": ["Yes, change time", "No, keep original"],
        }
    
    # ══════════════════════════════════════════════════════════════════════════
    # ACTION EXECUTION (After user confirmation)
    # ══════════════════════════════════════════════════════════════════════════
    
    async def confirm_action(
        self,
        action_id: str,
        user_id: str,
        plan_tier: str = "unknown",
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a pending action after user confirmation.
        """
        if action_id not in PENDING_ACTIONS:
            return {"status": "error", "message": "Action not found or expired"}
        
        action = PENDING_ACTIONS[action_id]
        
        # Verify user ownership
        if action["user_id"] != user_id:
            return {"status": "error", "message": "Unauthorized"}
        
        # Check expiration
        expires_at = datetime.fromisoformat(action["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            action["status"] = ActionStatus.EXPIRED.value
            return {"status": "error", "message": "Action expired. Please try again."}
        
        # Execute based on action type
        try:
            logger.info(f"⚡ Executing confirmed action: {action['action_type']} (ID: {action_id})")
            result = await self._execute_action(
                action,
                plan_tier=plan_tier,
                request_id=request_id or action_id,
            )
            action["status"] = ActionStatus.EXECUTED.value
            
            # Clean up
            del PENDING_ACTIONS[action_id]
            
            logger.info(f"✅ Action executed successfully: {action['action_type']}")
            
            return {
                "status": "success",
                "action_type": action["action_type"],
                "result": result,
                "message": f"✅ Done! {self._get_success_message(action['action_type'], result)}",
            }
            
        except Exception as e:
            logger.error(f"Action execution failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def reject_action(
        self,
        action_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Reject a pending action.
        """
        if action_id not in PENDING_ACTIONS:
            return {"status": "error", "message": "Action not found"}
        
        action = PENDING_ACTIONS[action_id]
        
        if action["user_id"] != user_id:
            return {"status": "error", "message": "Unauthorized"}
        
        action["status"] = ActionStatus.REJECTED.value
        del PENDING_ACTIONS[action_id]
        
        return {
            "status": "rejected",
            "message": "No problem! Let me know if you change your mind.",
        }
    
    async def get_pending_actions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all pending actions for a user.
        """
        user_actions = [
            action for action in PENDING_ACTIONS.values()
            if action["user_id"] == user_id and action["status"] == ActionStatus.PENDING.value
        ]
        
        # Clean up expired actions
        now = datetime.now(timezone.utc)
        for action in user_actions:
            if datetime.fromisoformat(action["expires_at"]) < now:
                action["status"] = ActionStatus.EXPIRED.value
        
        return [a for a in user_actions if a["status"] == ActionStatus.PENDING.value]
    
    async def _execute_action(
        self,
        action: Dict[str, Any],
        plan_tier: str = "unknown",
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute the actual action based on type.
        """
        action_type = action["action_type"]
        user_id = action["user_id"]
        data = action["data"]
        
        if action_type == ActionType.CREATE_GOAL.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=planner_service.create_goal,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == ActionType.CREATE_TASK.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=planner_service.create_task,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == ActionType.CREATE_HABIT.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=planner_service.create_habit,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == ActionType.COMPLETE_TASK.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload={"task_id": data["task_id"]},
                tool_callable=self._complete_task_by_payload,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == ActionType.RESCHEDULE_TASK.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload={"task_id": data["task_id"], "new_time": data["new_time"]},
                tool_callable=self._reschedule_task_by_payload,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == "CREATE_MULTIPLE_TASKS":
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=self._create_multiple_tasks,
                plan_tier=plan_tier,
                request_id=request_id,
            )
        
        elif action_type == ActionType.UPDATE_GOAL.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=planner_service.update_goal_details,
                plan_tier=plan_tier,
                request_id=request_id,
            )
            
        elif action_type == ActionType.UPDATE_TASK.value:
            from pydantic import BaseModel
            from datetime import datetime
            import dateutil.parser

            class TaskUpdate(BaseModel):
                title: Optional[str] = None
                priority: Optional[str] = None
                status: Optional[str] = None
                description: Optional[str] = None
                due_date: Optional[datetime] = None
                estimated_duration_minutes: Optional[int] = None
                
            updates = {}
            if "title" in data: updates["title"] = data["title"]
            if "priority" in data: updates["priority"] = data["priority"]
            if "status" in data: updates["status"] = data["status"]
            if "description" in data: updates["description"] = data["description"]
            if "due_date" in data and data["due_date"]:
                try:
                    updates["due_date"] = dateutil.parser.isoparse(data["due_date"])
                except Exception:
                    pass
            if "duration_minutes" in data: updates["estimated_duration_minutes"] = data["duration_minutes"]

            model_update = TaskUpdate(**updates)
            
            async def update_task_wrapper(uid, pd):
                return await planner_service.update_task(uid, data["task_id"], model_update)
                
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=update_task_wrapper,
                plan_tier=plan_tier,
                request_id=request_id,
            )
            
        elif action_type == ActionType.UPDATE_HABIT.value:
            async def update_habit_wrapper(uid, pd):
                from backend.db.models import Habit
                from sqlalchemy.future import select
                from backend.db.database import AsyncSessionLocal
                try:
                    habit_id_int = int(data["habit_id"])
                    user_id_int = int(uid)
                except ValueError:
                     return {"success": False, "error": "Invalid IDs"}

                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(Habit).where(Habit.id == habit_id_int, Habit.user_id == user_id_int))
                    habit = result.scalar_one_or_none()
                    if not habit:
                        return {"success": False, "error": "Habit not found."}
                    
                    if "name" in data: habit.name = data["name"]
                    if "description" in data: habit.description = data["description"]
                    if "frequency" in data: habit.frequency = data["frequency"]
                    await db.commit()
                return {"success": True}

            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=update_habit_wrapper,
                plan_tier=plan_tier,
                request_id=request_id,
            )
            
        elif action_type == ActionType.SCHEDULE_DEEP_WORK.value:
            return await self.execute_tool(
                tool_name=action_type,
                user_id=user_id,
                payload=data,
                tool_callable=planner_service.schedule_deep_work,
                plan_tier=plan_tier,
                request_id=request_id,
            )
            
        else:
            raise ValueError(f"Unknown action type: {action_type}")
    
    def _get_success_message(self, action_type: str, result: Dict[str, Any]) -> str:
        """Generate success message based on action type."""
        messages = {
            ActionType.CREATE_GOAL.value: f"Goal '{result.get('title', 'New Goal')}' has been created!",
            ActionType.UPDATE_GOAL.value: "Goal has been updated!",
            ActionType.CREATE_TASK.value: f"Task added to your planner!",
            ActionType.UPDATE_TASK.value: "Task has been updated!",
            ActionType.CREATE_HABIT.value: f"Habit '{result.get('name', 'New Habit')}' is now being tracked!",
            ActionType.UPDATE_HABIT.value: "Habit has been updated!",
            ActionType.COMPLETE_TASK.value: "Task marked as complete! Great job! 🎉",
            ActionType.RESCHEDULE_TASK.value: "Task rescheduled successfully!",
            ActionType.SCHEDULE_DEEP_WORK.value: "Recurring deep work schedule has been saved!",
            "CREATE_MULTIPLE_TASKS": f"Created {result.get('created_count', 0)} tasks for your roadmap!",
        }
        return messages.get(action_type, "Action completed successfully!")
    
    # ══════════════════════════════════════════════════════════════════════════
    # GOAL-BASED AI SUGGESTIONS
    # ══════════════════════════════════════════════════════════════════════════
    
    async def generate_goal_based_suggestions(
        self,
        user_id: str,
        goal_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate intelligent suggestions for a specific goal.
        """
        goals = context.get("goals", {}).get("list", [])
        goal = next((g for g in goals if str(g["id"]) == str(goal_id)), None)
        
        if not goal:
            return {"suggestions": [], "message": "Goal not found"}
        
        suggestions = []
        
        # Check if goal needs more tasks
        if goal["linked_tasks_count"] < 3:
            suggestions.append({
                "type": "ADD_TASKS",
                "message": f"Your goal '{goal['title']}' only has {goal['linked_tasks_count']} tasks. Consider breaking it down further.",
                "can_auto_generate": True,
            })
        
        # Check if goal is at risk
        if goal["status"] == "at_risk":
            suggestions.append({
                "type": "PRIORITY_BOOST",
                "message": f"Goal '{goal['title']}' is falling behind. Consider prioritizing related tasks.",
                "urgency": "high",
            })
        
        # Suggest habits if none linked
        habits = context.get("habits", {}).get("list", [])
        linked_habits = [h for h in habits if h.get("goal_link") == goal_id]
        
        if not linked_habits:
            suggestions.append({
                "type": "ADD_HABIT",
                "message": f"Adding a daily habit could accelerate progress on '{goal['title']}'.",
                "can_confirm": True,
            })
        
        return {
            "goal": goal,
            "suggestions": suggestions,
            "message": f"Here's my analysis for '{goal['title']}':",
        }


# Singleton instance
ai_agent_actions = AIAgentActions()
