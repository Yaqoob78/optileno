from fastapi import APIRouter
from backend.core.monitoring import monitoring_service

router = APIRouter()

@router.get("/health")
async def health():
    """
    Comprehensive health check endpoint.
    """
    health_data = await monitoring_service.get_application_health()
    status_code = 200 if health_data.get("status") == "healthy" else 503
    
    return health_data

@router.get("/health/simple")
async def simple_health():
    """
    Simple liveness probe.
    """
    return {"status": "ok"}

@router.get("/metrics")
async def get_metrics():
    """
    Get detailed performance metrics.
    """
    metrics = await monitoring_service.get_performance_metrics()
    return metrics

@router.get("/dashboard")
async def get_dashboard_data():
    """
    Get data for monitoring dashboard.
    """
    dashboard_data = await monitoring_service.get_dashboard_data()
    return dashboard_data