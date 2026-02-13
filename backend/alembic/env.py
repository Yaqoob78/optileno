# alembic/env.py - SIMPLIFIED VERSION
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys

# Add the parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Get database URL - adjust for your database
# For SQLite (development):
DATABASE_URL = "sqlite:///./optileno.db"
# For PostgreSQL (production):
# DATABASE_URL = "postgresql://user:password@localhost/dbname"

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import your Base from models
try:
    # Try to import your models
    from db.models import Base
    target_metadata = Base.metadata
except ImportError:
    # If that fails, create empty metadata
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