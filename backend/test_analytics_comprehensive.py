import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta, timezone

# Add project root to path
sys.path.append(os.getcwd())

from backend.db.database import get_db
from backend.services.analytics_service import analytics_service
from backend.services.behavior_timeline_service import behavior_timeline_service
from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
from backend.services.complex_goal_service import complex_goal_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_analytics_components():
    print("--- Starting Analytics Test ---")
    
    user_id = 1
    
    # 1. Timeline
    print("Testing Timeline...")
    try:
        data = await behavior_timeline_service.get_timeline(user_id, 14)
        print(f"✅ Timeline OK (Days: {len(data.get('timeline', []))})")
    except Exception as e:
        print(f"❌ Timeline Error: {e}")
        import traceback
        traceback.print_exc()

    # 2. Goal Analytics
    print("\nTesting Goal Analytics...")
    try:
        # Mocking or calling
        # Need to ensure enhanced_goal_analytics_service is initialized or mock dependencies if complex
        report = await enhanced_goal_analytics_service.get_goal_progress_report(str(user_id))
        print(f"✅ Goal Report OK")
        
        goals = report.get('goals', [])
        if goals:
            g = goals[0]
            print(f"   Goal: {g.get('title')}")
            print(f"   AI Prob: {g.get('ai_probability')}")
            
            # Call Complex Service
            print(f"   Calling Complex Service for Goal {g['id']}...")
            c_data = await complex_goal_service.get_goal_analytics(user_id, int(g['id']))
            print(f"✅ Complex Service OK: {c_data.get('smart_progress')}%")
        else:
            print("⚠️ No goals found for user")
            
    except Exception as e:
        print(f"❌ Goal Analytics Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(test_analytics_components())
    except Exception as e:
        print(f"CRITICAL MAIN ERROR: {e}")
