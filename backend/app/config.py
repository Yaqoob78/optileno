import os
import urllib.parse
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv
# backend/app/config.py

# ==================================================
# Force backend to load ONLY backend/.env
# ==================================================
BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / "backend" / ".env"
load_dotenv(ENV_PATH)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "y", "on")


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value.strip())
    except ValueError:
        return default


def _env_list(name: str) -> List[str]:
    value = os.getenv(name)
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _strip_wrapping_quotes(value: str) -> str:
    """
    Remove one layer of wrapping single/double quotes.
    Railway variables should be stored without quotes, but users often add them.
    """
    cleaned = (value or "").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        return cleaned[1:-1].strip()
    return cleaned


def _is_unresolved_template(value: str) -> bool:
    """
    Detect unresolved template-like env values such as ${VAR} or ${{Service.VAR}}.
    """
    v = (value or "").strip()
    return (v.startswith("${") and v.endswith("}")) or (v.startswith("$") and "{" in v and "}" in v)


# ... (imports)

def _normalize_database_url(url: str) -> str:
    """
    Normalize DB URLs for async SQLAlchemy usage.
    Railway/Postgres URLs are often provided as postgres:// or postgresql://.
    """
    normalized = _strip_wrapping_quotes(url or "")
    if not normalized:
        return ""  # let validation catch empty string
    
    if _is_unresolved_template(normalized):
        return normalized

    # Force asyncpg driver for general app usage
    if normalized.startswith("postgres://"):
        return "postgresql+asyncpg://" + normalized[len("postgres://"):]
    if normalized.startswith("postgresql://"):
        return "postgresql+asyncpg://" + normalized[len("postgresql://"):]

    if normalized.startswith("postgresql+psycopg2://"):
        return "postgresql+asyncpg://" + normalized[len("postgresql+psycopg2://"):]

    return normalized


def _build_database_url_from_pg_env() -> str:
    """
    Build async DATABASE_URL from Railway-style PG* variables if present.
    """
    host = (os.getenv("PGHOST") or "").strip()
    user = (os.getenv("PGUSER") or "").strip()
    password = os.getenv("PGPASSWORD") or ""
    database = (os.getenv("PGDATABASE") or "").strip()
    port = (os.getenv("PGPORT") or "5432").strip()

    if not (host and user and database):
        return ""

    encoded_user = urllib.parse.quote(user, safe="")
    encoded_password = urllib.parse.quote(password, safe="")
    return f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{host}:{port}/{database}"


def _pick_database_url_candidate() -> str:
    """
    Pick the first available DB URL from common environment variable names.
    """
    return (
        (os.getenv("DATABASE_URL") or "").strip()
        or (os.getenv("DATABASE_PRIVATE_URL") or "").strip()
        or (os.getenv("DATABASE_PUBLIC_URL") or "").strip()
        or (os.getenv("POSTGRES_URL") or "").strip()
        or (os.getenv("POSTGRESQL_URL") or "").strip()
    )



