"""
AI Planner Tools - Full integration with user's goals, tasks, and habits.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
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
        scheduled_time: Optional[str] = None,
        recurring: bool = False,
        recurrence_config: Optional[dict] = None,
        subtasks: Optional[list] = None,
        depends_on_task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a task in the planner"""
        
        # 1. Handle AI Hallucination/Tool Calling Error where all args are passed to title
        if isinstance(title, dict):
            args = title
            title = args.get("title", "New Task")
            # Override other args if they are present in the dict and were defaults in function signature
            if "priority" in args: priority = args["priority"]
            if "description" in args: description = args["description"]
            if "duration_minutes" in args: duration_minutes = args["duration_minutes"]
            if "category" in args: category = args["category"]
            if "tags" in args: tags = args["tags"]
            if "goal_link" in args: goal_link = args["goal_link"]
            if "scheduled_time" in args: scheduled_time = args["scheduled_time"]
            
        # 2. Parse Time
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
            'due_date': due_date.isoformat() if due_date else None,
        'recurring': recurring,
        'recurrence_config': recurrence_config,
        'subtasks': subtasks,
        'depends_on_task_id': depends_on_task_id
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
        
        # Handle AI Hallucination: title is actually the args dict
        if isinstance(title, dict):
            args = title
            title = args.get("title", "New Goal")
            description = args.get("description", description)
            category = args.get("category", category)
            target_date = args.get("target_date", target_date)
            milestones = args.get("milestones", milestones)

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
        auto_create_habits: bool = True,
        propose_deep_work: bool = True,
        preferred_task_time: str = None,
        preferred_deep_work_time: str = None,
        create_new_goal: bool = True,
        existing_goal_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a goal with AI-generated cascade of tasks and habits.
        Use this when the user asks for a full plan or agrees to automatic generation.
        """
        # Handle AI Hallucination
        if isinstance(title, dict):
             args = title
             title = args.get("title", "New Goal")
             description = args.get("description", description)
             category = args.get("category", category)
             timeframe = args.get("timeframe", timeframe)
             complexity = args.get("complexity", complexity)
             target_date = args.get("target_date", target_date)
             auto_create_tasks = args.get("auto_create_tasks", auto_create_tasks)
             auto_create_habits = args.get("auto_create_habits", auto_create_habits)
             propose_deep_work = args.get("propose_deep_work", propose_deep_work)
             preferred_task_time = args.get("preferred_task_time", preferred_task_time)
             preferred_deep_work_time = args.get("preferred_deep_work_time", preferred_deep_work_time)
             create_new_goal = args.get("create_new_goal", create_new_goal)
             existing_goal_id = args.get("existing_goal_id", existing_goal_id)
              
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
            "target_date": target_date,
            "preferred_task_time": preferred_task_time,
            "preferred_deep_work_time": preferred_deep_work_time,
            "create_new_goal": bool(create_new_goal),
            "existing_goal_id": existing_goal_id,
        }
        
        result = await create_goal_with_cascade(user_id, payload)
        
        # goal_automation usually returns strict typed dicts, maybe check status?
        if result.get("status") == "error":
             raise Exception(result.get("message", "Unknown error in goal cascade"))
        
        return result

    @staticmethod
    async def breakdown_goal(
        user_id: str,
        goal_link: str,
        auto_create_tasks: bool = True,
        auto_create_habits: bool = True,
        propose_deep_work: bool = True,
        preferred_task_time: Optional[str] = None,
        preferred_deep_work_time: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Break down an EXISTING goal into tasks/habits/deep-work.
        Used for chat-driven breakdown after user manually adds a goal.
        """
        if isinstance(goal_link, dict):
            args = goal_link
            goal_link = str(args.get("goal_link", "")).strip()
            auto_create_tasks = args.get("auto_create_tasks", auto_create_tasks)
            auto_create_habits = args.get("auto_create_habits", auto_create_habits)
            propose_deep_work = args.get("propose_deep_work", propose_deep_work)
            preferred_task_time = args.get("preferred_task_time", preferred_task_time)
            preferred_deep_work_time = args.get("preferred_deep_work_time", preferred_deep_work_time)

        if not goal_link:
            raise Exception("goal_link is required to break down an existing goal.")

        user_goals = await planner_service.get_user_goals(user_id)
        goal_match = next((g for g in user_goals if str(g.get("id")) == str(goal_link)), None)
        if not goal_match:
            goal_link_clean = str(goal_link).lower().strip()
            goal_match = next(
                (g for g in user_goals if str(g.get("title", "")).lower().strip() == goal_link_clean),
                None,
            )

        if not goal_match:
            raise Exception(f"Goal '{goal_link}' not found.")

        from backend.ai.tools.goal_automation import create_goal_with_cascade

        payload = {
            "title": goal_match.get("title", "Existing Goal"),
            "description": goal_match.get("description", "") or "",
            "category": goal_match.get("category", "personal") or "personal",
            "target_date": goal_match.get("target_date"),
            "create_new_goal": False,
            "existing_goal_id": str(goal_match.get("id")),
            "auto_create_tasks": bool(auto_create_tasks),
            "auto_create_habits": bool(auto_create_habits),
            "propose_deep_work": bool(propose_deep_work),
            "preferred_task_time": preferred_task_time,
            "preferred_deep_work_time": preferred_deep_work_time,
        }

        result = await create_goal_with_cascade(user_id, payload)
        if result.get("status") == "error":
            raise Exception(result.get("message", "Unknown error while breaking down goal"))
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
        
        # Handle AI Hallucination
        if isinstance(title, dict):
            args = title
            title = args.get("title", "New Habit")
            if not title and "name" in args: title = args["name"]
            description = args.get("description", description)
            frequency = args.get("frequency", frequency)
            category = args.get("category", category)
            goal_link = args.get("goal_link", goal_link)

        goal_id = None
        if goal_link:
            user_goals = await planner_service.get_user_goals(user_id)
            goal_match = next((g for g in user_goals if str(g.get("id")) == str(goal_link)), None)
            if not goal_match:
                goal_link_clean = goal_link.lower().strip()
                goal_match = next(
                    (g for g in user_goals if str(g.get("title", "")).lower().strip() == goal_link_clean),
                    None,
                )
            if goal_match:
                goal_id = goal_match.get("id")

        habit_data = {
            'title': title,  # Changed from 'name' to 'title' to match API
            'description': description,
            'frequency': frequency,
            'category': category,
            'goal_link': goal_link,
            'goal_id': goal_id,
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
    async def create_deep_work_session(
        user_id: str,
        duration_minutes: int = 25,
        focus_goal: str = "Focus on priority tasks",
        scheduled_start: Optional[str] = None
    ) -> Dict[str, Any]:
        """Prepare a deep work session (does NOT start the timer)"""
        
        status = "scheduled" if scheduled_start else "pending"
        
        from datetime import datetime
        import dateutil.parser
        
        dt = datetime.now(timezone.utc)
        if scheduled_start:
            try:
                dt = dateutil.parser.isoparse(scheduled_start)
            except Exception:
                pass
                
        payload = {
            "planned_duration_minutes": duration_minutes,
            "focus_goal": focus_goal,
            "notes": None,
            "status": status,
        }
        if scheduled_start:
            payload["scheduled_local_time"] = scheduled_start
            
        plan_data = {
            "name": "Deep Work Session",
            "description": focus_goal,
            "plan_type": "deep_work",
            "date": dt,
            "duration_hours": duration_minutes / 60.0,
            "schedule": payload
        }
        
        result = await planner_service.create_plan(user_id, plan_data)
             
        # Log analytics event
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "deep_work_prepared",
            "source": "ai_agent",
            "metadata": {
                "duration_minutes": duration_minutes,
                "focus_goal": focus_goal,
                "status": status
            }
        })
        
        return {
            "session_id": result.get('id', 'unknown') if result else 'unknown',
            "duration": duration_minutes,
            "focus_goal": focus_goal,
            "status": status,
            "message": f"Deep work session prepared for {duration_minutes} minutes"
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

    @staticmethod
    async def update_task(
        user_id: str,
        task_id: str,
        title: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        description: Optional[str] = None,
        due_date: Optional[str] = None,
        duration_minutes: Optional[int] = None,
        subtasks: Optional[list] = None,
        depends_on_task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update a task's details."""
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
            subtasks: Optional[list] = None
            depends_on_task_id: Optional[str] = None

        updates = {}
        if title is not None: updates["title"] = title
        if priority is not None: updates["priority"] = priority
        if status is not None: updates["status"] = status
        if description is not None: updates["description"] = description
        if due_date is not None:
            try:
                updates["due_date"] = dateutil.parser.isoparse(due_date)
            except Exception:
                pass
        if duration_minutes is not None: updates["estimated_duration_minutes"] = duration_minutes
        if subtasks is not None: updates["subtasks"] = subtasks
        if depends_on_task_id is not None: updates["depends_on_task_id"] = depends_on_task_id

        if not updates:
            return {"success": False, "error": "No valid updates provided."}

        model_update = TaskUpdate(**updates)
        result = await planner_service.update_task(user_id, task_id, model_update)
        
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "task_updated",
            "source": "ai_agent",
            "metadata": {"task_id": task_id, "updated_fields": list(updates.keys())}
        })
        return {"success": True, "task_id": task_id, "message": f"Task updated."}

    @staticmethod
    async def update_goal(
        user_id: str,
        goal_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        target_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update a goal."""
        updates = {}
        if title is not None: updates["title"] = title
        if description is not None: updates["description"] = description
        if status is not None: updates["status"] = status
        if target_date is not None: updates["target_date"] = target_date

        if not updates:
            return {"success": False, "error": "No valid updates provided."}

        success = await planner_service.update_goal_details(user_id, goal_id, updates)
        if success:
            await analytics_service.save_event({
                "user_id": int(user_id),
                "event": "goal_updated",
                "source": "ai_agent",
                "metadata": {"goal_id": goal_id, "updated_fields": list(updates.keys())}
            })
            return {"success": True, "goal_id": goal_id, "message": f"Goal updated."}
        return {"success": False, "error": "Failed to update goal."}

    @staticmethod
    async def update_habit(
        user_id: str,
        habit_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        frequency: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update a habit."""
        updates = {}
        if name is not None: updates["name"] = name
        if description is not None: updates["description"] = description
        if frequency is not None: updates["frequency"] = frequency

        if not updates:
            return {"success": False, "error": "No valid updates provided."}

        from backend.db.models import Habit
        from sqlalchemy.future import select
        from backend.db.database import AsyncSessionLocal
        
        try:
            habit_id_int = int(habit_id)
            user_id_int = int(user_id)
        except ValueError:
             return {"success": False, "error": "Invalid IDs"}

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Habit).where(Habit.id == habit_id_int, Habit.user_id == user_id_int))
            habit = result.scalar_one_or_none()
            if not habit:
                return {"success": False, "error": "Habit not found."}
            
            for k, v in updates.items():
                setattr(habit, k, v)
            await db.commit()

        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": "habit_updated",
            "source": "ai_agent",
            "metadata": {"habit_id": habit_id, "updated_fields": list(updates.keys())}
        })
        return {"success": True, "habit_id": habit_id, "message": f"Habit updated."}

    @staticmethod
    async def schedule_deep_work(
        user_id: str,
        start_time: str,
        duration_minutes: int,
        days_of_week: List[int],
        timezone: str,
        focus_goal: Optional[str] = None,
        recurring: bool = False,
    ) -> Dict[str, Any]:
        """Schedule a deep work session. Set recurring=True for weekly auto-renewal."""
        from backend.schemas.planner import DeepWorkScheduleCreate
        try:
            payload = DeepWorkScheduleCreate(
                start_time=start_time,
                duration_minutes=duration_minutes,
                days_of_week=days_of_week,
                timezone=timezone,
                focus_goal=focus_goal,
                recurring=recurring,
            )
        except Exception as e:
            return {"success": False, "error": str(e)}

        result = await planner_service.schedule_deep_work(user_id, payload.dict())
        
        event_type = "deep_work_scheduled_recurring" if recurring else "deep_work_scheduled"
        await analytics_service.save_event({
            "user_id": int(user_id),
            "event": event_type,
            "source": "ai_agent",
            "metadata": {"duration_minutes": duration_minutes, "days_of_week": days_of_week, "recurring": recurring}
        })
        mode_label = "recurring" if recurring else "one-time"
        return {"success": True, "message": f"Scheduled {mode_label} deep work at {start_time} for {duration_minutes}m."}

