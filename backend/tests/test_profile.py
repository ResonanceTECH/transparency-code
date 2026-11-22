"""Контракт домена profile: `questionnaire-v1`, revision, приватность, версии.

Старые версии этого файла сохранены в ``tests/archive/*-old-contract.py.txt``.
Тесты используют изолированную SQLite из ``conftest.py``; рабочая БД не трогается.
"""

import asyncio
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.base import Base
from app.core.config import get_settings
from app.core.deps import get_db
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password
from app.domains.profile import api as profile_api
from app.domains.profile import demo as profile_demo
from app.main import app

pytestmark = pytest.mark.asyncio

PASSWORD = "demo-pass-2026"
CONSENT = profile_demo.CONSENT_SAMPLE
SUPPORT = profile_demo.SUPPORT_SAMPLE
RESULT_SAMPLE = "Подтверждающий_документ_результата.pdf"
DEMO_PHONE = "+7 (000) 000-01-47"
RULE_IDS = {"РО-01", "ДУ-01", "ДЕ-01"}


@pytest.fixture(autouse=True)
def demo_enabled(monkeypatch):
    def enabled():
        return get_settings().model_copy(update={"allow_demo_login": True})

    monkeypatch.setattr(profile_api, "get_settings", enabled)
    monkeypatch.setattr(profile_demo, "get_settings", enabled)
    yield
    app.dependency_overrides.clear()


