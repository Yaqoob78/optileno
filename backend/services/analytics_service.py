# backend/services/analytics_service.py
"""
Complete analytics service with real-time processing and AI integration.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func
import asyncio
import json
import logging

from backend.db.session import get_db
from backend.db.models import (
    UserAnalytics, AnalyticsEvent, UserInsight, 
    BehavioralPattern, RealTimeMetrics, AIAnalysis
)
from backend.analytics.processors.even_normalizer import normalize_event

logger = logging.getLogger(__name__)

class AnalyticsService:
    """Complete analytics service with real-time processing"""
    
    async def save_event(self, event_data: Dict[str, Any]) -> AnalyticsEvent:
        """
        Save event with proper normalization and trigger processing.
        """
        async for db in get_db():
            # Normalize event first
            normalized = await normalize_event(event_data)
            
            try:
                ts = datetime.fromisoformat(normalized["timestamp"].replace('Z', '+00:00'))
            except (ValueError, TypeError):
                ts = datetime.utcnow()
            
            # Create event record
            event = AnalyticsEvent(
                user_id=normalized["user_id"],
                event_type=normalized["event"],
                event_source=normalized["source"],
                category=normalized.get("category", "other"),
                timestamp=ts,
                # Store as dict, let SQLAlchemy/Driver handle JSON serialization
                meta=normalized.get("metadata", {}),
                raw_data=normalized,
                processed_at=datetime.utcnow(),
            )
            
            db.add(event)
            await db.commit()
            await db.refresh(event)
            
            # Trigger immediate processing
            asyncio.create_task(self._process_event_async(event.id, normalized))
            
            logger.info(f"Event saved: {event.event_type} for user {event.user_id}")
            return event
    
    async def _process_event_async(self, event_id: int, event_data: Dict[str, Any]):
        """Async processing of event after save"""
        try:
            # 1. Update real-time metrics
            await self.update_realtime_metrics(event_data["user_id"], event_data)
            
            # 2. Check for immediate insights
            insight = await self._generate_immediate_insight(event_data)
            if insight:
                await self.save_insight(event_data["user_id"], insight)
            
            # 3. Check pattern triggers
            await self._check_pattern_triggers(event_data["user_id"], event_data)
            
            # 4. AI analysis for significant events
            if self._is_significant_event(event_data):
                from backend.ai.tools.analytics import analyze_behavior_patterns
                ai_result = await analyze_behavior_patterns(
                    user_id=event_data["user_id"],
                    events=[event_data],
                    context="immediate_event"
                )
                await self.save_ai_analysis(event_data["user_id"], event_data, ai_result)
                
        except Exception as e:
            logger.error(f"Async event processing failed: {e}")
    
    async def save_event_batch(self, events_data: List[Dict[str, Any]]) -> List[AnalyticsEvent]:
        """Save multiple events efficiently"""
        async for db in get_db():
            events = []
            for event_data in events_data:
                try:
                    normalized = await normalize_event(event_data)
                    
                    try:
                        ts = datetime.fromisoformat(normalized["timestamp"].replace('Z', '+00:00'))
                    except (ValueError, TypeError):
                        ts = datetime.utcnow()

                    event = AnalyticsEvent(
                        user_id=normalized["user_id"],
                        event_type=normalized["event"],
                        event_source=normalized["source"],
                        category=normalized.get("category", "other"),
                        timestamp=ts,
                        meta=normalized.get("metadata", {}),
                        raw_data=normalized,
                        processed_at=datetime.utcnow(),
                    )
                    events.append(event)
                    db.add(event)
                except Exception as e:
                    logger.error(f"Error processing event in batch: {e}")
                    continue
            
            if events:
                await db.commit()
                
                # Refresh all events to get IDs
                for event in events:
                    await db.refresh(event)
                
                # Process batch
                asyncio.create_task(self._process_batch_async([e.id for e in events], events_data))
            
            return events
    
    async def _process_batch_async(self, event_ids: List[int], events_data: List[Dict[str, Any]]):
        """Process batch of events"""
        try:
            if not events_data:
                return
            
            user_id = events_data[0]["user_id"]
            
            # Update metrics with batch
            for event_data in events_data:
                await self.update_realtime_metrics(user_id, event_data)
            
            # Generate batch insights
            await self._generate_batch_insights(user_id, events_data)
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
    
    async def get_recent_events(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent events for a user"""
        async for db in get_db():
            events = await db.execute(
                select(AnalyticsEvent)
                .where(AnalyticsEvent.user_id == user_id)
                .order_by(AnalyticsEvent.timestamp.desc())
                .limit(limit)
            )
            events = events.scalars().all()
            
            return [
                {
                    "id": e.id,
                    "event": e.event_type,
                    "source": e.event_source,
                    "category": e.category,
                    "timestamp": e.timestamp.isoformat(),
                    # Handle both dict (if JSON type) and string (if legacy/text type)
                    "metadata": e.meta if isinstance(e.meta, dict) else (json.loads(e.meta) if e.meta else {}),
                    "raw_data": e.raw_data if isinstance(e.raw_data, dict) else (json.loads(e.raw_data) if e.raw_data else {}),
                }
                for e in events
            ]
    
    async def get_realtime_metrics(self, user_id: int) -> Optional[RealTimeMetrics]:
        """Get current real-time metrics"""
        async for db in get_db():
            metrics = await db.execute(
                select(RealTimeMetrics)
                .where(RealTimeMetrics.user_id == user_id)
                .order_by(RealTimeMetrics.updated_at.desc())
                .limit(1)
            )
            metrics = metrics.scalar_one_or_none()
            return metrics
    
    async def update_realtime_metrics(self, user_id: int, event: Dict[str, Any]):
        """Update real-time metrics based on event"""
        async for db in get_db():
            # Get current metrics or create new
            metrics = await self.get_realtime_metrics(user_id)
            if not metrics:
                metrics = RealTimeMetrics(user_id=user_id)
                db.add(metrics)

            # Check for daily reset
            now = datetime.utcnow()
            # If metrics exist and were last updated on a Previous day
            if metrics.updated_at and metrics.updated_at.date() < now.date():
                logger.info(f"Resetting daily metrics for user {user_id} (last updated: {metrics.updated_at})")
                metrics.focus_sessions_today = 0
                metrics.total_focus_minutes = 0
                metrics.tasks_completed_today = 0
                metrics.habits_completed_today = 0
                metrics.planning_accuracy = 0.0
                # We DO NOT reset focus_score or habit_streak as those are long-term

            event_type = event.get("event")
            metadata = event.get("metadata", {})

            # Update based on event type
            if event_type == "deep_work_started":
                metrics.focus_sessions_today += 1
            elif event_type == "deep_work_completed":
                duration = metadata.get("duration", 0)
                metrics.total_focus_minutes += duration
                # Update focus score
                quality = metadata.get("quality", 0.5)
                metrics.focus_score = min(100, metrics.focus_score + (quality * 10))
            elif event_type == "task_completed":
                metrics.tasks_completed_today += 1
                # Update planning accuracy if available
                planned = metadata.get("planned_duration")
                actual = metadata.get("actual_duration")
                if planned and actual:
                    accuracy = 100 - (abs(planned - actual) / planned * 100)
                    total_tasks = metrics.tasks_completed_today
                    metrics.planning_accuracy = (
                        (metrics.planning_accuracy * (total_tasks - 1) + accuracy) / total_tasks
                    )
                
                # Update AI intelligence score in real-time when task is completed
                from backend.services.enhanced_ai_intelligence_service import enhanced_ai_intelligence_service
                await enhanced_ai_intelligence_service.update_score_realtime(user_id, event)
                
                # If task is linked to a goal, update goal progress
                if metadata.get("goal_id"):
                    from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
                    await enhanced_goal_analytics_service.update_goal_progress_realtime(
                        str(user_id), metadata["goal_id"], event_type, metadata
                    )
            elif event_type == "habit_completed":
                metrics.habits_completed_today += 1
                streak = metadata.get("streak", 0)
                metrics.current_habit_streak = max(metrics.current_habit_streak, streak)
                # Analytics Sync: Completed habits boost focus & consistency
                metrics.focus_score = min(100, metrics.focus_score + 5)
                
                # Update AI intelligence score when habit is completed
                from backend.services.enhanced_ai_intelligence_service import enhanced_ai_intelligence_service
                await enhanced_ai_intelligence_service.update_score_realtime(user_id, event)
                
                # If habit is linked to a goal, update goal progress
                if metadata.get("goal_link"):
                    from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
                    # Find the goal linked to this habit
                    async for db_inner in get_db():
                        from backend.db.models import Plan
                        habit_result = await db_inner.execute(
                            select(Plan).where(Plan.id == metadata.get("habit_id"))
                        )
                        habit = habit_result.scalar_one_or_none()
                        if habit and habit.schedule:
                            goal_link = habit.schedule.get("goal_link")
                            if goal_link:
                                await enhanced_goal_analytics_service.update_goal_progress_realtime(
                                    str(user_id), goal_link, event_type, metadata
                                )
            elif event_type == "goal_updated":
                # Update goal progress when goal is explicitly updated
                goal_id = metadata.get("goal_id")
                if goal_id:
                    from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
                    await enhanced_goal_analytics_service.update_goal_progress_realtime(
                        str(user_id), goal_id, event_type, metadata
                    )
            elif event_type == "analytics_engagement":
                # Engagement Boost Logic:
                # focus_score += 2 (max +10/day)
                # focus_sessions_today used to track if already boosted today
                engagement_time = metadata.get("duration_seconds", 0)
                if engagement_time > 300: # 5 minutes
                    metrics.focus_score = min(100, metrics.focus_score + 2)
                    # Use metadata to track daily limit if needed in a more complex setup

            metrics.updated_at = datetime.utcnow()
            await db.commit()

            # Broadcast updated metrics
            try:
                from backend.realtime.socket_manager import broadcast_analytics_update
                await broadcast_analytics_update(user_id, {
                    "focus": metrics.focus_score,
                    "tasks": metrics.tasks_completed_today,
                    "habits": metrics.habits_completed_today,
                    "streak": metrics.current_habit_streak
                })
            except:
                pass

    async def recalculate_focus_score(self, user_id: int):
        """
        Recalculate focus score and update both RealTimeMetrics and FocusScore table.
        This provides the data source for the real-time heatmap.
        """
        from backend.services.attention_integrity_service import attention_integrity_service
        from datetime import date
        
        # 1. Calculate new score
        result = await attention_integrity_service.calculate_attention_integrity(user_id, date.today())
        new_score = result.get("score", 0)
        
        async for db in get_db():
            # 2. Update/Create FocusScore record for today
            today = datetime.utcnow().date()
            stmt = select(FocusScore).where(
                FocusScore.user_id == user_id,
                func.date(FocusScore.date) == today
            )
            score_res = await db.execute(stmt)
            focus_record = score_res.scalar_one_or_none()
            
            if not focus_record:
                focus_record = FocusScore(
                    user_id=user_id,
                    date=datetime.utcnow(),
                    score=int(new_score),
                    breakdown=result.get("breakdown", {}),
                    activities=result.get("activities", [])
                )
                db.add(focus_record)
            else:
                focus_record.score = int(new_score)
                focus_record.breakdown = result.get("breakdown", {})
                focus_record.activities = result.get("activities", [])
                focus_record.updated_at = datetime.utcnow()
            
            # 3. Also update RealTimeMetrics for instant UI updates
            metrics = await self.get_realtime_metrics(user_id)
            if metrics:
                metrics.focus_score = int(new_score)
                metrics.updated_at = datetime.utcnow()
            
            await db.commit()
            
            # 4. Broadcast the update
            try:
                from backend.realtime.socket_manager import broadcast_analytics_update
                await broadcast_analytics_update(user_id, {
                    "type": "focus_score_updated",
                    "focus": new_score
                })
            except:
                pass
    
    async def save_insight(self, user_id: int, insight_data: Dict[str, Any]):
        """Save an insight"""
        async for db in get_db():
            insight = UserInsight(
                user_id=user_id,
                title=insight_data["title"],
                description=insight_data.get("description", ""),
                insight_type=insight_data.get("type", "rule"),
                category=insight_data.get("category", "general"),
                severity=insight_data.get("severity", "info"),
                confidence=insight_data.get("confidence", 0.7),
                action_items=json.dumps(insight_data.get("action_items", [])),
                context=json.dumps(insight_data.get("context", {})),
                generated_at=datetime.utcnow(),
            )
            db.add(insight)
            await db.commit()
    
    async def save_ai_analysis(self, user_id: int, event: Dict[str, Any], analysis: Dict[str, Any]):
        """Save AI analysis result"""
        async for db in get_db():
            ai_analysis = AIAnalysis(
                user_id=user_id,
                event_type=event.get("event"),
                analysis_type=analysis.get("type", "pattern"),
                content=json.dumps(analysis),
                confidence=analysis.get("confidence", 0.5),
                generated_at=datetime.utcnow(),
            )
            db.add(ai_analysis)
            await db.commit()
    
    async def save_patterns(self, user_id: int, patterns: List[Dict[str, Any]]):
        """Save detected patterns"""
        async for db in get_db():
            for pattern_data in patterns:
                pattern = BehavioralPattern(
                    user_id=user_id,
                    pattern_type=pattern_data["type"],
                    event_type=pattern_data.get("event_type"),
                    frequency=pattern_data.get("count", 1),
                    significance=pattern_data.get("significance", "medium"),
                    metadata=json.dumps(pattern_data),
                    first_detected=datetime.utcnow(),
                    last_detected=datetime.utcnow(),
                )
                db.add(pattern)
            await db.commit()
    
    async def get_user_insights(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent insights for a user"""
        async for db in get_db():
            insights = await db.execute(
                select(UserInsight)
                .where(UserInsight.user_id == user_id)
                .order_by(UserInsight.generated_at.desc())
                .limit(limit)
            )
            insights = insights.scalars().all()
            
            return [
                {
                    "id": i.id,
                    "title": i.title,
                    "description": i.description,
                    "type": i.insight_type,
                    "category": i.category,
                    "severity": i.severity,
                    "confidence": i.confidence,
                    "action_items": json.loads(i.action_items) if i.action_items else [],
                    "generated_at": i.generated_at.isoformat(),
                }
                for i in insights
            ]
    
    async def get_comprehensive_analytics(self, user_id: int) -> Dict[str, Any]:
        """Get complete analytics dashboard data"""
        try:
            # Get metrics
            metrics = await self.get_realtime_metrics(user_id)
            if not metrics:
                # Create default metrics if none exist
                from backend.db.models import RealTimeMetrics
                metrics = RealTimeMetrics(
                    user_id=int(user_id),
                    focus_score=50,
                    productivity_score=50,
                    planning_accuracy=60,
                    habit_consistency=70,  # Fixed field name if typo exists in model
                    burnout_risk=25,
                    engagement_score=50,
                    current_habit_streak=0,
                    habits_completed_today=0,
                    tasks_completed_today=0,
                    focus_sessions_today=0,
                    total_focus_minutes=0
                )

            # Get recent events (last 30 days to ensure historical data)
            events = await self.get_recent_events(user_id, limit=500)

            # Get insights
            insights = await self.get_user_insights(user_id, limit=20)

            # Get patterns
            async for db in get_db():
                patterns = await db.execute(
                    select(BehavioralPattern)
                    .where(BehavioralPattern.user_id == user_id)
                    .order_by(BehavioralPattern.last_detected.desc())
                    .limit(10)
                )
                patterns = patterns.scalars().all()

            # Calculate time-based analytics
            time_analytics = await self._calculate_time_analytics(events)

            # Get historical data for different time ranges
            historical_data = await self._get_historical_data(user_id)

            return {
                "metrics": {
                    "focus": {
                        "score": metrics.focus_score,
                        "sessions_today": metrics.focus_sessions_today,
                        "total_minutes": metrics.total_focus_minutes,
                        "average_session": (
                            metrics.total_focus_minutes / metrics.focus_sessions_today
                            if metrics.focus_sessions_today > 0 else 0
                        ),
                    },
                    "planning": {
                        "accuracy": metrics.planning_accuracy,
                        "tasks_completed": metrics.tasks_completed_today,
                        "completion_rate": await self._calculate_completion_rate(events),
                    },
                    "consistency": {
                        "habit_streak": metrics.current_habit_streak,
                        "habits_today": metrics.habits_completed_today,
                        "consistency_score": await self._calculate_consistency_score(events),
                    },
                    "wellbeing": {
                        "burnout_risk": await self._calculate_burnout_risk(events),
                        "engagement": await self._calculate_engagement_score(events),
                    },
                },
                "historical": historical_data,
                "insights": insights,
                "patterns": [
                    {
                        "type": p.pattern_type,
                        "event_type": p.event_type,
                        "frequency": p.frequency,
                        "significance": p.significance,
                        "last_detected": p.last_detected.isoformat(),
                    }
                    for p in patterns
                ],
                "time_analytics": time_analytics,
                "recent_activity": events[:10],
                "last_updated": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error in get_comprehensive_analytics: {e}", exc_info=True)
            # Return a safe default instead of crashing
            return {
                "metrics": {
                    "focus": {"score": 50, "sessions_today": 0, "total_minutes": 0, "average_session": 0},
                    "planning": {"accuracy": 0, "tasks_completed": 0, "completion_rate": 0},
                    "consistency": {"habit_streak": 0, "habits_today": 0, "consistency_score": 0},
                    "wellbeing": {"burnout_risk": 0, "engagement": 0},
                },
                "historical": {"focus": {}, "tasks": {}, "habits": {}},
                "insights": [],
                "patterns": [],
                "time_analytics": {},
                "recent_activity": [],
                "last_updated": datetime.utcnow().isoformat(),
                "error": str(e)
            }

    async def _get_historical_data(self, user_id: int) -> Dict[str, Any]:
        """Get historical analytics data for different time ranges"""
        try:
            async for db in get_db():
                # Get focus scores for the last 30 days
                focus_scores = await db.execute(
                    select(FocusScore)
                    .where(FocusScore.user_id == user_id)
                    .order_by(FocusScore.date.desc())
                    .limit(30)
                )
                focus_scores = focus_scores.scalars().all()

                # Get daily metrics for the last 30 days
                daily_metrics = await db.execute(
                    select(UserAnalytics)
                    .where(UserAnalytics.user_id == user_id)
                    .order_by(UserAnalytics.date.desc())
                    .limit(30)
                )
                daily_metrics = daily_metrics.scalars().all()

                # Calculate weekly and monthly averages
                weekly_focus = {}
                monthly_focus = {}

                if focus_scores:
                    # Calculate weekly average (last 7 days)
                    # Safe check for date type
                    today_date = datetime.utcnow().date()
                    
                    def get_date_obj(fs):
                        d = fs.date
                        if hasattr(d, 'date'):
                            return d.date()
                        return d

                    last_week_scores = [fs for fs in focus_scores if 
                                       (today_date - get_date_obj(fs)).days < 7]
                    
                    if last_week_scores:
                        weekly_avg = sum(fs.score for fs in last_week_scores) / len(last_week_scores)
                        weekly_focus = {
                            "average": round(weekly_avg, 1),
                            "scores": [{"date": fs.date.isoformat(), "score": fs.score} for fs in last_week_scores]
                        }

                    # Calculate monthly average (last 30 days)
                    if focus_scores:
                        monthly_avg = sum(fs.score for fs in focus_scores) / len(focus_scores)
                        monthly_focus = {
                            "average": round(monthly_avg, 1),
                            "scores": [{"date": fs.date.isoformat(), "score": fs.score} for fs in focus_scores]
                        }

                # Get task completion history
                task_events = await db.execute(
                    select(AnalyticsEvent)
                    .where(
                        AnalyticsEvent.user_id == user_id,
                        AnalyticsEvent.event_type.in_(['task_completed', 'task_created'])
                    )
                    .order_by(AnalyticsEvent.timestamp.desc())
                    .limit(100)
                )
                task_events = task_events.scalars().all()

                # Group by date
                task_history = {}
                for event in task_events:
                    try:
                        date_key = event.timestamp.date().isoformat()
                        if date_key not in task_history:
                            task_history[date_key] = {"completed": 0, "created": 0}
                        if event.event_type == 'task_completed':
                            task_history[date_key]["completed"] += 1
                        elif event.event_type == 'task_created':
                            task_history[date_key]["created"] += 1
                    except Exception:
                        continue

                return {
                    "focus": {
                        "weekly": weekly_focus,
                        "monthly": monthly_focus,
                        "daily_history": [{"date": fs.date.isoformat(), "score": fs.score} for fs in focus_scores]
                    },
                    "tasks": {
                        "daily_history": task_history,
                        "recent_activity": [{"date": te.timestamp.date().isoformat(), 
                                           "event": te.event_type, 
                                           "count": 1} for te in task_events[:20]]
                    },
                    "habits": {
                        "recent_tracking": await self._get_recent_habit_data(user_id)
                    }
                }
        except Exception as e:
            logger.error(f"Error in _get_historical_data: {e}", exc_info=True)
            return {"focus": {}, "tasks": {}, "habits": {}}

    async def _get_recent_habit_data(self, user_id: int) -> List[Dict[str, Any]]:
        """Get recent habit tracking data"""
        try:
            async for db in get_db():
                habit_events = await db.execute(
                    select(AnalyticsEvent)
                    .where(
                        AnalyticsEvent.user_id == user_id,
                        AnalyticsEvent.event_type.like('%habit%')
                    )
                    .order_by(AnalyticsEvent.timestamp.desc())
                    .limit(50)
                )
                habit_events = habit_events.scalars().all()

                return [
                    {
                        "date": event.timestamp.date().isoformat(),
                        "event": event.event_type,
                        "details": json.loads(event.meta) if event.meta else {}
                    }
                    for event in habit_events
                ]
        except Exception:
             return []

    async def initialize_user_analytics(self, user_id: int):
        """Initialize analytics data for a new user"""
        try:
            async for db in get_db():
                # Check if user already has metrics
                existing_metrics = await self.get_realtime_metrics(user_id)
                if existing_metrics:
                    return  # Already initialized
                
                # Create default metrics for new user
                from backend.db.models import RealTimeMetrics
                metrics = RealTimeMetrics(
                    user_id=int(user_id),
                    focus_score=50,
                    productivity_score=50,
                    planning_accuracy=60,
                    # habit_consistency removed as it is not in the model
                    burnout_risk=25,
                    engagement_score=50,
                    current_habit_streak=0,
                    habits_completed_today=0,
                    tasks_completed_today=0,
                    focus_sessions_today=0,
                    total_focus_minutes=0
                )
                
                db.add(metrics)
                await db.commit()
                
                logger.info(f"Initialized analytics for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to initialize analytics for user {user_id}: {e}")

    
    async def _calculate_time_analytics(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate time-based analytics"""
        if not events:
            return {"peak_hours": [], "daily_patterns": {}}
        
        # Group by hour
        hour_counts = {}
        for event in events:
            try:
                hour = datetime.fromisoformat(
                    event["timestamp"].replace('Z', '+00:00')
                ).hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            except:
                continue
        
        # Find peak hours (top 3)
        peak_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Group by day of week
        day_counts = {}
        for event in events:
            try:
                weekday = datetime.fromisoformat(
                    event["timestamp"].replace('Z', '+00:00')
                ).strftime('%A')
                day_counts[weekday] = day_counts.get(weekday, 0) + 1
            except:
                continue
        
        return {
            "peak_hours": [{"hour": h, "count": c} for h, c in peak_hours],
            "daily_patterns": day_counts,
            "total_events": len(events),
        }
    
    async def _calculate_completion_rate(self, events: List[Dict[str, Any]]) -> float:
        """Calculate task completion rate"""
        created = [e for e in events if e.get("event") == "task_created"]
        completed = [e for e in events if e.get("event") == "task_completed"]
        
        if not created:
            return 0
        
        return len(completed) / len(created) * 100
    
    async def _calculate_consistency_score(self, events: List[Dict[str, Any]]) -> float:
        """Calculate consistency score from habit events"""
        habit_events = [e for e in events if "habit" in e.get("event", "")]
        if not habit_events:
            return 0
        
        # Count completed vs missed
        completed = [e for e in habit_events if e.get("event") in ["habit_completed", "habit_streak_extended"]]
        missed = [e for e in habit_events if e.get("event") in ["habit_missed", "habit_streak_broken"]]
        
        total = len(completed) + len(missed)
        if total == 0:
            return 0
        
        return len(completed) / total * 100
    
    async def _calculate_burnout_risk(self, events: List[Dict[str, Any]]) -> float:
        """Calculate burnout risk (0-100)"""
        risk = 0
        
        # Late night work
        late_events = [e for e in events if self._is_late_night_event(e)]
        risk += len(late_events) * 5
        
        # Long focus sessions
        long_sessions = [e for e in events if e.get("event") == "deep_work_completed" 
                        and e.get("metadata", {}).get("duration", 0) > 120]
        risk += len(long_sessions) * 10
        
        # Venting/overwhelm events
        stress_events = [e for e in events if e.get("event") in ["vent_detected", "overwhelm_detected"]]
        risk += len(stress_events) * 15
        
        return min(100, risk)
    
    async def _calculate_engagement_score(self, events: List[Dict[str, Any]]) -> float:
        """Calculate engagement score (0-100)"""
        if not events:
            return 0
        
        # Recent events (last 24 hours)
        recent_events = [e for e in events if self._is_recent_event(e, hours=24)]
        
        # Diversity of event types
        event_types = set(e.get("event") for e in recent_events)
        
        # Score based on frequency and diversity
        frequency_score = min(50, len(recent_events) * 2)
        diversity_score = min(50, len(event_types) * 10)
        
        return frequency_score + diversity_score

    async def record_analytics_engagement(self, user_id: int, duration_seconds: int):
        """Record time spent in analytics to apply engagement boost."""
        await self.save_event({
            "user_id": user_id,
            "event": "analytics_engagement",
            "source": "analytics_ui",
            "metadata": {
                "duration_seconds": duration_seconds
            }
        })
    
    async def _generate_immediate_insight(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate immediate insight for event"""
        event_type = event.get("event")
        metadata = event.get("metadata", {})
        
        insights_map = {
            "task_completed": {
                "title": "Task Completed!",
                "description": f"Completed: {metadata.get('task_name', 'Task')}",
                "type": "achievement",
                "severity": "positive",
                "action_items": ["Take a short break", "Review next priority"],
            },
            "deep_work_completed": {
                "title": "Deep Work Session Complete",
                "description": f"{metadata.get('duration', 0)} minutes of focused work",
                "type": "achievement", 
                "severity": "positive",
                "action_items": ["Take a 5-10 minute break", "Hydrate and stretch"],
            },
            "habit_streak_extended": {
                "title": "Habit Streak Extended!",
                "description": f"Streak: {metadata.get('streak', 0)} days",
                "type": "consistency",
                "severity": "positive",
                "action_items": ["Celebrate small win", "Plan for tomorrow"],
            },
        }
        
        if event_type in insights_map:
            return insights_map[event_type]
        return None
    
    async def _check_pattern_triggers(self, user_id: int, event: Dict[str, Any]):
        """Check if event triggers any patterns"""
        # Get recent events for pattern detection
        recent_events = await self.get_recent_events(user_id, limit=50)
        
        # Check for procrastination pattern
        if event.get("event") == "task_delayed":
            delayed_tasks = [e for e in recent_events if e.get("event") == "task_delayed"]
            if len(delayed_tasks) >= 3:
                await self.save_insight(user_id, {
                    "title": "Procrastination Pattern Detected",
                    "description": "Multiple tasks delayed recently",
                    "type": "pattern",
                    "severity": "medium",
                    "action_items": [
                        "Break tasks into 25-minute chunks",
                        "Use Pomodoro technique",
                        "Set clear deadlines"
                    ],
                })
        
        # Check for overplanning
        if event.get("event") == "task_created":
            created_tasks = [e for e in recent_events if e.get("event") == "task_created"]
            completed_tasks = [e for e in recent_events if e.get("event") == "task_completed"]
            
            if len(created_tasks) > len(completed_tasks) * 2:
                await self.save_insight(user_id, {
                    "title": "Overplanning Detected",
                    "description": "Planning more tasks than completing",
                    "type": "pattern", 
                    "severity": "low",
                    "action_items": [
                        "Limit to 3 key tasks daily",
                        "Complete existing tasks first"
                    ],
                })
    
    async def _generate_batch_insights(self, user_id: int, events: List[Dict[str, Any]]):
        """Generate insights from batch of events"""
        # Group events by type
        events_by_type = {}
        for event in events:
            event_type = event.get("event")
            if event_type not in events_by_type:
                events_by_type[event_type] = []
            events_by_type[event_type].append(event)
        
        # Check for high-frequency patterns
        for event_type, type_events in events_by_type.items():
            if len(type_events) >= 5:  # High frequency
                await self.save_patterns(user_id, [{
                    "type": "high_frequency",
                    "event_type": event_type,
                    "count": len(type_events),
                    "timeframe": "batch",
                    "significance": "high",
                }])
    
    def _is_significant_event(self, event: Dict[str, Any]) -> bool:
        """Check if event is significant enough for AI analysis"""
        significant_events = [
            "task_completed",
            "deep_work_completed",
            "habit_streak_broken", 
            "habit_streak_extended",
            "vent_detected",
            "planning_session",
            "reflection_session",
        ]
        return event.get("event") in significant_events
    
    def _is_late_night_event(self, event: Dict[str, Any]) -> bool:
        """Check if event happened late at night (10pm-4am)"""
        timestamp = event.get("timestamp")
        if not timestamp:
            return False
        try:
            hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            return hour >= 22 or hour < 4
        except:
            return False
    
    def _is_recent_event(self, event: Dict[str, Any], hours: int = 24) -> bool:
        """Check if event is within last N hours"""
        timestamp = event.get("timestamp")
        if not timestamp:
            return False
        try:
            event_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return (datetime.utcnow() - event_time).total_seconds() < hours * 3600
        except:
            return False

# Singleton instance
analytics_service = AnalyticsService()