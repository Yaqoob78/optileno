import pytest
from sqlalchemy import select

from backend.db.database import get_db, init_db
from backend.db.models import User
from backend.auth.auth_service import auth_service
from backend.schemas.auth import UserLogin, UserRegister
from backend.utils.owner import get_owner_email, is_owner_email


@pytest.mark.asyncio
async def test_owner_recognition():
    owner_email = get_owner_email()
    assert owner_email == "khan011504@gmail.com"
    assert is_owner_email("khan011504@gmail.com") is True
    assert is_owner_email("KHAN011504@GMAIL.COM") is True
    assert is_owner_email("user@example.com") is False


@pytest.mark.asyncio
async def test_owner_login_auto_provision():
    await init_db()
    owner_email = "khan011504@gmail.com"
    
    async for db_session in get_db():
        # Clean up any existing owner record from test DB
        existing = await db_session.execute(select(User).where(User.email == owner_email))
        user_obj = existing.scalar_one_or_none()
        if user_obj:
            await db_session.delete(user_obj)
            await db_session.commit()

        # Attempt owner login (triggers auto-provision)
        login_data = UserLogin(email=owner_email, password="Yaqoob@1732006#")
        owner_user = await auth_service.authenticate(db_session, login_data)

        assert owner_user is not None
        assert owner_user.email == owner_email
        assert owner_user.role == "admin"
        assert owner_user.tier == "ultra"
        assert owner_user.plan_type == "ULTRA"
        assert owner_user.is_superuser is True
        assert owner_user.subscription_status == "active"
        break


@pytest.mark.asyncio
async def test_regular_user_register_and_login():
    await init_db()
    test_email = "test_user_isolation@optileno.com"
    
    async for db_session in get_db():
        # Clean up any previous test user
        existing = await db_session.execute(select(User).where(User.email == test_email))
        user_obj = existing.scalar_one_or_none()
        if user_obj:
            await db_session.delete(user_obj)
            await db_session.commit()

        # Register regular user
        reg_data = UserRegister(
            email=test_email,
            password="TestPassword123!",
            full_name="Test User",
            plan_type="EXPLORER"
        )
        new_user = await auth_service.register(db_session, reg_data)
        assert new_user.email == test_email
        assert new_user.role == "user"
        assert new_user.tier == "explorer"
        assert new_user.plan_type == "EXPLORER"
        assert new_user.is_superuser is False

        # Login regular user
        login_data = UserLogin(email=test_email, password="TestPassword123!")
        auth_user = await auth_service.authenticate(db_session, login_data)
        assert auth_user.id == new_user.id
        assert auth_user.email == test_email
        break


@pytest.mark.asyncio
async def test_google_auth_service():
    await init_db()
    google_email = "google_test_user@gmail.com"
    
    async for db_session in get_db():
        # Clean up test user
        existing = await db_session.execute(select(User).where(User.email == google_email))
        user_obj = existing.scalar_one_or_none()
        if user_obj:
            await db_session.delete(user_obj)
            await db_session.commit()

        google_info = {
            "email": google_email,
            "name": "Google Tester",
            "picture": "https://lh3.googleusercontent.com/a/test-avatar",
            "sub": "google-sub-12345"
        }

        user = await auth_service.authenticate_or_register_google(
            db_session,
            google_info=google_info,
            plan_type="EXPLORER"
        )

        assert user is not None
        assert user.email == google_email
        assert user.full_name == "Google Tester"
        assert user.is_verified is True
        assert user.preferences.get("avatar") == "https://lh3.googleusercontent.com/a/test-avatar"
        break