async def _login_client(db_session, username, role, display):
    user = User(id=uuid.uuid4(), username=username,
                password_hash=hash_password(PASSWORD),
                display_name=display, role=role)
    db_session.add(user)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    http = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    resp = await http.post("/api/auth/login", json={"username": username, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return http


@pytest_asyncio.fixture
async def reservist_client(db_session):
    http = await _login_client(db_session, "reservist", UserRole.RESERVIST, "Петрова Марина")
    yield http
    await http.aclose()


@pytest_asyncio.fixture
async def reviewer_client(db_session):
    http = await _login_client(db_session, "reviewer", UserRole.REVIEWER, "Смирнова Анна")
    yield http
    await http.aclose()


def _legacy_draft() -> dict:
    """Прежний плоский формат: сервер должен сконвертировать его в анкету v1."""
    return {
        "person": {"full_name": "Петрова Марина Ивановна", "birth_year": 1988,
                   "phone": "+7 900 111-22-33", "email": "petrova@example.demo"},
        "program": {"flow": "Время героев", "program_year": 2025,
                    "region": "Липецкая область"},
        "service_periods": [{"start_date": "2018-01-10", "end_date": "2024-12-31",
                             "kind": "military", "officer_category": "senior"}],
        "payments": [
            {"category": c, "answer": "no", "records": []}
            for c in ["one_time", "allowance", "support", "insurance", "family",
                      "material_aid", "housing", "monetary_allowance",
                      "allowances", "non_monetary"]
        ],
    }


async def _sample(client: AsyncClient, name: str, kind: str, section: str) -> dict:
    revision = (await client.get("/api/profile")).json()["revision"]
    response = await client.post("/api/profile/documents/sample", json={
        "name": name, "kind": kind, "section": section, "revision": revision,
    })
    assert response.status_code == 201, response.text
    return response.json()


async def _submit_owner(client: AsyncClient, *, mutate=None, private_reply: str | None = None,
                        demo_already_loaded: bool = False) -> dict:
    """Полный цикл: демо-наполнение, обязательное согласие, 90%, публикация."""
    if not demo_already_loaded:
        demo = await client.post("/api/profile/demo")
        assert demo.status_code == 200, demo.text
    support = await _sample(client, SUPPORT, "basis", "Региональная поддержка")
    consent = await _sample(client, CONSENT, "consent", "Учебное согласие")

    draft = (await client.get("/api/profile")).json()
    questionnaire = draft["questionnaire"]
    questionnaire["consent_document_id"] = consent["id"]
    questionnaire["records"]["3"][0]["document_id"] = support["id"]
    questionnaire["records"]["8"][0]["expected_year"] = "2028"
    if mutate is not None:
        mutate(questionnaire)

    saved = await client.put("/api/profile", json={
        "revision": draft["revision"],
        "questionnaire": questionnaire,
        "private_reply": private_reply,
    })
    assert saved.status_code == 200, saved.text
    assert saved.json()["progress"] == 90, saved.text
    submitted = await client.post("/api/profile/submit", json={
        "confirmed": True, "revision": saved.json()["revision"],
    })
    assert submitted.status_code == 201, submitted.text
    return submitted.json()


async def _first_in_queue(reviewer: AsyncClient) -> str:
    queue = (await reviewer.get("/api/reviewer/queue")).json()
    assert queue, "Отправленный профиль должен появиться в очереди"
    return queue[0]["profile_id"]


async def _finalize(reviewer: AsyncClient, profile_id: str) -> dict:
    """Человеческие решения и файл результата для итогового статуса."""
    card = (await reviewer.get(f"/api/reviewer/profiles/{profile_id}")).json()
    version = card["version"]["number"]
    for signal in card["signals"]:
        response = await reviewer.post(f"/api/reviewer/signals/{signal['id']}/decision", json={
            "status": "reviewed", "comment": "Сигнал рассмотрен по учебным материалам",
            "version": version,
        })
        assert response.status_code == 201, response.text
    for item in card["version"]["snapshot"]["documents"]:
        if item.get("kind") == "photo":
            continue
        response = await reviewer.post(
            f"/api/reviewer/profiles/{profile_id}/documents/{item['id']}/assessment",
            json={"version": version, "status": "usable", "comment": "Оригинал приложения пригоден"},
        )
        assert response.status_code == 201, response.text
    result = await reviewer.post(f"/api/reviewer/profiles/{profile_id}/documents",
        files={"file": ("result.pdf", profile_demo.sample_bytes(RESULT_SAMPLE), "application/pdf")},
        data={"version": str(version)})
    assert result.status_code == 201, result.text
    decision = await reviewer.post(f"/api/reviewer/profiles/{profile_id}/decision", json={
        "action": "complete", "comment": "Сведения сопоставлены с учебными основаниями вручную",
        "basis": "Учебное основание АР-0147/26", "checks": [True, True, True],
        "version": version, "document_id": result.json()["id"],
    })
    assert decision.status_code == 201, decision.text
    return decision.json()


# ---------- черновик и роли ----------


async def test_parallel_profile_endpoints_create_one_draft(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'profiles.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    from app.domains.profile.services import get_or_create_profile

    user = User(id=uuid.uuid4(), username="reservist",
                password_hash=hash_password(PASSWORD),
                display_name="Петрова Марина", role=UserRole.RESERVIST)
    async with factory() as session:
        session.add(user)
        await session.commit()

    async def with_session():
        async with factory() as session:
            current = await session.get(User, user.id)
            return await get_or_create_profile(session, current)

    profiles = await asyncio.gather(*(with_session() for _ in range(6)))
    assert len({p.id for p in profiles}) == 1
    await engine.dispose()


async def test_draft_created_lazily_and_private(reservist_client):
    body = (await reservist_client.get("/api/profile")).json()
    assert body["contract_version"] == "questionnaire-v1"
    assert body["status"] == "draft"
    assert body["progress"] == 0
    assert body["revision"] == 0
    assert body["questionnaire"]["candidate"]["full_name"] == ""
    assert body["versions_total"] == 0
    assert body["documents"] == []


async def test_draft_endpoints_require_reservist_role(auth_client, reviewer_client):
    for client in (auth_client, reviewer_client):
        assert (await client.get("/api/profile")).status_code == 403


async def test_unauthenticated_forbidden(client):
    assert (await client.get("/api/profile")).status_code == 401
    assert (await client.get("/api/reviewer/queue")).status_code == 401


# ---------- полнота и сохранение ----------


async def test_put_requires_revision_and_converts_legacy_draft(reservist_client):
    assert (await reservist_client.put("/api/profile", json=_legacy_draft())).status_code == 422
    saved = await reservist_client.put("/api/profile", json={"revision": 0, **_legacy_draft()})
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["questionnaire"]["candidate"]["full_name"] == "Петрова Марина Ивановна"
    assert len(body["service_periods"]) == 1
    assert body["revision"] == 1
    stale = await reservist_client.put("/api/profile", json={"revision": 0, **_legacy_draft()})
    assert stale.status_code == 409


async def test_completeness_grows_with_demo_support_and_consent(reservist_client):
    assert (await reservist_client.get("/api/profile/completeness")).json()["can_submit"] is False
    demo = (await reservist_client.post("/api/profile/demo")).json()
    assert demo["progress"] == 70
    await _sample(reservist_client, SUPPORT, "basis", "Региональная поддержка")
    await _sample(reservist_client, CONSENT, "consent", "Учебное согласие")
    body = (await reservist_client.get("/api/profile")).json()
    q = body["questionnaire"]
    q["consent_document_id"] = next(d["id"] for d in body["documents"] if d["kind"] == "consent")
    q["records"]["3"][0]["document_id"] = next(
        d["id"] for d in body["documents"] if d["filename"] == SUPPORT)
    q["records"]["8"][0]["expected_year"] = "2028"
    saved = await reservist_client.put("/api/profile", json={
        "revision": body["revision"], "questionnaire": q,
    })
    assert saved.status_code == 200, saved.text
    completeness = (await reservist_client.get("/api/profile/completeness")).json()
    assert completeness["progress"] == 90
    assert completeness["can_submit"] is True
    assert completeness["missing"] == []


async def test_submit_requires_confirmation_revision_and_consent(reservist_client, reviewer_client):
    no_confirm = await reservist_client.post("/api/profile/submit", json={"revision": 0})
    assert no_confirm.status_code == 422
    no_revision = await reservist_client.post("/api/profile/submit", json={"confirmed": True})
    assert no_revision.status_code == 422

    await reservist_client.post("/api/profile/demo")
    revision = (await reservist_client.get("/api/profile")).json()["revision"]
    incomplete = await reservist_client.post("/api/profile/submit", json={
        "confirmed": True, "revision": revision,
    })
    assert incomplete.status_code == 422

    version = await _submit_owner(reservist_client, demo_already_loaded=True)
    assert version["number"] == 1
    assert version["snapshot"]["questionnaire"]["candidate"]["full_name"]


async def test_submit_blocks_draft_and_keeps_snapshot(reservist_client, reviewer_client):
    version = await _submit_owner(reservist_client)
    assert (await reservist_client.put("/api/profile", json={"revision": 0})).status_code == 409
    snapshot = (await reservist_client.get("/api/profile/versions/1")).json()["snapshot"]
    assert snapshot["questionnaire"]["candidate"]["full_name"] == (
        version["snapshot"]["questionnaire"]["candidate"]["full_name"]
    )


# ---------- приватность и доступ ----------


async def test_draft_invisible_to_reviewer(reservist_client, reviewer_client):
    await reservist_client.put("/api/profile", json={"revision": 0, **_legacy_draft()})
    profile_id = (await reservist_client.get("/api/profile")).json()["profile_id"]
    queue = (await reviewer_client.get("/api/reviewer/queue")).json()
    assert all(item["profile_id"] != profile_id for item in queue)
    assert (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}")).status_code == 404


async def test_reviewer_sees_only_assigned_submitted_version(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    item = (await reviewer_client.get("/api/reviewer/queue")).json()[0]
    assert item["status"] == "submitted"
    assert item["reviewer_name"]
    card = (await reviewer_client.get(f"/api/reviewer/profiles/{item['profile_id']}")).json()
    assert card["version"]["number"] == 1
    assert card["contract_version"] == "questionnaire-v1"
    assert card["pending_signals"] == len(card["signals"])


async def test_submitted_reply_is_published_but_private_audit_is_not(reservist_client, reviewer_client):
    await _submit_owner(reservist_client, private_reply="Личное пояснение резервиста")
    profile_id = await _first_in_queue(reviewer_client)
    card = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}")).json()
    assert card["version"]["snapshot"]["reply"] == "Личное пояснение резервиста"
    audit = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/audit")).json()
    assert all(event["scope"] == "submitted" for event in audit)
    assert all("Черновик обновлён" not in event["action"] for event in audit)


# ---------- сигналы и решения ----------


async def test_signals_are_commented_human_questions(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)
    card = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}")).json()
    assert {s["rule_id"] for s in card["signals"]} <= RULE_IDS
    assert all(s["explanation"] and s["action"] for s in card["signals"])

    signal = card["signals"][0]
    short = await reviewer_client.post(f"/api/reviewer/signals/{signal['id']}/decision",
        json={"status": "reviewed", "comment": "ok", "version": 1})
    assert short.status_code == 422
    stale = await reviewer_client.post(f"/api/reviewer/signals/{signal['id']}/decision",
        json={"status": "reviewed", "comment": "Сигнал рассмотрен вручную", "version": 99})
    assert stale.status_code == 409
    decided = await reviewer_client.post(f"/api/reviewer/signals/{signal['id']}/decision",
        json={"status": "reviewed", "comment": "Сигнал рассмотрен вручную", "version": 1})
    assert decided.status_code == 201
    assert decided.json()["comment"] == "Сигнал рассмотрен вручную"


async def test_reviewer_workflow_and_final_closure(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)

    accepted = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision",
        json={"action": "accept", "comment": "Принято к рассмотрению", "version": 1})
    assert accepted.status_code == 201
    clarification = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision",
        json={"action": "clarification", "comment": "Уточните реквизиты акта", "version": 1})
    assert clarification.status_code == 201
    messages = (await reservist_client.get("/api/profile/messages")).json()
    assert messages[-1]["kind"] == "question"

    # Новая версия требует содержательного личного пояснения.
    demo = await reservist_client.post("/api/profile/demo")
    assert demo.status_code == 409  # уже заполнен — сценарий не перезаписывается
    body = (await reservist_client.get("/api/profile")).json()
    q = body["questionnaire"]
    q["candidate"]["phone"] = "+7 900 999-88-77"
    bad = await reservist_client.put("/api/profile", json={
        "revision": body["revision"], "questionnaire": q, "private_reply": "коротко"})
    assert bad.status_code == 200  # черновик сохраняется и с коротким пояснением
    body = bad.json()
    q = body["questionnaire"]
    q["candidate"]["phone"] = "+7 900 999-88-77"
    saved = await reservist_client.put("/api/profile", json={
        "revision": body["revision"], "questionnaire": q,
        "private_reply": "Сверил реквизиты акта и уточнил телефон по учебному материалу"})
    assert saved.status_code == 200, saved.text
    resubmitted = await reservist_client.post("/api/profile/submit", json={
        "confirmed": True, "revision": saved.json()["revision"]})
    assert resubmitted.status_code == 201
    assert resubmitted.json()["number"] == 2

    final = await _finalize(reviewer_client, profile_id)
    assert final["status"] == "completed"
    assert (await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision",
        json={"action": "accept", "comment": "Повторное решение", "version": 2})).status_code == 409


