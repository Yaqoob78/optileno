# backend/core/health.py
"""
Enterprise Health Check and Monitoring for Optileno SaaS.

Features:
- Comprehensive health checks for all subsystems
- Database connection pool status
- Redis cache status
- WebSocket connection status
- Performance metrics aggregation
- SLA compliance monitoring
"""

import time
import logging
from typing import Dict, Any, List
from datetime import datetime
import asyncio

from backend.app.config import settings

logger = logging.getLogger(__name__)


class HealthCheckResult:
    """Result of a health check."""
    
    def __init__(
        self,
        name: str,
        status: str,
        latency_ms: float = None,
        message: str = None,
        details: Dict[str, Any] = None
    ):
        self.name = name
        self.status = status  # healthy, degraded, unhealthy
        self.latency_ms = latency_ms
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "latency_ms": self.latency_ms,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class HealthMonitor:
    """
    Enterprise health monitoring service.
    Aggregates health from all subsystems.
    """
    
    def __init__(self):
        self.last_full_check = None
        self.cached_results: Dict[str, HealthCheckResult] = {}
        self.cache_ttl = 10  # Cache health results for 10 seconds
    
    async def check_database(self) -> HealthCheckResult:
        """Check database health."""
        from backend.db.database import check_database_health, get_database_metrics
        
        try:
            health = await check_database_health()
            metrics = await get_database_metrics()
            
            return HealthCheckResult(
                name="database",
                status=health["status"],
                latency_ms=health.get("latency_ms"),
                message=health.get("error"),
                details={
                    "pool_status": health.get("pool_status"),
                    "config": metrics.get("config"),
                    "total_queries": metrics.get("total_queries", 0),
                    "slow_queries": metrics.get("slow_queries", 0),
                }
            )
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return HealthCheckResult(
                name="database",
                status="unhealthy",
                message=str(e)
            )
    
    async def check_cache(self) -> HealthCheckResult:
        """Check Redis cache health."""
        from backend.core.cache import cache_service
        
        try:
            health = await cache_service.health_check()
            metrics = cache_service.get_metrics()
            
            return HealthCheckResult(
                name="cache",
                status=health["status"],
                latency_ms=health.get("latency_ms"),
                message=health.get("error"),
                details={
                    "hit_rate": metrics.get("hit_rate", 0),
                    "circuit_breaker": health.get("circuit_breaker_state"),
                    "local_cache_size": metrics.get("local_cache_size", 0),
                    "is_connected": metrics.get("is_connected", False),
                }
            )
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return HealthCheckResult(
                name="cache",
                status="unhealthy",
                message=str(e)
            )
    
    async def check_websocket(self) -> HealthCheckResult:
        """Check WebSocket connection health."""
        from backend.realtime.socket_manager import get_websocket_metrics, get_connection_health
        
        try:
            metrics = get_websocket_metrics()
            health = await get_connection_health()
            
            return HealthCheckResult(
                name="websocket",
                status=health["status"],
                details={
                    "current_connections": health.get("current_connections", 0),
                    "max_connections": health.get("max_connections", 0),
                    "utilization_percent": health.get("utilization_percent", 0),
                    "total_messages_sent": metrics.get("total_messages_sent", 0),
                    "failed_broadcasts": metrics.get("failed_broadcasts", 0),
                }
            )
        except Exception as e:
            logger.error(f"WebSocket health check failed: {e}")
            return HealthCheckResult(
                name="websocket",
                status="degraded",
                message=str(e)
            )
    
    async def check_middleware(self) -> HealthCheckResult:
        """Check middleware metrics."""
        from backend.core.middleware import get_middleware_metrics
        
        try:
            metrics = get_middleware_metrics()
            
            # Determine health based on metrics
            status = "healthy"
            if metrics.get("rate_limited_requests", 0) > 100:
                status = "degraded"
            if metrics.get("blocked_requests", 0) > 1000:
                status = "degraded"
            
            return HealthCheckResult(
                name="middleware",
                status=status,
                details={
                    "total_requests": metrics.get("total_requests", 0),
                    "blocked_requests": metrics.get("blocked_requests", 0),
                    "rate_limited": metrics.get("rate_limited_requests", 0),
                    "avg_response_time_ms": metrics.get("avg_response_time_ms", 0),
                    "slow_requests": metrics.get("slow_requests", 0),
                }
            )
        except Exception as e:
            logger.error(f"Middleware health check failed: {e}")
            return HealthCheckResult(
                name="middleware",
                status="degraded",
                message=str(e)
            )
    
    async def run_all_checks(self, use_cache: bool = True) -> Dict[str, Any]:
        """
        Run all health checks and aggregate results.
        
        Args:
            use_cache: Whether to use cached results if available
        
        Returns:
            Comprehensive health status
        """
        # Check if we can use cached results
        if use_cache and self.last_full_check:
            age = time.time() - self.last_full_check
            if age < self.cache_ttl:
                return self._get_cached_response()
        
        # Run all checks in parallel
        start_time = time.time()
        
        try:
            results = await asyncio.gather(
                self.check_database(),
                self.check_cache(),
                self.check_websocket(),
                self.check_middleware(),
                return_exceptions=True
            )
        except Exception as e:
            logger.error(f"Health check aggregation failed: {e}")
            results = []
        
        # Process results
        check_results = []
        overall_status = "healthy"
        
        for result in results:
            if isinstance(result, Exception):
                check_results.append(HealthCheckResult(
                    name="unknown",
                    status="unhealthy",
                    message=str(result)
                ).to_dict())
                overall_status = "unhealthy"
            else:
                check_results.append(result.to_dict())
                self.cached_results[result.name] = result
                
                if result.status == "unhealthy":
                    overall_status = "unhealthy"
                elif result.status == "degraded" and overall_status == "healthy":
                    overall_status = "degraded"
        
        check_time_ms = (time.time() - start_time) * 1000
        self.last_full_check = time.time()
        
        return {
            "status": overall_status,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "checks": check_results,
            "check_time_ms": round(check_time_ms, 2),
            "timestamp": datetime.utcnow().isoformat(),
            "scaling": {
                "max_concurrent_users": settings.MAX_CONCURRENT_USERS,
                "db_pool_size": settings.DB_POOL_SIZE,
                "redis_max_connections": settings.REDIS_MAX_CONNECTIONS,
                "websocket_max_connections": settings.WEBSOCKET_MAX_CONNECTIONS,
            }
        }
    
    def _get_cached_response(self) -> Dict[str, Any]:
        """Get cached health check response."""
        check_results = [r.to_dict() for r in self.cached_results.values()]
        
        overall_status = "healthy"
        for result in self.cached_results.values():
            if result.status == "unhealthy":
                overall_status = "unhealthy"
            elif result.status == "degraded" and overall_status == "healthy":
                overall_status = "degraded"
        
        return {
            "status": overall_status,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "checks": check_results,
            "cached": True,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    async def get_liveness(self) -> Dict[str, Any]:
        """
        Kubernetes liveness probe.
        Quick check that the application is running.
        """
        return {
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    async def get_readiness(self) -> Dict[str, Any]:
        """
        Kubernetes readiness probe.
        Check if application is ready to receive traffic.
        """
        # Quick database check
        try:
            from backend.db.database import check_database_health
            db_health = await check_database_health()
            
            if db_health["status"] == "healthy":
                return {
                    "status": "ready",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            else:
                return {
                    "status": "not_ready",
                    "reason": "database_unavailable",
                    "timestamp": datetime.utcnow().isoformat(),
                }
        except Exception as e:
            return {
                "status": "not_ready",
                "reason": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }


# Global health monitor instance
health_monitor = HealthMonitor()


async def get_health() -> Dict[str, Any]:
    """Get comprehensive health status."""
    return await health_monitor.run_all_checks()


async def get_health_simple() -> Dict[str, Any]:
    """Get simple health status (for load balancers)."""
    return await health_monitor.get_liveness()


async def get_readiness() -> Dict[str, Any]:
    """Get readiness status (for Kubernetes)."""
    return await health_monitor.get_readiness()


# ==================================================
# Metrics Exporter
# ==================================================
async def export_prometheus_metrics() -> str:
    """
    Export metrics in Prometheus format.
    """
    from backend.core.middleware import get_middleware_metrics
    from backend.realtime.socket_manager import get_websocket_metrics
    from backend.db.database import get_database_metrics
    from backend.core.cache import cache_service
    
    lines = []
    
    # Application info
    lines.append(f'# HELP optileno_info Application information')
    lines.append(f'# TYPE optileno_info gauge')
    lines.append(f'optileno_info{{version="{settings.VERSION}",environment="{settings.ENVIRONMENT}"}} 1')
    
    # Middleware metrics
    try:
        mw_metrics = get_middleware_metrics()
        lines.append(f'# HELP optileno_http_requests_total Total HTTP requests')
        lines.append(f'# TYPE optileno_http_requests_total counter')
        lines.append(f'optileno_http_requests_total {mw_metrics.get("total_requests", 0)}')
        
        lines.append(f'# HELP optileno_http_blocked_total Blocked requests')
        lines.append(f'# TYPE optileno_http_blocked_total counter')
        lines.append(f'optileno_http_blocked_total {mw_metrics.get("blocked_requests", 0)}')
        
        lines.append(f'# HELP optileno_http_response_time_ms Average response time')
        lines.append(f'# TYPE optileno_http_response_time_ms gauge')
        lines.append(f'optileno_http_response_time_ms {mw_metrics.get("avg_response_time_ms", 0)}')
    except Exception:
        pass
    
    # WebSocket metrics
    try:
        ws_metrics = get_websocket_metrics()
        lines.append(f'# HELP optileno_websocket_connections Current WebSocket connections')
        lines.append(f'# TYPE optileno_websocket_connections gauge')
        lines.append(f'optileno_websocket_connections {ws_metrics.get("current_connections", 0)}')
        
        lines.append(f'# HELP optileno_websocket_messages_total Total WebSocket messages')
        lines.append(f'# TYPE optileno_websocket_messages_total counter')
        lines.append(f'optileno_websocket_messages_total {ws_metrics.get("total_messages_sent", 0)}')
    except Exception:
        pass
    
    # Database metrics
    try:
        db_metrics = await get_database_metrics()
        lines.append(f'# HELP optileno_db_connections Active database connections')
        lines.append(f'# TYPE optileno_db_connections gauge')
        lines.append(f'optileno_db_connections {db_metrics.get("active_connections", 0)}')
        
        lines.append(f'# HELP optileno_db_slow_queries Slow queries count')
        lines.append(f'# TYPE optileno_db_slow_queries counter')
        lines.append(f'optileno_db_slow_queries {db_metrics.get("slow_queries", 0)}')
    except Exception:
        pass
    
    # Cache metrics
    try:
        cache_metrics = cache_service.get_metrics()
        lines.append(f'# HELP optileno_cache_hit_rate Cache hit rate percentage')
        lines.append(f'# TYPE optileno_cache_hit_rate gauge')
        lines.append(f'optileno_cache_hit_rate {cache_metrics.get("hit_rate", 0)}')
        
        lines.append(f'# HELP optileno_cache_operations_total Total cache operations')
        lines.append(f'# TYPE optileno_cache_operations_total counter')
        lines.append(f'optileno_cache_operations_total {cache_metrics.get("total_operations", 0)}')
    except Exception:
        pass
    
    return "\n".join(lines)
