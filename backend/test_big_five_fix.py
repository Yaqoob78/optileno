import asyncio
import logging
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from backend.services.big_five_test_service import big_five_test_service
from backend.db.database import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_big_five_start():
    with open("big_five_test_output.txt", "w") as f:
        f.write("--- Testing Big Five Test Start ---\n")
        
        # Mock user_id (ensure this user exists or use a dummy)
        # We'll use 1 as a likely existing user ID
        user_id = 1 
        
        f.write(f"Starting test for user {user_id}...\n")
        try:
            # Force new test to avoid "in progress" state issues
            result = await big_five_test_service.start_test(user_id, force_new=True)
            
            if "error" in result:
                f.write(f"❌ Error returned: {result['error']}\n")
                if "next personality test" in result['error'].lower():
                    f.write("   (User is on cooldown, which is expected behavior if they recently finished one)\n")
            else:
                f.write("✅ Test started successfully!\n")
                f.write(f"   Test ID: {result.get('test_id')}\n")
                f.write(f"   Total Questions: {result.get('total_questions')}\n")
                f.write(f"   First Question: {result.get('question', {}).get('text')}\n")
                f.write(f"   Source: {result.get('question_source')}\n")
                
        except Exception as e:
            f.write(f"❌ Exception caught: {e}\n")
            import traceback
            f.write(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test_big_five_start())
