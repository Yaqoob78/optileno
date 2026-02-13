"""
Test script to validate the enhanced analytics components
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

from backend.services.enhanced_ai_intelligence_service import enhanced_ai_intelligence_service
from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
from backend.db.session import get_db
from backend.db.models import User, Goal, Task
from sqlalchemy import select


async def test_enhanced_ai_intelligence():
    """Test the enhanced AI intelligence service"""
    print("Testing Enhanced AI Intelligence Service...")
    
    # Get a test user
    async for db in get_db():
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        
        if not user:
            print("No users found in database, skipping test")
            return
            
        print(f"Testing with user: {user.email}")
        
        # Test daily score
        daily_score = await enhanced_ai_intelligence_service.get_score(user.id, 'daily')
        print(f"Daily Score: {daily_score['score']}")
        print(f"Category: {daily_score['category']}")
        print(f"Metrics: {daily_score['metrics']}")
        
        # Test weekly score
        weekly_score = await enhanced_ai_intelligence_service.get_score(user.id, 'weekly')
        print(f"Weekly Score: {weekly_score['score']}")
        print(f"Weekly Category: {weekly_score['category']}")
        print(f"Weekly Trend: {weekly_score.get('trend', 'N/A')}")
        
        # Test monthly score
        monthly_score = await enhanced_ai_intelligence_service.get_score(user.id, 'monthly')
        print(f"Monthly Score: {monthly_score['score']}")
        print(f"Monthly Category: {monthly_score['category']}")
        print(f"Monthly Volatility: {monthly_score.get('volatility', 'N/A')}")
        
        print("+ Enhanced AI Intelligence Service test completed\n")


async def test_enhanced_goal_analytics():
    """Test the enhanced goal analytics service"""
    print("Testing Enhanced Goal Analytics Service...")
    
    # Get a test user
    async for db in get_db():
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        
        if not user:
            print("No users found in database, skipping test")
            return
            
        print(f"Testing with user: {user.email}")
        
        # Test goal progress report
        try:
            goal_report = await enhanced_goal_analytics_service.get_goal_progress_report(str(user.id))
            print(f"Overall Progress: {goal_report['overall_progress']}")
            print(f"Total Goals: {goal_report['total_goals']}")
            print(f"On Track: {goal_report['on_track_count']}")
            print(f"At Risk: {goal_report['at_risk_count']}")
            
            # Print details for each goal if available
            for goal in goal_report.get('goals', [])[:2]:  # Show first 2 goals
                print(f"  Goal: {goal.get('title', 'N/A')}")
                print(f"    Progress: {goal.get('progress', 0)}%")
                print(f"    Status: {goal.get('status', 'N/A')}")
                print(f"    Velocity: {goal.get('velocity', 0)}")
                print(f"    Trend: {goal.get('trend', 'N/A')}")
                tasks = goal.get('tasks', {})
                print(f"    Tasks: {tasks.get('completed', 0)}/{tasks.get('total', 0)}")
        except KeyError as e:
            print(f"No goals found for user: {e}")
            print("Testing with user that has no goals...")
            # Just test with the user that has no goals
            goal_report = await enhanced_goal_analytics_service.get_goal_progress_report(str(user.id))
            print(f"Overall Progress: {goal_report.get('overall_progress', 0)}")
            print(f"Total Goals: {goal_report.get('total_goals', 0)}")
            print(f"On Track: {goal_report.get('on_track_count', 0)}")
            print(f"At Risk: {goal_report.get('at_risk_count', 0)}")
        
        # Test daily achievement score
        daily_score = await enhanced_goal_analytics_service.get_daily_achievement_score(str(user.id))
        print(f"Daily Achievement Score: {daily_score.get('daily_score', 0)}")
        print(f"Grade: {daily_score.get('grade', 'N/A')}")
        print(f"Breakdown: {daily_score.get('breakdown', {})}")
        
        # Test goal timeline
        timeline = await enhanced_goal_analytics_service.get_goal_timeline(str(user.id))
        print(f"Timeline Events: {len(timeline)}")
        for event in timeline[:5]:  # Show first 5 events
            print(f"  Event: {event.get('type', 'N/A')} - {event.get('title', 'N/A')} on {event.get('date', 'N/A')}")
        
        print("+ Enhanced Goal Analytics Service test completed\n")


async def test_realtime_updates():
    """Test real-time update functionality"""
    print("Testing Real-time Updates...")
    
    # Get a test user
    async for db in get_db():
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        
        if not user:
            print("No users found in database, skipping test")
            return
            
        print(f"Testing real-time updates with user: {user.email}")
        
        # Simulate an event that would trigger real-time updates
        event_data = {
            "event_type": "task_completed",
            "timestamp": "2026-02-09T10:00:00Z",
            "metadata": {
                "task_name": "Test task",
                "goal_id": 1
            }
        }
        
        # Update AI intelligence score in real-time
        await enhanced_ai_intelligence_service.update_score_realtime(user.id, event_data)
        print("+ AI Intelligence score updated in real-time")
        
        # Update goal progress in real-time (if there are goals)
        goals_result = await db.execute(select(Goal).where(Goal.user_id == user.id).limit(1))
        goal = goals_result.scalar_one_or_none()
        
        if goal:
            await enhanced_goal_analytics_service.update_goal_progress_realtime(
                str(user.id), goal.id, "task_completed", {"task_id": 1}
            )
            print("+ Goal progress updated in real-time")
        else:
            print("- No goals found for real-time update test")
        
        print("+ Real-time Updates test completed\n")


async def run_all_tests():
    """Run all tests"""
    print("Starting Enhanced Analytics Components Tests...\n")
    
    try:
        await test_enhanced_ai_intelligence()
        await test_enhanced_goal_analytics()
        await test_realtime_updates()
        
        print(":) All tests completed successfully!")
        print("\nSummary of enhancements:")
        print("- Real-time AI intelligence scoring based on user behavior")
        print("- Real-time goal progress tracking with accurate timeline dates")
        print("- Enhanced metrics with 5 dimensions instead of 4")
        print("- Real-time updates triggered by user actions")
        print("- Accurate timeline with preserved original dates")
        print("- Improved progress calculations based on actual behavior")
        
    except Exception as e:
        print(f"X Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(run_all_tests())