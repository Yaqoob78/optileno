import math
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

class DeterministicAnalyticsEngine:
    """
    Mathematically grounded analytics engine without arbitrary values or placeholders.
    It guarantees deterministic, normalized output scores between 0-100 built entirely
    out of the actual raw data vectors available.
    """

    # --- Productivity Score Constraints ---
    PRODUCTIVITY_WEIGHTS = {
        "tasks_completed": 0.40,
        "on_time_completion": 0.20,
        "habits_maintained": 0.25,
        "deep_work_volume": 0.15
    }

    @staticmethod
    def calculate_productivity_score(
        tasks_created: int,
        tasks_completed: int,
        tasks_completed_on_time: int,
        tasks_completed_late: int,
        habits_due: int,
        habits_completed: int,
        deep_work_minutes: int,
        active_days_history: int = 7
    ) -> Dict[str, Any]:
        """
        Calculates a deterministic Productivity Score.
        Constraints:
        - Scheduling alone does NOT inflate productivity (Tasks created is a denominator, not a score booster).
        - Completion ALWAYS weighs more than creation.
        - On-time completion > Late completion.
        - Math prevents new users from getting fake 90s simply by creating empty lists.
        """
        # 1. Task Completion Score (Max 100)
        task_completion_score = 0.0
        if tasks_created > 0:
            task_completion_rate = min(tasks_completed / max(tasks_created, 1), 1.0)
            task_completion_score = task_completion_rate * 100.0
        elif tasks_completed > 0: 
            # Dealing with ghost tasks (completed but unrecorded creation)
            task_completion_score = 100.0

        # 2. On-Time vs Late Modifier (Max 100)
        on_time_score = 0.0
        if tasks_completed > 0:
            # Late tasks are penalized by 50% value compared to on-time tasks
            weighted_completions = tasks_completed_on_time + (tasks_completed_late * 0.5)
            on_time_score = (weighted_completions / tasks_completed) * 100.0
        
        # 3. Habit Maintenance Score (Max 100)
        habit_score = 0.0
        if habits_due > 0:
            habit_score = min(habits_completed / habits_due, 1.0) * 100.0
        elif habits_completed > 0:
            habit_score = 100.0
            
        # 4. Deep Work Volume Score (Max 100)
        # Assuming ~120 minutes is a "perfect" deep work day based on cognitive limits.
        deep_work_score = min(deep_work_minutes / 120.0, 1.0) * 100.0

        print(f"[Engine] Sub-scores: Task:{task_completion_score} OnTime:{on_time_score} Habit:{habit_score} Focus:{deep_work_score}")

        # Combine logic using strict mathematical weights
        W = DeterministicAnalyticsEngine.PRODUCTIVITY_WEIGHTS
        
        # Prevent new users with 0 data from getting arbitrary baseline scores
        total_actions = tasks_created + tasks_completed + habits_due + deep_work_minutes
        
        if total_actions == 0:
            return {
                "score": 0.0,
                "status": "No Activity",
                "components": {
                    "task_completion": 0.0,
                    "on_time": 0.0,
                    "habit_maintenance": 0.0,
                    "deep_work": 0.0
                }
            }

        final_score = (
            (task_completion_score * W["tasks_completed"]) +
            (on_time_score * W["on_time_completion"]) +
            (habit_score * W["habits_maintained"]) +
            (deep_work_score * W["deep_work_volume"])
        )

        # Smooth scaling using active history to prevent 0 -> 100 spikes on day 1
        # It takes ~3 days of consistency to start proving real trend, scaling up to 100% capacity at 7 days
        reliability_factor = min(max(active_days_history / 7.0, 0.4), 1.0) # Floor at 0.4 so new users aren't too discouraged.
        smoothed_score = final_score * reliability_factor

        return {
            "score": round(smoothed_score, 1),
            "raw_score": round(final_score, 1),
            "reliability_factor": round(reliability_factor, 2),
            "status": DeterministicAnalyticsEngine._get_status_from_score(smoothed_score),
            "components": {
                "task_completion": round(task_completion_score, 1),
                "on_time": round(on_time_score, 1),
                "habit_maintenance": round(habit_score, 1),
                "deep_work": round(deep_work_score, 1)
            }
        }

    @staticmethod
    def calculate_focus_score(
        actual_duration_minutes: int,
        planned_duration_minutes: int,
        interruptions_count: int,
        time_of_day_hours: int
    ) -> float:
        """
        Focus score strictly bounded 0-100 without random generation.
        Based on: Actual/Planned adherence, interruption penalties.
        """
        if planned_duration_minutes <= 0 and actual_duration_minutes <= 0:
            return 0.0
            
        planned = float(max(planned_duration_minutes, 1))
        
        # 1. Adherence Ratio (Did they sit for the time intended?)
        adherence_ratio = min(actual_duration_minutes / planned, 1.0)
        base_score = adherence_ratio * 100.0
        
        # 2. Distraction Penalty (Deterministic decay)
        # Each interruption penalizes the session by 15%, decaying exponentially.
        # e.g., 1 interruption = 0.85 multiplier. 2 = 0.72. 3 = 0.61.
        distraction_modifier = math.pow(0.85, interruptions_count)
        
        # 3. Circadian Edge Handling 
        # Deep work between 2 AM and 5 AM implies forced/exhausted focus in most chronotypes
        circadian_modifier = 1.0
        if 2 <= time_of_day_hours <= 5:
            circadian_modifier = 0.85 # 15% penalty to cognitive output assumptions

        final_focus = base_score * distraction_modifier * circadian_modifier
        
        return round(min(max(final_focus, 0.0), 100.0), 1)

    @staticmethod
    def calculate_burnout_risk(
        average_daily_work_minutes_7d: float,
        missed_habits_7d: int,
        late_tasks_ratio_7d: float,
        weekend_work_ratio: float
    ) -> float:
        """
        Calculates Burnout Risk (0-100).
        High burnout = High sustained work + dropping balls (missed habits/late tasks) + lack of rest.
        """
        # Feature 1: Overwork (Max at 600 mins/day = 10 hours of focused logging)
        work_load = min(average_daily_work_minutes_7d / 600.0, 1.0) * 40.0
        
        # Feature 2: Dropped Balls (Indicators that cognitive load is failing)
        # Missing > 5 habits a week indicates breakdown of routine. Max penalty at 5+.
        habit_failure_load = min(missed_habits_7d / 5.0, 1.0) * 25.0
        
        # Task failure (Ratio of late completions or complete misses)
        task_failure_load = min(late_tasks_ratio_7d, 1.0) * 20.0
        
        # Feature 3: Recovery Deficit (Working on weekends)
        weekend_penalty = min(weekend_work_ratio, 1.0) * 15.0
        
        total_risk = work_load + habit_failure_load + task_failure_load + weekend_penalty
        return round(min(max(total_risk, 0.0), 100.0), 1)

    @staticmethod
    def calculate_goal_probability(
        task_completion_ratio: float,
        habit_consistency_ratio: float,
        momentum_trend_slope: float,
        days_remaining_ratio: float
    ) -> Dict[str, Any]:
        """
        Goal Progress Probability Bands entirely driven by mathematical decay and velocity.
        """
        # Base probability is the structural completion of the scaffolding (tasks & habits)
        base_probability = (task_completion_ratio * 0.6) + (habit_consistency_ratio * 0.4)
        
        # Momentum acts as a velocity multiplier. If slope is positive, probability increases.
        # trend slope assuming normalized between -1.0 to 1.0.
        momentum_modifier = 1.0 + (max(min(momentum_trend_slope, 1.0), -1.0) * 0.25) 
        
        # Time pressure: If time is running out (days_remaining_ratio -> 0.0) and base_probability is low,
        # it decays the final probability sharply.
        time_modifier = 1.0
        if days_remaining_ratio < 0.25 and base_probability < 0.5:
            # 25% time left but less than 50% done = exponential drop-off
            time_modifier = math.pow(days_remaining_ratio / 0.25, 2)
            
        final_probability_score = min(max(base_probability * momentum_modifier * time_modifier * 100.0, 0.0), 100.0)
        
        # Band Resolution
        band = "very low"
        if final_probability_score >= 85: band = "very high"
        elif final_probability_score >= 65: band = "high"
        elif final_probability_score >= 40: band = "mid"
        elif final_probability_score >= 20: band = "low"
        
        return {
            "probability_score": round(final_probability_score, 1),
            "band": band
        }

    @staticmethod
    def _get_status_from_score(score: float) -> str:
        if score >= 90: return "Exceptional"
        if score >= 75: return "Strong"
        if score >= 50: return "Moderate"
        if score >= 25: return "Fair"
        return "Needs Improvement"

# -----------------
# EXAMPLE EXECUTION (To ensure no assumptions)
# -----------------
if __name__ == "__main__":
    # Example Calculation
    # User creates 10 tasks, completes 8 (6 on time, 2 late).
    # Has 4 habits due, does 3.
    # Does 90 minutes deep work.
    # Has been active on the app for 5 days.
    result = DeterministicAnalyticsEngine.calculate_productivity_score(
        tasks_created=10,
        tasks_completed=8,
        tasks_completed_on_time=6,
        tasks_completed_late=2,
        habits_due=4,
        habits_completed=3,
        deep_work_minutes=90,
        active_days_history=5
    )
    
    print("\n[Simulation] Output:")
    for k,v in result.items(): print(f"{k}: {v}")
