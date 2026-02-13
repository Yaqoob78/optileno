
import sqlite3
import os

DB_PATH = os.path.join("backend", "concierge.db")

with open("verification_result.txt", "w", encoding="utf-8") as f:
    f.write(f"Checking {DB_PATH}\n")
    if not os.path.exists(DB_PATH):
        f.write("DB not found\n")
    else:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("PRAGMA table_info(goals);")
            columns = [row[1] for row in cursor.fetchall()]
            f.write(f"Goal columns: {columns}\n")
            
            if "is_tracked" in columns:
                f.write("SUCCESS: is_tracked found in goals\n")
            else:
                f.write("FAILURE: is_tracked NOT found in goals\n")
                
            cursor.execute("PRAGMA table_info(plans);")
            plan_cols = [row[1] for row in cursor.fetchall()]
            if "goal_id" in plan_cols:
                 f.write("SUCCESS: goal_id found in plans\n")
            else:
                 f.write("FAILURE: goal_id NOT found in plans\n")

        except Exception as e:
            f.write(f"Error: {e}\n")
        finally:
            conn.close()
