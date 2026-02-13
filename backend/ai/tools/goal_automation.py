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
from datetime import datetime, timedelta
import logging

from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service
from backend.realtime.socket_manager import (
    broadcast_task_created,
    broadcast_plan_generated,
    broadcast_deep_work_started,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS & TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# GOAL DETECTION & PARSING
# ─────────────────────────────────────────────────────────────────────────────

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
    now = datetime.utcnow()
    
    timeframe_days = {
        "day": 1,
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365,
    }
    
    days = timeframe_days.get(timeframe, 30)
    return now + timedelta(days=days)


# ─────────────────────────────────────────────────────────────────────────────
# TASK GENERATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

async def generate_tasks_from_goal(
    user_id: str,
    goal_id: str,
    goal_title: str,
    category: str,
    timeframe: str,
) -> List[Dict[str, Any]]:
    """
    Generate and create tasks based on goal parameters.
    Uses roadmap templates split into daily chunks.
    """
    created_tasks = []
    
    # Get roadmap template
    roadmap = ROADMAP_TEMPLATES.get(category, ROADMAP_TEMPLATES["default"])
    
    # Calculate task distribution
    target_date = calculate_target_date(timeframe)
    days_available = (target_date - datetime.utcnow()).days
    
    if days_available < 1:
        days_available = 7  # Minimum 7 days
    
    # Distribute tasks across available days
    tasks_per_day = max(1, len(roadmap) // days_available)
    
    for i, template in enumerate(roadmap):
        # Calculate due date for this task
        task_day = min(i // tasks_per_day, days_available - 1)
        due_date = datetime.utcnow() + timedelta(days=task_day + 1)
        
        task_data = {
            "title": f"{goal_title}: {template['title']}",
            "description": f"Part of goal: {goal_title}",
            "priority": "medium",
            "category": category,
            "estimated_minutes": template["duration"],
            "due_date": due_date.isoformat(),
            "tags": [f"goal:{goal_id}", category],
        }
        
        try:
            task = await planner_service.create_task(user_id, task_data)
            
            # Check if it's an error dict
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
            logger.error(f"Failed to create task: {e}")
    
    logger.info(f"Generated {len(created_tasks)} tasks for goal {goal_id}")
    return created_tasks


# ─────────────────────────────────────────────────────────────────────────────
# HABIT RECOMMENDATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

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
            habit = await planner_service.create_habit(user_id, {
                "name": habit_data["name"],
                "description": habit_data.get("description", ""),
                "frequency": habit_data.get("frequency", "daily"),
                "target": habit_data.get("target", 1),
                "goal_link": goal_id,
            })
            if "error" not in habit:
                created_habits.append(habit)
        except Exception as e:
            logger.error(f"Failed to create habit: {e}")
    
    logger.info(f"Created {len(created_habits)} habits for goal {goal_id}")
    return created_habits


# ─────────────────────────────────────────────────────────────────────────────
# DEEP WORK SCHEDULING PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

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
        start_time = datetime.utcnow() + timedelta(days=1)
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


# ─────────────────────────────────────────────────────────────────────────────
# MAIN GOAL CREATION PIPELINE (CASCADE)
# ─────────────────────────────────────────────────────────────────────────────

async def create_goal_with_cascade(
    user_id: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Main entry point for AI goal creation with full cascade:
    1. Create the goal
    2. Generate supporting tasks
    3. Suggest/create supporting habits
    4. Propose deep work if needed
    5. Return comprehensive result
    """
    try:
        # Extract goal parameters
        title = payload.get("title", "New Goal")
        description = payload.get("description", "")
        category = payload.get("category", "personal")
        timeframe = payload.get("timeframe", "month")
        complexity = payload.get("complexity", "medium")
        auto_create_tasks = payload.get("auto_create_tasks", True)
        auto_create_habits = payload.get("auto_create_habits", False)
        propose_deep_work = payload.get("propose_deep_work", True)
        
        # Determine target date: prioritize explicit date, fallback to timeframe
        target_date_obj: datetime
        if payload.get("target_date"):
            try:
                # Handle both full ISO and YYYY-MM-DD
                date_str = payload["target_date"]
                # If it's just a date string (YYYY-MM-DD), append time
                if len(date_str) == 10: 
                    target_date_obj = datetime.fromisoformat(f"{date_str}T23:59:59")
                else:
                    target_date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except ValueError:
                # Fallback if parse fails
                logger.warning(f"Failed to parse target_date '{payload['target_date']}', falling back to timeframe")
                target_date_obj = calculate_target_date(timeframe)
        else:
            target_date_obj = calculate_target_date(timeframe)
        
        # 1. Create the goal
        # Pass datetime object, let service/model handle storage
        goal = await planner_service.create_goal(user_id, {
            "title": title,
            "description": description,
            "category": category,
            "target_date": target_date_obj,
            "current_progress": 0,
            "milestones": [],
            "ai_suggestions": [],
        })

        if "error" in goal:
            return {"status": "error", "message": goal["error"]}

        goal_id = goal.get("id")

        # Broadcast goal creation event
        try:
            from backend.realtime.socket_manager import broadcast_goal_created
            await broadcast_goal_created(int(user_id), {
                "id": goal.get("id"),
                "title": goal.get("title"),
                "description": goal.get("description"),
                "category": goal.get("category"),
                "target_date": goal.get("target_date"), # This should be ISO string from service response
                "current_progress": goal.get("current_progress", 0),
                "milestones": goal.get("milestones", []),
                "created_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to broadcast goal creation: {e}")
    
        # Result container
        result = {
            "status": "success",
            "goal": goal,
            "tasks_created": [],
            "habits_suggested": [],
            "habits_created": [],
            "deep_work_proposed": False,
            "deep_work_session": None,
        }
        
        # 2. Generate supporting tasks
        if auto_create_tasks:
            tasks = await generate_tasks_from_goal(
                user_id, goal_id, title, category, timeframe
            )
            result["tasks_created"] = tasks
        
        # 3. Suggest habits
        suggested_habits = get_recommended_habits(category)
        result["habits_suggested"] = suggested_habits
        
        # 4. Auto-create habits if requested
        if auto_create_habits and suggested_habits:
            created_habits = await create_habits_for_goal(
                user_id, goal_id, category, suggested_habits
            )
            result["habits_created"] = created_habits
        
        # 5. Propose deep work for complex goals
        if propose_deep_work and should_propose_deep_work(complexity):
            result["deep_work_proposed"] = True
            # Only schedule if explicitly requested
            if payload.get("schedule_deep_work", False):
                session = await schedule_deep_work_block(
                    user_id, goal_id, title, duration_minutes=180
                )
                result["deep_work_session"] = session
        
        # Log analytics event
        await analytics_service.save_event({
            "user_id": user_id,
            "event": "goal_created_with_cascade",
            "source": "ai_goal_automation",
            "metadata": {
                "goal_id": goal_id,
                "title": title,
                "category": category,
                "timeframe": timeframe,
                "complexity": complexity,
                "tasks_count": len(result["tasks_created"]),
                "habits_count": len(result["habits_created"]),
                "deep_work_proposed": result["deep_work_proposed"],
            }
        })
        
        logger.info(f"Goal created with cascade for user {user_id}: {goal_id}")
        
        # Build response message
        msg_parts = [f"✅ Goal '{title}' created!"]
        if result["tasks_created"]:
            msg_parts.append(f"📋 {len(result['tasks_created'])} tasks generated")
        if result["habits_suggested"]:
            msg_parts.append(f"🔄 {len(result['habits_suggested'])} habits suggested")
        if result["deep_work_proposed"]:
            msg_parts.append("🧠 Deep work block recommended")
        
        result["message"] = " | ".join(msg_parts)
        
        return result
        
    except Exception as e:
        logger.error(f"Goal cascade creation failed: {e}")
        return {"status": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD AGGREGATION
# ─────────────────────────────────────────────────────────────────────────────

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
        active_session = await planner_service.get_latest_session(user_id)
        
        # Calculate stats
        today = datetime.utcnow().date()
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
