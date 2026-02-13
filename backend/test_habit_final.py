import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.planner_service import planner_service

async def test_habit():
    try:
        result = await planner_service.create_habit('1', {
            'title': 'Test Exercise',
            'name': 'Test Exercise',
            'description': 'Daily exercise routine',
            'frequency': 'daily',
            'category': 'Fitness'
        })
        print('SUCCESS: Habit creation result:', result)
        return True
    except Exception as e:
        print('ERROR:', str(e))
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_habit())
    print('Test completed:', success)
