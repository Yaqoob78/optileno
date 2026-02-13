import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

try:
    print("Attempting to import backend.app.main...")
    from backend.app.main import app
    print("Successfully imported backend.app.main")
except Exception as e:
    print(f"Failed to import backend.app.main: {e}")
    import traceback
    traceback.print_exc()
