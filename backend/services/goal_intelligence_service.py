
import logging
import json
import re
from typing import Dict, Any
from sqlalchemy import select
from backend.db.database import get_db
from backend.db.models import Goal
from backend.ai.client import DualAIClient
from backend.services.planner_service import PlannerService

logger = logging.getLogger(__name__)

class GoalIntelligenceService:
    """
    Service for Goal Intelligence:
    1. AI Goal Breakdown (Goals -> Tasks, Habits, Deep Work)
    2. Probability Scoring based on consistency
    3. Goal Tracking Management (Limit 3)
    """
    
    def __init__(self):
        self.planner_service = PlannerService()

    def _extract_plan_json(self, text: str) -> Dict[str, Any]:
        decoder = json.JSONDecoder()
        if not text:
            return {}

        candidate_blocks = [text]
        fence_matches = re.findall(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE)
        candidate_blocks.extend(fence_matches)

        for block in candidate_blocks:
            payload = str(block or "").strip()
            if not payload:
                continue
            try:
                parsed = json.loads(payload)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

            for index, ch in enumerate(payload):
                if ch != "{":
                    continue
                try:
                    parsed, _ = decoder.raw_decode(payload[index:])
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    continue

        return {}

    def _normalize_plan_data(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(raw, dict):
            raw = {}
        return {
            "tasks": raw.get("tasks") if isinstance(raw.get("tasks"), list) else [],
            "habits": raw.get("habits") if isinstance(raw.get("habits"), list) else [],
            "deep_work": raw.get("deep_work") if isinstance(raw.get("deep_work"), list) else [],
            "milestones": raw.get("milestones") if isinstance(raw.get("milestones"), list) else [],
        }

    async def breakdown_goal_with_ai(self, user_id: str, goal_text: str, duration_days: int = 30) -> Dict[str, Any]:
        """
        Uses AI to break down a goal into Tasks, Habits, and Deep Work.
        """
        ai_client = DualAIClient(user_id)
        
        prompt = f"""
        You are an elite productivity and strategic planning AI. The user has set the following goal: "{goal_text}".
        Duration: {duration_days} days.
        
        Your objective is to break this specific goal down intelligently into a highly customized action plan. 
        Do NOT use a generic rigid template. Instead, deeply analyze the precise nature of the goal (e.g., highly academic like 'JEE Mains', physical like 'Marathon', or creative like 'Write a Novel') and tailor the exact number, frequency, and type of actions required exclusively for success in {duration_days} days.
        
        Create a precise execution engine containing:
        1. **Tasks**: Specific actionable items. For recurring tasks (e.g., "dribbling practice every monday"), you can specify an array of 'due_in_days' (e.g., [1, 8, 15, 22]) to schedule them across the {duration_days} days timeframe. Do not generate tasks past {duration_days} days.
        2. **Habits**: Recurring daily actions required for compounding progress (e.g., 'consistency study habits'). Only suggest habits that make logical sense for this specific goal.
        3. **Deep Work**: Focused, uninterrupted work blocks. Define the duration and the specific days ('due_in_days' array) if this goal requires deep focus. If not needed, omit it.
        
        Analyze the time constraint carefully. Keep rest days in mind.
        
        Output valid JSON only:
        {{
            "tasks": [
                {{"title": "Task Name", "estimated_minutes": 60, "priority": "high", "due_in_days": [1, 8, 15]}}
            ],
            "habits": [
                {{"name": "Habit Name", "frequency": "daily"}}
            ],
            "deep_work": [
                {{"focus_area": "Focus Area", "duration_minutes": 90, "due_in_days": [3, 10, 17], "notes": "Description"}}
            ],
            "milestones": [
                "Milestone 1 (Week 1)"
            ]
        }}
        """
        
        try:
            # Use a specialized system prompt for planning
            response = await ai_client.chat_completion([
                {"role": "system", "content": "You are a precise JSON-generating planning AI. Output ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ])
            
            text = response.get("text", "")
            plan_data = self._extract_plan_json(text)
            if plan_data:
                return self._normalize_plan_data(plan_data)

            logger.error("Failed to parse AI breakdown JSON")
            return {}
                
        except Exception as e:
            logger.error(f"AI Breakdown failed: {e}")
            return {}

    async def update_goal_probability(self, user_id: str, goal_id: str) -> None:
        """
        Calculates and updates success probability for a tracked goal using advanced logic.
        Delegates completely to canonical GoalProgressEngine.
        """
        from backend.db.models import User
        try:
            async for db in get_db():
                usr_res = await db.execute(select(User).where(User.id == int(user_id)))
                usr = usr_res.scalar()
                is_ultra = usr.plan_type == 'ULTRA' if usr else False

                result = await db.execute(select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id)))
                goal = result.scalar_one_or_none()
                if not goal or not goal.is_tracked:
                    return

                old_progress = goal.current_progress or 0

                scoring_version = str(getattr(goal, "scoring_version", "v1") or "v1").lower()
                if scoring_version == "v2":
                    from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
                    await GoalProgressEngineV2.calculate(
                        db,
                        int(goal_id),
                        int(user_id),
                        is_ultra=is_ultra,
                        save_snapshot=True,
                    )
                    await db.commit()
                    await db.refresh(goal)
                else:
                    from backend.services.goal_progress_engine import GoalProgressEngine
                    await GoalProgressEngine.calculate_progress(
                        db, int(goal_id), int(user_id), is_ultra=is_ultra
                    )

                # Broadcast Real-time Updates
                try:
                    from backend.realtime.socket_manager import broadcast_goal_updated, broadcast_goal_progress_changed
                    
                    goal_dict = {
                        "id": str(goal.id),
                        "title": goal.title,
                        "description": goal.description,
                        "category": goal.category,
                        "target_date": goal.target_date.isoformat() if goal.target_date else None,
                        "current_progress": goal.current_progress,
                        "milestones": goal.milestones,
                        "probability_status": goal.probability_status,
                        "created_at": goal.created_at.isoformat() if goal.created_at else None,
                    }
                    await broadcast_goal_updated(int(user_id), goal_dict)
                    
                    if goal.current_progress != old_progress:
                        await broadcast_goal_progress_changed(int(user_id), {
                            "goal_id": str(goal.id),
                            "progress": goal.current_progress,
                            "previous_progress": old_progress
                        })
                except Exception as e:
                    logger.error(f"Failed to broadcast goal updates: {e}")

        except Exception as e:
            logger.error(f"Failed to process probability for goal {goal_id}: {e}")

goal_intelligence_service = GoalIntelligenceService()
