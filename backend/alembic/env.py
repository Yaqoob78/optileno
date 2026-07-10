# alembic/env.py - SIMPLIFIED VERSION
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.engine import make_url
from alembic import context
import os
import sys
import urllib.parse
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - alembic can still read real env vars
    load_dotenv = None

# Add the repository root to Python path (3 levels up from env.py)
# env.py -> alembic/ -> backend/ -> ROOT
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, repo_root)
repo_root_path = Path(repo_root)


def _load_env_file() -> None:
    if load_dotenv is None:
        return

    explicit_env_file = os.getenv("OPTILENO_ENV_FILE", "").strip()
    candidates = []

    if explicit_env_file:
        explicit_path = Path(explicit_env_file)
        candidates.append(explicit_path if explicit_path.is_absolute() else repo_root_path / explicit_path)

    candidates.extend([
        repo_root_path / "backend" / ".env",
        repo_root_path / "env" / ".env",
        repo_root_path / ".env",
    ])

    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate, override=False)
            return


_load_env_file()

def _strip_wrapping_quotes(value: str) -> str:
    cleaned = (value or "").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        return cleaned[1:-1].strip()
    return cleaned


def _is_unresolved_template(value: str) -> bool:
    v = (value or "").strip()
    return (v.startswith("${") and v.endswith("}")) or (v.startswith("$") and "{" in v and "}" in v)


def _is_postgres_url(url: str) -> bool:
    return _strip_wrapping_quotes(url or "").lower().startswith(("postgres://", "postgresql://", "postgresql+"))


def _database_ssl_mode(url: str) -> str:
    explicit = _strip_wrapping_quotes(os.getenv("DATABASE_SSL_MODE", "")).strip().lower()
    if explicit:
        return explicit
    environment = _strip_wrapping_quotes(os.getenv("ENVIRONMENT", "")).strip().lower()
    if environment == "production" and _is_postgres_url(url):
        return "require"
    return ""


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _database_iam_auth_enabled() -> bool:
    return _env_bool("DATABASE_IAM_AUTH", False)


def _remove_url_query_params(url: str, names: set[str]) -> str:
    parsed = urllib.parse.urlsplit(url)
    if not parsed.query:
        return url

    filtered_query = [
        (key, value)
        for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in names
    ]
    return urllib.parse.urlunsplit(
        parsed._replace(query=urllib.parse.urlencode(filtered_query))
    )


def _with_sync_sslmode(url: str) -> str:
    ssl_mode = _database_ssl_mode(url)
    if not ssl_mode or ssl_mode in {"disable", "false", "0", "no"} or not _is_postgres_url(url):
        return url

    if ssl_mode in {"true", "1", "yes"}:
        ssl_mode = "require"

    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    if any(key.lower() == "sslmode" for key, _ in query):
        return url

    query.append(("sslmode", ssl_mode))
    return urllib.parse.urlunsplit(
        parsed._replace(query=urllib.parse.urlencode(query))
    )


def _with_iam_auth_token(url: str) -> str:
    if not _database_iam_auth_enabled() or not _is_postgres_url(url):
        return url

    from backend.db.rds_iam import generate_db_auth_token

    parsed_url = make_url(url)
    if not parsed_url.host or not parsed_url.username:
        raise RuntimeError("DATABASE_URL must include host and username when DATABASE_IAM_AUTH=true")

    token = generate_db_auth_token(
        hostname=parsed_url.host,
        port=int(parsed_url.port or 5432),
        username=parsed_url.username,
        region_name=os.getenv("DATABASE_AWS_REGION") or os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION"),
    )
    return parsed_url.set(password=token).render_as_string(hide_password=False)


def _normalize_alembic_database_url(url: str) -> str:
    normalized = _strip_wrapping_quotes(url or "")
    if not normalized:
        return normalized
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql://", 1)
    if normalized.startswith("postgresql+asyncpg://"):
        # Alembic uses a synchronous engine; strip async dialect for migrations.
        normalized = normalized.replace("postgresql+asyncpg://", "postgresql://", 1)
    if normalized.startswith("postgresql+psycopg2://"):
        normalized = normalized.replace("postgresql+psycopg2://", "postgresql://", 1)
    if normalized.startswith("sqlite+aiosqlite://"):
        # Alembic migrations run synchronously; use sqlite sync driver.
        normalized = normalized.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return _with_sync_sslmode(normalized)


def _to_async_database_url(url: str) -> str:
    normalized = _strip_wrapping_quotes(url or "")
    if not normalized:
        return normalized
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("postgresql+psycopg2://"):
        normalized = normalized.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("sqlite://"):
        normalized = normalized.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return _remove_url_query_params(normalized, {"sslmode"})


def _build_sync_db_url_from_pg_env() -> str:
    host = (os.getenv("PGHOST") or "").strip()
    user = (os.getenv("PGUSER") or "").strip()
    password = os.getenv("PGPASSWORD") or ""
    database = (os.getenv("PGDATABASE") or "").strip()
    port = (os.getenv("PGPORT") or "5432").strip()
    if not (host and user and database):
        return ""
    encoded_user = urllib.parse.quote(user, safe="")
    encoded_password = urllib.parse.quote(password, safe="")
    return f"postgresql://{encoded_user}:{encoded_password}@{host}:{port}/{database}"


def _pick_database_url_candidate() -> str:
    return (
        (os.getenv("DATABASE_URL") or "").strip()
        or (os.getenv("DATABASE_PRIVATE_URL") or "").strip()
        or (os.getenv("DATABASE_PUBLIC_URL") or "").strip()
        or (os.getenv("POSTGRES_URL") or "").strip()
        or (os.getenv("POSTGRESQL_URL") or "").strip()
    )


# Get database URL from environment, then PG* fallback, then sqlite fallback.
DATABASE_URL = _normalize_alembic_database_url(
    _pick_database_url_candidate()
    or _build_sync_db_url_from_pg_env()
    or "sqlite:///./optileno.db"
)
DATABASE_URL = _with_iam_auth_token(DATABASE_URL)

if _is_unresolved_template(DATABASE_URL):
    raise RuntimeError(
        "DATABASE_URL appears unresolved (e.g. ${VAR} or ${{Service.VAR}}). "
        "Set DATABASE_URL to a real URL in Railway variables."
    )

# Keep env normalized so imports that read settings see a clean value.
os.environ["DATABASE_URL"] = _to_async_database_url(DATABASE_URL)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import your Base from models using absolute path
try:
    from backend.db.models import Base
    target_metadata = Base.metadata
except ImportError as e:
    # If that fails, log it
    print(f"Could not import backend.db.models: {e}")
    from sqlalchemy.ext.declarative import declarative_base
    target_metadata = declarative_base().metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        {"sqlalchemy.url": DATABASE_URL},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
