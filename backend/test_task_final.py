import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.planner_service import planner_service

async def test_task():
    try:
        result = await planner_service.create_task('1', {
            'title': 'Review Exam Syllabus',
            'description': 'Review the complete exam syllabus',
            'priority': 'high',
            'estimated_minutes': 60,
            'category': 'Education',
            'goal_link': 'Crack College Exams'
        })
        print('SUCCESS: Task creation result:', result)
        return True
    except Exception as e:
        print('ERROR:', str(e))
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_task())
    print('Test completed:', success)
