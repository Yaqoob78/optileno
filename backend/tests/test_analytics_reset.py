
import pytest
import asyncio
from datetime import datetime, timedelta
from backend.services.analytics_service import analytics_service
from backend.db.models import RealTimeMetrics
from backend.db.session import get_db

@pytest.mark.asyncio
async def test_daily_metrics_reset(db_session):
    """
    Test that daily metrics are reset when a new event occurs on a new day.
    """
    # 1. Setup: Create a user and metrics for "Yesterday"
    user_id = 999
    
    # Create fake existing metrics
    # Note: We need to use raw SQL or ensure the session commits properly
    # Using the service's get_db logic via db_session fixture if available, 
    # but let's try to inject directly if possible or use service to init.
    
    # Just insert a dummy metric row directly
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    metric = RealTimeMetrics(
        user_id=user_id,
        focus_score=80, # Should persist
        focus_sessions_today=5, # Should reset
        tasks_completed_today=10, # Should reset
        habits_completed_today=3, # Should reset
        current_habit_streak=5, # Should persist
        planning_accuracy=90.0, # Should reset
        updated_at=yesterday # Key factor
    )
    db_session.add(metric)
    db_session.commit()
    
    # Verify setup
    saved_metric = db_session.query(RealTimeMetrics).filter_by(user_id=user_id).first()
    assert saved_metric.focus_sessions_today == 5
    assert saved_metric.updated_at.date() < datetime.utcnow().date()
    
    # 2. Action: Trigger an event "Today"
    # This calls update_realtime_metrics internally
    event_data = {
        "user_id": user_id,
        "event": "task_completed",
        "metadata": {
            "task_name": "Test Task"
        }
    }
    
    await analytics_service.update_realtime_metrics(user_id, event_data)
    
    # 3. Verification: Check metrics again
    # Use a new session or refresh
    db_session.refresh(saved_metric)
    
    # Daily counters should be reset (and then incremented by the event)
    # tasks_completed_today was 10. Reset to 0. Plus 1 for this event. Result: 1.
    assert saved_metric.tasks_completed_today == 1 
    
    # Other daily counters should be 0 since this event didn't touch them
    assert saved_metric.focus_sessions_today == 0
    assert saved_metric.habits_completed_today == 0
    
    # Persistent counters should remain
    assert saved_metric.focus_score == 80 # Event didn't change it (or maybe small bump?)
    # task_completed does not bump focus score in current logic? 
    # Let's check logic: 
    # elif event_type == "task_completed": ... logic ...
    # It does NOT update focus_score. So it should be stable.
    assert saved_metric.current_habit_streak == 5
    
    print("\n✅ Daily reset test passed!")

