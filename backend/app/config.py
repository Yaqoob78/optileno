import os
import re
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
    # Accept comma/newline/semicolon-delimited lists and strip accidental wrapping quotes.
    cleaned_value = _strip_wrapping_quotes(value.strip())
    if not cleaned_value:
        return []

    items: List[str] = []
    for raw in re.split(r"[,\n;]", cleaned_value):
        cleaned = _strip_wrapping_quotes(raw.strip())
        if cleaned:
            items.append(cleaned)

    # Stable de-duplication.
    deduped: List[str] = []
    seen = set()
    for item in items:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


def _strip_wrapping_quotes(value: str) -> str:
    """
    Remove one layer of wrapping single/double quotes.
    Railway variables should be stored without quotes, but users often add them.
    """
    cleaned = (value or "").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        return cleaned[1:-1].strip()
    return cleaned


def _normalize_origin(origin: str) -> str:
    """
    Normalize an origin for strict CORS matching:
    - trim whitespace/quotes
    - lowercase scheme + host
    - drop path/query/fragment
    - strip trailing slash for non-standard inputs
    """
    cleaned = _strip_wrapping_quotes((origin or "").strip())
    if not cleaned:
        return ""

    parsed = urllib.parse.urlsplit(cleaned)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"

    return cleaned.rstrip("/")


def _append_unique_origin(origins: List[str], origin: str) -> None:
    normalized = _normalize_origin(origin)
    if normalized and normalized not in origins:
        origins.append(normalized)


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


def _build_redis_url_from_env() -> str:
    """
    Build REDIS_URL from REDIS_* variables when REDIS_URL is not explicitly set.
    """
    explicit_url = _strip_wrapping_quotes(os.getenv("REDIS_URL", ""))
    if explicit_url:
        return explicit_url

    host = _strip_wrapping_quotes(os.getenv("REDIS_HOST", "localhost")) or "localhost"
    port = (os.getenv("REDIS_PORT", "6379") or "6379").strip()
    db = (os.getenv("REDIS_DB", "0") or "0").strip()
    password = os.getenv("REDIS_PASSWORD", "")

    if password:
        encoded_password = urllib.parse.quote(password, safe="")
        return f"redis://:{encoded_password}@{host}:{port}/{db}"

    return f"redis://{host}:{port}/{db}"



