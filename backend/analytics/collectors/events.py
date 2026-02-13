"""
Enhanced event collector with rich event types and immediate processing.
"""

from typing import Dict, Any, List
from datetime import datetime
import asyncio
import json

from backend.services.analytics_service import analytics_service
from backend.ai.tools.analytics import analyze_event_pattern
from backend.analytics.processors.even_normalizer import normalize_event
from backend.analytics.insights.insight_engine import generate_immediate_insight

# Event categories for structured processing
EVENT_CATEGORIES = {
    # Planner events
    "task_created": "planning",
    "task_started": "execution",
    "task_completed": "execution",
    "task_delayed": "planning",
    "task_abandoned": "planning",
    "deep_work_started": "focus",
    "deep_work_completed": "focus",
    "deep_work_interrupted": "focus",
    "habit_completed": "consistency",
    "habit_missed": "consistency",
    "habit_streak_extended": "consistency",
    "habit_streak_broken": "consistency",
    
    # Chat events
    "message_sent": "communication",
    "conversation_started": "communication",
    "vent_detected": "wellbeing",
    "planning_session": "planning",
    "reflection_session": "reflection",
    
    # System events
    "app_opened": "engagement",
    "planner_viewed": "engagement",
    "analytics_viewed": "engagement",
}

async def collect_and_process_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhanced collector: Normalize → Save → Immediate processing → AI analysis
    """
    # Extract user_id first (required)
    user_id = event_data.get("user_id")
    if not user_id:
        raise ValueError("user_id is required for event collection")
    
    # Normalize event structure
    normalized = await normalize_event(event_data)
    
    # Add category based on event type
    event_type = normalized.get("event", "unknown")
    normalized["category"] = EVENT_CATEGORIES.get(event_type, "other")
    normalized["processed_at"] = datetime.utcnow().isoformat()
    
    # Save to database via service
    saved_event = await analytics_service.save_event(normalized)
    
    # Start immediate processing (non-blocking)
    asyncio.create_task(process_event_immediately(user_id, normalized, saved_event))
    
    return {
        "status": "collected_processing",
        "event_id": getattr(saved_event, "id", None),
        "timestamp": normalized["timestamp"],
        "category": normalized["category"],
        "will_generate_insight": True,
    }

async def process_event_immediately(user_id: str, event: Dict[str, Any], saved_event: Any):
    """
    Process event immediately after saving:
    1. Generate immediate insight
    2. Analyze pattern with AI
    3. Update user behavioral profile
    """
    try:
        # 1. Generate immediate insight
        insight = await generate_immediate_insight(user_id, event)
        if insight:
            await analytics_service.save_insight(user_id, insight)
        
        # 2. Analyze with AI (if event is significant)
        if _is_significant_event(event):
            ai_analysis = await analyze_event_pattern(user_id, event)
            if ai_analysis:
                await analytics_service.save_ai_analysis(user_id, event["event"], ai_analysis)
        
        # 3. Update real-time metrics
        await update_realtime_metrics(user_id, event)
        
        # 4. Check for pattern triggers
        await check_pattern_triggers(user_id, event)
        
    except Exception as e:
        # Log error but don't crash the event collection
        print(f"Event processing error: {e}")

async def collect_events_batch(events_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process multiple events at once (for offline sync)
    """
    results = []
    for event_data in events_data:
        try:
            result = await collect_and_process_event(event_data)
            results.append(result)
        except Exception as e:
            results.append({
                "status": "error",
                "error": str(e),
                "event_data": event_data
            })
    
    # Process batch patterns
    if len(events_data) > 0:
        user_id = events_data[0].get("user_id")
        if user_id:
            asyncio.create_task(analyze_batch_patterns(user_id, events_data))
    
    return {
        "status": "batch_processed",
        "total": len(events_data),
        "successful": len([r for r in results if r.get("status") == "collected_processing"]),
        "failed": len([r for r in results if r.get("status") == "error"]),
        "results": results,
    }

async def analyze_batch_patterns(user_id: str, events: List[Dict[str, Any]]):
    """
    Analyze patterns across a batch of events
    """
    try:
        # Group events by type
        events_by_type = {}
        for event in events:
            event_type = event.get("event", "unknown")
            if event_type not in events_by_type:
                events_by_type[event_type] = []
            events_by_type[event_type].append(event)
        
        # Detect frequency patterns
        patterns = []
        for event_type, type_events in events_by_type.items():
            if len(type_events) > 3:  # More than 3 events of same type
                patterns.append({
                    "type": "frequency",
                    "event_type": event_type,
                    "count": len(type_events),
                    "timeframe": "batch",
                    "significance": "high" if len(type_events) > 5 else "medium",
                })
        
        if patterns:
            await analytics_service.save_patterns(user_id, patterns)
            
    except Exception as e:
        print(f"Batch pattern analysis error: {e}")

