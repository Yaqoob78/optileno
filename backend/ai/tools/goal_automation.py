# backend/ai/tools/goal_automation.py
"""
AI Goal Automation Pipeline.

This module handles the complete AI-driven planning automation:
1. Goal detection from chat conversations
2. Automatic task generation from goals
3. Habit recommendations based on goal category
4. Deep work block scheduling for complex goals
5. Dashboard aggregation and real-time updates
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import logging

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.realtime.socket_manager import (
    broadcast_task_created,
    broadcast_plan_generated,
    broadcast_deep_work_started,
)

logger = logging.getLogger(__name__)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CONSTANTS & TEMPLATES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

RECOMMENDED_HABITS = {
    "learning": [
        {"name": "Daily Review", "description": "Review what you learned today", "frequency": "daily"},
        {"name": "Practice Session", "description": "Hands-on practice", "frequency": "daily"},
        {"name": "Read 30 mins", "description": "Read related material", "frequency": "daily"},
    ],
    "fitness": [
        {"name": "Morning Exercise", "description": "Start day with movement", "frequency": "daily"},
        {"name": "Water Intake", "description": "Stay hydrated (8 glasses)", "frequency": "daily"},
        {"name": "Stretch Routine", "description": "Flexibility and recovery", "frequency": "daily"},
    ],
    "work": [
        {"name": "Daily Planning", "description": "Plan your day in advance", "frequency": "daily"},
        {"name": "Email Management", "description": "Process inbox to zero", "frequency": "daily"},
        {"name": "Progress Review", "description": "Review daily achievements", "frequency": "daily"},
    ],
    "personal": [
        {"name": "Journaling", "description": "Reflect on thoughts and feelings", "frequency": "daily"},
        {"name": "Meditation", "description": "Mindfulness practice", "frequency": "daily"},
        {"name": "Gratitude List", "description": "Note 3 things you're grateful for", "frequency": "daily"},
    ],
    "project": [
        {"name": "Code Review", "description": "Review and refactor code", "frequency": "daily"},
        {"name": "Testing", "description": "Write and run tests", "frequency": "daily"},
        {"name": "Documentation", "description": "Update project docs", "frequency": "weekly"},
    ],
}

ROADMAP_TEMPLATES = {
    "learning": [
        {"title": "Research and gather resources", "duration": 60, "order": 1},
        {"title": "Study fundamentals", "duration": 90, "order": 2},
        {"title": "Practice basics", "duration": 60, "order": 3},
        {"title": "Apply knowledge", "duration": 90, "order": 4},
        {"title": "Review and consolidate", "duration": 45, "order": 5},
    ],
    "project": [
        {"title": "Define scope and requirements", "duration": 60, "order": 1},
        {"title": "Create project structure", "duration": 45, "order": 2},
        {"title": "Implement core features", "duration": 120, "order": 3},
        {"title": "Testing and debugging", "duration": 90, "order": 4},
        {"title": "Documentation and polish", "duration": 60, "order": 5},
    ],
    "fitness": [
        {"title": "Set baseline measurements", "duration": 30, "order": 1},
        {"title": "Create workout plan", "duration": 45, "order": 2},
        {"title": "Start training routine", "duration": 60, "order": 3},
        {"title": "Track progress", "duration": 30, "order": 4},
        {"title": "Adjust and optimize", "duration": 45, "order": 5},
    ],
    "default": [
        {"title": "Define goal clearly", "duration": 30, "order": 1},
        {"title": "Break down into milestones", "duration": 45, "order": 2},
        {"title": "Start first milestone", "duration": 60, "order": 3},
        {"title": "Review progress", "duration": 30, "order": 4},
        {"title": "Complete and celebrate", "duration": 30, "order": 5},
    ],
}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# GOAL DETECTION & PARSING
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def detect_goal_intent(message: str) -> Dict[str, Any]:
    """
    Detect if user message contains a goal intent and extract parameters.
    Returns: {detected: bool, title: str, category: str, timeframe: str, complexity: str}
    """
    msg_lower = message.lower()
    
    # Goal trigger phrases
    goal_triggers = [
        "i want to", "my goal is", "i need to", "help me", "i'm trying to",
        "i aim to", "i plan to", "i'd like to", "set a goal", "create a goal",
        "new goal", "add goal", "track goal", "achieve", "accomplish"
    ]
    
    detected = any(trigger in msg_lower for trigger in goal_triggers)
    
    if not detected:
        return {"detected": False}
    
    # Category detection
    category = "personal"  # default
    if any(word in msg_lower for word in ["learn", "study", "course", "skill", "tutorial"]):
        category = "learning"
    elif any(word in msg_lower for word in ["project", "build", "create", "develop", "code"]):
        category = "project"
    elif any(word in msg_lower for word in ["exercise", "workout", "fitness", "health", "weight"]):
        category = "fitness"
    elif any(word in msg_lower for word in ["work", "career", "job", "professional"]):
        category = "work"
    
    # Timeframe detection
    timeframe = "month"  # default
    if any(word in msg_lower for word in ["today", "tonight"]):
        timeframe = "day"
    elif any(word in msg_lower for word in ["this week", "in a week", "7 days"]):
        timeframe = "week"
    elif any(word in msg_lower for word in ["this month", "30 days", "in a month"]):
        timeframe = "month"
    elif any(word in msg_lower for word in ["this quarter", "3 months", "90 days"]):
        timeframe = "quarter"
    
    # Complexity detection (based on scope words)
    complexity = "medium"
    if any(word in msg_lower for word in ["simple", "quick", "easy", "basic"]):
        complexity = "low"
    elif any(word in msg_lower for word in ["complex", "advanced", "comprehensive", "deep"]):
        complexity = "high"
    
    # Extract goal title (simplified - real NLP would be better)
    title = extract_goal_title(message)
    
    return {
        "detected": True,
        "title": title,
        "category": category,
        "timeframe": timeframe,
        "complexity": complexity,
        "original_message": message,
    }


def extract_goal_title(message: str) -> str:
    """Extract goal title from message using pattern matching."""
    # Remove common prefixes
    prefixes = [
        "i want to", "my goal is to", "i need to", "help me", "i'm trying to",
        "i aim to", "i plan to", "i'd like to", "set a goal to", "create a goal to",
        "add goal", "track goal", "i want", "my goal is"
    ]
    
    title = message
    for prefix in prefixes:
        if title.lower().startswith(prefix):
            title = title[len(prefix):].strip()
            break
    
    # Capitalize first letter
    if title:
        title = title[0].upper() + title[1:] if len(title) > 1 else title.upper()
    
    # Truncate if too long
    if len(title) > 100:
        title = title[:97] + "..."
    
    return title or "New Goal"


def calculate_target_date(timeframe: str) -> datetime:
    """Calculate realistic deadline based on timeframe."""
    now = datetime.now(timezone.utc)
    
    timeframe_days = {
        "day": 1,
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365,
    }
    
    days = timeframe_days.get(timeframe, 30)
    return now + timedelta(days=days)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TASK GENERATION PIPELINE
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def generate_tasks_from_goal(
    user_id: str,
    goal_id: str,
    goal_title: str,
    category: str,
    timeframe: str,
) -> List[Dict[str, Any]]:
    """
    Generate and create tasks based on goal parameters using AI.
    Replaces static templates with dynamic AI breakdown.
    """
    created_tasks = []
    
    try:
        from backend.services.goal_intelligence_service import goal_intelligence_service
        
        # Calculate duration days
        target_date = calculate_target_date(timeframe)
        duration_days = max(1, (target_date - datetime.now(timezone.utc)).days)
        
        # 1. Get AI Breakdown
        logger.info(f"Requesting AI breakdown for goal: {goal_title} ({duration_days} days)")
        breakdown_json = await goal_intelligence_service.breakdown_goal_with_ai(user_id, goal_title, duration_days)
        
        # 2. Extract Tasks
        ai_tasks = breakdown_json.get("tasks", [])
        
        if not ai_tasks:
            # Fallback to templates if AI fails
            logger.warning("AI breakdown returned no tasks, falling back to templates.")
            roadmap = ROADMAP_TEMPLATES.get(category, ROADMAP_TEMPLATES["default"])
            
            # Simple conversion of template to mock AI task objects
            for t in roadmap:
                ai_tasks.append({
                    "title": t["title"],
                    "estimated_minutes": t["duration"],
                    "priority": "medium",
                    "due_in_days": t.get("order", 1) * 3 # rough spacing
                })
        
        # 3. Create Tasks in DB
        for i, task_def in enumerate(ai_tasks):
            # Ensure due_in_days is a list to handle recurrence
            due_in_days_val = task_def.get("due_in_days", (i + 1) * 2)
            if not isinstance(due_in_days_val, list):
                due_in_days_list = [due_in_days_val]
            else:
                due_in_days_list = due_in_days_val

            for due_in in due_in_days_list:
                try:
                    due_date = datetime.now(timezone.utc) + timedelta(days=int(due_in))
                except Exception:
                    due_date = datetime.now(timezone.utc) + timedelta(days=(i + 1) * 2)
                
                task_data = {
                    "title": task_def.get("title", f"Task for {goal_title}"),
                    "description": task_def.get("description", f"AI generated task for goal: {goal_title}"),
                    "priority": task_def.get("priority", "medium").lower(),
                    "category": category,
                    "estimated_minutes": task_def.get("estimated_minutes", 30),
                    "due_date": due_date.isoformat(),
                    "goal_id": goal_id, # Link directly
                    "tags": ["ai-generated", f"goal:{goal_id}", category],
                }
                
                try:
                    task = await planner_service.create_task(user_id, task_data)
                    
                    if "error" in task:
                        logger.error(f"Failed to create task: {task['error']}")
                    else:
                        created_tasks.append(task)
                        
                        # Broadcast task creation
                        try:
                            await broadcast_task_created(int(user_id), task)
                        except Exception:
                            pass
                except Exception as e:
                    logger.error(f"Failed to create individual task: {e}")

        # 4. Handle Habits from AI Breakdown (Optional: if we want to merge this logic here or keep separate)
        # The current calling function `create_goal_with_cascade` handles habits separately via `get_recommended_habits`.
        # For now, we'll stick to just returning tasks here to minimize refactoring risk, 
        # BUT we can log the AI suggested habits for later use or future enhancement.
        
    except Exception as e:
        logger.error(f"AI Task Generation failed: {e}")
        # Fallback to empty list or template implementation if strictly required
    
    logger.info(f"Generated {len(created_tasks)} tasks for goal {goal_id}")
    return created_tasks


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# HABIT RECOMMENDATION PIPELINE
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def get_recommended_habits(category: str) -> List[Dict[str, Any]]:
    """Get recommended habits for a goal category."""
    return RECOMMENDED_HABITS.get(category, RECOMMENDED_HABITS.get("personal", []))


async def create_habits_for_goal(
    user_id: str,
    goal_id: str,
    category: str,
    habits_to_create: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Create habits that support the goal."""
    created_habits = []
    
    for habit_data in habits_to_create:
        try:
            habit_name = habit_data.get("name") or habit_data.get("title")
            if not habit_name:
                continue
            habit = await planner_service.create_habit(user_id, {
                "name": habit_name,
                "description": habit_data.get("description", ""),
                "frequency": habit_data.get("frequency", "daily"),
                "target": habit_data.get("target", 1),
                "goal_link": goal_id,
                "goal_id": goal_id,
            })
            if "error" not in habit:
                created_habits.append(habit)
        except Exception as e:
            logger.error(f"Failed to create habit: {e}")
    
    logger.info(f"Created {len(created_habits)} habits for goal {goal_id}")
    return created_habits


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DEEP WORK SCHEDULING PIPELINE
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def should_propose_deep_work(complexity: str, estimated_hours: int = 3) -> bool:
    """Determine if deep work should be proposed based on goal complexity."""
    return complexity in ["high", "medium"] and estimated_hours >= 2


