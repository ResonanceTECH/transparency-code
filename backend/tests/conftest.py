"""Общие фикстуры тестов: SQLite в памяти + подмена get_db для AsyncClient."""

import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.base import Base
from app.core.deps import get_db
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password
from app.main import app

DEMO_PASSWORD = "demo-pass-2026"


@pytest_asyncio.fixture
async def db_session():
    """Изолированная in-memory SQLite сессия; create_all на каждый тест."""
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    """AsyncClient к приложению; все Depends(get_db) получают тестовую сессию."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def demo_user(db_session):
    """Демо-пользователь с известным паролем (`DEMO_PASSWORD`)."""
    user = User(
        id=uuid.uuid4(),
        username="demo",
        password_hash=hash_password(DEMO_PASSWORD),
        display_name="Демо",
        role=UserRole.SPECIALIST,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def auth_client(client, demo_user):
    """AsyncClient с активной сессией demo-пользователя (cookie сохранена)."""
    resp = await client.post(
        "/api/auth/login", json={"username": "demo", "password": DEMO_PASSWORD}
    )
    assert resp.status_code == 200, resp.text
    return client