async def test_final_decision_requires_human_evidence(reviewer_client):
    card = (await reviewer_client.post("/api/reviewer/demo")).json()
    profile_id = card["profile_id"]
    weak = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision", json={
        "action": "complete", "comment": "ok", "basis": "Основание",
        "checks": [True, True, True], "version": 1})
    assert weak.status_code == 422
    no_document = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision", json={
        "action": "complete", "comment": "Сведения достоверны по учебным материалам",
        "basis": "Основание", "checks": [True, True, True], "version": 1})
    assert no_document.status_code == 422
    assert "подтверждающий документ" in no_document.json()["detail"]


# ---------- сообщения, файлы, аудит ----------


async def test_messages(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)
    question = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/messages",
        json={"text": "Приложите скан приказа о выплате"})
    assert question.json()["kind"] == "question"
    reply = await reservist_client.post("/api/profile/messages", json={"text": "Приказ приложен к делу"})
    assert reply.json()["kind"] == "reply"
    messages = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/messages")).json()
    assert [m["kind"] for m in messages] == ["question", "reply"]


async def test_documents_keep_distinct_ids_and_soft_delete(reservist_client):
    payload = profile_demo.sample_bytes(SUPPORT)
    ids = []
    for name in ("a.pdf", "b.pdf"):
        revision = (await reservist_client.get("/api/profile")).json()["revision"]
        response = await reservist_client.post("/api/profile/documents",
            files={"file": (name, payload, "application/pdf")},
            data={"kind": "basis", "revision": str(revision)})
        assert response.status_code == 201, response.text
        ids.append(response.json()["id"])
    assert ids[0] != ids[1]

    revision = (await reservist_client.get("/api/profile")).json()["revision"]
    removed = await reservist_client.delete(f"/api/profile/documents/{ids[0]}", params={"revision": revision})
    assert removed.status_code == 204
    assert [d["id"] for d in (await reservist_client.get("/api/profile")).json()["documents"]] == [ids[1]]

    revision = (await reservist_client.get("/api/profile")).json()["revision"]
    bad = await reservist_client.post("/api/profile/documents",
        files={"file": ("bogus.exe", b"MZ", "application/octet-stream")},
        data={"kind": "basis", "revision": str(revision)})
    assert bad.status_code == 422


