# alembic/env.py - SIMPLIFIED VERSION
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys

# Add the repository root to Python path (3 levels up from env.py)
# env.py -> alembic/ -> backend/ -> ROOT
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, repo_root)

# Get database URL from environment or fallback to sqlite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./optileno.db")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    # Alembic uses a synchronous engine; strip async dialect for migrations.
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

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
