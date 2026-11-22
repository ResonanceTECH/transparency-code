"""Текущий контракт questionnaire-v1: тесты серверного хранения, а не старого UI.

Старые ``test_profile.py``/Playwright-сценарии описывают предыдущий in-memory
этап и другой API-контракт. Этот файл проверяет то, что используется сейчас:
пустой старт, revision, независимое демо, неизменные файлы и человеческое закрытие.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_db
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password
from app.domains.profile import api as profile_api
from app.domains.profile import demo as profile_demo
from app.main import app

PASSWORD = "current-contract-2026"


@pytest.fixture(autouse=True)
def demo_enabled(monkeypatch):
    """Учебные комплекты включены только внутри этих тестов."""
    from app.core.config import get_settings

    def enabled():
        return get_settings().model_copy(update={"allow_demo_login": True})

    monkeypatch.setattr(profile_api, "get_settings", enabled)
    monkeypatch.setattr(profile_demo, "get_settings", enabled)
    yield
    app.dependency_overrides.clear()


async def _login_client(db_session, username: str, role: UserRole) -> AsyncClient:
    user = User(
        id=uuid.uuid4(),
        username=username,
        password_hash=hash_password(PASSWORD),
        display_name=f"Тест {username}",
        role=role,
    )
    db_session.add(user)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    response = await client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return client


@pytest_asyncio.fixture
async def reservist_client(db_session):
    client = await _login_client(db_session, "reservist", UserRole.RESERVIST)
    yield client
    await client.aclose()


@pytest_asyncio.fixture
async def reviewer_client(db_session):
    client = await _login_client(db_session, "reviewer", UserRole.REVIEWER)
    yield client
    await client.aclose()


async def test_new_profile_is_blank_and_uses_current_contract(reservist_client):
    response = await reservist_client.get("/api/profile")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["contract_version"] == "questionnaire-v1"
    assert body["revision"] == 0
    assert body["progress"] == 0
    assert body["status"] == "draft"
    assert body["editable"] is True
    assert body["can_load_demo"] is True
    assert body["questionnaire"]["candidate"]["full_name"] == ""
    assert body["documents"] == []
    assert body["versions_total"] == 0
    assert not body["private_reply"]

    completeness = (await reservist_client.get("/api/profile/completeness")).json()
    assert completeness["can_submit"] is False
    assert completeness["progress"] == 0


async def test_save_requires_current_revision(reservist_client):
    assert (await reservist_client.put("/api/profile", json={"revision": 0})).status_code == 200

    stale = await reservist_client.put("/api/profile", json={"revision": 0})
    assert stale.status_code == 409, stale.text

    draft = (await reservist_client.get("/api/profile")).json()
    assert draft["revision"] == 1
    updated = await reservist_client.put(
        "/api/profile",
        json={"revision": 1, "private_reply": "Личное пояснение не published"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["private_reply"] == "Личное пояснение не published"
    assert updated.json()["revision"] == 2


async def test_demo_fill_is_explicit_and_only_for_pristine_profile(reservist_client):
    first = await reservist_client.post("/api/profile/demo")
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["is_demo"] is True
    assert body["questionnaire"]["candidate"]["full_name"]
    assert len(body["documents"]) >= 9

    second = await reservist_client.post("/api/profile/demo")
    assert second.status_code == 409, second.text


async def test_demo_fill_does_not_overwrite_existing_own_data(db_session, reservist_client):
    saved = await reservist_client.put(
        "/api/profile",
        json={"revision": 0, "questionnaire": {"candidate": {"full_name": "Существующий Владелец"}}},
    )
    assert saved.status_code == 200, saved.text
    denied = await reservist_client.post("/api/profile/demo")
    assert denied.status_code == 409, denied.text
    body = (await reservist_client.get("/api/profile")).json()
    assert body["questionnaire"]["candidate"]["full_name"] == "Существующий Владелец"
    assert body["is_demo"] is False


async def test_reviewer_demo_is_separate_from_owner_draft(reservist_client, reviewer_client):
    material = await reviewer_client.post("/api/reviewer/demo")
    assert material.status_code == 200, material.text
    body = material.json()
    assert body["contract_version"] == "questionnaire-v1"
    assert body["is_demo"] is True
    assert body["version"]["number"] == 1
    assert body["version"]["snapshot"]["questionnaire"]["candidate"]["full_name"]
    assert body["assigned_reviewer"]

    owner = (await reservist_client.get("/api/profile")).json()
    assert owner["revision"] == 0
    assert owner["is_demo"] is False
    assert owner["versions_total"] == 0
    assert owner["documents"] == []

    queue = (await reviewer_client.get("/api/reviewer/queue")).json()
    assert any(item["is_demo"] and item["profile_id"] == body["profile_id"] for item in queue)


async def test_duplicate_files_have_distinct_ids_and_deletion_is_soft(reservist_client):
    content = profile_demo.sample_bytes(profile_demo.SUPPORT_SAMPLE)
    ids = []
    for name in ("первый.pdf", "второй.pdf"):
        revision = (await reservist_client.get("/api/profile")).json()["revision"]
        response = await reservist_client.post(
            "/api/profile/documents",
            files={"file": (name, content, "application/pdf")},
            data={"kind": "basis", "section": "Основание", "revision": str(revision)},
        )
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    assert ids[0] != ids[1]

    revision = (await reservist_client.get("/api/profile")).json()["revision"]
    removed = await reservist_client.delete(
        f"/api/profile/documents/{ids[0]}", params={"revision": revision}
    )
    assert removed.status_code == 204, removed.text
    remaining = (await reservist_client.get("/api/profile")).json()
    assert [item["id"] for item in remaining["documents"]] == [ids[1]]


async def test_final_decision_requires_evidence_and_version(reviewer_client):
    material = (await reviewer_client.post("/api/reviewer/demo")).json()
    profile_id = material["profile_id"]

    stale = await reviewer_client.post(
        f"/api/reviewer/profiles/{profile_id}/decision",
        json={
            "action": "accept",
            "comment": "Принято к рассмотрению",
            "version": 99,
        },
    )
    assert stale.status_code == 409, stale.text

    final = await reviewer_client.post(
        f"/api/reviewer/profiles/{profile_id}/decision",
        json={
            "action": "complete",
            "comment": "Сведения сопоставлены с учебными материалами вручную",
            "basis": "Учебное основание АР-0147/26",
            "checks": [True, True, True],
            "version": 1,
        },
    )
    assert final.status_code == 422, final.text
    assert "подтверждающий документ" in final.json()["detail"]

    # Никакого автоматического отказа: материал остаётся доступным для работы.
    card = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}")).json()
    assert card["version"]["number"] == 1
    assert card["pending_signals"] >= 0
