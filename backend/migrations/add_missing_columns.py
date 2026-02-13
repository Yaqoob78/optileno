"""
Database migration script to add missing columns for AI features.
Run this to fix the database schema issues.
"""

import asyncio
import logging
from sqlalchemy import text
from backend.db.database import get_db, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_missing_columns():
    """Add missing columns to support AI features."""
    
    async for db in get_db():
        try:
            # Check if we're using SQLite
            result = await db.execute(text("SELECT sqlite_version()"))
            version = result.scalar()
            logger.info(f"SQLite version: {version}")
            
            # Add columns to goals table
            logger.info("Adding columns to goals table...")
            
            # Check if is_tracked column exists
            try:
                await db.execute(text("SELECT is_tracked FROM goals LIMIT 1"))
                logger.info("  - is_tracked column already exists")
            except Exception:
                await db.execute(text("ALTER TABLE goals ADD COLUMN is_tracked BOOLEAN DEFAULT 0"))
                logger.info("  - Added is_tracked column")
            
            # Check if probability_status column exists
            try:
                await db.execute(text("SELECT probability_status FROM goals LIMIT 1"))
                logger.info("  - probability_status column already exists")
            except Exception:
                await db.execute(text("ALTER TABLE goals ADD COLUMN probability_status VARCHAR DEFAULT 'Medium'"))
                logger.info("  - Added probability_status column")
            
            # Check if last_analyzed_at column exists
            try:
                await db.execute(text("SELECT last_analyzed_at FROM goals LIMIT 1"))
                logger.info("  - last_analyzed_at column already exists")
            except Exception:
                await db.execute(text("ALTER TABLE goals ADD COLUMN last_analyzed_at TIMESTAMP"))
                logger.info("  - Added last_analyzed_at column")
            
            # Add columns to plans table
            logger.info("Adding columns to plans table...")
            
            # Check if goal_id column exists
            try:
                await db.execute(text("SELECT goal_id FROM plans LIMIT 1"))
                logger.info("  - goal_id column already exists")
            except Exception:
                await db.execute(text("ALTER TABLE plans ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL"))
                logger.info("  - Added goal_id column")
            
            await db.commit()
            logger.info("✅ Database migration completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(add_missing_columns())
