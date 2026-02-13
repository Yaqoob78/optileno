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

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid
import logging

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service

logger = logging.getLogger(__name__)


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
    CREATE_PLAN = "CREATE_PLAN"


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
    
    # ══════════════════════════════════════════════════════════════════════════
    # ACTION EXECUTION (After user confirmation)
    # ══════════════════════════════════════════════════════════════════════════
    
    async def confirm_action(
        self,
        action_id: str,
        user_id: str
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
            result = await self._execute_action(action)
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
    
    async def _execute_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the actual action based on type.
        """
        action_type = action["action_type"]
        user_id = action["user_id"]
        data = action["data"]
        
        if action_type == ActionType.CREATE_GOAL.value:
            return await planner_service.create_goal(user_id, data)
        
        elif action_type == ActionType.CREATE_TASK.value:
            return await planner_service.create_task(user_id, data)
        
        elif action_type == ActionType.CREATE_HABIT.value:
            return await planner_service.create_habit(user_id, data)
        
        elif action_type == ActionType.COMPLETE_TASK.value:
            return await planner_service.complete_task(user_id, data["task_id"])
        
        elif action_type == "CREATE_MULTIPLE_TASKS":
            results = []
            for task_data in data["tasks"]:
                result = await planner_service.create_task(user_id, task_data)
                results.append(result)
            return {"created_count": len(results), "tasks": results}
        
        else:
            raise ValueError(f"Unknown action type: {action_type}")
    
    def _get_success_message(self, action_type: str, result: Dict[str, Any]) -> str:
        """Generate success message based on action type."""
        messages = {
            ActionType.CREATE_GOAL.value: f"Goal '{result.get('title', 'New Goal')}' has been created!",
            ActionType.CREATE_TASK.value: f"Task added to your planner!",
            ActionType.CREATE_HABIT.value: f"Habit '{result.get('name', 'New Habit')}' is now being tracked!",
            ActionType.COMPLETE_TASK.value: "Task marked as complete! Great job! 🎉",
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
