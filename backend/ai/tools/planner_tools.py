"""
AI Planner Tools - Full integration with user's goals, tasks, and habits.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.services.goal_analytics_service import goal_analytics_service

logger = logging.getLogger(__name__)


class PlannerToolSet:
    """Tools for AI to manage planner components"""

    @staticmethod
    async def create_task(
        user_id: str,
        title: str,
        priority: str = "medium",
        description: str = "",
        duration_minutes: int = 60,
        category: str = "work",
        tags: List[str] = None,
        goal_link: Optional[str] = None,
        scheduled_time: Optional[str] = None  # e.g. "morning", "5pm", "tomorrow 10am"
    ) -> Dict[str, Any]:
        """Create a task in the planner"""
        
        # 1. Parse Time
        due_date = None
        if scheduled_time:
            now = datetime.now()
            today = now.date()
            time_lower = scheduled_time.lower().strip()
            
            target_time = None
            target_date = today

            # Handle tomorrow
            if "tomorrow" in time_lower:
                target_date = today + timedelta(days=1)
                time_lower = time_lower.replace("tomorrow", "").strip()

            # Time Logic
            if "morning" in time_lower:
                target_time = datetime.strptime("09:00", "%H:%M").time()
            elif "afternoon" in time_lower:
                target_time = datetime.strptime("14:00", "%H:%M").time()
            elif "evening" in time_lower:
                target_time = datetime.strptime("18:00", "%H:%M").time()
            elif "tonight" in time_lower:
                target_time = datetime.strptime("20:00", "%H:%M").time()
            elif ":" in time_lower:
                try:
                    # Check for am/pm
                    fmt = "%H:%M"
                    if "am" in time_lower or "pm" in time_lower:
                        fmt = "%I:%M%p"
                        time_lower = time_lower.replace(" ", "") # remove space before am/pm
                    target_time = datetime.strptime(time_lower, fmt).time()
                except:
                    pass
            else:
                 # Try simple integer hour
                try:
                    hour_str = ''.join(filter(str.isdigit, time_lower))
                    if hour_str:
                        hour = int(hour_str)
                        if "pm" in time_lower and hour < 12:
                            hour += 12
                        elif "am" in time_lower and hour == 12:
                            hour = 0
                        # Heuristic: 1-6 usually means PM unless specified AM
                        elif hour <= 6 and "am" not in time_lower:
                            hour += 12
                            
                        target_time = datetime.strptime(f"{hour}:00", "%H:%M").time()
                except:
                    pass

            if target_time:
                due_date = datetime.combine(target_date, target_time)
            elif "today" not in time_lower and "tomorrow" not in time_lower:
                 # If no time found but date implies logic, default to 9am? No, let's skip.
                 pass

        # 2. Resolve Goal ID
        goal_id = None
        goal_match = None
        if goal_link:
            user_goals = await planner_service.get_user_goals(user_id)
            # Try exact match ID
            goal_match = next((g for g in user_goals if str(g['id']) == str(goal_link)), None)
            if not goal_match:
                # Try name match (fuzzy)
                goal_link_clean = goal_link.lower().strip()
                goal_match = next((g for g in user_goals if g['title'].lower().strip() == goal_link_clean), None)
            
            if goal_match:
                goal_id = goal_match['id']
                # If category missing, inherit from Goal
                if category == "work" and goal_match.get('category'):
                     category = goal_match['category']

        task_data = {
            'title': title,
            'description': description,
            'priority': priority,
            'status': 'pending',
            'estimated_duration_minutes': duration_minutes,
            'category': category,
            'tags': tags or [],
            'goal_link': goal_link,
            'goal_id': goal_id,
            'due_date': due_date.isoformat() if due_date else None
        }
        
        result = await planner_service.create_task(user_id, task_data)

        if result.get("error"):
             logger.error(f"Failed to create task: {result['error']}")
             raise Exception(f"Failed to create task: {result['error']}")

        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "task_created",
            "source": "ai_agent",
            "metadata": {
                "task_title": title,
                "priority": priority,
                "category": category,
                "estimated_duration": duration_minutes,
                "has_due_date": due_date is not None,
                "linked_goal": goal_id
            }
        })

        return {
            "id": result.get('id', 'unknown'),
            "title": title,
            "priority": priority,
            "status": "pending",
            "due_date": due_date.strftime("%I:%M %p") if due_date else None,
            "linked_goal": goal_match['title'] if goal_id and goal_match else None,
            "message": f"Task '{title}' created successfully" + (f" for {due_date.strftime('%I:%M %p')}" if due_date else "") + (f" linked to '{goal_match['title']}'" if goal_id else "")
        }

    @staticmethod
    async def create_goal(
        user_id: str,
        title: str,
        description: str = "",
        target_date: str = None,
        milestones: List[str] = None,
        category: str = "Personal"
    ) -> Dict[str, Any]:
        """Create a goal in the planner"""
        goal_data = {
            'title': title,
            'description': description,
            'target_date': target_date,
            'milestones': milestones or [],
            'category': category
        }
        
        result = await planner_service.create_goal(user_id, goal_data)
        
        if result.get("error"):
             logger.error(f"Failed to create goal: {result['error']}")
             raise Exception(f"Failed to create goal: {result['error']}")

        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "goal_created",
            "source": "ai_agent",
            "metadata": {
                "goal_title": title,
                "category": category,
                "target_date": target_date
            }
        })

        return {
            "id": result.get('id', 'unknown'),
            "title": title,
            "category": category,
            "target_date": target_date,
            "message": f"Goal '{title}' created successfully"
        }

    @staticmethod
    async def create_goal_with_cascade(
        user_id: str,
        title: str,
        description: str = "",
        category: str = "personal",
        timeframe: str = "month",
        complexity: str = "medium",
        target_date: str = None,
        auto_create_tasks: bool = True,
        auto_create_habits: bool = False,
        propose_deep_work: bool = True
    ) -> Dict[str, Any]:
        """
        Create a goal with AI-generated cascade of tasks and habits.
        Use this when the user asks for a full plan or agrees to automatic generation.
        """
        from backend.ai.tools.goal_automation import create_goal_with_cascade
        
        payload = {
            "title": title,
            "description": description,
            "category": category,
            "timeframe": timeframe,
            "complexity": complexity,
            "auto_create_tasks": auto_create_tasks,
            "auto_create_habits": auto_create_habits,
            "propose_deep_work": propose_deep_work,
            "target_date": target_date
        }
        
        result = await create_goal_with_cascade(user_id, payload)
        
        # goal_automation usually returns strict typed dicts, maybe check status?
        if result.get("status") == "error":
             raise Exception(result.get("message", "Unknown error in goal cascade"))
        
        return result

    @staticmethod
    async def create_habit(
        user_id: str,
        title: str,
        description: str = "",
        category: str = "Wellness",
        frequency: str = "daily",
        goal_link: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a habit in the planner"""
        habit_data = {
            'title': title,  # Changed from 'name' to 'title' to match API
            'description': description,
            'frequency': frequency,
            'category': category,
            'goal_link': goal_link  # Store goal_link in schedule, not as direct goal_id
        }
        
        result = await planner_service.create_habit(user_id, habit_data)
        
        if result.get("error"):
             logger.error(f"Failed to create habit: {result['error']}")
             raise Exception(f"Failed to create habit: {result['error']}")
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "habit_created",
            "source": "ai_agent",
            "metadata": {
                "habit_name": title,
                "frequency": frequency,
                "category": category
            }
        })
        
        return {
            "id": result.get('id', 'unknown'),
            "title": title,  # Changed from 'name' to 'title'
            "frequency": frequency,
            "category": category,
            "message": f"Habit '{title}' created successfully"
        }

    @staticmethod
    async def delete_task(
        user_id: str,
        task_id: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete a task by id or title (case-insensitive)."""
        if not task_id and title:
            tasks = await planner_service.get_tasks(user_id)
            match = next(
                (t for t in tasks if getattr(t, "title", "").lower() == title.lower()),
                None
            )
            task_id = str(match.id) if match else None

        if not task_id:
            return {"success": False, "error": "Task not found"}

        success = await planner_service.delete_task(user_id, task_id)
        if success:
            await analytics_service.save_event({
                "user_id": int(user_id),
                "event": "task_deleted",
                "source": "ai_agent",
                "metadata": {"task_id": task_id}
            })
            return {"success": True, "task_id": task_id}
        return {"success": False, "error": "Failed to delete task"}

    @staticmethod
    async def delete_goal(
        user_id: str,
        goal_id: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete a goal by id or title (case-insensitive)."""
        if not goal_id and title:
            goals = await planner_service.get_user_goals(user_id)
            match = next(
                (g for g in goals if str(g.get("title", "")).lower() == title.lower()),
                None
            )
            goal_id = str(match.get("id")) if match else None

        if not goal_id:
            return {"success": False, "error": "Goal not found"}

        success = await planner_service.delete_goal(user_id, goal_id)
        if success:
            await analytics_service.save_event({
                "user_id": int(user_id),
                "event": "goal_deleted",
                "source": "ai_agent",
                "metadata": {"goal_id": goal_id}
            })
            return {"success": True, "goal_id": goal_id}
        return {"success": False, "error": "Failed to delete goal"}

    @staticmethod
    async def delete_habit(
        user_id: str,
        habit_id: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete a habit by id or name/title (case-insensitive)."""
        if not habit_id and title:
            habits = await planner_service.get_user_habits(user_id)
            match = next(
                (h for h in habits if str(h.get("name", "")).lower() == title.lower()),
                None
            )
            habit_id = str(match.get("id")) if match else None

        if not habit_id:
            return {"success": False, "error": "Habit not found"}

        success = await planner_service.delete_habit(user_id, habit_id)
        if success:
            await analytics_service.save_event({
                "user_id": int(user_id),
                "event": "habit_deleted",
                "source": "ai_agent",
                "metadata": {"habit_id": habit_id}
            })
            return {"success": True, "habit_id": habit_id}
        return {"success": False, "error": "Failed to delete habit"}

    @staticmethod
    async def update_task_status(
        user_id: str,
        task_id: str,
        status: str
    ) -> Dict[str, Any]:
        """Update task status"""
        from pydantic import BaseModel
        
        class TaskUpdate(BaseModel):
            status: str
        
        updates = TaskUpdate(status=status)
        result = await planner_service.update_task(user_id, task_id, updates)
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": f"task_{status}",
            "source": "ai_agent",
            "metadata": {
                "task_id": task_id,
                "new_status": status
            }
        })
        
        return {
            "task_id": task_id,
            "status": status,
            "message": f"Task {task_id} status updated to {status}"
        }

    @staticmethod
    async def update_goal_progress(
        user_id: str,
        goal_id: str,
        progress: int
    ) -> Dict[str, Any]:
        """Update goal progress"""
        success = await planner_service.update_goal_progress(user_id, goal_id, progress)
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "goal_progress_updated",
            "source": "ai_agent",
            "metadata": {
                "goal_id": goal_id,
                "new_progress": progress
            }
        })
        
        return {
            "goal_id": goal_id,
            "progress": progress,
            "success": success,
            "message": f"Goal {goal_id} progress updated to {progress}%"
        }

    @staticmethod
    async def complete_habit(
        user_id: str,
        habit_id: str
    ) -> Dict[str, Any]:
        """Mark habit as completed today"""
        result = await planner_service.track_habit(user_id, habit_id)
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "habit_completed",
            "source": "ai_agent",
            "metadata": {
                "habit_id": habit_id,
                "streak": result.get('streak', 0)
            }
        })
        
        return {
            "habit_id": habit_id,
            "streak": result.get('streak', 0),
            "message": f"Habit completed, streak: {result.get('streak', 0)}"
        }

    @staticmethod
    async def get_planner_stats(user_id: str) -> Dict[str, Any]:
        """Get planner statistics"""
        return await planner_service.get_user_goals(user_id)

    @staticmethod
    async def get_tasks(user_id: str) -> List[Dict[str, Any]]:
        """Get all tasks for user"""
        tasks = await planner_service.get_tasks(user_id)
        return [
            {
                "id": str(getattr(task, "id", "")),
                "title": getattr(task, "title", ""),
                "status": getattr(task, "status", "pending"),
                "priority": getattr(task, "priority", "medium"),
                "due_date": getattr(task, "due_date", None).isoformat() if getattr(task, "due_date", None) else None,
                "category": getattr(task, "category", "")
            }
            for task in tasks
        ]

    @staticmethod
    async def get_goals(user_id: str) -> List[Dict[str, Any]]:
        """Get all goals for user"""
        goals = await planner_service.get_user_goals(user_id)
        return goals

    @staticmethod
    async def get_habits(user_id: str) -> List[Dict[str, Any]]:
        """Get all habits for user"""
        habits = await planner_service.get_user_habits(user_id)
        return habits

    @staticmethod
    async def start_deep_work_session(
        user_id: str,
        duration_minutes: int = 25,
        focus_goal: str = "Focus on priority tasks"
    ) -> Dict[str, Any]:
        """Start a deep work session"""
        result = await planner_service.start_deep_work_session(user_id, duration_minutes)
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "deep_work_started",
            "source": "ai_agent",
            "metadata": {
                "duration_minutes": duration_minutes,
                "focus_goal": focus_goal
            }
        })
        
        return {
            "session_id": result.get('id', 'unknown'),
            "duration": duration_minutes,
            "focus_goal": focus_goal,
            "message": f"Deep work session started for {duration_minutes} minutes"
        }

    @staticmethod
    async def get_daily_achievement_score(user_id: str) -> Dict[str, Any]:
        """Get daily achievement score with breakdown"""
        return await goal_analytics_service.get_daily_achievement_score(user_id)

    @staticmethod
    async def get_goal_progress_report(user_id: str, goal_id: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive goal progress report"""
        return await goal_analytics_service.get_goal_progress_report(user_id, goal_id)

    @staticmethod
    async def get_goal_timeline(user_id: str) -> List[Dict[str, Any]]:
        """Get goal timeline for visualization"""
        return await planner_service.get_goal_timeline(user_id)
