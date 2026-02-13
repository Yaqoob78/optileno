"""
Complex Goal Analytics Service
------------------------------
This service implements advanced, AI-driven logic for tracking goal progress.
Unlike simple task counting, this service calculates a "Probability of Success"
based on:
1. Weighted Components: Habits (Consistency) vs Tasks (Completion) vs Deep Work (Focus).
2. Goal Context: Different weights for different categories (e.g., Health = High Habit weight).
3. Momentum & Decay: Recent activity boosts score; inactivity decays it.
4. AI Breakdown: Probability is derived from the structural integrity of the goal plan.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_
import math
import logging

from backend.db.database import get_db
from backend.db.models import Goal, Task, Plan, AnalyticsEvent
from backend.services.analytics_service import analytics_service

logger = logging.getLogger(__name__)

class ComplexGoalService:
    # ─────────────────────────────────────────────────────────────────────────────
    # WEIGHTING STRATEGIES (The "Reasoning" Engine)
    # ─────────────────────────────────────────────────────────────────────────────
    
    # Weights determine impact on "Probability of Success"
    COMPONENT_WEIGHTS = {
        "fitness":      {"habit": 0.60, "task": 0.20, "deep_work": 0.20}, # Consistency is king
        "learning":     {"habit": 0.40, "task": 0.30, "deep_work": 0.30}, # Balanced
        "project":      {"habit": 0.20, "task": 0.50, "deep_work": 0.30}, # Execution is king
        "financial":    {"habit": 0.50, "task": 0.40, "deep_work": 0.10}, 
        "career":       {"habit": 0.30, "task": 0.40, "deep_work": 0.30}, 
        "default":      {"habit": 0.35, "task": 0.35, "deep_work": 0.30},
    }

    async def get_goal_analytics(self, user_id: int, goal_id: int) -> Dict[str, Any]:
        """
        Main entry point. Returns the "Smart Progress" and "AI Probability".
        """
        async for db in get_db():
            goal = await db.get(Goal, goal_id)
            if not goal:
                return None

            # 1. Fetch Components
            components = await self._get_goal_components(db, user_id, goal_id)
            
            # 2. Determine Weights based on Category
            weights = self.COMPONENT_WEIGHTS.get(goal.category, self.COMPONENT_WEIGHTS["default"])
            
            # 3. Calculate Component Scores (0-100)
            scores = await self._calculate_component_scores(db, user_id, goal, components)
            
            # 4. Calculate Weighted Probability
            raw_probability = (
                (scores["habit"] * weights["habit"]) +
                (scores["task"] * weights["task"]) +
                (scores["deep_work"] * weights["deep_work"])
            )
            
            # 5. Apply Momentum & Decay (The "Real-time" dynamic factor)
            momentum_factor = await self._calculate_momentum_factor(db, user_id, goal_id)
            decay_factor = await self._calculate_decay_factor(db, user_id, goal_id)
            
            # Final Probability Calculation
            adjusted_probability = (raw_probability * momentum_factor) * decay_factor
            final_probability = min(100, max(0, adjusted_probability))
            
            # 6. Generate Insights / Reasoning
            insights = self._generate_ai_reasoning(
                final_probability, scores, weights, momentum_factor, decay_factor
            )
            
            return {
                "goal_id": goal_id,
                "smart_progress": round(final_probability, 1), # Replaces simple progress
                "status_probability": round(final_probability, 1),
                "breakdown": {
                    "habit_cscore": round(scores["habit"], 1),
                    "task_score": round(scores["task"], 1),
                    "focus_score": round(scores["deep_work"], 1),
                    "weights_used": weights
                },
                "dynamics": {
                    "momentum_boost": round((momentum_factor - 1) * 100, 1),
                    "inactivity_decay": round((1 - decay_factor) * 100, 1)
                },
                "ai_insights": insights
            }

    async def _get_goal_components(self, db, user_id: int, goal_id: int) -> Dict[str, List[Any]]:
        """Fetch all linked entities."""
        # Tasks (tagged with 'goal:ID')
        tasks_res = await db.execute(select(Task).where(Task.user_id == user_id))
        all_tasks = tasks_res.scalars().all()
        linked_tasks = [t for t in all_tasks if t.tags and f"goal:{goal_id}" in t.tags]
        
        # Habits (linked via schedule meta)
        habits_res = await db.execute(select(Plan).where(Plan.user_id == user_id, Plan.plan_type == 'habit'))
        all_habits = habits_res.scalars().all()
        linked_habits = [h for h in all_habits if h.schedule and h.schedule.get("goal_link") == str(goal_id)]
        
        # Deep Work sessions
        dw_res = await db.execute(
            select(AnalyticsEvent).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.event_type.in_(['deep_work_completed', 'deep_work_session']),
                AnalyticsEvent.meta.op('->>')('goal_id') == str(goal_id)
            )
        )
        linked_dw = dw_res.scalars().all()
        
        return {
            "tasks": linked_tasks,
            "habits": linked_habits,
            "deep_work": linked_dw
        }

    async def _calculate_component_scores(self, db, user_id: int, goal: Goal, components: Dict) -> Dict[str, float]:
        """Calculate individual 0-100 scores for each component."""
        
        # --- TASK SCORE (Completion Rate + Priority Weighting) ---
        tasks = components["tasks"]
        if not tasks:
            task_score = 0.0 
        else:
            total_weight = 0
            completed_weight = 0
            for t in tasks:
                w = 3 if t.priority == 'high' else 2 if t.priority == 'medium' else 1
                total_weight += w
                if t.status == 'completed':
                    completed_weight += w
            task_score = (completed_weight / total_weight * 100) if total_weight > 0 else 0

        # --- HABIT SCORE (Consistency & Streak) ---
        habits = components["habits"]
        if not habits:
            habit_score = 100.0 if not tasks else 50.0 # Neutral if no habits required, else punitive
            # Actually, if goal is fitness and no habits, score should be low.
            # But we handle that via main Weights. If category=fitness, Habit weight is high.
            # If no habits exist, this score contributes 0.
            if not habits: habit_score = 0.0
        else:
            habit_percentages = []
            for h in habits:
                streak = h.schedule.get("streak", 0)
                # Cap streak impact at 21 days (habit formation threshold)
                streak_score = min(100, (streak / 21) * 100)
                habit_percentages.append(streak_score)
            habit_score = sum(habit_percentages) / len(habit_percentages)

        # --- DEEP WORK SCORE (Hours Logged vs Expected) ---
        # Heuristic: Complex goals need ~10 hours deep work / month approx?
        # Better: Check accumulated time vs passed time.
        deep_works = components["deep_work"]
        total_minutes = sum([int(dw.meta.get("duration_minutes", 0)) for dw in deep_works])
        
        # Determine "Required" deep work based on goal duration so far
        # E.g., 2 hours per week expected
        created_at = goal.created_at or datetime.now(timezone.utc)
        start_date = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        weeks_active = max(1, (now - start_date).days / 7)
        
        expected_minutes = weeks_active * 120 # 2 hours/week baseline
        if expected_minutes == 0: expected_minutes = 60
        
        deep_work_score = min(100, (total_minutes / expected_minutes) * 100)

        return {
            "task": task_score,
            "habit": habit_score,
            "deep_work": deep_work_score
        }

    async def _calculate_momentum_factor(self, db, user_id: int, goal_id: int) -> float:
        """
        Boost score if user has been active RECENTLY (last 3 days).
        Multiplier: 1.0 to 1.15
        """
        now = datetime.now(timezone.utc)
        three_days_ago = now - timedelta(days=3)
        
        # Count recent events for this goal
        recent_events = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= three_days_ago,
                AnalyticsEvent.meta.op('->>')('goal_id') == str(goal_id)
            )
        )
        count = recent_events.scalar() or 0
        
        # Simple multiplier logic
        if count >= 5: return 1.15 # High momentum
        if count >= 3: return 1.10
        if count >= 1: return 1.05
        return 1.0

    async def _calculate_decay_factor(self, db, user_id: int, goal_id: int) -> float:
        """
        Reduce score if user has been INACTIVE (no events for 7+ days).
        Multiplier: 1.0 down to 0.5
        """
        # Find last event
        last_event_res = await db.execute(
            select(AnalyticsEvent.timestamp).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.meta.op('->>')('goal_id') == str(goal_id)
            ).order_by(AnalyticsEvent.timestamp.desc()).limit(1)
        )
        last_date = last_event_res.scalar()
        
        if not last_date:
            return 1.0 # No data yet, benefit of doubt
            
        if last_date.tzinfo is None:
            last_date = last_date.replace(tzinfo=timezone.utc)
            
        days_inactive = (datetime.now(timezone.utc) - last_date).days
        
        if days_inactive < 7: return 1.0
        if days_inactive < 14: return 0.90 # Slight decay
        if days_inactive < 30: return 0.75 # Significant decay
        return 0.50 # Severe decay (Ghosted goal)

    def _generate_ai_reasoning(self, probability: float, scores: Dict, weights: Dict, momentum: float, decay: float) -> List[str]:
        """Generate human-readable explanations for the score."""
        reasons = []
        
        # 1. Main Driver
        if scores["habit"] < 40 and weights["habit"] > 0.4:
            reasons.append("Low habit consistency is severely impacting your probability.")
        elif scores["task"] < 40 and weights["task"] > 0.4:
            reasons.append("Pending high-priority tasks are holding you back.")
        elif probability > 80:
            reasons.append("Excellent progress! Your balanced approach is working.")
            
        # 2. Dynamics
        if momentum > 1.05:
            reasons.append(f"Momentum Bonus: Recent activity boosted your score by {int((momentum-1)*100)}%.")
        if decay < 1.0:
            reasons.append(f"Inactivity Warning: Score decayed by {int((1-decay)*100)}% due to lack of recent progress.")
            
        # 3. Next Step Hint
        if weights["habit"] > weights["task"]:
            reasons.append("Focus on daily consistency rather than big one-off tasks for this goal.")
        
        return reasons

complex_goal_service = ComplexGoalService()