async def test_export_result(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)
    await _finalize(reviewer_client, profile_id)
    exported = await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/export")
    assert exported.status_code == 200
    body = exported.json()
    assert body["profile"]["status"] == "completed"
    assert body["version"]["number"] == 1
    assert body["reviews"][0]["result"] == "completed"
    assert body["limitations"]
    assert (await reservist_client.get(f"/api/reviewer/profiles/{profile_id}/export")).status_code == 403


async def test_reviewer_income_summary(reservist_client, reviewer_client):
    def amounts(q):
        for key in ("0", "1", "2", "3", "4", "6", "7"):
            for row in q["records"].get(key, []):
                row["amount"] = "0"
        q["records"]["2"][0]["amount"] = "50000"
        q["records"]["2"][0]["form"] = "Денежная"
        # Натуральная мера не должна увеличивать денежный итог; в слепке её сумма нулевая.
        q["records"]["3"][0]["amount"] = "0"
        q["records"]["3"][0]["form"] = ""
        q["records"]["6"][0]["amount"] = "30000"
        q["records"]["6"][0]["recipient_kind"] = "Член семьи"

    await _submit_owner(reservist_client, mutate=amounts)
    profile_id = await _first_in_queue(reviewer_client)
    summary = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}")).json()["income_summary"]
    assert summary["total"] == "50000.00"
    assert summary["family_total"] == "30000.00"
    assert summary["family_records"] == 1
    by_category = {c["category"]: c["total"] for c in summary["by_category"]}
    assert by_category["one_time"] == "50000.00"
    assert by_category["support"] == "0.00"
    assert "housing" not in by_category and "non_monetary" not in by_category


