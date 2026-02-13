
print("Initializing debug script...")
import asyncio
import logging
import traceback
import sys

# Force flush
sys.stdout.reconfigure(line_buffering=True)

try:
    print("Importing service...")
    from backend.services.big_five_test_service import big_five_test_service
    print("Service imported.")
except ImportError as e:
    print(f"ImportError: {e}")
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"Import Exception: {e}")
    traceback.print_exc()
    sys.exit(1)

async def test_start_test():
    print("Starting test debugging...")
    try:
        # Try with user_id 1
        print("Calling start_test(1)...")
        result = await big_five_test_service.start_test(1)
        print("Result:", result)
    except Exception as e:
        print("CAUGHT EXCEPTION:")
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(test_start_test())
    except Exception as e:
        print(f"Runtime Error: {e}")
        traceback.print_exc()
