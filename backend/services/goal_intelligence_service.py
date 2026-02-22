
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, or_
from backend.db.database import get_db
from backend.db.models import Goal, Task, Plan
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
            
            # Parse JSON from response
            import json
            import re
            
            text = response.get("text", "")
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                plan_data = json.loads(json_match.group(0))
                return plan_data
            else:
                logger.error(f"Failed to parse AI breakdown JSON: {text}")
                return {}
                
        except Exception as e:
            logger.error(f"AI Breakdown failed: {e}")
            return {}

    async def update_goal_probability(self, user_id: str, goal_id: str) -> None:
        """
        Calculates and updates success probability for a tracked goal using advanced logic.
        Differentiates between highly precise AI-Agentic Goals and manual user Goals.
        """
        try:
            from datetime import timezone
            now_utc = datetime.now(timezone.utc)
            
            async for db in get_db():
                # 1. Get Goal
                result = await db.execute(select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id)))
                goal = result.scalar_one_or_none()
                if not goal or not goal.is_tracked:
                    return

                # 2. Get all Linked Items
                task_res = await db.execute(select(Task).where(Task.goal_id == int(goal_id), Task.user_id == int(user_id)))
                all_tasks = task_res.scalars().all()

                habit_res = await db.execute(select(Plan).where(Plan.goal_id == int(goal_id), Plan.user_id == int(user_id), Plan.plan_type == 'habit'))
                all_habits = habit_res.scalars().all()

                dw_res = await db.execute(select(Plan).where(Plan.goal_id == int(goal_id), Plan.user_id == int(user_id), Plan.plan_type == 'deep_work'))
                all_dw = dw_res.scalars().all()

                # 3. Determine if Goal is AI Agentic
                # AI tasks are tagged with "ai-generated".
                is_ai_agentic = any("ai-generated" in (t.tags or []) for t in all_tasks)

                # 4. Compute Metrics
                try:
                    old_progress = goal.current_progress or 0
                    
                    if is_ai_agentic:
                        prob_score, new_progress = self._calculate_ai_agentic_metrics(goal, all_tasks, all_habits, all_dw, now_utc)
                    else:
                        prob_score, new_progress = self._calculate_manual_metrics(goal, all_tasks, all_habits, all_dw, now_utc)

                    # Ensure bounds
                    new_progress = max(0, min(100, int(new_progress)))
                    prob_score = max(0.0, min(100.0, float(prob_score)))
                    
                    label = self._get_probability_label(prob_score)

                    # Update Goal
                    goal.current_progress = new_progress
                    goal.probability_status = label
                    goal.last_analyzed_at = now_utc
                    await db.commit()

                    logger.info(f"Updated Goal {goal_id}: Type={'AI' if is_ai_agentic else 'Manual'}, Prob={label} ({prob_score:.1f}%), Progress={new_progress}%")

                    # 5. Broadcast Real-time Updates
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

                except Exception as eval_err:
                    logger.error(f"Error during AI/Manual math evaluation for {goal_id}: {eval_err}")

        except Exception as e:
            logger.error(f"Failed to process probability for goal {goal_id}: {e}")

    def _calculate_ai_agentic_metrics(self, goal: Goal, tasks: List[Task], habits: List[Plan], dw: List[Plan], now_utc: datetime) -> tuple[float, int]:
        """Highly precise mathematical model for AI-generated goals facing strict deadlines."""
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if str(t.status).lower() in ['completed', 'done'])
        
        # 1. Progress: AI sets exact tasks -> rigid exact completion ratio.
        progress = int((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0)

        # 2. Task Reliability Velocity (strict penalties for missed scheduled items)
        due_tasks = [t for t in tasks if t.due_date and t.due_date.replace(tzinfo=timezone.utc) <= now_utc]
        completed_due = sum(1 for t in due_tasks if str(t.status).lower() in ['completed', 'done'])
        
        if due_tasks:
            task_score = (completed_due / len(due_tasks)) * 100
            overdue = len(due_tasks) - completed_due
            # Severe penalty for overdue tasks on AI scheduled timelines (5% per missed task)
            if overdue > 0:
                task_score = max(0, task_score - (overdue * 5.0))
        else:
            # Baseline if nothing is due yet
            task_score = 100.0 if completed_tasks > 0 else 50.0 
            
        # 3. Habit Flow (High velocity expected)
        habit_score = 50.0
        if habits:
            total_h_score = 0
            for h in habits:
                streak = h.schedule.get('streak', 0) if isinstance(h.schedule, dict) else 0
                # AI habits expect rapid momentum. A streak of 7 is considered 100% efficient.
                total_h_score += min(100.0, (streak / 7.0) * 100)
            habit_score = total_h_score / len(habits)

        # 4. Deep Work Architecture
        dw_score = 50.0
        if dw:
            completed_dw = sum(1 for d in dw if isinstance(d.schedule, dict) and str(d.schedule.get('status')).lower() in ['completed', 'done'])
            dw_score = (completed_dw / len(dw)) * 100

        # Weighted Probability AI: Execution Heavy (Tasks: 55%, Habits: 30%, DW: 15%)
        weights, final_score = 0.0, 0.0
        
        if tasks:
            final_score += task_score * 0.55
            weights += 0.55
        if habits:
            final_score += habit_score * 0.30
            weights += 0.30
        if dw:
            final_score += dw_score * 0.15
            weights += 0.15
            
        if weights == 0:
            return 50.0, progress
            
        return final_score / weights, progress

    def _calculate_manual_metrics(self, goal: Goal, tasks: List[Task], habits: List[Plan], dw: List[Plan], now_utc: datetime) -> tuple[float, int]:
        """Fluid probabilistic logic for user-managed goals prioritizing momentum over exact rigidity."""
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if str(t.status).lower() in ['completed', 'done'])
        
        # 1. Progress: Inherits previous context or purely tasks if tracked.
        if total_tasks > 0:
            progress = int(completed_tasks / total_tasks * 100)
        else:
            progress = goal.current_progress or 0

        # 2. Task Momentum
        due_tasks = [t for t in tasks if t.due_date and t.due_date.replace(tzinfo=timezone.utc) <= now_utc]
        completed_due = sum(1 for t in due_tasks if str(t.status).lower() in ['completed', 'done'])
        
        task_score = 50.0
        if due_tasks:
            # Base completion logic
            base_score = (completed_due / len(due_tasks)) * 100
            overdue = len(due_tasks) - completed_due
            # Soft penalty for manual goals
            task_score = max(0, base_score - (overdue * 2.0))
        elif total_tasks > 0:
            # Credit momentum for completing tasks even before they are due
            task_score = min(100.0, 50.0 + (completed_tasks * 10.0))

        # 3. Habit Consistency
        habit_score = 50.0
        if habits:
            total_h_score = 0
            for h in habits:
                streak = h.schedule.get('streak', 0) if isinstance(h.schedule, dict) else 0
                # Manual lifestyle habits scale out (21 days for 100%)
                total_h_score += min(100.0, (streak / 21.0) * 100)
            habit_score = total_h_score / len(habits)

        # 4. Deep Work Engagement
        dw_score = 50.0
        if dw:
            completed_dw = sum(1 for d in dw if isinstance(d.schedule, dict) and str(d.schedule.get('status')).lower() in ['completed', 'done'])
            dw_score = (completed_dw / len(dw)) * 100

        # Weighted Probability Manual: Lifestyle Balance (Tasks: 40%, Habits: 40%, DW: 20%)
        weights, final_score = 0.0, 0.0
        
        if tasks:
            final_score += task_score * 0.40
            weights += 0.40
        if habits:
            final_score += habit_score * 0.40
            weights += 0.40
        if dw:
            final_score += dw_score * 0.20
            weights += 0.20
            
        if weights == 0:
            return 50.0, progress
            
        return final_score / weights, progress

    def _get_probability_label(self, score: float) -> str:
        """Categorize mathematical output into UX strings."""
        if score >= 88: return "Extremely High"
        if score >= 72: return "Very High"
        if score >= 55: return "High"
        if score >= 35: return "Medium"
        if score >= 15: return "Low"
        return "Very Low"

goal_intelligence_service = GoalIntelligenceService()
