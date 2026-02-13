"""
Quick database fix to add missing goal_id column to plans table
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.db.database import engine
from sqlalchemy import text

async def add_goal_id_column():
    """Add goal_id column to plans table if it doesn't exist"""
    async with engine.begin() as conn:
        try:
            # Check if column exists
            result = await conn.execute(text("PRAGMA table_info(plans)"))
            columns = [row[1] for row in result]
            print('Current columns:', columns)
            
            if 'goal_id' not in columns:
                print('Adding goal_id column...')
                await conn.execute(text('ALTER TABLE plans ADD COLUMN goal_id INTEGER'))
                await conn.execute(text('CREATE INDEX IF NOT EXISTS ix_plans_goal_id ON plans(goal_id)'))
                print('Column added successfully!')
            else:
                print('Column already exists')
                
        except Exception as e:
            print(f'Error: {e}')
            return False
        return True

if __name__ == "__main__":
    success = asyncio.run(add_goal_id_column())
    if success:
        print("Database fix completed successfully!")
    else:
        print("Database fix failed!")
        sys.exit(1)
