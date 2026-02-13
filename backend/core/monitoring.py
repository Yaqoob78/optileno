"""
Monitoring and observability service for Concierge AI backend.

Implements comprehensive monitoring, logging, and observability features:
- Application metrics
- Performance monitoring
- Error tracking
- Health checks
- Request/response logging
"""

import time
import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
import logging
from fastapi import Request, Response
from prometheus_client import Counter, Histogram, Gauge, Summary
import psutil

from backend.core.cache import cache_service
from backend.db.database import get_db
from backend.db.models import AnalyticsEvent

# Try to import optional GPU monitoring library
try:
    import GPUtil
    HAS_GPU_SUPPORT = True
except ImportError:
    GPUtil = None
    HAS_GPU_SUPPORT = False


class MetricType(Enum):
    COUNTER = "counter"
    HISTOGRAM = "histogram"
    GAUGE = "gauge"
    SUMMARY = "summary"


class MonitoringService:
    """
    Comprehensive monitoring and observability service for the Concierge AI backend.
    
    Provides:
    - Application metrics collection
    - Performance monitoring
    - Health checks
    - Request/response logging
    - Error tracking
    """
    
    def __init__(self):
        # Initialize Prometheus metrics
        self.request_count = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status_code']
        )
        
        self.request_duration = Histogram(
            'http_request_duration_seconds',
            'HTTP request duration',
            ['method', 'endpoint']
        )
        
        self.active_requests = Gauge(
            'http_active_requests',
            'Number of active HTTP requests'
        )
        
        self.api_response_time = Histogram(
            'api_response_time_seconds',
            'API response time',
            ['endpoint', 'method']
        )
        
        self.error_count = Counter(
            'errors_total',
            'Total errors',
            ['type', 'endpoint']
        )
        
        self.db_query_duration = Histogram(
            'db_query_duration_seconds',
            'Database query duration',
            ['table', 'operation']
        )
        
        self.system_cpu_usage = Gauge(
            'system_cpu_percent',
            'CPU usage percentage'
        )
        
        self.system_memory_usage = Gauge(
            'system_memory_percent',
            'Memory usage percentage'
        )
        
        self.system_disk_usage = Gauge(
            'system_disk_percent',
            'Disk usage percentage'
        )
        
        self.active_users = Gauge(
            'active_users_count',
            'Number of active users'
        )
        
        # Initialize internal tracking
        self.request_start_times = {}
        self.active_request_count = 0
        
        # Logger
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize monitoring service."""
        self.logger.info("Initializing monitoring service...")
        
        # Start background tasks
        asyncio.create_task(self.collect_system_metrics())
        asyncio.create_task(self.cleanup_old_metrics())
        
        self.logger.info("Monitoring service initialized")
    
    async def collect_system_metrics(self):
        """Collect system-level metrics periodically."""
        while True:
            try:
                # CPU usage
                cpu_percent = psutil.cpu_percent(interval=1)
                self.system_cpu_usage.set(cpu_percent)
                
                # Memory usage
                memory = psutil.virtual_memory()
                self.system_memory_usage.set(memory.percent)
                
                # Disk usage
                disk = psutil.disk_usage('/')
                disk_percent = (disk.used / disk.total) * 100
                self.system_disk_usage.set(disk_percent)
                
                # GPU usage if available
                if HAS_GPU_SUPPORT:
                    try:
                        gpus = GPUtil.getGPUs()
                        if gpus:
                            gpu = gpus[0]  # Use first GPU
                            gpu_usage_gauge = Gauge(
                                'gpu_utilization_percent',
                                'GPU utilization percentage',
                                ['gpu_id']
                            )
                            gpu_usage_gauge.labels(gpu_id=gpu.id).set(gpu.load * 100)
                    except:
                        pass  # GPU not available or GPUtil not installed
                
                await asyncio.sleep(30)  # Collect every 30 seconds
                
            except Exception as e:
                self.logger.error(f"Error collecting system metrics: {e}")
                await asyncio.sleep(30)
    
    async def cleanup_old_metrics(self):
        """Clean up old metrics data periodically."""
        while True:
            try:
                # Clean up old request timing data
                current_time = time.time()
                expired_keys = [
                    key for key, start_time in self.request_start_times.items()
                    if current_time - start_time > 300  # 5 minutes
                ]
                
                for key in expired_keys:
                    del self.request_start_times[key]
                
                await asyncio.sleep(300)  # Clean up every 5 minutes
                
            except Exception as e:
                self.logger.error(f"Error cleaning up metrics: {e}")
                await asyncio.sleep(300)
    
    async def track_request_start(self, request: Request):
        """Track the start of a request."""
        request_id = id(request)
        self.request_start_times[request_id] = time.time()
        self.active_request_count += 1
        self.active_requests.inc()
    
    async def track_request_end(self, request: Request, response: Response):
        """Track the end of a request."""
        request_id = id(request)
        start_time = self.request_start_times.pop(request_id, time.time())
        duration = time.time() - start_time
        
        self.active_request_count -= 1
        self.active_requests.dec()
        
        # Record metrics
        endpoint = request.url.path
        method = request.method
        
        self.request_count.labels(
            method=method,
            endpoint=endpoint,
            status_code=response.status_code
        ).inc()
        
        self.request_duration.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)
        
        self.api_response_time.labels(
            endpoint=endpoint,
            method=method
        ).observe(duration)
    
    async def log_request_response(self, request: Request, response: Response, start_time: float):
        """Log detailed request/response information."""
        duration = time.time() - start_time
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "url": str(request.url),
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "user_agent": request.headers.get("user-agent", ""),
            "content_length": response.headers.get("content-length", 0),
            "client_host": request.client.host if request.client else None
        }
        
        # Log to standard logger
        self.logger.info(f"REQUEST: {log_data}")
        
        # Store in cache for real-time monitoring
        cache_key = "recent_requests"
        recent_requests = await cache_service.get(cache_key) or []
        recent_requests.insert(0, log_data)
        recent_requests = recent_requests[:100]  # Keep last 100 requests
        await cache_service.set(cache_key, recent_requests, 3600)  # 1 hour
    
    async def log_error(self, request: Request, error: Exception, error_type: str = "application"):
        """Log error information."""
        endpoint = request.url.path if request else "unknown"
        
        error_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": error_type,
            "message": str(error),
            "endpoint": endpoint,
            "user_agent": request.headers.get("user-agent", "") if request else "",
            "client_host": request.client.host if request and request.client else None
        }
        
        # Log to standard logger
        self.logger.error(f"ERROR: {error_data}")
        
        # Record in metrics
        self.error_count.labels(
            type=error_type,
            endpoint=endpoint
        ).inc()
        
        # Store in cache for error analysis
        cache_key = "recent_errors"
        recent_errors = await cache_service.get(cache_key) or []
        recent_errors.insert(0, error_data)
        recent_errors = recent_errors[:50]  # Keep last 50 errors
        await cache_service.set(cache_key, recent_errors, 3600)  # 1 hour
    
    async def get_application_health(self) -> Dict[str, Any]:
        """Get comprehensive application health status."""
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {},
            "metrics": {}
        }
        
        # Database connectivity check
        try:
            async for db in get_db():
                # Simple query to test connection
                result = await db.execute("SELECT 1")
                health_data["checks"]["database"] = {"status": "healthy", "response_time_ms": 0}
        except Exception as e:
            health_data["checks"]["database"] = {"status": "unhealthy", "error": str(e)}
            health_data["status"] = "unhealthy"
        
        # Cache connectivity check
        try:
            await cache_service.set("health_check", "ok", 10)
            cache_result = await cache_service.get("health_check")
            if cache_result == "ok":
                health_data["checks"]["cache"] = {"status": "healthy"}
            else:
                health_data["checks"]["cache"] = {"status": "unhealthy", "error": "Cache read/write failed"}
                health_data["status"] = "unhealthy"
        except Exception as e:
            health_data["checks"]["cache"] = {"status": "unhealthy", "error": str(e)}
            health_data["status"] = "unhealthy"
        
        # System metrics
        try:
            health_data["metrics"]["cpu_percent"] = psutil.cpu_percent()
            health_data["metrics"]["memory_percent"] = psutil.virtual_memory().percent
            health_data["metrics"]["disk_percent"] = (psutil.disk_usage('/').used / psutil.disk_usage('/').total) * 100
            health_data["metrics"]["active_requests"] = self.active_request_count
        except Exception as e:
            health_data["metrics"]["system_error"] = str(e)
        
        # Recent error count
        recent_errors = await cache_service.get("recent_errors") or []
        health_data["metrics"]["recent_errors_count"] = len(recent_errors)
        
        # Active users count (approximate)
        try:
            from backend.realtime.socket_manager import get_connected_users_count
            health_data["metrics"]["connected_users"] = get_connected_users_count()
        except:
            health_data["metrics"]["connected_users"] = 0
        
        return health_data
    
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get detailed performance metrics."""
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "system": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": (psutil.disk_usage('/').used / psutil.disk_usage('/').total) * 100,
                "process_count": len(psutil.pids())
            },
            "application": {
                "active_requests": self.active_request_count,
                "uptime_seconds": getattr(self, '_start_time', time.time()) - time.time()
            },
            "requests": {
                "recent_count": len(await cache_service.get("recent_requests") or []),
                "avg_response_time_ms": self._calculate_avg_response_time()
            },
            "database": {
                "connections": 0,  # Would need to track actual DB connections
                "queries_per_second": 0  # Would need to track query counts
            }
        }
        
        return metrics
    
    def _calculate_avg_response_time(self) -> float:
        """Calculate average response time from recent requests."""
        # This would typically aggregate from collected metrics
        # For now, returning a placeholder
        return 0.0
    
    async def track_custom_metric(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Track a custom metric."""
        # In a real implementation, this would create dynamic metrics
        # For now, we'll log it
        metric_data = {
            "name": name,
            "value": value,
            "labels": labels or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.debug(f"CUSTOM_METRIC: {metric_data}")
    
    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data for monitoring dashboard."""
        recent_requests = await cache_service.get("recent_requests") or []
        recent_errors = await cache_service.get("recent_errors") or []
        
        # Calculate request statistics
        total_requests = len(recent_requests)
        error_count = len(recent_errors)
        success_rate = ((total_requests - error_count) / total_requests * 100) if total_requests > 0 else 100
        
        # Average response time
        if recent_requests:
            avg_response_time = sum(r.get("duration_ms", 0) for r in recent_requests) / len(recent_requests)
        else:
            avg_response_time = 0
        
        # Endpoint distribution
        endpoint_counts = {}
        for req in recent_requests:
            endpoint = req.get("url", "unknown")
            endpoint_counts[endpoint] = endpoint_counts.get(endpoint, 0) + 1
        
        # Error distribution
        error_types = {}
        for err in recent_errors:
            err_type = err.get("type", "unknown")
            error_types[err_type] = error_types.get(err_type, 0) + 1
        
        return {
            "summary": {
                "total_requests": total_requests,
                "total_errors": error_count,
                "success_rate_percent": round(success_rate, 2),
                "average_response_time_ms": round(avg_response_time, 2),
                "active_requests": self.active_request_count
            },
            "trends": {
                "requests_per_minute": self._calculate_requests_per_minute(recent_requests),
                "errors_per_minute": self._calculate_errors_per_minute(recent_errors)
            },
            "top_endpoints": sorted(
                [(k, v) for k, v in endpoint_counts.items()], 
                key=lambda x: x[1], 
                reverse=True
            )[:10],
            "error_types": sorted(
                [(k, v) for k, v in error_types.items()], 
                key=lambda x: x[1], 
                reverse=True
            )[:5],
            "system_metrics": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": (psutil.disk_usage('/').used / psutil.disk_usage('/').total) * 100
            }
        }
    
    def _calculate_requests_per_minute(self, requests: list) -> float:
        """Calculate requests per minute from recent data."""
        if not requests:
            return 0
        
        # Calculate based on time range of recent requests
        first_time = datetime.fromisoformat(requests[-1]["timestamp"]) if requests else datetime.utcnow()
        last_time = datetime.fromisoformat(requests[0]["timestamp"]) if requests else datetime.utcnow()
        
        time_diff = (last_time - first_time).total_seconds() / 60  # in minutes
        if time_diff == 0:
            return len(requests)  # All requests in same moment
        
        return len(requests) / time_diff if time_diff > 0 else len(requests)
    
    def _calculate_errors_per_minute(self, errors: list) -> float:
        """Calculate errors per minute from recent data."""
        if not errors:
            return 0
        
        # Calculate based on time range of recent errors
        first_time = datetime.fromisoformat(errors[-1]["timestamp"]) if errors else datetime.utcnow()
        last_time = datetime.fromisoformat(errors[0]["timestamp"]) if errors else datetime.utcnow()
        
        time_diff = (last_time - first_time).total_seconds() / 60  # in minutes
        if time_diff == 0:
            return len(errors)  # All errors in same moment
        
        return len(errors) / time_diff if time_diff > 0 else len(errors)
    
    async def track_analytics_event(self, user_id: int, event_type: str, metadata: Dict[str, Any]):
        """Track an analytics event in the database."""
        try:
            async for db in get_db():
                analytics_event = AnalyticsEvent(
                    user_id=user_id,
                    event_type=event_type,
                    event_source="system",
                    category="monitoring",
                    timestamp=datetime.utcnow(),
                    meta=metadata,
                    raw_data={"event_type": event_type, "user_id": user_id}
                )
                db.add(analytics_event)
                await db.commit()
        except Exception as e:
            self.logger.error(f"Failed to track analytics event: {e}")


# Global monitoring service instance
monitoring_service = MonitoringService()