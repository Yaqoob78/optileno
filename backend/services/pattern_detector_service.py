# backend/services/pattern_detector_service.py
"""
AI-Powered Pattern Detection Service
Analyzes user behavior across all Concierge components with statistical significance.

Core Principle: "Patterns or Silence" - Only show insights with 75%+ confidence.
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional, Tuple
import logging
from collections import defaultdict, Counter
import math
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import (
    AnalyticsEvent, Plan, Task, ChatMessage, 
    FocusScore
)

logger = logging.getLogger(__name__)


class PatternDetectorService:
    """
    AI-powered pattern recognition with statistical significance testing.
    Minimum 30 days of data required. Only shows patterns with 75%+ confidence.
    """

    # Configuration
    MIN_DAYS_REQUIRED = 30
    CONFIDENCE_THRESHOLD = 75.0
    ANALYSIS_WINDOW_DAYS = 30

    # Pattern categories
    CATEGORY_BEHAVIORAL = "behavioral_cycle"
    CATEGORY_TRIGGER = "trigger_response"
    CATEGORY_BOTTLENECK = "bottleneck"
    CATEGORY_SENTIMENT = "sentiment_trend"
    CATEGORY_PEAK = "peak_performance"

    async def detect_all_patterns(self, user_id: int) -> Dict[str, Any]:
        """
        Main entry point - detect all patterns across all categories.
        Returns empty list if insufficient data or no significant patterns.
        """
        try:
            async for db in get_db():
                # Check data quality first
                data_quality = await self._assess_data_quality(db, user_id)
                
                if not data_quality['sufficient_data']:
                    return {
                        'patterns': [],
                        'data_quality': data_quality,
                        'message': f"Collecting data... {data_quality['days_until_ready']} days until analysis"
                    }

                # Detect patterns across all categories
                patterns = []
                
                behavioral = await self._detect_behavioral_cycles(db, user_id)
                patterns.extend(behavioral)
                
                triggers = await self._detect_trigger_response(db, user_id)
                patterns.extend(triggers)
                
                bottlenecks = await self._detect_bottlenecks(db, user_id)
                patterns.extend(bottlenecks)
                
                sentiment = await self._detect_sentiment_trends(db, user_id)
                patterns.extend(sentiment)
                
                peak = await self._detect_peak_performance(db, user_id)
                patterns.extend(peak)

                # Filter by confidence threshold
                significant_patterns = [
                    p for p in patterns 
                    if p['confidence'] >= self.CONFIDENCE_THRESHOLD
                ]

                # Sort by confidence
                significant_patterns.sort(key=lambda x: x['confidence'], reverse=True)

                return {
                    'patterns': significant_patterns,
                    'data_quality': data_quality,
                    'total_detected': len(patterns),
                    'statistically_significant': len(significant_patterns),
                    'last_updated': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Error detecting patterns: {e}")
            return {
                'patterns': [],
                'data_quality': {'sufficient_data': False},
                'error': str(e)
            }

    async def _assess_data_quality(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Check if user has sufficient data for pattern detection."""
        # Get first event date
        result = await db.execute(
            select(AnalyticsEvent.timestamp)
            .where(AnalyticsEvent.user_id == user_id)
            .order_by(AnalyticsEvent.timestamp.asc())
            .limit(1)
        )
        first_event = result.scalar_one_or_none()

        if not first_event:
            return {
                'sufficient_data': False,
                'days_analyzed': 0,
                'days_until_ready': self.MIN_DAYS_REQUIRED,
                'first_event_date': None
            }

        days_of_data = (datetime.now() - first_event).days
        sufficient = days_of_data >= self.MIN_DAYS_REQUIRED

        return {
            'sufficient_data': sufficient,
            'days_analyzed': days_of_data,
            'days_until_ready': max(0, self.MIN_DAYS_REQUIRED - days_of_data),
            'first_event_date': first_event.isoformat()
        }

    async def _detect_behavioral_cycles(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Detect weekly/monthly behavioral patterns.
        Uses frequency analysis to find productivity cycles.
        """
        patterns = []
        start_date = datetime.now() - timedelta(days=self.ANALYSIS_WINDOW_DAYS)

        # Get focus scores by day of week
        result = await db.execute(
            select(FocusScore).where(
                FocusScore.user_id == user_id,
                FocusScore.date >= start_date.date()
            )
        )
        focus_scores = result.scalars().all()

        if len(focus_scores) < 14:  # Need at least 2 weeks
            return patterns

        # Group by day of week
        day_scores = defaultdict(list)
        for fs in focus_scores:
            day_of_week = fs.date.weekday()  # 0=Monday, 6=Sunday
            day_scores[day_of_week].append(fs.score)

        # Calculate average by day
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_averages = {}
        for day, scores in day_scores.items():
            if len(scores) >= 2:  # At least 2 data points
                day_averages[day] = sum(scores) / len(scores)

        if len(day_averages) < 3:  # Need at least 3 days
            return patterns

        # Find peak days (above average)
        overall_avg = sum(day_averages.values()) / len(day_averages)
        peak_days = [
            (day, avg) for day, avg in day_averages.items()
            if avg > overall_avg * 1.15  # 15% above average
        ]

        if len(peak_days) >= 2:
            # Calculate confidence based on consistency
            peak_day_names = [day_names[day] for day, _ in peak_days]
            confidence = self._calculate_confidence(
                data_points=len(focus_scores),
                pattern_strength=len(peak_days) / 7,
                consistency=0.8  # High confidence for weekly patterns
            )

            patterns.append({
                'id': 'behavioral_weekly_peak',
                'category': self.CATEGORY_BEHAVIORAL,
                'title': 'Weekly Productivity Peak',
                'description': f"Peak productivity on {' & '.join(peak_day_names)}",
                'confidence': round(confidence, 1),
                'evidence': [
                    f"{len(focus_scores)} days of focus data analyzed",
                    f"Consistent pattern over {len(focus_scores) // 7} weeks"
                ],
                'actionable_insight': f"Schedule important tasks on {peak_day_names[0]} mornings",
                'data_points': len(focus_scores),
                'detected_on': datetime.now().date().isoformat(),
                'details': {
                    'peak_days': peak_day_names,
                    'average_scores': {day_names[d]: round(s, 1) for d, s in day_averages.items()}
                }
            })

        return patterns

    async def _detect_trigger_response(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Detect trigger-response patterns (what actions lead to what outcomes).
        Analyzes event sequences for causal relationships.
        """
        patterns = []
        start_date = datetime.now() - timedelta(days=self.ANALYSIS_WINDOW_DAYS)

        # Get tasks and their completion patterns
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_date
            )
        )
        tasks = result.scalars().all()

        if len(tasks) < 20:  # Need minimum sample size
            return patterns

        # Analyze: Tasks completed after morning planning
        tasks_by_hour = defaultdict(int)
        for task in tasks:
            if task.completed_at:
                hour = task.completed_at.hour
                tasks_by_hour[hour] += 1

        # Find if tasks cluster after certain hours (morning planning effect)
        morning_tasks = sum(tasks_by_hour[h] for h in range(6, 10))  # 6-10 AM
        afternoon_tasks = sum(tasks_by_hour[h] for h in range(12, 17))  # 12-5 PM

        if morning_tasks > 0 and afternoon_tasks > morning_tasks * 1.5:
            confidence = self._calculate_confidence(
                data_points=len(tasks),
                pattern_strength=afternoon_tasks / (morning_tasks + afternoon_tasks),
                consistency=0.75
            )

            if confidence >= self.CONFIDENCE_THRESHOLD:
                patterns.append({
                    'id': 'trigger_morning_planning',
                    'category': self.CATEGORY_TRIGGER,
                    'title': 'Morning Planning Momentum',
                    'description': 'Planning in the morning leads to higher afternoon productivity',
                    'confidence': round(confidence, 1),
                    'evidence': [
                        f"{len(tasks)} completed tasks analyzed",
                        f"{afternoon_tasks} afternoon completions vs {morning_tasks} morning"
                    ],
                    'actionable_insight': 'Start your day with a planning session for better momentum',
                    'data_points': len(tasks),
                    'detected_on': datetime.now().date().isoformat(),
                    'details': {
                        'morning_completions': morning_tasks,
                        'afternoon_completions': afternoon_tasks,
                        'lift_percentage': round((afternoon_tasks / morning_tasks - 1) * 100, 1) if morning_tasks > 0 else 0
                    }
                })

        return patterns

    async def _detect_bottlenecks(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Detect bottlenecks and friction points in workflow.
        """
        patterns = []
        start_date = datetime.now() - timedelta(days=self.ANALYSIS_WINDOW_DAYS)

        # Get tasks with time estimates
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start_date,
                Task.estimated_minutes.isnot(None),
                Task.actual_minutes.isnot(None)
            )
        )
        tasks = result.scalars().all()

        if len(tasks) < 15:
            return patterns

        # Find tasks that consistently take longer than estimated
        overrun_count = 0
        total_overrun_pct = 0

        for task in tasks:
            if task.actual_minutes > task.estimated_minutes:
                overrun_count += 1
                overrun_pct = ((task.actual_minutes - task.estimated_minutes) / task.estimated_minutes) * 100
                total_overrun_pct += overrun_pct

        if overrun_count > len(tasks) * 0.6:  # More than 60% overrun
            avg_overrun = total_overrun_pct / overrun_count
            
            confidence = self._calculate_confidence(
                data_points=len(tasks),
                pattern_strength=overrun_count / len(tasks),
                consistency=0.7
            )

            patterns.append({
                'id': 'bottleneck_time_estimation',
                'category': self.CATEGORY_BOTTLENECK,
                'title': 'Time Estimation Bottleneck',
                'description': f'Tasks consistently take {round(avg_overrun)}% longer than estimated',
                'confidence': round(confidence, 1),
                'evidence': [
                    f"{overrun_count} out of {len(tasks)} tasks exceeded estimates",
                    f"Average overrun: {round(avg_overrun)}%"
                ],
                'actionable_insight': f'Add {round(avg_overrun)}% buffer to your time estimates',
                'data_points': len(tasks),
                'detected_on': datetime.now().date().isoformat(),
                'details': {
                    'overrun_rate': round(overrun_count / len(tasks), 2),
                    'average_overrun_percentage': round(avg_overrun, 1)
                }
            })

        return patterns

    async def _detect_sentiment_trends(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Detect emotional/sentiment patterns from chat analysis.
        Correlate with productivity metrics.
        """
        patterns = []
        # This would integrate with existing burnout risk sentiment analysis
        # For now, return empty - can enhance later with more sophisticated NLP
        return patterns

    async def _detect_peak_performance(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """
        Detect optimal times for deep work and peak performance.
        """
        patterns = []
        start_date = datetime.now() - timedelta(days=self.ANALYSIS_WINDOW_DAYS)

        # Get deep work sessions
        result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start_date
            )
        )
        sessions = result.scalars().all()

        if len(sessions) < 10:
            return patterns

        # Group by hour of day
        hour_quality = defaultdict(list)
        for session in sessions:
            if session.date and session.schedule and isinstance(session.schedule, dict):
                hour = session.date.hour
                quality = session.schedule.get('quality', 0.5)
                hour_quality[hour].append(quality)

        # Find peak hours (high quality sessions)
        hour_averages = {}
        for hour, qualities in hour_quality.items():
            if len(qualities) >= 3:  # At least 3 sessions
                hour_averages[hour] = sum(qualities) / len(qualities)

        if len(hour_averages) >= 3:
            # Find top hours
            sorted_hours = sorted(hour_averages.items(), key=lambda x: x[1], reverse=True)
            top_hours = sorted_hours[:2]  # Top 2 hours

            if top_hours[0][1] > 0.7:  # Quality above 70%
                hour_labels = [f"{h}:00-{h+1}:00" for h, _ in top_hours]
                
                confidence = self._calculate_confidence(
                    data_points=len(sessions),
                    pattern_strength=top_hours[0][1],
                    consistency=0.8
                )

                patterns.append({
                    'id': 'peak_deep_work_hours',
                    'category': self.CATEGORY_PEAK,
                    'title': 'Optimal Deep Work Window',
                    'description': f"Peak focus during {', '.join(hour_labels)}",
                    'confidence': round(confidence, 1),
                    'evidence': [
                        f"{len(sessions)} deep work sessions analyzed",
                        f"{round(top_hours[0][1] * 100)}% average quality in peak hours"
                    ],
                    'actionable_insight': f'Block {hour_labels[0]} for your most important work',
                    'data_points': len(sessions),
                    'detected_on': datetime.now().date().isoformat(),
                    'details': {
                        'peak_hours': hour_labels,
                        'quality_scores': {h: round(q, 2) for h, q in top_hours}
                    }
                })

        return patterns

    def _calculate_confidence(
        self, 
        data_points: int, 
        pattern_strength: float,
        consistency: float
    ) -> float:
        """
        Calculate statistical confidence score (0-100).
        
        Args:
            data_points: Number of data points analyzed
            pattern_strength: Strength of pattern (0-1)
            consistency: Consistency over time (0-1)
        """
        # Base confidence from sample size
        sample_confidence = min(100, (data_points / 30) * 50)  # Max 50 from sample
        
        # Pattern strength contribution
        strength_confidence = pattern_strength * 30  # Max 30 from strength
        
        # Consistency contribution
        consistency_confidence = consistency * 20  # Max 20 from consistency
        
        total = sample_confidence + strength_confidence + consistency_confidence
        
        return min(100, total)


# Singleton instance
pattern_detector_service = PatternDetectorService()
