"""
Real-Time Analytics Event Tracker - Week 1 Implementation

This service tracks user activities and updates analytics in real-time.
Integrates with planner service to track tasks, goals, habits, and deep work sessions.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.db.models import DailyAnalytics, AnalyticsEvent, Task

logger = logging.getLogger(__name__)


class RealTimeAnalyticsTracker:
    """Tracks user events and updates analytics in real-time."""
    
    async def track_event(
        self,
        user_id: int,
        event_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Track a user event and update analytics.
        
        Args:
            user_id: ID of the user
            event_type: Type of event ('task_completed', 'goal_milestone', etc.)
            metadata: Additional event metadata
        """
        try:
            async with get_db() as db:
                # 1. Create analytics event record
                event = AnalyticsEvent(
                    user_id=user_id,
                    event_type=event_type,
                    timestamp=datetime.now(),
                    meta=metadata or {},
                    event_source='planner',
                    category=self._get_category(event_type)
                )
                db.add(event)
                
                # 2. Update today's daily snapshot
                await self._update_daily_snapshot(db, user_id, event_type, metadata)
                
                # 3. Recalculate scores
                new_scores = await self._recalculate_scores(db, user_id)
                
                await db.commit()
                
                # 4. Emit WebSocket event for real-time UI update
                try:
                    from backend.realtime.socket_manager import broadcast_analytics_update
                    await broadcast_analytics_update(
                        user_id=user_id,
                        metrics={
                            'productivity_score': new_scores['productivity'],
                            'focus_score': new_scores['focus'],
                            'burnout_risk': new_scores['burnout'],
                            'timestamp': datetime.now().isoformat()
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to broadcast analytics update: {e}")
                
                logger.info(f"Tracked event {event_type} for user {user_id}")
                return event
                
        except Exception as e:
            logger.error(f"Error tracking event: {str(e)}")
            raise
    
    def _get_category(self, event_type: str) -> str:
        """Categorize event type."""
        if event_type in ['task_completed', 'task_created', 'task_started']:
            return 'task'
        elif event_type in ['goal_progress', 'goal_milestone', 'goal_completed']:
            return 'goal'
        elif event_type in ['habit_completed', 'habit_streak']:
            return 'habit'
        elif event_type in ['focus_session', 'deep_work_session']:
            return 'focus'
        else:
            return 'other'
    
    async def _update_daily_snapshot(
        self,
        db: AsyncSession,
        user_id: int,
        event_type: str,
        metadata: Optional[Dict[str, Any]]
    ):
        """Update today's daily analytics snapshot."""
        today = date.today()
        
        # Get or create today's snapshot
        result = await db.execute(
            select(DailyAnalytics).where(
                DailyAnalytics.user_id == user_id,
                func.date(DailyAnalytics.date) == today
            )
        )
        snapshot = result.scalar_one_or_none()
        
        if not snapshot:
            snapshot = DailyAnalytics(
                user_id=user_id,
                date=datetime.combine(today, datetime.min.time())
            )
            db.add(snapshot)
            await db.flush()  # Get ID
        
        # Update counts based on event type
        if event_type == 'task_completed':
            snapshot.tasks_completed += 1
        elif event_type == 'task_created':
            snapshot.tasks_created += 1
        elif event_type == 'goal_progress':
            snapshot.goals_progressed += 1
        elif event_type == 'goal_milestone':
            snapshot.goals_progressed += 1
        elif event_type == 'habit_completed':
            snapshot.habits_completed += 1
        elif event_type == 'focus_session' or event_type == 'deep_work_session':
            duration = metadata.get('duration', 0) if metadata else 0
            snapshot.total_focus_minutes += duration
            if event_type == 'deep_work_session':
                snapshot.deep_work_minutes += duration
            
            interruptions = metadata.get('interruptions', 0) if metadata else 0
            snapshot.interruptions += interruptions
        
        snapshot.updated_at = datetime.now()
    
    async def _recalculate_scores(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict[str, int]:
        """Recalculate all scores based on today's data."""
        today = date.today()
        
        # Get today's snapshot
        result = await db.execute(
            select(DailyAnalytics).where(
                DailyAnalytics.user_id == user_id,
                func.date(DailyAnalytics.date) == today
            )
        )
        snapshot = result.scalar_one_or_none()
        
        if not snapshot:
            return {'productivity': 0, 'focus': 0, 'burnout': 0}
        
        # Calculate productivity score (0-100)
        productivity = min(100, (
            snapshot.tasks_completed * 10 +
            snapshot.goals_progressed * 20 +
            snapshot.habits_completed * 8 +
            (snapshot.total_focus_minutes // 10) * 3
        ))
        
        # Calculate focus score (0-100)
        if snapshot.total_focus_minutes > 0:
            # Base score from duration (2 points per minute, capped at 90)
            focus = min(90, snapshot.total_focus_minutes // 2)
            
            # Penalty for interruptions (-5 per interruption, max -30)
            interruption_penalty = min(30, snapshot.interruptions * 5)
            focus = max(0, focus - interruption_penalty)
            
            # Bonus for deep work (+10%)
            if snapshot.deep_work_minutes > 60:
                focus = min(100, int(focus * 1.1))
        else:
            focus = 0
        
        # Calculate burnout risk (0-100, lower is better)
        work_hours = snapshot.total_focus_minutes / 60
        burnout = min(100, int(
            (work_hours / 8) * 50 +  # > 8 hours = higher risk
            (snapshot.interruptions / 10) * 30 +  # High interruptions = stress
            (snapshot.tasks_created - snapshot.tasks_completed) * 2  # Backlog = pressure
        ))
        
        # Update snapshot with calculated scores
        snapshot.productivity_score = productivity
        snapshot.focus_score = focus
        snapshot.burnout_risk = burnout
        
        return {
            'productivity': productivity,
            'focus': focus,
            'burnout': burnout
        }
    
    async def get_today_scores(self, user_id: int) -> Dict[str, Any]:
        """Get today's real-time scores."""
        async with get_db() as db:
            today = date.today()
            
            result = await db.execute(
                select(DailyAnalytics).where(
                    DailyAnalytics.user_id == user_id,
                    func.date(DailyAnalytics.date) == today
                )
            )
            snapshot = result.scalar_one_or_none()
            
            if not snapshot:
                # Create empty snapshot
                snapshot = DailyAnalytics(
                    user_id=user_id,
                    date=datetime.combine(today, datetime.min.time())
                )
                db.add(snapshot)
                await db.commit()
            
            return {
                'productivity_score': snapshot.productivity_score,
                'focus_score': snapshot.focus_score,
                'burnout_risk': snapshot.burnout_risk,
                'tasks_completed': snapshot.tasks_completed,
                'goals_progressed': snapshot.goals_progressed,
                'habits_completed': snapshot.habits_completed,
                'focus_minutes': snapshot.total_focus_minutes,
                'last_updated': snapshot.updated_at.isoformat() if snapshot.updated_at else None
            }
    
    async def get_historical_data(
        self,
        user_id: int,
        time_range: str = 'daily'
    ) -> list:
        """
        Get historical analytics data.
        
        Args:
            user_id: User ID
            time_range: 'daily', 'weekly', or 'monthly'
        
        Returns:
            List of daily analytics data
        """
        async with get_db() as db:
            if time_range == 'daily':
                # Last 30 days
                start_date = date.today() - timedelta(days=30)
            elif time_range == 'weekly':
                # Last 12 weeks
                start_date = date.today() - timedelta(weeks=12)
            elif time_range == 'monthly':
                # Last 12 months
                start_date = date.today() - timedelta(days=365)
            else:
                start_date = date.today() - timedelta(days=30)
            
            result = await db.execute(
                select(DailyAnalytics).where(
                    DailyAnalytics.user_id == user_id,
                    func.date(DailyAnalytics.date) >= start_date
                ).order_by(DailyAnalytics.date)
            )
            
            daily_data = result.scalars().all()
            
            return [
                {
                    'date': d.date.isoformat(),
                    'productivity_score': d.productivity_score,
                    'focus_score': d.focus_score,
                    'burnout_risk': d.burnout_risk,
                    'tasks_completed': d.tasks_completed,
                    'focus_minutes': d.total_focus_minutes,
                    'habits_completed': d.habits_completed,
                    'goals_progressed': d.goals_progressed
                }
                for d in daily_data
            ]


# Singleton instance
realtime_analytics = RealTimeAnalyticsTracker()
