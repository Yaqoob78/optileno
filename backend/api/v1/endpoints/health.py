"""
Health check endpoints for monitoring and load balancers.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
import psutil
import asyncio
from typing import Dict, Any

from backend.db.database import get_db
from backend.core.redis_rate_limiter import redis_rate_limiter

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "optileno-backend"
    }

@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check - verifies database and Redis connections"""
    checks = {}
    
    # Database check
    try:
        result = await db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "healthy",
            "response_time_ms": 0  # Would need to measure actual time
        }
    except Exception as e:
        checks["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Redis check
    try:
        await redis_rate_limiter.initialize()
        if redis_rate_limiter.redis_client:
            await redis_rate_limiter.redis_client.ping()
            checks["redis"] = {
                "status": "healthy",
                "response_time_ms": 0
            }
        else:
            checks["redis"] = {
                "status": "unhealthy",
                "error": "Redis client not initialized"
            }
    except Exception as e:
        checks["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Overall status
    all_healthy = all(check["status"] == "healthy" for check in checks.values())
    
    status_code = 200 if all_healthy else 503
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }

@router.get("/health/live")
async def liveness_check():
    """Liveness check - verifies the application is running"""
    try:
        # Basic system checks
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        # Check if system resources are critically low
        if cpu_percent > 95 or memory.percent > 95:
            raise HTTPException(
                status_code=503,
                detail="System resources critically low"
            )
        
        return {
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": memory.available / (1024**3)
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Liveness check failed: {str(e)}"
        )

@router.get("/health/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check with detailed metrics"""
    health_info = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "uptime_seconds": 0,  # Would need to track startup time
        "checks": {}
    }
    
    # Database detailed check
    try:
        # Test basic connectivity
        await db.execute(text("SELECT 1"))
        
        # Get connection pool info
        pool = db.bind.pool
        health_info["checks"]["database"] = {
            "status": "healthy",
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow()
        }
    except Exception as e:
        health_info["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Redis detailed check
    try:
        await redis_rate_limiter.initialize()
        if redis_rate_limiter.redis_client:
            info = await redis_rate_limiter.redis_client.info()
            health_info["checks"]["redis"] = {
                "status": "healthy",
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_mb": info.get("used_memory", 0) / (1024*1024),
                "uptime_seconds": info.get("uptime_in_seconds", 0)
            }
        else:
            health_info["checks"]["redis"] = {
                "status": "unhealthy",
                "error": "Redis client not initialized"
            }
    except Exception as e:
        health_info["checks"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # System metrics
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_info["system"] = {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_gb": memory.total / (1024**3),
                "available_gb": memory.available / (1024**3),
                "used_percent": memory.percent
            },
            "disk": {
                "total_gb": disk.total / (1024**3),
                "free_gb": disk.free / (1024**3),
                "used_percent": (disk.used / disk.total) * 100
            }
        }
    except Exception as e:
        health_info["system"] = {
            "error": str(e)
        }
    
    # Overall status
    all_healthy = all(
        check.get("status") == "healthy" 
        for check in health_info["checks"].values()
    )
    
    health_info["status"] = "healthy" if all_healthy else "unhealthy"
    
    return health_info