async def schedule_deep_work_block(
    user_id: str,
    goal_id: str,
    goal_title: str,
    duration_minutes: int = 180,
) -> Optional[Dict[str, Any]]:
    """
    Schedule a deep work block for the goal.
    Returns the created session or None if failed.
    """
    try:
        # Find the next available slot (simplified - would use calendar integration)
        # For now, schedule for next day morning
        start_time = datetime.now(timezone.utc) + timedelta(days=1)
        start_time = start_time.replace(hour=9, minute=0, second=0, microsecond=0)
        
        session = await planner_service.start_deep_work_session(
            user_id=user_id,
            duration_minutes=duration_minutes,
        )
        
        # Broadcast deep work scheduled
        try:
            await broadcast_deep_work_started(int(user_id), {
                "id": session.get("id") if isinstance(session, dict) else getattr(session, 'id', None),
                "goal_id": goal_id,
                "goal_title": goal_title,
                "duration_minutes": duration_minutes,
                "scheduled_for": start_time.isoformat(),
            })
        except Exception:
            pass
        
        logger.info(f"Deep work block scheduled for goal {goal_id}")
        return session
        
    except Exception as e:
        logger.error(f"Failed to schedule deep work: {e}")
        return None


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MAIN GOAL CREATION PIPELINE (CASCADE)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def create_goal_with_cascade(
    user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Main entry point for AI goal creation/breakdown with full cascade:
    1. Create or reuse a goal
    2. Generate supporting tasks
    3. Suggest/create supporting habits
    4. Propose/schedule deep work if needed
    5. Return comprehensive result
    """

    def _coerce_utc_datetime(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            parsed = value
        else:
            raw = str(value).strip()
            if not raw:
                return None
            if len(raw) == 10:
                raw = f"{raw}T23:59:59"
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def _parse_preferred_time(value: Any, default_hour: int, default_minute: int) -> tuple[int, int]:
        if not value:
            return default_hour, default_minute
        try:
            parts = str(value).strip().split(":")
            if len(parts) < 2:
                return default_hour, default_minute
            hour = int(parts[0])
            minute = int(parts[1])
            if hour < 0 or hour > 23 or minute < 0 or minute > 59:
                return default_hour, default_minute
            return hour, minute
        except Exception:
            return default_hour, default_minute

    def _normalize_due_offsets(raw_value: Any, fallback: int, max_days: int) -> List[int]:
        values = raw_value if isinstance(raw_value, list) else [raw_value]
        offsets: List[int] = []
        for value in values:
            try:
                offset = int(value)
            except (TypeError, ValueError):
                offset = fallback
            offset = max(0, min(offset, max_days))
            if offset not in offsets:
                offsets.append(offset)
        if not offsets:
            offsets = [max(0, min(fallback, max_days))]
        return offsets

    try:
        create_new_goal = bool(payload.get("create_new_goal", True))
        existing_goal_id = payload.get("existing_goal_id")

        title = str(payload.get("title", "New Goal")).strip() or "New Goal"
        description = payload.get("description", "") or ""
        category = (payload.get("category", "personal") or "personal").lower()
        timeframe = payload.get("timeframe", "month") or "month"
        complexity = (payload.get("complexity", "medium") or "medium").lower()
        auto_create_tasks = bool(payload.get("auto_create_tasks", True))
        auto_create_habits = bool(payload.get("auto_create_habits", True))
        propose_deep_work = bool(payload.get("propose_deep_work", True))

        now_utc = datetime.now(timezone.utc)
        target_date_obj = _coerce_utc_datetime(payload.get("target_date")) or calculate_target_date(timeframe)
        if target_date_obj <= now_utc:
            target_date_obj = now_utc + timedelta(days=1)

        goal: Dict[str, Any]
        if create_new_goal:
            goal = await planner_service.create_goal(
                user_id,
                {
                    "title": title,
                    "description": description,
                    "category": category,
                    "target_date": target_date_obj,
                    "current_progress": 0,
                    "milestones": [],
                    "ai_suggestions": [],
                },
            )
            if "error" in goal:
                return {"status": "error", "message": goal["error"]}
        else:
            if not existing_goal_id:
                return {
                    "status": "error",
                    "message": "existing_goal_id is required when create_new_goal is false",
                }
            user_goals = await planner_service.get_user_goals(user_id)
            goal = next((g for g in user_goals if str(g.get("id")) == str(existing_goal_id)), {})
            if not goal:
                return {"status": "error", "message": "Existing goal not found"}
            title = goal.get("title", title)
            description = goal.get("description") or description
            category = (goal.get("category") or category or "personal").lower()
            goal_target = _coerce_utc_datetime(goal.get("target_date"))
            if goal_target:
                target_date_obj = goal_target
            if target_date_obj <= now_utc:
                target_date_obj = now_utc + timedelta(days=1)

        goal_id = goal.get("id")
        if not goal_id:
            return {"status": "error", "message": "Goal creation failed: missing goal id"}

        result: Dict[str, Any] = {
            "status": "success",
            "goal": goal,
            "tasks_created": [],
            "habits_suggested": [],
            "habits_created": [],
            "deep_work_proposed": False,
            "deep_work_session": None,
        }

        from backend.services.goal_intelligence_service import goal_intelligence_service

        duration_days = max(1, (target_date_obj - now_utc).days)
        logger.info("Requesting AI breakdown for goal '%s' (%s days)", title, duration_days)
        ai_plan = await goal_intelligence_service.breakdown_goal_with_ai(user_id, title, duration_days)
        if not isinstance(ai_plan, dict):
            ai_plan = {}

        if auto_create_tasks:
            ai_tasks = ai_plan.get("tasks", [])
            if not isinstance(ai_tasks, list):
                ai_tasks = []

            created_tasks: List[Dict[str, Any]] = []
            task_hour, task_minute = _parse_preferred_time(payload.get("preferred_task_time"), 9, 0)

            for index, task_def in enumerate(ai_tasks):
                if not isinstance(task_def, dict):
                    continue
                due_offsets = _normalize_due_offsets(
                    task_def.get("due_in_days"),
                    fallback=min(duration_days, index + 1),
                    max_days=duration_days,
                )
                for due_in in due_offsets:
                    due_date = now_utc + timedelta(days=due_in)
                    due_date = due_date.replace(hour=task_hour, minute=task_minute, second=0, microsecond=0)
                    if due_date > target_date_obj:
                        due_date = target_date_obj

                    try:
                        estimated_minutes = max(5, int(task_def.get("estimated_minutes", 30)))
                    except (TypeError, ValueError):
                        estimated_minutes = 30

                    task_data = {
                        "title": task_def.get("title", f"Task for {title}"),
                        "description": task_def.get("description", f"AI-generated task for goal: {title}"),
                        "priority": str(task_def.get("priority", "medium")).lower(),
                        "category": category,
                        "estimated_minutes": estimated_minutes,
                        "due_date": due_date.isoformat(),
                        "goal_id": goal_id,
                        "tags": ["ai-generated", f"goal:{goal_id}", category],
                    }
                    task = await planner_service.create_task(user_id, task_data)
                    if isinstance(task, dict) and "error" not in task:
                        created_tasks.append(task)
                        try:
                            await broadcast_task_created(int(user_id), task)
                        except Exception:
                            pass

            result["tasks_created"] = created_tasks

        raw_habits = ai_plan.get("habits", [])
        normalized_habits: List[Dict[str, Any]] = []
        if isinstance(raw_habits, list):
            for habit in raw_habits:
                if not isinstance(habit, dict):
                    continue
                habit_name = str(habit.get("name") or habit.get("title") or "").strip()
                if not habit_name:
                    continue
                normalized_habits.append(
                    {
                        "name": habit_name,
                        "description": habit.get("description", ""),
                        "frequency": habit.get("frequency", "daily"),
                        "target": habit.get("target", 1),
                    }
                )

        result["habits_suggested"] = normalized_habits
        if auto_create_habits and normalized_habits:
            result["habits_created"] = await create_habits_for_goal(
                user_id,
                str(goal_id),
                category,
                normalized_habits,
            )

        raw_deep_work = ai_plan.get("deep_work", [])
        ai_deep_work = raw_deep_work if isinstance(raw_deep_work, list) else []

        if propose_deep_work:
            should_propose = bool(ai_deep_work) or should_propose_deep_work(complexity)
            result["deep_work_proposed"] = should_propose

            if should_propose and (payload.get("schedule_deep_work", False) or ai_deep_work):
                deep_work_defs = ai_deep_work or [
                    {
                        "focus_area": f"Focused progress on {title}",
                        "duration_minutes": 90,
                        "due_in_days": [1],
                        "notes": "Heuristic deep work recommendation",
                    }
                ]

                dw_hour, dw_minute = _parse_preferred_time(payload.get("preferred_deep_work_time"), 9, 0)
                sessions: List[Dict[str, Any]] = []
                for index, deep_work_def in enumerate(deep_work_defs):
                    if not isinstance(deep_work_def, dict):
                        continue
                    due_offsets = _normalize_due_offsets(
                        deep_work_def.get("due_in_days"),
                        fallback=min(duration_days, index + 1),
                        max_days=duration_days,
                    )
                    try:
                        duration_minutes = max(30, int(deep_work_def.get("duration_minutes", 90)))
                    except (TypeError, ValueError):
                        duration_minutes = 90

                    for due_in in due_offsets:
                        start_time = now_utc + timedelta(days=due_in)
                        start_time = start_time.replace(hour=dw_hour, minute=dw_minute, second=0, microsecond=0)
                        if start_time > target_date_obj:
                            continue

                        focus_goal = deep_work_def.get("focus_area", f"Deep focus around {title}")
                        plan_data = {
                            "name": "Deep Work Session",
                            "description": focus_goal,
                            "plan_type": "deep_work",
                            "date": start_time,
                            "duration_hours": duration_minutes / 60.0,
                            "goal_id": goal_id,
                            "schedule": {
                                "type": "deep_work",
                                "goal_id": goal_id,
                                "duration_minutes": duration_minutes,
                                "status": "scheduled",
                                "scheduled_local_time": start_time.isoformat(),
                                "notes": deep_work_def.get("notes"),
                            },
                        }
                        session = await planner_service.create_plan(user_id, plan_data)
                        if isinstance(session, dict) and "error" not in session:
                            sessions.append(session)

                if sessions:
                    result["deep_work_session"] = sessions[-1]
                    result["deep_work_sessions"] = sessions

        try:
            await analytics_service.save_event(
                {
                    "user_id": int(user_id),
                    "event": "goal_created_with_cascade",
                    "source": "ai_goal_automation",
                    "metadata": {
                        "goal_id": goal_id,
                        "title": title,
                        "category": category,
                        "timeframe": timeframe,
                        "complexity": complexity,
                        "create_new_goal": create_new_goal,
                        "tasks_count": len(result["tasks_created"]),
                        "habits_count": len(result["habits_created"]),
                        "deep_work_proposed": result["deep_work_proposed"],
                    },
                }
            )
        except Exception:
            pass

        logger.info("Goal cascade completed for user %s and goal %s", user_id, goal_id)

        message_parts = [f"Goal '{title}' {'created' if create_new_goal else 'updated'} with AI breakdown"]
        if result["tasks_created"]:
            message_parts.append(f"{len(result['tasks_created'])} tasks created")
        if result["habits_created"]:
            message_parts.append(f"{len(result['habits_created'])} habits created")
        elif result["habits_suggested"]:
            message_parts.append(f"{len(result['habits_suggested'])} habits suggested")
        if result["deep_work_proposed"]:
            message_parts.append("deep work recommended")
        result["message"] = " | ".join(message_parts)

        return result

    except Exception as e:
        logger.error(f"Goal cascade creation failed: {e}")
        return {"status": "error", "message": str(e)}
# DASHBOARD AGGREGATION
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def get_planner_dashboard(user_id: str) -> Dict[str, Any]:
    """
    Get aggregated dashboard data for the planner.
    This is read-only and combines data from all planner components.
    """
    try:
        # Get all data
        tasks = await planner_service.get_active_tasks(user_id)
        goals = await planner_service.get_user_goals(user_id)
        habits = await planner_service.get_user_habits(user_id)
        active_session = await planner_service.get_active_deep_work(user_id)
        
        # Calculate stats
        today = datetime.now(timezone.utc).date()
        tasks_today = [t for t in tasks if hasattr(t, 'due_date') and t.due_date and t.due_date.date() == today]
        tasks_completed_today = [t for t in tasks if hasattr(t, 'status') and t.status == 'completed' and hasattr(t, 'completed_at') and t.completed_at and t.completed_at.date() == today]
        
        # Goal progress average
        goal_progress = sum(g.get("current_progress", 0) for g in goals) / len(goals) if goals else 0
        
        # Habits due today
        habits_due = [h for h in habits if h.get("frequency") == "daily"]
        habits_completed = [h for h in habits if h.get("lastCompleted") and h["lastCompleted"].startswith(today.isoformat())]
        
        # Productivity score (simplified calculation)
        task_score = (len(tasks_completed_today) / len(tasks_today) * 100) if tasks_today else 100
        habit_score = (len(habits_completed) / len(habits_due) * 100) if habits_due else 100
        productivity_score = int((task_score + habit_score + goal_progress) / 3)
        
        return {
            "daily_stats": {
                "tasks_today": len(tasks_today),
                "tasks_completed": len(tasks_completed_today),
                "habits_due": len(habits_due),
                "habits_completed": len(habits_completed),
                "deep_work_active": active_session is not None,
                "goal_progress": round(goal_progress, 1),
            },
            "counts": {
                "total_tasks": len(tasks),
                "total_goals": len(goals),
                "total_habits": len(habits),
            },
            "productivity_score": min(100, max(0, productivity_score)),
            "active_deep_work": active_session,
        }
        
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}")
        return {
            "daily_stats": {},
            "counts": {},
            "productivity_score": 0,
            "error": str(e),
        }
