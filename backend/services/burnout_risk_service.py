# backend/services/burnout_risk_service.py
"""
AI-Powered Burnout Risk Calculation Service
Analyzes work patterns, chat sentiment, and activity levels to predict burnout risk.
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
import logging
import re
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import AnalyticsEvent, Plan, Task, ChatMessage, ChatSession

logger = logging.getLogger(__name__)


class BurnoutRiskService:
    """
    AI-powered burnout risk assessment.
    Score range: 0-100 (0 = no risk, 100 = extreme burnout risk)
    """

    # Burnout indicators from chat
    BURNOUT_KEYWORDS = {
        'extreme': ['exhausted', 'burned out', 'burnout', 'can\'t take it', 'overwhelmed', 'breaking down', 'too much'],
        'high': ['tired', 'stressed', 'anxious', 'pressure', 'struggling', 'difficult', 'hard time', 'overworked'],
        'moderate': ['busy', 'hectic', 'rushed', 'behind', 'deadline', 'worried', 'concerned'],
        'recovery': ['rest', 'break', 'relax', 'sleep', 'vacation', 'time off', 'recharge']
    }

    # Time thresholds
    SAFE_HOURS = 1.0          # Under 1 hour = 0 risk
    MODERATE_HOURS = 5.0      # After 5 hours, risk increases rapidly
    EXTREME_HOURS = 10.0      # 10+ hours = very high risk

    async def calculate_burnout_risk(
        self, 
        user_id: int, 
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate burnout risk for a given day.
        Returns risk score (0-100) with AI-powered insights.
        """
        if target_date is None:
            target_date = date.today()

        try:
            async for db in get_db():
                # Calculate individual risk factors
                time_risk = await self._calculate_time_based_risk(db, user_id, target_date)
                workload_risk = await self._calculate_workload_risk(db, user_id, target_date)
                chat_sentiment_risk = await self._analyze_chat_sentiment(db, user_id, target_date)
                deep_work_risk = await self._calculate_deep_work_risk(db, user_id, target_date)
                recovery_score = await self._calculate_recovery_indicators(db, user_id, target_date)

                # Weighted calculation
                # Time and workload are primary factors
                # Chat sentiment can override if AI detects stress
                # Recovery reduces risk
                base_risk = (
                    time_risk * 0.35 +           # 35% - Hours worked
                    workload_risk * 0.25 +       # 25% - Tasks/deep work
                    chat_sentiment_risk * 0.30 + # 30% - AI sentiment analysis
                    deep_work_risk * 0.10        # 10% - Deep work intensity
                )

                # Apply recovery reduction
                final_risk = max(0, base_risk - recovery_score)

                # Cap at 100
                final_risk = min(100, final_risk)

                return {
                    "risk": round(final_risk, 1),
                    "date": target_date.isoformat(),
                    "level": self._get_risk_level(final_risk),
                    "breakdown": {
                        "time_based": round(time_risk, 1),
                        "workload": round(workload_risk, 1),
                        "chat_sentiment": round(chat_sentiment_risk, 1),
                        "deep_work_intensity": round(deep_work_risk, 1),
                        "recovery_bonus": round(recovery_score, 1)
                    },
                    "ai_insights": await self._generate_ai_insights(
                        db, user_id, target_date, final_risk, chat_sentiment_risk
                    ),
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

    async def _calculate_time_based_risk(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Calculate risk based on time spent on platform.
        - Under 1 hour: 0 risk
        - 1-5 hours: Gradual increase (very slow)
        - 5+ hours: Rapid increase (1% per 4 minutes)
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Count analytics events to estimate active time
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

        if estimated_hours < self.SAFE_HOURS:
            return 0
        elif estimated_hours < self.MODERATE_HOURS:
            # Slow gradual increase: 1-5 hours = 0-25 risk
            hours_over_safe = estimated_hours - self.SAFE_HOURS
            return (hours_over_safe / 4) * 25  # 6.25 risk per hour
        else:
            # Rapid increase after 5 hours
            hours_over_moderate = estimated_hours - self.MODERATE_HOURS
            minutes_over = hours_over_moderate * 60
            
            # 1% risk per 4 minutes after 5 hours
            rapid_risk = (minutes_over / 4) * 1
            
            # Base risk at 5 hours is 25, then add rapid increase
            return min(100, 25 + rapid_risk)

    async def _calculate_workload_risk(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Calculate risk based on tasks completed.
        Each task = +1 risk
        Helps identify overwork patterns.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Count completed tasks
        result = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_time,
                Task.completed_at <= end_time
            )
        )
        task_count = result.scalar() or 0

        # Each task adds 1% risk
        # Cap at 50% from tasks alone
        return min(50, task_count * 1)

    async def _calculate_deep_work_risk(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Calculate risk from deep work sessions.
        Each deep work block = +15 risk
        Intense focus can lead to burnout if excessive.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get deep work sessions
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start_time,
                Plan.date <= end_time
            )
        )
        deep_work_sessions = result.scalars().all()

        # Each completed deep work block = +15 risk
        completed_blocks = 0
        for session in deep_work_sessions:
            if session.schedule and isinstance(session.schedule, dict):
                if session.schedule.get('completed') or session.schedule.get('status') == 'completed':
                    completed_blocks += 1

        # Cap at 60% from deep work
        return min(60, completed_blocks * 15)

    async def _analyze_chat_sentiment(self, db: Session, user_id: int, target_date: date) -> float:
        """
        AI-powered sentiment analysis from chat messages.
        Analyzes user's language for burnout indicators.
        This is the AI component that can override other metrics.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        # Get recent chat messages - join through ChatSession to get user_id
        result = await db.execute(
            select(ChatMessage)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.created_at >= start_time,
                ChatMessage.created_at <= end_time,
                ChatMessage.role == 'user'  # Only analyze user messages
            ).order_by(desc(ChatMessage.created_at)).limit(50)
        )
        messages = result.scalars().all()

        if not messages:
            return 0  # No chat data = neutral

        # Analyze message content for burnout keywords
        extreme_count = 0
        high_count = 0
        moderate_count = 0
        recovery_count = 0

        for message in messages:
            content = message.content.lower()
            
            # Check for extreme burnout indicators
            for keyword in self.BURNOUT_KEYWORDS['extreme']:
                if keyword in content:
                    extreme_count += 1
            
            # Check for high stress indicators
            for keyword in self.BURNOUT_KEYWORDS['high']:
                if keyword in content:
                    high_count += 1
            
            # Check for moderate stress
            for keyword in self.BURNOUT_KEYWORDS['moderate']:
                if keyword in content:
                    moderate_count += 1
            
            # Check for recovery language
            for keyword in self.BURNOUT_KEYWORDS['recovery']:
                if keyword in content:
                    recovery_count += 1

        # Calculate sentiment risk
        # Extreme keywords = 20 risk each
        # High keywords = 10 risk each
        # Moderate keywords = 5 risk each
        # Recovery keywords = -10 risk each
        sentiment_risk = (
            extreme_count * 20 +
            high_count * 10 +
            moderate_count * 5 -
            recovery_count * 10
        )

        # AI can push risk very high if detecting severe stress
        return max(0, min(100, sentiment_risk))

    async def _calculate_recovery_indicators(self, db: Session, user_id: int, target_date: date) -> float:
        """
        Calculate recovery score (reduces burnout risk).
        Looks for breaks, rest periods, and recovery activities.
        """
        start_time = datetime.combine(target_date, time.min)
        end_time = datetime.combine(target_date, time.max)

        recovery_score = 0

        # Check for break/rest plans
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.date >= start_time,
                Plan.date <= end_time,
                or_(
                    Plan.plan_type == 'break',
                    Plan.plan_type == 'rest',
                    Plan.name.ilike('%break%'),
                    Plan.name.ilike('%rest%')
                )
            )
        )
        break_plans = result.scalars().all()
        
        # Each break reduces risk by 5
        recovery_score += len(break_plans) * 5

        # Check for recovery keywords in chat - join through ChatSession to get user_id
        result = await db.execute(
            select(ChatMessage)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.created_at >= start_time,
                ChatMessage.created_at <= end_time,
                ChatMessage.role == 'user'
            )
        )
        messages = result.scalars().all()

        for message in messages:
            content = message.content.lower()
            for keyword in self.BURNOUT_KEYWORDS['recovery']:
                if keyword in content:
                    recovery_score += 3
                    break  # Count once per message

        # Cap recovery bonus at 30
        return min(30, recovery_score)

    async def _generate_ai_insights(
        self, 
        db: Session, 
        user_id: int, 
        target_date: date, 
        risk_score: float,
        sentiment_risk: float
    ) -> List[str]:
        """
        Generate AI-powered insights about burnout risk.
        """
        insights = []

        if risk_score < 20:
            insights.append("✅ Healthy work pattern detected")
        elif risk_score < 40:
            insights.append("⚠️ Moderate activity - monitor your energy")
        elif risk_score < 60:
            insights.append("🔶 Elevated risk - consider taking breaks")
        elif risk_score < 80:
            insights.append("🔴 High burnout risk - rest is recommended")
        else:
            insights.append("🚨 Critical burnout risk - immediate rest needed")

        # Add sentiment-specific insights
        if sentiment_risk > 50:
            insights.append("🤖 AI detected stress indicators in your messages")
        elif sentiment_risk > 30:
            insights.append("💬 Your language suggests increased pressure")

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
        """Get recommendation based on risk level."""
        if risk < 20:
            return "Keep up the balanced pace"
        elif risk < 40:
            return "Consider scheduling short breaks"
        elif risk < 60:
            return "Take a 15-minute break soon"
        elif risk < 80:
            return "Stop and rest - burnout prevention needed"
        else:
            return "Immediate rest required - step away from work"

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
burnout_risk_service = BurnoutRiskService()
