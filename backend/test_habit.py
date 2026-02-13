import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.planner_service import planner_service

async def test_habit():
    try:
        result = await planner_service.create_habit('1', {
            'name': 'Test Exercise',
            'description': 'Daily exercise routine',
            'frequency': 'daily',
            'category': 'Fitness'
        })
        print('Habit creation result:', result)
    except Exception as e:
        print('Error:', e)

if __name__ == "__main__":
    asyncio.run(test_habit())