async def test_contacts_and_rules_registry(auth_client, db_session):
    from app.domains.profile import services as svc
    await svc.seed_contacts(db_session)
    await db_session.commit()
    contacts = (await auth_client.get("/api/reference/contacts")).json()
    assert len(contacts) >= 3
    rules = (await auth_client.get("/api/reference/rules")).json()
    assert RULE_IDS <= {rule["id"] for rule in rules}


# ---------- версии ----------


async def _resubmit_with_phone(reservist_client, reviewer_client, phone):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)
    clarification = await reviewer_client.post(f"/api/reviewer/profiles/{profile_id}/decision",
        json={"action": "clarification", "comment": "Уточните телефон", "version": 1})
    assert clarification.status_code == 201
    body = (await reservist_client.get("/api/profile")).json()
    q = body["questionnaire"]
    q["candidate"]["phone"] = phone
    saved = await reservist_client.put("/api/profile", json={
        "revision": body["revision"], "questionnaire": q,
        "private_reply": "Сверил номер телефона с учебным материалом",
    })
    assert saved.status_code == 200, saved.text
    second = await reservist_client.post("/api/profile/submit", json={
        "confirmed": True, "revision": saved.json()["revision"]})
    assert second.status_code == 201
    assert second.json()["number"] == 2
    return profile_id


async def test_version_immutable_snapshot(reservist_client, reviewer_client):
    await _resubmit_with_phone(reservist_client, reviewer_client, "+7 900 999-88-77")
    v1 = (await reservist_client.get("/api/profile/versions/1")).json()
    v2 = (await reservist_client.get("/api/profile/versions/2")).json()
    assert v1["snapshot"]["questionnaire"]["candidate"]["phone"] == DEMO_PHONE
    assert v2["snapshot"]["questionnaire"]["candidate"]["phone"] == "+7 900 999-88-77"
    assert v2["status"] == "resubmitted"
    assert "Личное пояснение" not in str(v1)


async def test_version_diff_and_reviewer_version_selection(reservist_client, reviewer_client):
    profile_id = await _resubmit_with_phone(reservist_client, reviewer_client, "+7 900 777-66-55")
    diff = (await reservist_client.get("/api/profile/versions/1/diff/2")).json()
    assert (diff["version_from"], diff["version_to"]) == (1, 2)
    assert diff["changed"] >= 1
    assert any("777-66-55" in str(entry["after"]) for entry in diff["entries"])
    assert (await reservist_client.get("/api/profile/versions/1/diff/9")).status_code == 404

    versions = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/versions")).json()
    assert [v["number"] for v in versions] == [1, 2]
    first = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}?version=1")).json()
    assert first["version"]["snapshot"]["questionnaire"]["candidate"]["phone"] == DEMO_PHONE
    assert (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}?version=9")).status_code == 404
    summary = (await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/diff")).json()
    assert (summary["version_from"], summary["version_to"]) == (1, 2)


async def test_reviewer_diff_requires_two_versions(reservist_client, reviewer_client):
    await _submit_owner(reservist_client)
    profile_id = await _first_in_queue(reviewer_client)
    response = await reviewer_client.get(f"/api/reviewer/profiles/{profile_id}/diff")
    assert response.status_code == 409
    assert "две версии" in response.json()["detail"]