class Settings:
    """Clean, deterministic settings (no silent overrides)."""

    # =========================
    # Application
    # =========================
    APP_NAME: str = "Optileno"
    VERSION: str = "2.0.0"  # SaaS Professional Edition
    ENVIRONMENT: str = _strip_wrapping_quotes(os.getenv("ENVIRONMENT", "development")).strip().lower() or "development"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # =========================
    # Server
    # =========================
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = _env_int("PORT", 8000)
    BASE_URL: str = _strip_wrapping_quotes(os.getenv("BASE_URL", "http://localhost:8000"))
    
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
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = _env_int("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", 30)
    EXPOSE_DEBUG_AUTH_TOKENS: bool = _env_bool("EXPOSE_DEBUG_AUTH_TOKENS", False)
    
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
        ENVIRONMENT == "production"
    )
    COOKIE_SAMESITE: str = os.getenv(
        "COOKIE_SAMESITE",
        "none" if COOKIE_SECURE else "lax"
    )
    COOKIE_SAMESITE: str = _strip_wrapping_quotes(COOKIE_SAMESITE)
    COOKIE_DOMAIN: Optional[str] = _strip_wrapping_quotes(os.getenv("COOKIE_DOMAIN", "")) or None

    # Owner Account (Auto-provisioned)
    OWNER_EMAIL: str = _strip_wrapping_quotes(os.getenv("OWNER_EMAIL", ""))
    OWNER_PASSWORD_HASH: str = _strip_wrapping_quotes(os.getenv("OWNER_PASSWORD_HASH", ""))

    # =========================
    # CORS
    # =========================
    # When using credentials, cannot use wildcard - must specify origins
    FRONTEND_URL: str = _normalize_origin(os.getenv("FRONTEND_URL", "http://localhost:3000"))
    PRODUCTION_FRONTEND_URL: str = _normalize_origin(os.getenv("PRODUCTION_FRONTEND_URL", ""))
    APP_URL: str = _normalize_origin(os.getenv("APP_URL", ""))
    if not APP_URL:
        APP_URL = PRODUCTION_FRONTEND_URL or FRONTEND_URL or _normalize_origin(BASE_URL)
    _cors_env = _env_list("CORS_ORIGINS")
    _cors_seed = _cors_env or [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    CORS_ORIGINS: List[str] = []
    for origin in _cors_seed:
        _append_unique_origin(CORS_ORIGINS, origin)

    # Add configured frontend URLs.
    for configured_origin in (PRODUCTION_FRONTEND_URL, FRONTEND_URL, APP_URL):
        _append_unique_origin(CORS_ORIGINS, configured_origin)

    # Always allow canonical first-party web origins.
    for canonical_origin in ("https://optileno.com", "https://www.optileno.com"):
        _append_unique_origin(CORS_ORIGINS, canonical_origin)

    CORS_ALLOW_ORIGIN_REGEX: Optional[str] = _strip_wrapping_quotes(
        os.getenv("CORS_ALLOW_ORIGIN_REGEX", "")
    ) or None
    if not CORS_ALLOW_ORIGIN_REGEX:
        if ".vercel.app" in FRONTEND_URL.lower() or ".vercel.app" in PRODUCTION_FRONTEND_URL.lower():
            CORS_ALLOW_ORIGIN_REGEX = r"^https://([a-z0-9-]+\.)*vercel\.app$"

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
    AUTH_RATE_LIMIT_ENABLED: bool = _env_bool("AUTH_RATE_LIMIT_ENABLED", True)
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = _env_int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)
    AUTH_RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS: int = _env_int("AUTH_RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS", 10)
    AUTH_RATE_LIMIT_LOGIN_IDENTIFIER_MAX_ATTEMPTS: int = _env_int(
        "AUTH_RATE_LIMIT_LOGIN_IDENTIFIER_MAX_ATTEMPTS",
        10,
    )
    AUTH_RATE_LIMIT_REGISTER_IP_MAX_ATTEMPTS: int = _env_int("AUTH_RATE_LIMIT_REGISTER_IP_MAX_ATTEMPTS", 5)
    AUTH_RATE_LIMIT_REGISTER_IDENTIFIER_MAX_ATTEMPTS: int = _env_int(
        "AUTH_RATE_LIMIT_REGISTER_IDENTIFIER_MAX_ATTEMPTS",
        5,
    )

    # =========================
    # Features
    # =========================
    ENABLE_DOCS: bool = _env_bool("ENABLE_DOCS", ENVIRONMENT == "development")
    ANALYTICS_V2_ENABLED: bool = _env_bool("ANALYTICS_V2_ENABLED", True)
    GOAL_PROGRESS_V3_ENABLED: bool = _env_bool("GOAL_PROGRESS_V3_ENABLED", True)

    # =========================
    # Redis Cache - Enterprise HA
    # =========================
    REDIS_URL: str = _build_redis_url_from_env()
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
    WEBSOCKET_QUEUE_BATCH_SIZE: int = _env_int("WEBSOCKET_QUEUE_BATCH_SIZE", 200)
    WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS: int = _env_int("WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS", 25)
    WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS: int = _env_int("WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS", 1000)
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
    # Explorer: 3 days free trial, then paid
    # Ultra: No free trial, premium features, YEARLY ONLY
    EXPLORER_TRIAL_DAYS: int = _env_int("EXPLORER_TRIAL_DAYS", 3)
    ULTRA_TRIAL_DAYS: int = _env_int("ULTRA_TRIAL_DAYS", 0)  # No free trial
    
    # Plan Pricing (in USD cents, 100 = $1)
    # Explorer: $2.00/month
    # Ultra: $10.00/month or $80.00/year (Discounted)
    
    EXPLORER_MONTHLY_PRICE: int = _env_int("EXPLORER_MONTHLY_PRICE", 200)   # $2.00
    EXPLORER_ANNUAL_PRICE: int = _env_int("EXPLORER_ANNUAL_PRICE", 2000)    # $20.00
    
    ULTRA_MONTHLY_PRICE: int = _env_int("ULTRA_MONTHLY_PRICE", 1000)        # $10.00
    ULTRA_ANNUAL_PRICE: int = _env_int("ULTRA_ANNUAL_PRICE", 8000)          # $80.00
    
    # Grace Period for Failed Payments
    PAYMENT_GRACE_PERIOD_DAYS: int = _env_int("PAYMENT_GRACE_PERIOD_DAYS", 7)
    PAYMENT_RETRY_ATTEMPTS: int = _env_int("PAYMENT_RETRY_ATTEMPTS", 3)

    # =========================
    # Payments (Cashfree) - Primary PG
    # =========================
    CASHFREE_APP_ID: str = os.getenv("CASHFREE_APP_ID", "")
    CASHFREE_SECRET_KEY: str = os.getenv("CASHFREE_SECRET_KEY", "")
    CASHFREE_WEBHOOK_SECRET: str = os.getenv("CASHFREE_WEBHOOK_SECRET", "")
    CASHFREE_CURRENCY: str = _strip_wrapping_quotes(os.getenv("CASHFREE_CURRENCY", "USD")).upper()
    CASHFREE_FALLBACK_CURRENCY: str = _strip_wrapping_quotes(os.getenv("CASHFREE_FALLBACK_CURRENCY", "")).upper()
    CASHFREE_FX_CACHE_MINUTES: int = _env_int("CASHFREE_FX_CACHE_MINUTES", 60)
    CASHFREE_USD_INR_FALLBACK_RATE: float = _env_float("CASHFREE_USD_INR_FALLBACK_RATE", 90.0)

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
            if not self.COOKIE_SECURE:
                raise ValueError("COOKIE_SECURE must be true in production")

        same_site = self.COOKIE_SAMESITE.lower()
        if same_site not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be one of: lax, strict, none")

        if same_site == "none" and not self.COOKIE_SECURE:
            raise ValueError("COOKIE_SAMESITE=None requires COOKIE_SECURE=true")

        if self.ACCESS_TOKEN_EXPIRE_MINUTES < 5 or self.ACCESS_TOKEN_EXPIRE_MINUTES > 1440:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be between 5 and 1440")

        if self.REFRESH_TOKEN_EXPIRE_DAYS < 1 or self.REFRESH_TOKEN_EXPIRE_DAYS > 90:
            raise ValueError("REFRESH_TOKEN_EXPIRE_DAYS must be between 1 and 90")

        if self.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES < 5 or self.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES > 120:
            raise ValueError("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES must be between 5 and 120")

        if self.AUTH_RATE_LIMIT_WINDOW_SECONDS < 1:
            raise ValueError("AUTH_RATE_LIMIT_WINDOW_SECONDS must be >= 1")

        for auth_limit_value, auth_limit_name in (
            (self.AUTH_RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS, "AUTH_RATE_LIMIT_LOGIN_IP_MAX_ATTEMPTS"),
            (self.AUTH_RATE_LIMIT_LOGIN_IDENTIFIER_MAX_ATTEMPTS, "AUTH_RATE_LIMIT_LOGIN_IDENTIFIER_MAX_ATTEMPTS"),
            (self.AUTH_RATE_LIMIT_REGISTER_IP_MAX_ATTEMPTS, "AUTH_RATE_LIMIT_REGISTER_IP_MAX_ATTEMPTS"),
            (
                self.AUTH_RATE_LIMIT_REGISTER_IDENTIFIER_MAX_ATTEMPTS,
                "AUTH_RATE_LIMIT_REGISTER_IDENTIFIER_MAX_ATTEMPTS",
            ),
        ):
            if auth_limit_value < 1:
                raise ValueError(f"{auth_limit_name} must be >= 1")

        wildcard_origins = {"*", "http://*", "https://*"}
        if any((origin or "").strip() in wildcard_origins for origin in self.CORS_ORIGINS):
            raise ValueError("CORS_ORIGINS cannot contain wildcard entries when credentials are enabled")

        if self.CORS_ALLOW_ORIGIN_REGEX:
            try:
                re.compile(self.CORS_ALLOW_ORIGIN_REGEX)
            except re.error as exc:
                raise ValueError(f"Invalid CORS_ALLOW_ORIGIN_REGEX: {exc}") from exc

            normalized_regex = self.CORS_ALLOW_ORIGIN_REGEX.strip().lower()
            disallowed_regexes = {
                ".*",
                "^.*$",
                "^https?://.*$",
                "^https://.*$",
                "^http://.*$",
            }
            if normalized_regex in disallowed_regexes:
                raise ValueError(
                    "CORS_ALLOW_ORIGIN_REGEX is too broad for credentialed requests. "
                    "Use explicit origins or a constrained regex."
                )
    
    def get_plan_limits(self, plan: str) -> dict:
        """Get AI limits for a subscription plan."""
        plans = {
            "explorer": {"nvidia": self.LIMIT_BASIC_NVIDIA, "groq": self.LIMIT_BASIC_GROQ},
            "ultra": {"nvidia": self.LIMIT_PRO_NVIDIA, "groq": self.LIMIT_PRO_GROQ},
            # Legacy compatibility for one migration window
            "free": {"nvidia": self.LIMIT_FREE_NVIDIA, "groq": self.LIMIT_FREE_GROQ},
            "basic": {"nvidia": self.LIMIT_BASIC_NVIDIA, "groq": self.LIMIT_BASIC_GROQ},
            "pro": {"nvidia": self.LIMIT_PRO_NVIDIA, "groq": self.LIMIT_PRO_GROQ},
            "enterprise": {"nvidia": self.LIMIT_ENTERPRISE_NVIDIA, "groq": self.LIMIT_ENTERPRISE_GROQ},
        }
        normalized = (plan or "").strip().lower()
        if normalized in {"premium", "elite"}:
            normalized = "ultra"
        if normalized in {"trial"}:
            normalized = "explorer"
        return plans.get(normalized, plans["explorer"])


