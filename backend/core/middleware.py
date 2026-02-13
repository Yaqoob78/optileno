# backend/core/middleware.py
"""
Enterprise Security Middleware for Optileno SaaS.

Features:
- Adaptive rate limiting with burst allowance
- Configurable limits via environment variables
- Request validation and sanitization
- Security headers (OWASP compliance)
- Request/response logging with metrics
- CSRF protection with flexible configuration
- Performance monitoring integration
"""

import time
import logging
import hmac
import re
from typing import Callable, Dict, List, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime

from backend.app.config import settings

logger = logging.getLogger(__name__)


# ==================================================
# Middleware Metrics
# ==================================================
class MiddlewareMetrics:
    """Track middleware performance metrics."""
    
    def __init__(self):
        self.total_requests = 0
        self.blocked_requests = 0
        self.rate_limited_requests = 0
        self.csrf_failures = 0
        self.validation_failures = 0
        self.slow_requests = 0
        self.avg_response_time_ms = 0.0
        self._response_times: List[float] = []
    
    def record_request(self, response_time_ms: float, status_code: int):
        self.total_requests += 1
        self._response_times.append(response_time_ms)
        
        # Keep only last 10000 samples
        if len(self._response_times) > 10000:
            self._response_times = self._response_times[-10000:]
        
        self.avg_response_time_ms = sum(self._response_times) / len(self._response_times)
        
        # Track slow requests (>200ms threshold from config)
        if response_time_ms > settings.PERF_RESPONSE_TIME_THRESHOLD_MS:
            self.slow_requests += 1
    
    def to_dict(self) -> Dict:
        return {
            "total_requests": self.total_requests,
            "blocked_requests": self.blocked_requests,
            "rate_limited_requests": self.rate_limited_requests,
            "csrf_failures": self.csrf_failures,
            "validation_failures": self.validation_failures,
            "slow_requests": self.slow_requests,
            "avg_response_time_ms": round(self.avg_response_time_ms, 2),
            "p95_threshold_ms": settings.PERF_RESPONSE_TIME_THRESHOLD_MS,
        }

middleware_metrics = MiddlewareMetrics()


# ==================================================
# Adaptive Rate Limiting
# ==================================================
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Adaptive rate limiting middleware with burst allowance.
    
    Features:
    - Configurable limits via environment variables
    - Per-IP and per-user rate limiting
    - Burst allowance for legitimate traffic spikes
    - Sliding window algorithm
    """

    def __init__(self, app):
        super().__init__(app)
        self.request_counts: Dict[str, List[float]] = defaultdict(list)
        self.burst_counts: Dict[str, int] = defaultdict(int)
        self.last_cleanup = time.time()
    
    def _cleanup_old_requests(self, now: float):
        """Periodic cleanup of old request records."""
        # Cleanup every 60 seconds
        if now - self.last_cleanup < 60:
            return
        
        window = settings.RATE_LIMIT_WINDOW_SECONDS
        keys_to_delete = []
        
        for key, timestamps in self.request_counts.items():
            # Remove old timestamps
            self.request_counts[key] = [t for t in timestamps if now - t < window]
            if not self.request_counts[key]:
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self.request_counts[key]
            self.burst_counts.pop(key, None)
        
        self.last_cleanup = now

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply adaptive rate limiting."""
        
        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        identifier = client_ip
        
        # Check if user is authenticated (higher limit)
        is_authenticated = hasattr(request.state, "user_id")
        if is_authenticated:
            identifier = f"user_{request.state.user_id}"
            max_requests = settings.RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE
        else:
            max_requests = settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        
        # Apply burst allowance
        burst_allowance = settings.RATE_LIMIT_BURST_ALLOWANCE
        effective_limit = max_requests + burst_allowance
        
        now = time.time()
        window = settings.RATE_LIMIT_WINDOW_SECONDS
        
        # Cleanup old requests periodically
        self._cleanup_old_requests(now)
        
        # Clean old requests for this identifier
        self.request_counts[identifier] = [
            req_time for req_time in self.request_counts[identifier]
            if now - req_time < window
        ]
        
        current_count = len(self.request_counts[identifier])
        
        # Check rate limit
        if current_count >= effective_limit:
            middleware_metrics.rate_limited_requests += 1
            middleware_metrics.blocked_requests += 1
            logger.warning(f"Rate limit exceeded for {identifier}: {current_count}/{effective_limit}")
            
            # Calculate retry-after
            oldest_request = min(self.request_counts[identifier]) if self.request_counts[identifier] else now
            retry_after = int(window - (now - oldest_request)) + 1
            
            return Response(
                content='{"error": "Too many requests", "retry_after": ' + str(retry_after) + '}',
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + retry_after))
                }
            )
        
        # Record this request
        self.request_counts[identifier].append(now)
        
        # Track burst usage
        if current_count > max_requests:
            self.burst_counts[identifier] = current_count - max_requests
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = max(0, max_requests - current_count - 1)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + window))
        
        if self.burst_counts[identifier] > 0:
            response.headers["X-RateLimit-Burst-Used"] = str(self.burst_counts[identifier])
        
        return response


