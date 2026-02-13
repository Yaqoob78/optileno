import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.planner_service import planner_service

async def test_goal():
    try:
        result = await planner_service.create_goal('1', {
            'title': 'Crack College Exams',
            'description': 'Achieve excellent results in college exams',
            'category': 'Education',
            'milestones': ['Complete Syllabus', 'Practice Mock Tests', 'Improve Weak Areas']
        })
        print('SUCCESS: Goal creation result:', result)
        return True
    except Exception as e:
        print('ERROR:', str(e))
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_goal())
    print('Test completed:', success)