async def update_realtime_metrics(user_id: str, event: Dict[str, Any]):
    """
    Update real-time metrics based on event
    """
    # Get current metrics
    current_metrics = await analytics_service.get_realtime_metrics(user_id)
    if not current_metrics:
        current_metrics = {
            "focus": {"score": 50, "sessions_today": 0, "total_duration": 0},
            "planning": {"accuracy": 0, "tasks_created": 0, "tasks_completed": 0},
            "consistency": {"streak": 0, "habits_today": 0, "missed_days": 0},
            "wellbeing": {"burnout_risk": 0, "engagement": 0},
            "last_updated": datetime.utcnow().isoformat(),
        }
    
    # Update based on event type
    event_type = event.get("event")
    
    if event_type == "deep_work_started":
        current_metrics["focus"]["sessions_today"] += 1
    elif event_type == "deep_work_completed":
        duration = event.get("metadata", {}).get("duration", 0)
        current_metrics["focus"]["total_duration"] += duration
        # Increase focus score based on session quality
        quality = event.get("metadata", {}).get("quality", 0.5)
        current_metrics["focus"]["score"] = min(100, current_metrics["focus"]["score"] + (quality * 10))
    elif event_type == "task_completed":
        current_metrics["planning"]["tasks_completed"] += 1
        # Calculate accuracy if planned duration exists
        planned = event.get("metadata", {}).get("planned_duration")
        actual = event.get("metadata", {}).get("actual_duration")
        if planned and actual:
            accuracy = 100 - (abs(planned - actual) / planned * 100)
            current_metrics["planning"]["accuracy"] = (
                (current_metrics["planning"]["accuracy"] * (current_metrics["planning"]["tasks_completed"] - 1) + accuracy)
                / current_metrics["planning"]["tasks_completed"]
            )
    elif event_type == "habit_completed":
        current_metrics["consistency"]["habits_today"] += 1
        streak = event.get("metadata", {}).get("streak", 0)
        current_metrics["consistency"]["streak"] = max(current_metrics["consistency"]["streak"], streak)
    
    # Update in database
    await analytics_service.update_realtime_metrics(user_id, current_metrics)

async def check_pattern_triggers(user_id: str, event: Dict[str, Any]):
    """
    Check if event triggers any pattern-based insights
    """
    # Get recent events
    recent_events = await analytics_service.get_recent_events(user_id, limit=20)
    
    # Check for procrastination pattern
    if event.get("event") == "task_delayed":
        delayed_tasks = [e for e in recent_events if e.get("event") == "task_delayed"]
        if len(delayed_tasks) >= 3:
            await analytics_service.save_insight(user_id, {
                "type": "pattern",
                "title": "Procrastination Pattern Detected",
                "description": "Multiple tasks delayed recently. Consider breaking tasks into smaller steps.",
                "severity": "medium",
                "action_items": ["Break large tasks into 25-minute chunks", "Use Pomodoro technique", "Set clear deadlines"],
            })
    
    # Check for overplanning pattern
    if event.get("event") == "task_created":
        created_tasks = [e for e in recent_events if e.get("event") == "task_created"]
        completed_tasks = [e for e in recent_events if e.get("event") == "task_completed"]
        
        if len(created_tasks) > len(completed_tasks) * 2:  # Creating twice as many as completing
            await analytics_service.save_insight(user_id, {
                "type": "pattern",
                "title": "Overplanning Detected",
                "description": "You're planning more tasks than you're completing. Focus on execution.",
                "severity": "low",
                "action_items": ["Limit daily planning to 3 key tasks", "Complete existing tasks before adding new ones"],
            })

def _is_significant_event(event: Dict[str, Any]) -> bool:
    """
    Determine if event is significant enough for AI analysis
    """
    significant_events = [
        "task_completed",
        "deep_work_completed", 
        "habit_streak_broken",
        "habit_streak_extended",
        "vent_detected",
        "planning_session",
    ]
    
    return event.get("event") in significant_events

# Backward compatibility
async def collect_and_save_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """Backward compatibility wrapper"""
    return await collect_and_process_event(event_data)