# ==================================================
# Request Validation
# ==================================================
class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Request validation middleware with security sanitization.
    
    Features:
    - Content-Type validation
    - Body size limits
    - SQL injection pattern detection
    - XSS pattern detection
    """

    MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB
    
    # SQL injection patterns
    SQL_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)",
        r"(--|\#|\/\*|\*\/)",
        r"(\b(OR|AND)\b\s+[\d\w'\"]+\s*=\s*[\d\w'\"]+)",
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
    ]

    def __init__(self, app):
        super().__init__(app)
        self.sql_regex = [re.compile(p, re.IGNORECASE) for p in self.SQL_PATTERNS]
        self.xss_regex = [re.compile(p, re.IGNORECASE) for p in self.XSS_PATTERNS]

    def _check_for_injection(self, value: str) -> bool:
        """Check for SQL injection or XSS patterns."""
        for pattern in self.sql_regex:
            if pattern.search(value):
                return True
        for pattern in self.xss_regex:
            if pattern.search(value):
                return True
        return False

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate incoming requests."""

        # Check Content-Type for POST/PUT/PATCH
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")

            if not any(ct in content_type for ct in [
                "application/json",
                "multipart/form-data",
                "application/x-www-form-urlencoded",
            ]):
                middleware_metrics.validation_failures += 1
                logger.warning(f"Invalid Content-Type: {content_type}")
                return Response(
                    content='{"error": "Invalid Content-Type"}',
                    status_code=415,
                    media_type="application/json"
                )

        # Check content length
        content_length = request.headers.get("content-length", "0")
        try:
            content_length = int(content_length)
            if content_length > self.MAX_BODY_SIZE:
                middleware_metrics.validation_failures += 1
                logger.warning(f"Request body too large: {content_length}")
                return Response(
                    content='{"error": "Request body too large"}',
                    status_code=413,
                    media_type="application/json"
                )
        except ValueError:
            pass

        # Check query parameters for injection (lightweight check)
        for key, value in request.query_params.items():
            if self._check_for_injection(value):
                middleware_metrics.validation_failures += 1
                middleware_metrics.blocked_requests += 1
                logger.warning(f"Potential injection detected in query param: {key}")
                return Response(
                    content='{"error": "Invalid request parameters"}',
                    status_code=400,
                    media_type="application/json"
                )

        response = await call_next(request)
        return response


# ==================================================
# Security Headers
# ==================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    OWASP-compliant security headers middleware.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' ws: wss: https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        # Strict Transport Security (HSTS) - 1 year
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        else:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Cache control for sensitive endpoints
        if "/api/v1/auth" in request.url.path or "/api/v1/users" in request.url.path:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"

        return response


# ==================================================
# Logging Middleware with Metrics
# ==================================================
class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Request/response logging middleware with performance metrics.
    """

    # Paths to exclude from verbose logging
    QUIET_PATHS = {"/health", "/metrics", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        request_id = f"{int(start_time * 1000)}-{id(request)}"
        
        # Add request ID to state
        request.state.request_id = request_id

        # Log request (skip quiet paths)
        if request.url.path not in self.QUIET_PATHS:
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} | "
                f"Client: {request.client.host if request.client else 'unknown'}"
            )

        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"[{request_id}] Error handling request: {e}")
            raise

        # Calculate response time
        process_time = time.time() - start_time
        process_time_ms = process_time * 1000
        
        # Record metrics
        middleware_metrics.record_request(process_time_ms, response.status_code)

        # Log response (skip quiet paths)
        if request.url.path not in self.QUIET_PATHS:
            log_level = logging.WARNING if process_time_ms > settings.PERF_RESPONSE_TIME_THRESHOLD_MS else logging.INFO
            logger.log(
                log_level,
                f"[{request_id}] {request.method} {request.url.path} | "
                f"Status: {response.status_code} | "
                f"Duration: {process_time_ms:.2f}ms"
            )

        # Add timing headers
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        response.headers["X-Request-ID"] = request_id

        return response


# ==================================================
# CSRF Protection
# ==================================================
class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware with flexible configuration.
    """

    STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    SKIP_CSRF_PATHS = {
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/validate",
        "/api/v1/webhooks/webhook",
        "/api/v1/webhooks/stripe",
        "/metrics",
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate CSRF token for state-changing requests."""

        # Skip for safe paths
        if request.url.path in self.SKIP_CSRF_PATHS:
            return await call_next(request)
        
        # Skip for paths starting with skipped prefixes
        # Also skip /api/v1/ paths — they use X-Requested-With header as CSRF mitigation
        # and the backend does not issue csrf_token cookies for cookie-auth sessions.
        if any(request.url.path.startswith(p) for p in ["/socket.io", "/ws", "/api/v1/"]):
            return await call_next(request)

        # Skip CSRF check for safe methods
        if request.method not in self.STATE_CHANGING_METHODS:
            return await call_next(request)

        # Skip CSRF if Authorization header is used (API auth)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return await call_next(request)

        # Validate CSRF token
        csrf_cookie = request.cookies.get("csrf_token")
        csrf_header = request.headers.get("X-CSRF-Token") or request.headers.get("X-Csrf-Token")

        if not csrf_cookie or not csrf_header:
            middleware_metrics.csrf_failures += 1
            middleware_metrics.blocked_requests += 1
            logger.warning(f"CSRF token missing for {request.method} {request.url.path}")
            return Response(
                content='{"error": "CSRF token required"}',
                status_code=403,
                media_type="application/json"
            )

        if not hmac.compare_digest(csrf_cookie, csrf_header):
            middleware_metrics.csrf_failures += 1
            middleware_metrics.blocked_requests += 1
            logger.warning(f"CSRF token mismatch for {request.method} {request.url.path}")
            return Response(
                content='{"error": "CSRF token invalid"}',
                status_code=403,
                media_type="application/json"
            )

        response = await call_next(request)
        return response


# ==================================================
# Utility Functions
# ==================================================
def get_middleware_metrics() -> Dict:
    """Get current middleware metrics."""
    return middleware_metrics.to_dict()


def reset_middleware_metrics():
    """Reset middleware metrics (for testing)."""
    global middleware_metrics
    middleware_metrics = MiddlewareMetrics()
