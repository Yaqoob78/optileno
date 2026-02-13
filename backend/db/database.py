"""
Database module for Optileno SaaS backend.

Enterprise-grade database connection management with:
- Configurable connection pooling (50-125+ connections)
- Health monitoring and auto-recovery
- Slow query detection and logging
- Connection pool metrics
"""

import logging
import time
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncEngine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import event, text
from sqlalchemy.pool import QueuePool

from backend.app.config import settings

logger = logging.getLogger(__name__)

# ==================================================
# SQLAlchemy Base (used by all models)
# ==================================================
Base = declarative_base()

# ==================================================
# Connection Pool Metrics
# ==================================================
class DatabaseMetrics:
    """Track database connection pool metrics."""
    
    def __init__(self):
        self.total_connections = 0
        self.active_connections = 0
        self.available_connections = 0
        self.overflow_connections = 0
        self.slow_queries = 0
        self.failed_queries = 0
        self.total_queries = 0
        self.last_health_check = None
        self.is_healthy = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_connections": self.total_connections,
            "active_connections": self.active_connections,
            "available_connections": self.available_connections,
            "overflow_connections": self.overflow_connections,
            "slow_queries": self.slow_queries,
            "failed_queries": self.failed_queries,
            "total_queries": self.total_queries,
            "last_health_check": self.last_health_check,
            "is_healthy": self.is_healthy,
        }

db_metrics = DatabaseMetrics()


# ==================================================
# Async Engine - Enterprise Configuration
# ==================================================
def create_database_engine() -> AsyncEngine:
    """Create database engine with enterprise configuration."""
    
    if "sqlite" in settings.DATABASE_URL:
        # SQLite-specific configuration (for development)
        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            connect_args={
                "check_same_thread": False, 
                "timeout": 30
            }
        )
    else:
        # PostgreSQL-specific configuration (for production with Supabase)
        # Scaled for 5,000+ concurrent users
        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            poolclass=QueuePool,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            connect_args={
                "options": f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT}"
            },
            # Pool event listeners for monitoring
            pool_events=True,
        )
        
        # Add pool event listeners for metrics
        @event.listens_for(engine.sync_engine, "checkout")
        def on_checkout(dbapi_conn, connection_record, connection_proxy):
            db_metrics.active_connections += 1
            db_metrics.total_connections = engine.pool.size() if hasattr(engine, 'pool') else 0
            
        @event.listens_for(engine.sync_engine, "checkin")
        def on_checkin(dbapi_conn, connection_record):
            db_metrics.active_connections = max(0, db_metrics.active_connections - 1)
        
        logger.info(f"[DB] Created engine with pool_size={settings.DB_POOL_SIZE}, "
                   f"max_overflow={settings.DB_MAX_OVERFLOW}")
    
    return engine


engine = create_database_engine()


# ==================================================
# Async Session Factory
# ==================================================
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ==================================================
# Query Timing Context Manager
# ==================================================
@asynccontextmanager
async def timed_session():
    """Session with query timing for slow query detection."""
    start_time = time.time()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            db_metrics.total_queries += 1
        finally:
            elapsed_ms = (time.time() - start_time) * 1000
            if elapsed_ms > settings.DB_SLOW_QUERY_THRESHOLD_MS:
                db_metrics.slow_queries += 1
                logger.warning(f"[DB-SLOW] Query took {elapsed_ms:.2f}ms (threshold: {settings.DB_SLOW_QUERY_THRESHOLD_MS}ms)")


# ==================================================
# Dependency
# ==================================================
async def get_db():
    """
    Provide a database session.
    Transaction control is handled by services.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            db_metrics.failed_queries += 1
            logger.error(f"[DB] Session error: {e}")
            raise


# ==================================================
# Health Check
# ==================================================
async def check_database_health() -> Dict[str, Any]:
    """
    Comprehensive database health check.
    
    Returns:
        Dict with health status and metrics
    """
    import datetime
    
    health = {
        "status": "unknown",
        "latency_ms": None,
        "pool_status": None,
        "error": None,
    }
    
    start = time.time()
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            
        latency = (time.time() - start) * 1000
        health["status"] = "healthy"
        health["latency_ms"] = round(latency, 2)
        
        # Get pool status if available
        if hasattr(engine, 'pool') and engine.pool:
            pool = engine.pool
            health["pool_status"] = {
                "size": pool.size(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "checked_in": pool.checkedin(),
            }
            db_metrics.available_connections = pool.checkedin()
            db_metrics.overflow_connections = pool.overflow()
        
        db_metrics.is_healthy = True
        db_metrics.last_health_check = datetime.datetime.utcnow().isoformat()
        
    except Exception as e:
        health["status"] = "unhealthy"
        health["error"] = str(e)
        db_metrics.is_healthy = False
        logger.error(f"[DB] Health check failed: {e}")
    
    return health


async def get_database_metrics() -> Dict[str, Any]:
    """Get current database metrics."""
    health = await check_database_health()
    return {
        **db_metrics.to_dict(),
        "health": health,
        "config": {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "slow_query_threshold_ms": settings.DB_SLOW_QUERY_THRESHOLD_MS,
        }
    }


# ==================================================
# Lifecycle
# ==================================================
async def init_db():
    """
    Initialize database schema.
    Fails fast if DB is unavailable.
    """
    try:
        from backend.db import models  # explicit import

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Run initial health check
        health = await check_database_health()
        if health["status"] == "healthy":
            logger.info(f"[CHECK] Database initialized (latency: {health['latency_ms']}ms)")
            if health.get("pool_status"):
                logger.info(f"[DB] Pool status: {health['pool_status']}")
        else:
            logger.warning(f"[WARN] Database initialized but health check shows issues: {health}")

    except Exception as e:
        logger.critical(f"❌ Database initialization failed: {e}")
        raise


async def close_db():
    """
    Dispose database engine.
    """
    await engine.dispose()
    logger.info("[CHECK] Database connections closed")


# ==================================================
# Connection Pool Management
# ==================================================
async def refresh_connection_pool():
    """
    Refresh the connection pool.
    Useful for recovering from connection issues.
    """
    global engine, AsyncSessionLocal
    
    try:
        await engine.dispose()
        engine = create_database_engine()
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.info("[DB] Connection pool refreshed")
        return True
    except Exception as e:
        logger.error(f"[DB] Failed to refresh connection pool: {e}")
        return False
