
print("Starting debug script...")
import sys
import os
import asyncio

# Add the project root to sys.path
sys.path.append(os.getcwd())

try:
    print("Importing get_db...")
    from backend.db.database import get_db
    print("Importing service...")
    from backend.services.behavior_timeline_service import behavior_timeline_service
    print("Imports successful.")
except Exception as e:
    print(f"Import Error: {e}")
    sys.exit(1)

async def test_timeline():
    print("Running timeline test...")
    try:
        user_id = 1
        result = await behavior_timeline_service.get_timeline(user_id=user_id, days=14)
        print("Result:", result)
    except Exception as e:
        print(f"Runtime Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(test_timeline())
