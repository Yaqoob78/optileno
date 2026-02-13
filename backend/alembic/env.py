# alembic/env.py - SIMPLIFIED VERSION
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys
import urllib.parse

# Add the repository root to Python path (3 levels up from env.py)
# env.py -> alembic/ -> backend/ -> ROOT
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, repo_root)

def _strip_wrapping_quotes(value: str) -> str:
    cleaned = (value or "").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {"'", '"'}:
        return cleaned[1:-1].strip()
    return cleaned


def _is_unresolved_template(value: str) -> bool:
    v = (value or "").strip()
    return (v.startswith("${") and v.endswith("}")) or (v.startswith("$") and "{" in v and "}" in v)


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
    return normalized


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

if _is_unresolved_template(DATABASE_URL):
    raise RuntimeError(
        "DATABASE_URL appears unresolved (e.g. ${VAR} or ${{Service.VAR}}). "
        "Set DATABASE_URL to a real URL in Railway variables."
    )

# Keep env normalized so imports that read settings see a clean value.
os.environ["DATABASE_URL"] = DATABASE_URL

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
