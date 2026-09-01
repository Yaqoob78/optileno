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
from jose import JWTError

from backend.app.config import settings
from backend.auth.auth_utils import decode_token
from backend.core.redis_rate_limiter import redis_rate_limiter

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

from backend.app.config import settings
from backend.auth.auth_utils import decode_token
from backend.core.redis_rate_limiter import redis_rate_limiter

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
        self._last_distributed_limiter_warning = 0.0
        self._warning_interval_seconds = 30
    
    @staticmethod
    def _extract_client_ip(request: Request) -> str:
        """Prefer forwarded headers when behind reverse proxy/load balancer."""
        x_forwarded_for = request.headers.get("x-forwarded-for", "")
        if x_forwarded_for:
            first = x_forwarded_for.split(",")[0].strip()
            if first:
                return first

        x_real_ip = request.headers.get("x-real-ip", "").strip()
        if x_real_ip:
            return x_real_ip

        return request.client.host if request.client else "unknown"

    @staticmethod
    def _extract_user_id(request: Request) -> Optional[str]:
        token: Optional[str] = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        else:
            token = request.cookies.get("access_token")

        if not token:
            return None

        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                return None
            user_id = payload.get("user_id")
            return str(user_id) if user_id is not None else None
        except JWTError:
            return None
        except Exception:
            return None

    def _cleanup_old_requests(self, now: float):
        if now - self.last_cleanup < 60:
            return
        
        window = settings.RATE_LIMIT_WINDOW_SECONDS
        keys_to_delete = []
        
        for key, timestamps in self.request_counts.items():
            self.request_counts[key] = [t for t in timestamps if now - t < window]
            if not self.request_counts[key]:
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self.request_counts[key]
            self.burst_counts.pop(key, None)
        
        self.last_cleanup = now

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Avoid rate limiting health/metrics/docs/root noise
        if (
            request.url.path in {"/", "/health", "/health/full", "/health/ready", "/health/live", "/metrics", "/docs", "/redoc", "/openapi.json", "/robots.txt", "/favicon.ico"}
            or request.url.path.startswith("/api/v1/health")
            or request.url.path.startswith("/api/v1/system/")
        ):
            return await call_next(request)

        user_id = self._extract_user_id(request)
        client_ip = self._extract_client_ip(request)
        identifier = f"user_{user_id}" if user_id else f"ip_{client_ip}"
        max_requests = (
            settings.RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE
            if user_id
            else settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        )

        burst_allowance = settings.RATE_LIMIT_BURST_ALLOWANCE
        effective_limit = max_requests + burst_allowance

        now = time.time()
        window = settings.RATE_LIMIT_WINDOW_SECONDS

        if redis_rate_limiter._initialized and redis_rate_limiter.redis_client:
            try:
                is_allowed = await redis_rate_limiter.check_rate_limit(
                    user_id=identifier,
                    max_requests=effective_limit,
                    window_seconds=window,
                    identifier="http",
                )

                if not is_allowed:
                    middleware_metrics.rate_limited_requests += 1
                    middleware_metrics.blocked_requests += 1
                    logger.warning(f"Rate limit exceeded for {identifier} (distributed): {effective_limit}/{window}s")
                    return Response(
                        content='{"error": "Too many requests", "retry_after": ' + str(window) + '}',
                        status_code=429,
                        media_type="application/json",
                        headers={
                            "Retry-After": str(window),
                            "X-RateLimit-Limit": str(max_requests),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": str(int(now + window))
                        }
                    )

                response = await call_next(request)
                response.headers["X-RateLimit-Limit"] = str(max_requests)
                response.headers["X-RateLimit-Remaining"] = "-1"
                response.headers["X-RateLimit-Reset"] = str(int(now + window))
                return response
            except Exception as e:
                if now - self._last_distributed_limiter_warning > self._warning_interval_seconds:
                    logger.warning(f"Distributed rate limiter unavailable, falling back to local limiter: {e}")
                    self._last_distributed_limiter_warning = now

        self._cleanup_old_requests(now)

        self.request_counts[identifier] = [
            req_time for req_time in self.request_counts[identifier]
            if now - req_time < window
        ]

        current_count = len(self.request_counts[identifier])

        if current_count >= effective_limit:
            middleware_metrics.rate_limited_requests += 1
            middleware_metrics.blocked_requests += 1
            logger.warning(f"Rate limit exceeded for {identifier}: {current_count}/{effective_limit}")

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

        self.request_counts[identifier].append(now)

        if current_count > max_requests:
            self.burst_counts[identifier] = current_count - max_requests

        response = await call_next(request)

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

        # Check content length first
        content_length_raw = request.headers.get("content-length", "0")
        content_length = 0
        try:
            content_length = int(content_length_raw)
            if content_length > self.MAX_BODY_SIZE:
                middleware_metrics.validation_failures += 1
                logger.warning(f"Request body too large: {content_length}")
                return Response(
                    content='{"error": "Request body too large"}',
                    status_code=413,
                    media_type="application/json"
                )
        except ValueError:
            # Unknown content length (for example, chunked transfer).
            content_length = -1

        # Check Content-Type for POST/PUT/PATCH when a request body is present.
        # Empty-body POSTs (for example /auth/logout) should not require a content type.
        if request.method in ["POST", "PUT", "PATCH"]:
            transfer_encoding = (request.headers.get("transfer-encoding") or "").strip().lower()
            has_body = content_length > 0 or transfer_encoding not in ("", "identity")

            if has_body:
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
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob: https://*.googleusercontent.com; "
            "frame-src 'self' https://accounts.google.com; "
            "connect-src 'self' ws: wss: https: https://accounts.google.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Cross-Origin Opener Policy (allows OAuth popups like Google Sign-In)
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"

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
# Canonical 301 Redirect Middleware
# ==================================================
class CanonicalRedirectMiddleware(BaseHTTPMiddleware):
    """
    Enforces global 301 Permanent Redirects:
    1. optileno.com -> https://www.optileno.com (apex to www)
    Never redirects API or load balancer health checks.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        host = request.headers.get("host", "").split(":")[0].lower()

        # Ignore local development, test runners, private IPs, and health checks
        if (
            host in {"localhost", "127.0.0.1", "testserver"}
            or host.endswith(".local")
            or host.startswith("192.168.")
            or host.startswith("10.")
            or host.startswith("172.")
            or request.url.path in {"/", "/health", "/health/full", "/health/ready", "/health/live", "/metrics"}
        ):
            return await call_next(request)

        # Enforce canonical www only on apex domain optileno.com (never api.optileno.com)
        if host == "optileno.com":
            path = request.url.path
            query = f"?{request.url.query}" if request.url.query else ""
            target_url = f"https://www.optileno.com{path}{query}"
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=target_url, status_code=301)

        return await call_next(request)


# ==================================================
# Logging Middleware with Metrics
# ==================================================
class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Request/response logging middleware with performance metrics.
    """

    # Paths to exclude from verbose logging
    QUIET_PATHS = {"/health", "/metrics", "/favicon.ico", "/docs", "/redoc", "/openapi.json"}
    QUIET_PREFIXES = ("/api/v1/health", "/api/v1/system/", "/socket.io")

    @classmethod
    def _is_quiet_path(cls, path: str) -> bool:
        if path in cls.QUIET_PATHS:
            return True
        return any(path.startswith(prefix) for prefix in cls.QUIET_PREFIXES)

    def _should_log_request_start(self, request: Request) -> bool:
        if request.method == "OPTIONS":
            return False
        if self._is_quiet_path(request.url.path):
            return False
        # In production, reduce log volume by default.
        if settings.ENVIRONMENT == "production" and not settings.DEBUG:
            return False
        return True

    def _should_log_response(self, request: Request, status_code: int, process_time_ms: float) -> bool:
        if request.method == "OPTIONS":
            return False
        if self._is_quiet_path(request.url.path):
            return False

        if settings.ENVIRONMENT == "production" and not settings.DEBUG:
            # Keep production logs focused on actionable issues only.
            return status_code >= 500 or process_time_ms > settings.PERF_RESPONSE_TIME_THRESHOLD_MS
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        request_id = f"{int(start_time * 1000)}-{id(request)}"
        
        # Add request ID to state
        request.state.request_id = request_id

        # Log request (skip quiet paths)
        if self._should_log_request_start(request):
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} | "
                f"Client: {request.client.host if request.client else 'unknown'}"
            )

        try:
            response = await call_next(request)
        except Exception as e:
            if settings.DEBUG:
                logger.error(f"[{request_id}] Error handling request: {e}", exc_info=True)
            else:
                logger.error(f"[{request_id}] Error handling request: {e}")
            raise

        # Calculate response time
        process_time = time.time() - start_time
        process_time_ms = process_time * 1000
        
        # Record metrics
        middleware_metrics.record_request(process_time_ms, response.status_code)

        # Log response (skip quiet paths)
        if self._should_log_response(request, response.status_code, process_time_ms):
            if response.status_code >= 500:
                log_level = logging.ERROR
            elif process_time_ms > settings.PERF_RESPONSE_TIME_THRESHOLD_MS:
                log_level = logging.WARNING
            else:
                log_level = logging.INFO
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
    APP_STATE_CHANGING_PREFIXES = ("/api/", "/auth")

    SKIP_CSRF_PATHS = {
        "/health",
        "/health/ready",
        "/health/live",
        "/health/full",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/health",
        "/api/v1/health/ready",
        "/api/v1/health/live",
        "/api/v1/health/detailed",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/google",
        "/api/v1/auth/access/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/validate",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/growth/events",
        "/api/v1/growth/leads",
        "/api/v1/tools/task-prioritizer",
        "/api/v1/tools/weekly-planner",
        "/api/v1/tools/schedule-generator",
        "/api/v1/tools/burnout-calculator",
        "/api/v1/webhooks/webhook",
        "/api/v1/webhooks/stripe",
        "/api/v1/payments/webhook",
        "/api/v1/payments/complete-return",
        "/auth/login",
        "/auth/register",
        "/auth/google",
        "/auth/access/register",
        "/auth/refresh",
        "/auth/validate",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/metrics",
    }

    @classmethod
    def _log_csrf_failure(cls, request: Request, reason: str) -> None:
        message = f"CSRF token {reason} for {request.method} {request.url.path}"
        if (
            settings.ENVIRONMENT == "production"
            and not request.url.path.startswith(cls.APP_STATE_CHANGING_PREFIXES)
        ):
            logger.debug(message)
            return

        logger.warning(message)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate CSRF token for state-changing requests."""

        # Skip for safe paths
        if request.url.path in self.SKIP_CSRF_PATHS:
            return await call_next(request)
        
        # Skip realtime transports; normal API routes use csrf_token cookies.
        if any(request.url.path.startswith(p) for p in ["/socket.io", "/ws"]):
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
            self._log_csrf_failure(request, "missing")
            return Response(
                content='{"error": "CSRF token required"}',
                status_code=403,
                media_type="application/json"
            )

        if not hmac.compare_digest(csrf_cookie, csrf_header):
            middleware_metrics.csrf_failures += 1
            middleware_metrics.blocked_requests += 1
            self._log_csrf_failure(request, "mismatch")
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
