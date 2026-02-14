"""
Optileno SaaS Backend - Main Application Entry Point.

Enterprise-grade FastAPI application with:
- Horizontal scaling support (5,000+ concurrent users)
- Redis-backed caching and session management
- WebSocket real-time communication
- Comprehensive health monitoring
- Security middleware stack (OWASP compliant)
- Performance metrics and observability
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import time
import logging
from pathlib import Path

from backend.app.config import settings, log_startup_settings
from backend.api.v1.api import api_router
from backend.auth import auth_router
from backend.db.database import init_db, close_db
from backend.realtime import create_socketio_app
from backend.core.cache import cache_service
from backend.core.monitoring import monitoring_service
from backend.core.middleware import (
    RateLimitMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware,
    LoggingMiddleware,
    CSRFMiddleware,
)
from backend.core.health import (
    get_health,
    get_health_simple,
    get_readiness,
    export_prometheus_metrics,
)

# ==================================================
# Logging Configuration
# ==================================================
log_level = logging.DEBUG if settings.DEBUG else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ==================================================
# Lifespan Manager
# ==================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown of all services.
    """
    start_time = time.time()
    logger.info("=" * 60)
    logger.info(f"[ROCKET] Starting Optileno SaaS v{settings.VERSION}")
    logger.info(f"[CHART] Environment: {settings.ENVIRONMENT}")
    logger.info("=" * 60)

    try:
        # Initialize database with enterprise pooling
        await init_db()
        logger.info("[CHECK] Database initialized with enterprise pooling")

        # Initialize cache service with circuit breaker
        await cache_service.initialize()
        logger.info("[CHECK] Cache service initialized with HA patterns")

        # Initialize monitoring service
        try:
            await monitoring_service.initialize()
            logger.info("[CHECK] Monitoring service initialized")
        except Exception as e:
            logger.warning(f"[WARN] Monitoring service init failed (non-critical): {e}")

        # Log startup configuration
        log_startup_settings()

        startup_time = (time.time() - start_time) * 1000
        logger.info("=" * 60)
        logger.info(f"[LINK] API Docs: {settings.BASE_URL}/docs")
        logger.info(f"[PLUG] Real-time: ws://localhost:{settings.PORT}/socket.io/")
        logger.info(f"[SPEED] Startup completed in {startup_time:.2f}ms")
        logger.info("=" * 60)

        yield

    except Exception as e:
        logger.critical(f"[CROSS] Startup failed: {e}")
        raise

    finally:
        logger.info("[STOP] Initiating graceful shutdown...")
        
        # Close cache connections
        try:
            await cache_service.close()
            logger.info("[CHECK] Cache connections closed")
        except Exception as e:
            logger.warning(f"[WARN] Cache shutdown error: {e}")
        
        # Close database connections
        try:
            await close_db()
            logger.info("[CHECK] Database connections closed")
        except Exception as e:
            logger.warning(f"[WARN] Database shutdown error: {e}")
        
        logger.info("[CHECK] Clean shutdown completed")


# ==================================================
# FastAPI Application
# ==================================================
app = FastAPI(
    title="Optileno",
    description="Premium SaaS Productivity Platform - Enterprise Edition",
    version=settings.VERSION,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
    lifespan=lifespan,
)

# Static files for media
MEDIA_ROOT = Path("data/media")
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


# ==================================================
# Global Exception Handler
# ==================================================
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all uncaught exceptions."""
    import traceback
    logger.error(f"Global error: {exc}")
    
    if settings.DEBUG:
        traceback.print_exc()

    from fastapi.responses import JSONResponse
    content = {"message": "Internal Server Error", "status": "error"}
    if settings.DEBUG:
        content["detail"] = str(exc)
    
    # Include CORS headers so errors aren't masked as CORS errors in browsers
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in settings.CORS_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(status_code=500, content=content, headers=headers)


from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Handle validation errors with CORS headers so they aren't masked."""
    from fastapi.responses import JSONResponse
    
    content = {"message": "Validation Error", "status": "error", "detail": exc.errors()}
    
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in settings.CORS_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(status_code=422, content=content, headers=headers)


# ==================================================
# Middleware Stack (Order matters: inner to outer)
# ==================================================

# Compression (innermost)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# Logging with metrics
app.add_middleware(LoggingMiddleware)

# Adaptive rate limiting with configurable limits
app.add_middleware(RateLimitMiddleware)

# Request validation with injection detection
app.add_middleware(RequestValidationMiddleware)

# CSRF protection
app.add_middleware(CSRFMiddleware)

# CORS (outermost - must be last)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-Process-Time",
        "X-Request-ID",
    ],
)


# ==================================================
# API Routes
# ==================================================
app.include_router(api_router, prefix="/api/v1")
# Backward-compatible auth routes for legacy frontend bundles.
app.include_router(auth_router, prefix="/auth", tags=["Authentication (Legacy)"])


# ==================================================
# Health & Monitoring Endpoints
# ==================================================
@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "message": "Welcome to Optileno",
        "service": "Premium SaaS Productivity Platform",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if settings.ENABLE_DOCS else None,
        "health": "/health",
        "scaling": {
            "max_concurrent_users": settings.MAX_CONCURRENT_USERS,
            "db_pool_size": settings.DB_POOL_SIZE,
            "redis_max_connections": settings.REDIS_MAX_CONNECTIONS,
        }
    }


@app.get("/health")
async def health():
    """
    Simple liveness probe for load balancers.
    """
    result = await get_health_simple()
    return result


@app.get("/health/full")
async def health_full():
    """
    Comprehensive health check with all subsystem status.
    """
    result = await get_health()
    return result


@app.get("/health/ready")
async def health_ready():
    """
    Kubernetes readiness probe.
    Returns 200 if ready to receive traffic, 503 otherwise.
    """
    result = await get_readiness()
    
    if result["status"] != "ready":
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)
    
    return result


@app.get("/metrics")
async def metrics():
    """
    Prometheus-compatible metrics endpoint.
    """
    if not settings.METRICS_EXPORT_ENABLED:
        return Response(content="Metrics disabled", status_code=404)
    
    metrics_text = await export_prometheus_metrics()
    return Response(
        content=metrics_text,
        media_type="text/plain; version=0.0.4"
    )


# ==================================================
# Socket.IO Integration (Must be LAST)
# ==================================================
# Wrap FastAPI app with Socket.IO for real-time
app = create_socketio_app(app)


# ==================================================
# Local Development Runner
# ==================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level="debug" if settings.DEBUG else "info",
        workers=1 if settings.ENVIRONMENT == "development" else settings.MAX_WORKERS,
    )
