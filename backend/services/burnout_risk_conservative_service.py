# backend/services/burnout_risk_conservative_service.py
"""
Conservative Burnout Risk Assessment Service
Probabilistic risk based on observable work patterns:
- Work Hour Volatility (30%): Inconsistent work patterns
- Task Overload Ratio (25%): Capacity vs demand
- Recovery Deficit (25%): Work without rest
- Late-Night Activity (15%): Poor work-life boundaries
- Goal Slippage Trend (5%): Falling behind on goals

Minimal AI - pattern clustering and trend deviation only
NO emotion prediction, NO fake psychology
Conservative estimates, probabilistic language
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
import statistics
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import AnalyticsEvent, Task, Goal

logger = logging.getLogger(__name__)


class BurnoutRiskConservativeService:
    """
    Conservative Burnout Risk Assessment.
    Observable patterns only - no emotion prediction.
    """

    # Component weights (total = 100%)
    WEIGHTS = {
        "work_hour_volatility": 0.30,   # 30% - Inconsistent patterns
        "task_overload_ratio": 0.25,     # 25% - Capacity vs demand
        "recovery_deficit": 0.25,        # 25% - No rest days
        "late_night_activity": 0.15,     # 15% - Poor boundaries
        "goal_slippage": 0.05            # 5% - Falling behind
    }

    # Late night threshold (10 PM)
    LATE_NIGHT_HOUR = 22

    async def calculate_burnout_risk(
        self, 
        user_id: int, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate conservative burnout risk for a given day.
        Returns risk score (0-100) with probabilistic insights.
        """
        if target_date is None:
            target_date = date.today()

        try:
            async for db in get_db():
                # Calculate individual risk factors
                volatility_risk = await self._calculate_work_hour_volatility(db, user_id, target_date)
                overload_risk = await self._calculate_task_overload_ratio(db, user_id, target_date)
                recovery_risk = await self._calculate_recovery_deficit(db, user_id, target_date)
                late_night_risk = await self._calculate_late_night_activity(db, user_id, target_date)
                goal_risk = await self._calculate_goal_slippage(db, user_id, target_date)

                # Weighted total
                total_risk = (
                    volatility_risk * self.WEIGHTS["work_hour_volatility"] +
                    overload_risk * self.WEIGHTS["task_overload_ratio"] +
                    recovery_risk * self.WEIGHTS["recovery_deficit"] +
                    late_night_risk * self.WEIGHTS["late_night_activity"] +
                    goal_risk * self.WEIGHTS["goal_slippage"]
                )

                # Cap at 100
                final_risk = min(100, total_risk)

                # Generate probabilistic insights
                insights = self._generate_probabilistic_insights(
                    volatility_risk,
                    overload_risk,
                    recovery_risk,
                    late_night_risk,
                    goal_risk
                )

                return {
                    "risk": round(final_risk, 1),
                    "date": target_date.isoformat(),
                    "level": self._get_risk_level(final_risk),
                    "breakdown": {
                        "work_hour_volatility": round(volatility_risk, 1),
                        "task_overload_ratio": round(overload_risk, 1),
                        "recovery_deficit": round(recovery_risk, 1),
                        "late_night_activity": round(late_night_risk, 1),
                        "goal_slippage": round(goal_risk, 1)
                    },
                    "ai_insights": insights,
                    "recommendation": self._get_recommendation(final_risk)
                }
        except Exception as e:
            logger.error(f"Error calculating burnout risk: {e}")
            return {
                "risk": 0,
                "date": target_date.isoformat(),
                "level": "Unknown",
                "breakdown": {},
                "ai_insights": [],
                "recommendation": "Unable to assess",
                "error": str(e)
            }

    async def _calculate_work_hour_volatility(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Work Hour Volatility (30% weight)
        Inconsistent work patterns = risk
        
        Calculates standard deviation of work hours over last 7 days.
        High variance = high risk (erratic patterns)
        """
        daily_hours = []
        
        for i in range(7):
            check_date = target_date - timedelta(days=i)
            start_time = datetime.combine(check_date, time.min)
            end_time = datetime.combine(check_date, time.max)

            # Count analytics events to estimate hours
            result = await db.execute(
                select(func.count(AnalyticsEvent.id)).where(
                    AnalyticsEvent.user_id == user_id,
                    AnalyticsEvent.timestamp >= start_time,
                    AnalyticsEvent.timestamp <= end_time
                )
            )
            event_count = result.scalar() or 0
            
            # Estimate hours (1 event per 30 seconds)
            estimated_hours = event_count / 120
            daily_hours.append(estimated_hours)

        if len(daily_hours) < 2:
            return 0  # Not enough data

        # Calculate volatility
        mean_hours = statistics.mean(daily_hours)
        
        if mean_hours == 0:
            return 0
        
        std_deviation = statistics.stdev(daily_hours)
        
        # Volatility score (higher std = higher risk)
        volatility_score = (std_deviation / mean_hours) * 100
        
        return min(100, volatility_score)

    async def _calculate_task_overload_ratio(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Task Overload Ratio (25% weight)
        Capacity vs demand
        
        Calculates days needed to clear backlog:
        - ≤1 day = 0 risk
        - 3 days = 30 risk
        - 7 days = 60 risk
        - >7 days = 90 risk
        """
        # Get planned tasks
        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                or_(Task.status == 'planned', Task.status == 'pending')
            )
        )
        tasks_planned = result.scalar() or 0

        # Get completion rate (last 7 days)
        start_week = target_date - timedelta(days=7)
        start_time = datetime.combine(start_week, time.min)
        end_time = datetime.combine(target_date, time.max)

        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_time,
                Task.completed_at <= end_time
            )
        )
        tasks_completed = result.scalar() or 0

        # Calculate average completion rate
        avg_completion_rate = tasks_completed / 7

        if avg_completion_rate == 0:
            return 0  # No data

        # Days to clear backlog
        days_to_clear = tasks_planned / avg_completion_rate

        # Convert to risk score
        if days_to_clear <= 1.0:
            return 0
        elif days_to_clear <= 3.0:
            return 30
        elif days_to_clear <= 7.0:
            return 60
        else:
            return 90

    async def _calculate_recovery_deficit(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Recovery Deficit (25% weight)
        Work without rest = burnout
        
        Checks last 7 days for rest days (work hours < 1):
        - 2+ rest days = 0 risk
        - 1 rest day = 40 risk
        - 0 rest days = 80 risk
        """
        rest_days = 0
        
        for i in range(7):
            check_date = target_date - timedelta(days=i)
            start_time = datetime.combine(check_date, time.min)
            end_time = datetime.combine(check_date, time.max)

            # Count analytics events
            result = await db.execute(
                select(func.count(AnalyticsEvent.id)).where(
                    AnalyticsEvent.user_id == user_id,
                    AnalyticsEvent.timestamp >= start_time,
                    AnalyticsEvent.timestamp <= end_time
                )
            )
            event_count = result.scalar() or 0
            
            # Estimate hours
            estimated_hours = event_count / 120
            
            # Rest day = < 1 hour of work
            if estimated_hours < 1.0:
                rest_days += 1

        # Calculate recovery ratio
        recovery_ratio = rest_days / 7

        # Convert to risk
        if recovery_ratio >= 0.3:  # 2+ rest days
            return 0
        elif recovery_ratio >= 0.15:  # 1 rest day
            return 40
        else:  # No rest
            return 80

    async def _calculate_late_night_activity(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Late-Night Activity (15% weight)
        Work after 10 PM = poor boundaries
        
        Calculates % of events after 10 PM:
        - <10% = 0 risk
        - 10-25% = 40 risk
        - >25% = 80 risk
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Count total events
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start_time,
                AnalyticsEvent.timestamp <= end_time
            )
        )
        total_events = result.scalar() or 0

        if total_events == 0:
            return 0  # No data

        # Count late-night events (after 10 PM)
        result = await db.execute(
            select(func.count(AnalyticsEvent.id)).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= start_time,
                AnalyticsEvent.timestamp <= end_time,
                func.extract('hour', AnalyticsEvent.timestamp) >= self.LATE_NIGHT_HOUR
            )
        )
        late_night_events = result.scalar() or 0

        # Calculate ratio
        late_night_ratio = late_night_events / total_events

        # Convert to risk
        if late_night_ratio < 0.1:  # <10%
            return 0
        elif late_night_ratio < 0.25:  # 10-25%
            return 40
        else:  # >25%
            return 80

    async def _calculate_goal_slippage(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date
    ) -> float:
        """
        Goal Slippage Trend (5% weight)
        Falling behind on goals = stress
        
        Calculates % of overdue goals:
        - 0% = 0 risk
        - 50% = 50 risk
        - 100% = 100 risk
        """
        # Get active goals
        result = await db.execute(
            select(Goal).where(
                Goal.user_id == user_id,
                Goal.current_progress < 100
            )
        )
        active_goals = result.scalars().all()

        if not active_goals:
            return 0  # No goals = no risk

        # Count overdue goals
        overdue_count = 0
        for goal in active_goals:
            if goal.target_date:
                # Handle both date and datetime
                if isinstance(goal.target_date, datetime):
                    target = goal.target_date.date()
                else:
                    target = goal.target_date
                
                if target < target_date:
                    overdue_count += 1

        # Calculate slippage ratio
        slippage_ratio = overdue_count / len(active_goals)
        
        return slippage_ratio * 100

    def _generate_probabilistic_insights(
        self,
        volatility: float,
        overload: float,
        recovery: float,
        late_night: float,
        goal_slippage: float
    ) -> List[str]:
        """
        Generate probabilistic insights (NOT emotional predictions).
        Uses factual, observable language.
        """
        insights = []

        # Volatility insights
        if volatility > 60:
            insights.append("Risk increasing due to inconsistent work hour patterns")
        elif volatility > 30:
            insights.append("Work hours show moderate variability")

        # Overload insights
        if overload > 60:
            insights.append("Task backlog exceeds 7-day clearance capacity")
        elif overload > 30:
            insights.append("Task backlog requires 3+ days to clear")

        # Recovery insights
        if recovery > 60:
            insights.append("No rest days detected in last 7 days")
        elif recovery > 30:
            insights.append("Limited recovery time in recent week")

        # Late-night insights
        if late_night > 60:
            insights.append("High proportion of late-night activity (>25%)")
        elif late_night > 30:
            insights.append("Moderate late-night work detected")

        # Goal slippage insights
        if goal_slippage > 50:
            insights.append("Majority of goals past target dates")

        # If no significant risks
        if not insights:
            insights.append("Work patterns within normal parameters")

        return insights

    def _get_risk_level(self, risk: float) -> str:
        """Convert risk score to level."""
        if risk < 20:
            return "Low"
        elif risk < 40:
            return "Moderate"
        elif risk < 60:
            return "Elevated"
        elif risk < 80:
            return "High"
        else:
            return "Critical"

    def _get_recommendation(self, risk: float) -> str:
        """Get recommendation based on risk level (factual, not emotional)."""
        if risk < 20:
            return "Current work patterns sustainable"
        elif risk < 40:
            return "Consider scheduling regular breaks"
        elif risk < 60:
            return "Recommend reducing workload or adding rest days"
        elif risk < 80:
            return "Work pattern adjustment recommended"
        else:
            return "Immediate workload reduction advised"

    async def get_weekly_average(self, user_id: int) -> Dict[str, Any]:
        """Calculate average burnout risk for the last 7 days."""
        risks = []
        
        for i in range(7):
            target_date = date.today() - timedelta(days=i)
            result = await self.calculate_burnout_risk(user_id, target_date)
            risks.append(result["risk"])

        avg_risk = sum(risks) / len(risks) if risks else 0

        return {
            "average_risk": round(avg_risk, 1),
            "level": self._get_risk_level(avg_risk),
            "period": "weekly",
            "days": 7
        }

    async def get_monthly_risk(self, user_id: int) -> Dict[str, Any]:
        """
        Monthly burnout risk always returns 0.
        Burnout is a short-term phenomenon, not monthly.
        """
        return {
            "average_risk": 0,
            "level": "Not Applicable",
            "period": "monthly",
            "days": 30,
            "note": "Burnout risk is assessed daily/weekly only"
        }


# Singleton instance
burnout_risk_conservative_service = BurnoutRiskConservativeService()
