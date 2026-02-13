
import sqlite3
import os
import sys

# Flush prints immediately
sys.stdout.reconfigure(line_buffering=True)
DB_PATH = os.path.join("data", "optileno.db")

print(f"Connecting to {DB_PATH}")

if not os.path.exists(DB_PATH):
    print(f"ERROR: Database not found at {DB_PATH}")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

def add_column(table, column_def):
    try:
        sql = f"ALTER TABLE {table} ADD COLUMN {column_def};"
        print(f"Executing: {sql}")
        cursor.execute(sql)
        print(f"Success: Added column {column_def}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Ignored: Column already exists ({e})")
        else:
            print(f"Error adding {column_def} to {table}: {e}")

try:
    print("Migrating 'goals' table...")
    add_column("goals", "is_tracked BOOLEAN DEFAULT 0")
    add_column("goals", "probability_status VARCHAR DEFAULT 'Medium'")
    add_column("goals", "last_analyzed_at TIMESTAMP")

    print("Migrating 'plans' table...")
    add_column("plans", "goal_id INTEGER REFERENCES goals(id)")
    
    conn.commit()
    print("Migration committed.")
    
except Exception as e:
    print(f"Migration script failed with exception: {e}")
finally:
    conn.close()
