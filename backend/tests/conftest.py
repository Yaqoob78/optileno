import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator


# Test database configuration
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "sqlite:///./test.db"
)

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in TEST_DATABASE_URL else {}
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


@pytest.fixture(scope="session")
def db_setup():
    """Setup and teardown test database"""
    # Create all tables
    from backend.db.models import Base
    Base.metadata.create_all(bind=test_engine)
    
    yield
    
    # Cleanup
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session(db_setup) -> Generator:
    """Provide test database session"""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_client(db_session):
    """Provide test client with database session"""
    from backend.app.main import app
    from backend.db.session import get_db
    
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    client = TestClient(app)
    
    yield client
    
    app.dependency_overrides.clear()


# Test data fixtures
@pytest.fixture
def test_user_data():
    """Sample user data for testing"""
    return {
        "email": "test@example.com",
        "password": "TestPassword123!",
        "first_name": "Test",
        "last_name": "User"
    }


@pytest.fixture
def test_user_token(test_client, test_user_data):
    """Create test user and return auth token"""
    # Register user
    response = test_client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    
    if response.status_code == 201:
        # Login
        login_response = test_client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }
        )
        
        if login_response.status_code == 200:
            return login_response.json().get("access_token")
    
    return "mock_token_for_testing"


@pytest.fixture
def test_user_id(test_client, test_user_data):
    """Get test user ID"""
    response = test_client.post(
        "/api/v1/auth/register",
        json=test_user_data
    )
    
    if response.status_code == 201:
        return response.json().get("user_id")
    
    return "test_user_1"


@pytest.fixture
def test_task_data():
    """Sample task data for testing"""
    return {
        "title": "Test Task",
        "description": "This is a test task",
        "priority": "medium",
        "due_date": "2024-12-31",
        "status": "pending"
    }


@pytest.fixture
def test_notification_data():
    """Sample notification data for testing"""
    return {
        "title": "Test Notification",
        "message": "This is a test notification",
        "type": "task_update",
        "priority": "normal"
    }


@pytest.fixture
def test_comment_data():
    """Sample comment data for testing"""
    return {
        "content": "This is a test comment",
        "mentions": []
    }


# Helper functions
def create_test_task(test_client, test_user_token: str, task_data: dict = None):
    """Helper to create a test task"""
    if task_data is None:
        task_data = {
            "title": "Test Task",
            "description": "Test Description"
        }
    
    response = test_client.post(
        "/api/v1/tasks",
        json=task_data,
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    
    return None


def create_test_notification(test_client, test_user_token: str, notification_data: dict = None):
    """Helper to create a test notification"""
    if notification_data is None:
        notification_data = {
            "title": "Test Notification",
            "message": "Test Message"
        }
    
    response = test_client.post(
        "/api/v1/notifications/send",
        json=notification_data,
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    
    return None


def add_test_comment(test_client, test_user_token: str, task_id: str, content: str = "Test Comment"):
    """Helper to add a test comment"""
    response = test_client.post(
        f"/api/v1/tasks/{task_id}/comments",
        json={"content": content},
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    
    return None


def share_test_task(test_client, test_user_token: str, task_id: str, shared_with_id: str, permissions: list = None):
    """Helper to share a test task"""
    if permissions is None:
        permissions = ["view", "edit", "comment"]
    
    response = test_client.post(
        f"/api/v1/tasks/{task_id}/share",
        json={
            "shared_with_id": shared_with_id,
            "permissions": permissions
        },
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    
    return None


def send_agent_message(test_client, test_user_token: str, mode: str = "CHAT", content: str = "Test message"):
    """Helper to send agent message"""
    response = test_client.post(
        "/api/v1/agent/message",
        json={
            "mode": mode,
            "content": content
        },
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    
    return None


# Pytest configuration
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers",
        "performance: mark test as performance test"
    )


# Test environment setup
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