settings = Settings()


# ==================================================
# SAFE STARTUP LOGGING (NO SIDE EFFECTS)
# ==================================================
def log_startup_settings():
    print(f"[ROCKET] Optileno SaaS v{settings.VERSION}")
    print(f"[SCALE] Max Concurrent Users: {settings.MAX_CONCURRENT_USERS}")
    print(f"[DB] Pool Size: {settings.DB_POOL_SIZE}, Max Overflow: {settings.DB_MAX_OVERFLOW}")
    print(f"[CORS] Origins: {settings.CORS_ORIGINS}")
    if settings.CORS_ALLOW_ORIGIN_REGEX:
        print(f"[CORS] Origin Regex: {settings.CORS_ALLOW_ORIGIN_REGEX}")
    print(f"[CACHE] Redis Max Connections: {settings.REDIS_MAX_CONNECTIONS}")
    print(f"[WS] Max WebSocket Connections: {settings.WEBSOCKET_MAX_CONNECTIONS}")
    print(
        "[WS] Queue: "
        f"size={settings.WEBSOCKET_MESSAGE_QUEUE_SIZE}, "
        f"batch={settings.WEBSOCKET_QUEUE_BATCH_SIZE}, "
        f"interval_ms={settings.WEBSOCKET_QUEUE_PROCESS_INTERVAL_MS}, "
        f"threshold={settings.WEBSOCKET_QUEUE_THRESHOLD_CONNECTIONS}"
    )
    print(f"[ROCKET] AI Provider: {settings.AI_PROVIDER if settings.AI_PROVIDER else 'Not configured'}")
    print(f"[BRAIN] AI Model: {settings.AI_MODEL if settings.AI_MODEL else 'Not configured'}")

    if settings.AI_PROVIDER == "groq":
        print(
            f"[KEY] GROQ Key Loaded: {'YES' if settings.GROQ_API_KEY else 'NO'}"
        )

