"""
Production monitoring and alerting system for Optileno.
Metrics collection, alerting, and performance monitoring.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import psutil
from dataclasses import dataclass, asdict

from backend.core.redis_rate_limiter import redis_rate_limiter
from backend.app.config import settings

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    """System performance metrics"""
    timestamp: str
    cpu_percent: float
    memory_percent: float
    memory_available_gb: float
    disk_usage_percent: float
    disk_free_gb: float
    active_connections: int
    load_average: List[float]

@dataclass
class ApplicationMetrics:
    """Application-specific metrics"""
    timestamp: str
    active_users: int
    requests_per_minute: float
    error_rate: float
    response_time_p95: float
    ai_requests_per_minute: float
    database_connections: int
    redis_connections: int

@dataclass
class Alert:
    """Alert definition"""
    id: str
    name: str
    severity: "low" | "medium" | "high" | "critical"
    condition: str
    threshold: float
    current_value: float
    message: str
    timestamp: str
    resolved: bool = False

class ProductionMonitor:
    """Production monitoring system"""
    
    def __init__(self):
        self.metrics_history: List[SystemMetrics] = []
        self.app_metrics_history: List[ApplicationMetrics] = []
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_thresholds = self._load_alert_thresholds()
        self._monitoring_task: Optional[asyncio.Task] = None
        
    def _load_alert_thresholds(self) -> Dict[str, Dict]:
        """Load alert thresholds from configuration"""
        return {
            "cpu_high": {"threshold": 80, "severity": "high", "condition": "cpu_percent >"},
            "cpu_critical": {"threshold": 95, "severity": "critical", "condition": "cpu_percent >"},
            "memory_high": {"threshold": 85, "severity": "high", "condition": "memory_percent >"},
            "memory_critical": {"threshold": 95, "severity": "critical", "condition": "memory_percent >"},
            "disk_high": {"threshold": 85, "severity": "medium", "condition": "disk_usage_percent >"},
            "error_rate_high": {"threshold": 5, "severity": "high", "condition": "error_rate >"},
            "response_time_slow": {"threshold": 2000, "severity": "medium", "condition": "response_time_p95 >"},
            "active_users_low": {"threshold": 0, "severity": "low", "condition": "active_users <"},
        }
    
    async def collect_system_metrics(self) -> SystemMetrics:
        """Collect system performance metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            load_avg = list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0, 0, 0]
            
            # Memory metrics
            memory = psutil.virtual_memory()
            memory_available_gb = memory.available / (1024**3)
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            disk_usage_percent = (disk.used / disk.total) * 100
            disk_free_gb = disk.free / (1024**3)
            
            # Network connections
            try:
                active_connections = len(psutil.net_connections())
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                active_connections = 0
            
            metrics = SystemMetrics(
                timestamp=datetime.utcnow().isoformat(),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                memory_available_gb=memory_available_gb,
                disk_usage_percent=disk_usage_percent,
                disk_free_gb=disk_free_gb,
                active_connections=active_connections,
                load_average=load_avg
            )
            
            # Keep only last 100 entries
            self.metrics_history.append(metrics)
            if len(self.metrics_history) > 100:
                self.metrics_history.pop(0)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
            raise
    
    async def collect_application_metrics(self) -> ApplicationMetrics:
        """Collect application-specific metrics"""
        try:
            # This would typically connect to your monitoring system
            # For now, we'll simulate some metrics
            
            metrics = ApplicationMetrics(
                timestamp=datetime.utcnow().isoformat(),
                active_users=await self._get_active_user_count(),
                requests_per_minute=await self._get_requests_per_minute(),
                error_rate=await self._get_error_rate(),
                response_time_p95=await self._get_response_time_p95(),
                ai_requests_per_minute=await self._get_ai_requests_per_minute(),
                database_connections=await self._get_database_connections(),
                redis_connections=await self._get_redis_connections()
            )
            
            # Keep only last 100 entries
            self.app_metrics_history.append(metrics)
            if len(self.app_metrics_history) > 100:
                self.app_metrics_history.pop(0)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect application metrics: {e}")
            raise
    
    async def _get_active_user_count(self) -> int:
        """Get current active user count"""
        try:
            # This would typically query your database or cache
            # For now, return a simulated value
            return 42
        except Exception:
            return 0
    
    async def _get_requests_per_minute(self) -> float:
        """Get requests per minute"""
        try:
            # This would typically query your logs or monitoring system
            return 125.5
        except Exception:
            return 0.0
    
    async def _get_error_rate(self) -> float:
        """Get current error rate percentage"""
        try:
            # This would typically calculate from your logs
            return 2.3
        except Exception:
            return 0.0
    
    async def _get_response_time_p95(self) -> float:
        """Get 95th percentile response time in milliseconds"""
        try:
            # This would typically calculate from your monitoring data
            return 450.0
        except Exception:
            return 0.0
    
    async def _get_ai_requests_per_minute(self) -> float:
        """Get AI requests per minute"""
        try:
            # This would typically query your AI service metrics
            return 15.2
        except Exception:
            return 0.0
    
    async def _get_database_connections(self) -> int:
        """Get current database connection count"""
        try:
            # This would typically query your database pool
            return 8
        except Exception:
            return 0
    
    async def _get_redis_connections(self) -> int:
        """Get current Redis connection count"""
        try:
            if redis_rate_limiter.redis_client:
                info = await redis_rate_limiter.redis_client.info()
                return info.get("connected_clients", 0)
            return 0
        except Exception:
            return 0
    
    async def check_alerts(self, system_metrics: SystemMetrics, app_metrics: ApplicationMetrics):
        """Check all alert conditions and trigger alerts if needed"""
        alerts_to_check = [
            # System alerts
            ("cpu_high", system_metrics.cpu_percent),
            ("cpu_critical", system_metrics.cpu_percent),
            ("memory_high", system_metrics.memory_percent),
            ("memory_critical", system_metrics.memory_percent),
            ("disk_high", system_metrics.disk_usage_percent),
            
            # Application alerts
            ("error_rate_high", app_metrics.error_rate),
            ("response_time_slow", app_metrics.response_time_p95),
            ("active_users_low", app_metrics.active_users),
        ]
        
        for alert_id, current_value in alerts_to_check:
            await self._check_alert(alert_id, current_value)
    
    async def _check_alert(self, alert_id: str, current_value: float):
        """Check individual alert condition"""
        threshold_config = self.alert_thresholds.get(alert_id)
        if not threshold_config:
            return
        
        condition = threshold_config["condition"]
        threshold = threshold_config["threshold"]
        
        # Evaluate condition
        if condition.endswith(">"):
            triggered = current_value > threshold
        elif condition.endswith("<"):
            triggered = current_value < threshold
        else:
            return
        
        alert_key = f"{alert_id}_{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        
        if triggered and alert_key not in self.active_alerts:
            # Create new alert
            alert = Alert(
                id=alert_key,
                name=alert_id.replace("_", " ").title(),
                severity=threshold_config["severity"],
                condition=condition,
                threshold=threshold,
                current_value=current_value,
                message=self._generate_alert_message(alert_id, current_value, threshold),
                timestamp=datetime.utcnow().isoformat()
            )
            
            self.active_alerts[alert_key] = alert
            await self._send_alert(alert)
            
            logger.warning(f"Alert triggered: {alert.name} - {alert.message}")
            
        elif not triggered and alert_key in self.active_alerts:
            # Resolve alert
            alert = self.active_alerts[alert_key]
            alert.resolved = True
            await self._resolve_alert(alert)
            
            del self.active_alerts[alert_key]
            logger.info(f"Alert resolved: {alert.name}")
    
    def _generate_alert_message(self, alert_id: str, current_value: float, threshold: float) -> str:
        """Generate alert message"""
        messages = {
            "cpu_high": f"High CPU usage: {current_value:.1f}% (threshold: {threshold}%)",
            "cpu_critical": f"Critical CPU usage: {current_value:.1f}% (threshold: {threshold}%)",
            "memory_high": f"High memory usage: {current_value:.1f}% (threshold: {threshold}%)",
            "memory_critical": f"Critical memory usage: {current_value:.1f}% (threshold: {threshold}%)",
            "disk_high": f"High disk usage: {current_value:.1f}% (threshold: {threshold}%)",
            "error_rate_high": f"High error rate: {current_value:.1f}% (threshold: {threshold}%)",
            "response_time_slow": f"Slow response time: {current_value:.0f}ms (threshold: {threshold}ms)",
            "active_users_low": f"Low active users: {int(current_value)} (threshold: {int(threshold)})",
        }
        
        return messages.get(alert_id, f"Alert triggered: {alert_id}")
    
    async def _send_alert(self, alert: Alert):
        """Send alert notification"""
        try:
            # In production, this would send to your alerting system
            # Examples: Slack, email, PagerDuty, SMS, etc.
            
            alert_data = {
                "alert_id": alert.id,
                "name": alert.name,
                "severity": alert.severity,
                "message": alert.message,
                "timestamp": alert.timestamp,
                "threshold": alert.threshold,
                "current_value": alert.current_value
            }
            
            # Log alert for monitoring system
            logger.error(f"ALERT: {json.dumps(alert_data)}")
            
            # TODO: Implement actual alert delivery
            # - Send to Slack webhook
            # - Send email notification
            # - Send to PagerDuty
            # - Send to monitoring system
            
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
    
    async def _resolve_alert(self, alert: Alert):
        """Handle alert resolution"""
        try:
            resolution_data = {
                "alert_id": alert.id,
                "name": alert.name,
                "resolved_at": datetime.utcnow().isoformat(),
                "message": f"Alert resolved: {alert.message}"
            }
            
            logger.info(f"ALERT RESOLVED: {json.dumps(resolution_data)}")
            
            # TODO: Send resolution notification
            
        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
    
    async def start_monitoring(self, interval_seconds: int = 60):
        """Start continuous monitoring"""
        if self._monitoring_task and not self._monitoring_task.done():
            return
        
        self._monitoring_task = asyncio.create_task(self._monitoring_loop(interval_seconds))
        logger.info(f"Started production monitoring with {interval_seconds}s interval")
    
    async def stop_monitoring(self):
        """Stop continuous monitoring"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            self._monitoring_task = None
            logger.info("Stopped production monitoring")
    
    async def _monitoring_loop(self, interval_seconds: int):
        """Main monitoring loop"""
        while True:
            try:
                # Collect metrics
                system_metrics = await self.collect_system_metrics()
                app_metrics = await self.collect_application_metrics()
                
                # Check alerts
                await self.check_alerts(system_metrics, app_metrics)
                
                # Wait for next iteration
                await asyncio.sleep(interval_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval_seconds)
    
    def get_current_status(self) -> Dict[str, Any]:
        """Get current monitoring status"""
        return {
            "monitoring_active": self._monitoring_task is not None and not self._monitoring_task.done(),
            "active_alerts_count": len(self.active_alerts),
            "system_metrics_count": len(self.metrics_history),
            "app_metrics_count": len(self.app_metrics_history),
            "last_system_check": self.metrics_history[-1].timestamp if self.metrics_history else None,
            "last_app_check": self.app_metrics_history[-1].timestamp if self.app_metrics_history else None,
            "active_alerts": [asdict(alert) for alert in self.active_alerts.values()]
        }
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of recent metrics"""
        if not self.metrics_history or not self.app_metrics_history:
            return {"error": "No metrics available"}
        
        recent_system = self.metrics_history[-10:]  # Last 10 entries
        recent_app = self.app_metrics_history[-10:]
        
        return {
            "system": {
                "avg_cpu_percent": sum(m.cpu_percent for m in recent_system) / len(recent_system),
                "avg_memory_percent": sum(m.memory_percent for m in recent_system) / len(recent_system),
                "avg_disk_usage": sum(m.disk_usage_percent for m in recent_system) / len(recent_system),
                "current_connections": recent_system[-1].active_connections if recent_system else 0
            },
            "application": {
                "avg_active_users": sum(m.active_users for m in recent_app) / len(recent_app),
                "avg_requests_per_minute": sum(m.requests_per_minute for m in recent_app) / len(recent_app),
                "avg_error_rate": sum(m.error_rate for m in recent_app) / len(recent_app),
                "avg_response_time_p95": sum(m.response_time_p95 for m in recent_app) / len(recent_app),
                "current_ai_requests_per_minute": recent_app[-1].ai_requests_per_minute if recent_app else 0
            }
        }

# Global monitor instance
production_monitor = ProductionMonitor()

async def get_production_monitor() -> ProductionMonitor:
    """Get the production monitor instance"""
    return production_monitor
