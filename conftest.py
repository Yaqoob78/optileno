import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_TEST_DB_PATH = (Path(__file__).resolve().parent / "test_suite.db").as_posix()
DEFAULT_ASYNC_DB_URL = f"sqlite+aiosqlite:///{DEFAULT_TEST_DB_PATH}"
DEFAULT_SYNC_DB_URL = f"sqlite:///{DEFAULT_TEST_DB_PATH}"

os.environ.setdefault("TESTING", "true")
os.environ.setdefault("DATABASE_URL", DEFAULT_ASYNC_DB_URL)
os.environ.setdefault("TEST_DATABASE_URL", DEFAULT_SYNC_DB_URL)


def _bootstrap_test_database() -> None:
    """Create schema and seed a deterministic user for legacy integration tests."""
    from backend.db.models import Base, User

    engine = create_engine(
        DEFAULT_SYNC_DB_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)

    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_local() as db:
        user = db.query(User).filter(User.id == 1).first()
        if not user:
            db.add(
                User(
                    id=1,
                    email="test-user-1@example.com",
                    username="testuser1",
                    hashed_password="test-hash",
                    is_active=True,
                    is_verified=True,
                )
            )
            db.commit()


_bootstrap_test_database()
