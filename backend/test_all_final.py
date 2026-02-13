import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_all():
    from backend.services.planner_service import planner_service
    
    print('Testing Goal Creation...')
    goal_result = await planner_service.create_goal('1', {
        'title': 'Test Goal',
        'category': 'Test',
        'milestones': ['Test Milestone 1', 'Test Milestone 2']
    })
    print('Goal Result:', goal_result)
    
    print('\nTesting Task Creation...')
    task_result = await planner_service.create_task('1', {
        'title': 'Test Task',
        'duration_minutes': 30,
        'priority': 'medium',
        'goal_link': 'Test Goal'
    })
    print('Task Result:', task_result)
    
    print('\nTesting Habit Creation...')
    habit_result = await planner_service.create_habit('1', {
        'title': 'Test Habit',
        'name': 'Test Habit',
        'frequency': 'daily',
        'category': 'Test',
        'goal_link': 'Test Goal'
    })
    print('Habit Result:', habit_result)
    
    print('\nFetching All Data...')
    goals = await planner_service.get_user_goals('1')
    tasks = await planner_service.get_tasks('1')
    habits = await planner_service.get_user_habits('1')
    
    print('Goals:', len(goals), 'items')
    print('Tasks:', len(tasks), 'items')  
    print('Habits:', len(habits), 'items')
    
    if goals:
        print('First Goal:', goals[0].get('title'))
    if tasks:
        print('First Task:', tasks[0].get('title'))
    if habits:
        print('First Habit:', habits[0].get('name'))
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_all())
    print('Test completed:', success)
