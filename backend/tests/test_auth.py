"""Контракт auth по SPEC.md §4: login/me/logout, cookie-сессии, 401."""

from datetime import UTC, datetime, timedelta

from conftest import DEMO_PASSWORD
from sqlalchemy import select

from app.domains.identity.models import UserSession

PASSWORD = DEMO_PASSWORD


async def test_health_is_public(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_me_requires_session(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Требуется вход"}


async def test_login_wrong_password(client, demo_user):
    resp = await client.post(
        "/api/auth/login", json={"username": "demo", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Неверный логин или пароль"}


async def test_login_unknown_user(client):
    resp = await client.post(
        "/api/auth/login", json={"username": "ghost", "password": "whatever-123"}
    )
    assert resp.status_code == 401


async def test_login_me_logout_flow(client, demo_user):
    resp = await client.post(
        "/api/auth/login", json={"username": "demo", "password": PASSWORD}
    )
    assert resp.status_code == 200
    assert resp.json() == {"username": "demo", "display_name": "Демо", "role": "specialist"}
    cookie = resp.headers["set-cookie"]
    assert "session=" in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()

    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json() == {"username": "demo", "display_name": "Демо", "role": "specialist"}

    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json() == {}  # клиент всегда парсит JSON

    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_session_soft_check(client, demo_user):
    # Аноним: всегда 200 — boot-запрос клиента без 401 в консоли.
    resp = await client.get("/api/auth/session")
    assert resp.status_code == 200
    assert resp.json() == {"authenticated": False, "user": None}

    await client.post("/api/auth/login", json={"username": "demo", "password": PASSWORD})
    resp = await client.get("/api/auth/session")
    assert resp.status_code == 200
    assert resp.json() == {
        "authenticated": True,
        "user": {"username": "demo", "display_name": "Демо", "role": "specialist"},
    }


async def test_expired_session_rejected(client, demo_user, db_session):
    await client.post(
        "/api/auth/login", json={"username": "demo", "password": PASSWORD}
    )
    # «Протухаем» все сессии напрямую в БД.
    sessions = (await db_session.scalars(select(UserSession))).all()
    for s in sessions:
        s.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()

    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