class Settings:
    """Clean, deterministic settings (no silent overrides)."""

    # =========================
    # Application
    # =========================
    APP_NAME: str = "Optileno"
    VERSION: str = "2.0.0"  # SaaS Professional Edition
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # =========================
    # Server
    # =========================
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = _env_int("PORT", 8000)
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    
    # =========================
    # Scaling Configuration (5,000 Users)
    # =========================
    MAX_CONCURRENT_USERS: int = _env_int("MAX_CONCURRENT_USERS", 5000)
    WORKERS_PER_CORE: int = _env_int("WORKERS_PER_CORE", 2)
    MAX_WORKERS: int = _env_int("MAX_WORKERS", 8)

    # =========================
    # Security
    # =========================
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    
    # Session Management
    MAX_CONCURRENT_SESSIONS: int = _env_int("MAX_CONCURRENT_SESSIONS", 5)
    SESSION_TIMEOUT_MINUTES: int = _env_int("SESSION_TIMEOUT_MINUTES", 60)
    
    # Account Security
    MAX_LOGIN_ATTEMPTS: int = _env_int("MAX_LOGIN_ATTEMPTS", 5)
    LOCKOUT_DURATION_MINUTES: int = _env_int("LOCKOUT_DURATION_MINUTES", 15)
    PASSWORD_MIN_LENGTH: int = _env_int("PASSWORD_MIN_LENGTH", 8)
    
    # MFA Configuration
    MFA_ENABLED: bool = _env_bool("MFA_ENABLED", True)
    MFA_ISSUER: str = os.getenv("MFA_ISSUER", "Optileno")
    
    # OAuth Providers (configurable)
    OAUTH_GOOGLE_CLIENT_ID: Optional[str] = os.getenv("OAUTH_GOOGLE_CLIENT_ID")
    OAUTH_GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("OAUTH_GOOGLE_CLIENT_SECRET")
    OAUTH_MICROSOFT_CLIENT_ID: Optional[str] = os.getenv("OAUTH_MICROSOFT_CLIENT_ID")
    OAUTH_MICROSOFT_CLIENT_SECRET: Optional[str] = os.getenv("OAUTH_MICROSOFT_CLIENT_SECRET")
    OAUTH_APPLE_CLIENT_ID: Optional[str] = os.getenv("OAUTH_APPLE_CLIENT_ID")
    OAUTH_APPLE_KEY_ID: Optional[str] = os.getenv("OAUTH_APPLE_KEY_ID")

    # Cookie/SameSite behavior
    COOKIE_SECURE: bool = _env_bool(
        "COOKIE_SECURE",
        os.getenv("ENVIRONMENT", "development") == "production"
    )
    COOKIE_SAMESITE: str = os.getenv(
        "COOKIE_SAMESITE",
        "none" if COOKIE_SECURE else "lax"
    )
    COOKIE_DOMAIN: Optional[str] = os.getenv("COOKIE_DOMAIN") or None

    # Owner Account (Auto-provisioned)
    OWNER_EMAIL: str = os.getenv("OWNER_EMAIL", "")
    OWNER_PASSWORD_HASH: str = os.getenv("OWNER_PASSWORD_HASH", "")

    # =========================
    # CORS
    # =========================
    # When using credentials, cannot use wildcard - must specify origins
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    PRODUCTION_FRONTEND_URL: str = os.getenv("PRODUCTION_FRONTEND_URL", "")
    _cors_env = _env_list("CORS_ORIGINS")
    CORS_ORIGINS: List[str] = _cors_env or [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    
    # Add production URLs
    if PRODUCTION_FRONTEND_URL and PRODUCTION_FRONTEND_URL not in CORS_ORIGINS:
        CORS_ORIGINS.append(PRODUCTION_FRONTEND_URL)
        
    if FRONTEND_URL and FRONTEND_URL not in CORS_ORIGINS:
        CORS_ORIGINS.append(FRONTEND_URL)

    # =========================
    # Database - Enterprise Scaling
    # =========================
    DATABASE_URL: str = _normalize_database_url(
        _pick_database_url_candidate()
        or _build_database_url_from_pg_env()
        or ""
    )
    
    # Connection Pool Settings (tuned for 8 workers w/ 300 max_conn)
    DB_POOL_SIZE: int = _env_int("DB_POOL_SIZE", 20)
    DB_MAX_OVERFLOW: int = _env_int("DB_MAX_OVERFLOW", 10)
    DB_POOL_TIMEOUT: int = _env_int("DB_POOL_TIMEOUT", 30)
    DB_POOL_RECYCLE: int = _env_int("DB_POOL_RECYCLE", 300)
    DB_STATEMENT_TIMEOUT: int = _env_int("DB_STATEMENT_TIMEOUT", 30000)  # 30 seconds
    DB_SLOW_QUERY_THRESHOLD_MS: int = _env_int("DB_SLOW_QUERY_THRESHOLD_MS", 50)

    # =========================
    # AI CONFIG (NO DEFAULTS)
    # =========================
    AI_PROVIDER: str | None = os.getenv("AI_PROVIDER")
    AI_MODEL: str | None = os.getenv("AI_MODEL")

    # =========================
    # GROQ (Chat - Secondary)
    # =========================
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # =========================
    MAX_HISTORY_TOKENS: int = _env_int("MAX_HISTORY_TOKENS", 4000)
    
    # NVIDIA NIM Configuration (Multi-Model)
    # Defaulting to Llama 3.3 70B (State of the art, fast)
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_API_KEY: Optional[str] = os.getenv("NVIDIA_API_KEY")
    
    # The "Brain" - Reasoning & Chat
    NVIDIA_BRAIN_MODEL: str = os.getenv("NVIDIA_BRAIN_MODEL", "meta/llama-3.3-70b-instruct")
    
    # The "Agent" - Tools & JSON
    NVIDIA_AGENT_MODEL: str = os.getenv("NVIDIA_AGENT_MODEL", "meta/llama-3.3-70b-instruct")

    # Groq Configuration (Backup)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    # GEMINI (Legacy/Optional)
    # =========================
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

    # =========================
    # OpenAI (optional backup)
    # =========================
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    # =========================
    # Limits & Quotas (Configurable)
    # =========================
    # Free Plan
    LIMIT_FREE_NVIDIA: int = _env_int("LIMIT_FREE_NVIDIA", 100)
    LIMIT_FREE_GROQ: int = _env_int("LIMIT_FREE_GROQ", 50)
    
    # Basic Plan
    LIMIT_BASIC_NVIDIA: int = _env_int("LIMIT_BASIC_NVIDIA", 2000)
    LIMIT_BASIC_GROQ: int = _env_int("LIMIT_BASIC_GROQ", 500)

    # Pro Plan
    LIMIT_PRO_NVIDIA: int = _env_int("LIMIT_PRO_NVIDIA", 5000)
    LIMIT_PRO_GROQ: int = _env_int("LIMIT_PRO_GROQ", 1000)
    
    # Enterprise Plan
    LIMIT_ENTERPRISE_NVIDIA: int = _env_int("LIMIT_ENTERPRISE_NVIDIA", 50000)
    LIMIT_ENTERPRISE_GROQ: int = _env_int("LIMIT_ENTERPRISE_GROQ", 10000)

    # =========================
    # Rate Limiting (Configurable)
    # =========================
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = _env_int("RATE_LIMIT_REQUESTS_PER_MINUTE", 600)
    RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE: int = _env_int("RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE", 3000)
    RATE_LIMIT_BURST_ALLOWANCE: int = _env_int("RATE_LIMIT_BURST_ALLOWANCE", 100)
    RATE_LIMIT_WINDOW_SECONDS: int = _env_int("RATE_LIMIT_WINDOW_SECONDS", 60)

    # =========================
    # Features
    # =========================
    ENABLE_DOCS: bool = _env_bool("ENABLE_DOCS", ENVIRONMENT == "development")

    # =========================
    # Redis Cache - Enterprise HA
    # =========================
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    # Redis Pool Settings (for 5,000 users)
    REDIS_MAX_CONNECTIONS: int = _env_int("REDIS_MAX_CONNECTIONS", 100)
    REDIS_SOCKET_TIMEOUT: int = _env_int("REDIS_SOCKET_TIMEOUT", 5)
    REDIS_SOCKET_CONNECT_TIMEOUT: int = _env_int("REDIS_SOCKET_CONNECT_TIMEOUT", 5)
    REDIS_HEALTH_CHECK_INTERVAL: int = _env_int("REDIS_HEALTH_CHECK_INTERVAL", 30)
    REDIS_RETRY_ON_TIMEOUT: bool = _env_bool("REDIS_RETRY_ON_TIMEOUT", True)
    
    # Redis Sentinel (for HA)
    REDIS_SENTINEL_ENABLED: bool = _env_bool("REDIS_SENTINEL_ENABLED", False)
    REDIS_SENTINEL_HOSTS: str = os.getenv("REDIS_SENTINEL_HOSTS", "")
    REDIS_SENTINEL_MASTER: str = os.getenv("REDIS_SENTINEL_MASTER", "mymaster")
    
    # Cache TTL Settings (seconds)
    CACHE_TTL_USER_ANALYTICS: int = _env_int("CACHE_TTL_USER_ANALYTICS", 300)
    CACHE_TTL_GOAL_PROGRESS: int = _env_int("CACHE_TTL_GOAL_PROGRESS", 600)
    CACHE_TTL_USER_TASKS: int = _env_int("CACHE_TTL_USER_TASKS", 180)
    CACHE_TTL_AI_CONTEXT: int = _env_int("CACHE_TTL_AI_CONTEXT", 900)
    CACHE_TTL_SESSION: int = _env_int("CACHE_TTL_SESSION", 1800)

    # =========================
    # WebSocket Configuration
    # =========================
    WEBSOCKET_PING_INTERVAL: int = _env_int("WEBSOCKET_PING_INTERVAL", 25)
    WEBSOCKET_PING_TIMEOUT: int = _env_int("WEBSOCKET_PING_TIMEOUT", 60)
    WEBSOCKET_MAX_CONNECTIONS: int = _env_int("WEBSOCKET_MAX_CONNECTIONS", 10000)
    WEBSOCKET_MESSAGE_QUEUE_SIZE: int = _env_int("WEBSOCKET_MESSAGE_QUEUE_SIZE", 1000)
    WEBSOCKET_RECONNECT_DELAY_MIN: int = _env_int("WEBSOCKET_RECONNECT_DELAY_MIN", 1000)
    WEBSOCKET_RECONNECT_DELAY_MAX: int = _env_int("WEBSOCKET_RECONNECT_DELAY_MAX", 30000)

    # =========================
    # Payments (Stripe)
    # =========================
    STRIPE_API_KEY: str = os.getenv("STRIPE_API_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRO_PRICE_ID: str = os.getenv("STRIPE_PRO_PRICE_ID", "")

    # =========================
    # Payments (Razorpay) - Subscription Plans
    # =========================
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    
    # Subscription Plan IDs
    RAZORPAY_EXPLORER_PLAN_ID: str = os.getenv("RAZORPAY_EXPLORER_PLAN_ID", "")
    RAZORPAY_ULTRA_PLAN_ID: str = os.getenv("RAZORPAY_ULTRA_PLAN_ID", "")
    
    # Plan Configuration
    # Explorer: 7 days free trial, then paid
    # Ultra: No free trial, premium features, YEARLY ONLY
    EXPLORER_TRIAL_DAYS: int = _env_int("EXPLORER_TRIAL_DAYS", 7)
    ULTRA_TRIAL_DAYS: int = _env_int("ULTRA_TRIAL_DAYS", 0)  # No free trial
    
    # Plan Pricing (in USD cents, 100 = $1)
    # Explorer: $2.00/month
    # Ultra: $10.00/month or $80.00/year (Discounted)
    
    EXPLORER_MONTHLY_PRICE: int = _env_int("EXPLORER_MONTHLY_PRICE", 200)   # $2.00
    EXPLORER_ANNUAL_PRICE: int = _env_int("EXPLORER_ANNUAL_PRICE", 2000)    # $20.00 (Optional, can be removed)
    
    ULTRA_MONTHLY_PRICE: int = _env_int("ULTRA_MONTHLY_PRICE", 1000)        # $10.00
    ULTRA_ANNUAL_PRICE: int = _env_int("ULTRA_ANNUAL_PRICE", 8000)          # $80.00 (Yearly Offer)
    
    # Grace Period for Failed Payments
    PAYMENT_GRACE_PERIOD_DAYS: int = _env_int("PAYMENT_GRACE_PERIOD_DAYS", 7)
    PAYMENT_RETRY_ATTEMPTS: int = _env_int("PAYMENT_RETRY_ATTEMPTS", 3)

    # =========================
    # Agentic (Private OpenClaw)
    # =========================
    AGENT_ENABLED: bool = _env_bool("AGENT_ENABLED", False)
    AGENT_ENDPOINT: str = os.getenv("AGENT_ENDPOINT", "")
    AGENT_SHARED_SECRET: str = os.getenv("AGENT_SHARED_SECRET", "")
    AGENT_TIMEOUT_SECONDS: int = _env_int("AGENT_TIMEOUT_SECONDS", 15)

    # =========================
    # Monitoring & Alerting
    # =========================
    MONITORING_ENABLED: bool = _env_bool("MONITORING_ENABLED", True)
    METRICS_EXPORT_ENABLED: bool = _env_bool("METRICS_EXPORT_ENABLED", True)
    
    # Performance Thresholds
    PERF_RESPONSE_TIME_THRESHOLD_MS: int = _env_int("PERF_RESPONSE_TIME_THRESHOLD_MS", 200)
    PERF_ERROR_RATE_THRESHOLD: float = _env_float("PERF_ERROR_RATE_THRESHOLD", 0.1)
    PERF_MIN_UPTIME_PERCENT: float = _env_float("PERF_MIN_UPTIME_PERCENT", 99.9)
    
    # Alert Webhooks
    ALERT_WEBHOOK_URL: Optional[str] = os.getenv("ALERT_WEBHOOK_URL")
    ALERT_EMAIL: Optional[str] = os.getenv("ALERT_EMAIL")
    
    # =========================
    # Compliance & Audit
    # =========================
    AUDIT_LOG_ENABLED: bool = _env_bool("AUDIT_LOG_ENABLED", True)
    AUDIT_LOG_RETENTION_DAYS: int = _env_int("AUDIT_LOG_RETENTION_DAYS", 90)
    GDPR_MODE_ENABLED: bool = _env_bool("GDPR_MODE_ENABLED", True)
    DATA_RETENTION_DAYS: int = _env_int("DATA_RETENTION_DAYS", 365)

    # =========================
    # Background Jobs
    # =========================
    BACKGROUND_JOBS_ENABLED: bool = _env_bool("BACKGROUND_JOBS_ENABLED", True)
    JOB_RETRY_MAX_ATTEMPTS: int = _env_int("JOB_RETRY_MAX_ATTEMPTS", 3)
    JOB_RETRY_DELAY_SECONDS: int = _env_int("JOB_RETRY_DELAY_SECONDS", 60)
    JOB_TIMEOUT_SECONDS: int = _env_int("JOB_TIMEOUT_SECONDS", 300)

    def __init__(self):
        self._validate()

    def _validate(self) -> None:
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL must be set")

        if _is_unresolved_template(self.DATABASE_URL):
            raise ValueError(
                "DATABASE_URL appears unresolved (e.g. ${VAR} or ${{Service.VAR}}). "
                "Set DATABASE_URL to the actual connection string in Railway."
            )

        # Fail early with a clear message if SQLAlchemy cannot parse the URL.
        from sqlalchemy.engine import make_url
        try:
            make_url(self.DATABASE_URL)
        except Exception as e:
            raise ValueError(f"Invalid DATABASE_URL format: {e}") from e

        if self.ENVIRONMENT == "production":
            if not self.NVIDIA_API_KEY and not self.GROQ_API_KEY:
                raise ValueError("At least one AI API KEY (NVIDIA/GROQ) must be set in production")
            if not self.SECRET_KEY or self.SECRET_KEY == "dev-secret-key":
                raise ValueError("SECRET_KEY must be set to a secure value in production")

        if self.COOKIE_SAMESITE.lower() == "none" and not self.COOKIE_SECURE:
            raise ValueError("COOKIE_SAMESITE=None requires COOKIE_SECURE=true")
    
    def get_plan_limits(self, plan: str) -> dict:
        """Get AI limits for a subscription plan."""
        plans = {
            "free": {"nvidia": self.LIMIT_FREE_NVIDIA, "groq": self.LIMIT_FREE_GROQ},
            "basic": {"nvidia": self.LIMIT_BASIC_NVIDIA, "groq": self.LIMIT_BASIC_GROQ},
            "pro": {"nvidia": self.LIMIT_PRO_NVIDIA, "groq": self.LIMIT_PRO_GROQ},
            "enterprise": {"nvidia": self.LIMIT_ENTERPRISE_NVIDIA, "groq": self.LIMIT_ENTERPRISE_GROQ},
        }
        return plans.get(plan.lower(), plans["free"])


settings = Settings()


# ==================================================
# SAFE STARTUP LOGGING (NO SIDE EFFECTS)
# ==================================================
def log_startup_settings():
    print(f"[ROCKET] Optileno SaaS v{settings.VERSION}")
    print(f"[SCALE] Max Concurrent Users: {settings.MAX_CONCURRENT_USERS}")
    print(f"[DB] Pool Size: {settings.DB_POOL_SIZE}, Max Overflow: {settings.DB_MAX_OVERFLOW}")
    print(f"[CACHE] Redis Max Connections: {settings.REDIS_MAX_CONNECTIONS}")
    print(f"[WS] Max WebSocket Connections: {settings.WEBSOCKET_MAX_CONNECTIONS}")
    print(f"[ROCKET] AI Provider: {settings.AI_PROVIDER if settings.AI_PROVIDER else 'Not configured'}")
    print(f"[BRAIN] AI Model: {settings.AI_MODEL if settings.AI_MODEL else 'Not configured'}")

    if settings.AI_PROVIDER == "groq":
        print(
            f"[KEY] GROQ Key Loaded: {'YES' if settings.GROQ_API_KEY else 'NO'}"
        )

