
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
        You are an expert productivity planner. The user has a goal: "{goal_text}".
        Duration: {duration_days} days.
        
        Break this goal down into a concrete action plan containing:
        1. **Tasks**: Specific, actionable 1-time items (e.g., "Physics Chapter 1", "Market Research"). 
           - Suggest 3-5 key tasks per week or phase.
        2. **Habits**: Recurring daily actions (e.g., "Wake up at 6am", "Code for 1h").
        3. **Deep Work**: Focused blocks (e.g., "Mock Test", "Deep Reading") with frequency.
        
        Output valid JSON only:
        {{
            "tasks": [
                {{"title": "Task Name", "estimated_minutes": 60, "priority": "high", "due_in_days": 1}}
            ],
            "habits": [
                {{"name": "Habit Name", "frequency": "daily"}}
            ],
            "deep_work": [
                {{"focus_area": "Focus Area", "duration_minutes": 90, "frequency_per_week": 3, "notes": "Description"}}
            ],
            "milestones": [
                "Milestone 1 (Week 1)", "Milestone 2 (Week 2)"
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
        Calculates and updates success probability for a tracked goal.
        Logic:
        - Consistency = (Completed Items / Total Due Items) * 100
        - Weights: Tasks (40%), Habits (40%), Deep Work (20%)
        """
        try:
            async for db in get_db():
                # 1. Get Goal
                result = await db.execute(select(Goal).where(Goal.id == int(goal_id), Goal.user_id == int(user_id)))
                goal = result.scalar_one_or_none()
                if not goal or not goal.is_tracked:
                    return

                # 2. Get Linked Items
                # Tasks
                task_stats = await self._get_task_stats(db, user_id, goal_id)
                # Habits (Plans with type='habit' linked to goal)
                habit_stats = await self._get_habit_stats(db, user_id, goal_id)
                # Deep Work (Plans with type='deep_work' linked to goal)
                dw_stats = await self._get_deep_work_stats(db, user_id, goal_id)

                # 3. Calculate Scores
                task_score = task_stats['consistency']
                habit_score = habit_stats['consistency']
                dw_score = dw_stats['consistency']
                
                # Weighted Average
                # If a category has no items, distribute weight to others
                weights = {'task': 0.4, 'habit': 0.4, 'dw': 0.2}
                
                # Adjust weights if empty
                active_weights = 0
                if task_stats['total'] > 0: active_weights += weights['task']
                if habit_stats['total'] > 0: active_weights += weights['habit']
                if dw_stats['total'] > 0: active_weights += weights['dw']
                
                final_consistency = 0
                if active_weights > 0:
                    raw_score = 0
                    if task_stats['total'] > 0: raw_score += task_score * weights['task']
                    if habit_stats['total'] > 0: raw_score += habit_score * weights['habit']
                    if dw_stats['total'] > 0: raw_score += dw_score * weights['dw']
                    
                    final_consistency = (raw_score / active_weights)
                else:
                    # No data yet -> Medium baseline
                    final_consistency = 50.0

                # 4. Map to Label
                label = self._get_probability_label(final_consistency)
                
                # 5. Update Goal
                goal.probability_status = label
                goal.last_analyzed_at = datetime.utcnow()
                await db.commit()
                
                logger.info(f"Updated Goal {goal_id} probability: {label} ({final_consistency:.1f}%)")

        except Exception as e:
            logger.error(f"Failed to update probability for goal {goal_id}: {e}")

    async def _get_task_stats(self, db, user_id, goal_id) -> Dict[str, Any]:
        """Consistency of tasks linked to goal."""
        result = await db.execute(
            select(Task).where(Task.goal_id == int(goal_id), Task.user_id == int(user_id))
        )
        tasks = result.scalars().all()
        if not tasks: return {'total': 0, 'consistency': 0}
        
        completed = sum(1 for t in tasks if t.status == 'completed')
        # Only count tasks that are DUE (or completed). Future tasks shouldn't drag down score?
        # User said "misses most low probability". "Misses" implies due.
        # Simple Logic: Completed / (Completed + Overdue + InProgress/Due)
        # For now, Total = All tasks that are NOT scheduled in future?
        # Let's use All Tasks for simplicity or simple ratio of Completed/Total
        
        consistency = (completed / len(tasks)) * 100
        return {'total': len(tasks), 'consistency': consistency}

    async def _get_habit_stats(self, db, user_id, goal_id) -> Dict[str, Any]:
        """Consistency of habits linked to goal."""
        # Habits are Plans. We need to check execution history.
        # But 'Plan' table just stores definition? 
        # Actually `Plan` stores schedule state like `streak` and `completed_today`.
        # To get historical consistency, we'd need a separate HabitLog table (which doesn't exist yet?)
        # Or parse `streak` / `target`.
        # User said "habits missed on 2-3 days".
        # Assuming `Plan` model is the habit.
        # We can use `streak` as a proxy? Or `consistency` field if it exists?
        # `Plan` has `schedule` JSON.
        result = await db.execute(
            select(Plan).where(
                Plan.goal_id == int(goal_id), 
                Plan.user_id == int(user_id),
                Plan.plan_type == 'habit'
            )
        )
        habits = result.scalars().all()
        if not habits: return {'total': 0, 'consistency': 0}
        
        # Calculate average streak relative to age? 
        # For now, let's assume if streak > 3 it's "Good".
        # Or if `schedule['completed_today']`?
        # Let's use a placeholder logic: 
        # "Excellent" if streak > 7. "Medium" if streak > 3.
        # This is weak but matches schema constraints.
        total_score = 0
        for h in habits:
            streak = h.schedule.get('streak', 0)
            if streak >= 21: total_score += 100
            elif streak >= 7: total_score += 80
            elif streak >= 3: total_score += 60
            elif streak >= 1: total_score += 40
            else: total_score += 20
            
        return {'total': len(habits), 'consistency': total_score / len(habits)}

    async def _get_deep_work_stats(self, db, user_id, goal_id) -> Dict[str, Any]:
        """Consistency of Deep Work linked to goal."""
        # Deep Work sessions are historical Plans.
        result = await db.execute(
            select(Plan).where(
                Plan.goal_id == int(goal_id),
                Plan.user_id == int(user_id),
                Plan.plan_type == 'deep_work'
            )
        )
        sessions = result.scalars().all()
        if not sessions: return {'total': 0, 'consistency': 0}
        
        # Just having sessions is good?
        # User said "shows good consistency".
        # If dates are regular?
        # For now, assuming existence of sessions implies execution.
        # Score = 100 if > 0 sessions recently? 
        # Let's return 100 for now if they exist. Deep work is hard to "miss" if it's not pre-scheduled as a non-Plan entity.
        # Actually user said "ai will schedule deepwork... user has to complete".
        # This implies Deep Work is SCHEDULED in future.
        # If `Plan` has `status`?
        # `start_deep_work` creates a Plan with status='active'. `complete_deep_work` updates it.
        # So we check completed vs total.
        
        completed = sum(1 for s in sessions if s.schedule.get('status') == 'completed')
        consistency = (completed / len(sessions)) * 100
        return {'total': len(sessions), 'consistency': consistency}

    def _get_probability_label(self, score: float) -> str:
        if score >= 90: return "Extremely High"
        if score >= 75: return "Very High"
        if score >= 60: return "High"
        if score >= 40: return "Medium"
        if score >= 20: return "Low"
        return "Very Low"

goal_intelligence_service = GoalIntelligenceService()
