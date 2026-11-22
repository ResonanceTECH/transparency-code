"""Контракт-тесты домена profile — этап 2 (SPEC.md §10).

Покрывает: приватность черновика, прогресс-вехи, полную замену черновика,
публикацию + версии-слепки, детерминированные несоответствия, очередь и
решения проверяющего, переписку, аудит, справочник контактов, ролевые границы.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_db
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password
from app.main import app

pytestmark = pytest.mark.asyncio

DEMO_PASSWORD = "demo-pass-2026"


async def _login_client(db_session, username, role, display):
    """Отдельный AsyncClient на роль — cookie сессий не пересекаются."""
    user = User(id=uuid.uuid4(), username=username,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=display, role=role)
    db_session.add(user)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    http = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    resp = await http.post("/api/auth/login",
                           json={"username": username, "password": DEMO_PASSWORD})
    assert resp.status_code == 200, resp.text
    return http


@pytest_asyncio.fixture
async def reservist_client(db_session):
    http = await _login_client(db_session, "reservist", UserRole.RESERVIST,
                               "Петрова Марина")
    yield http
    await http.aclose()


@pytest_asyncio.fixture
async def reviewer_client(db_session):
    http = await _login_client(db_session, "reviewer", UserRole.REVIEWER,
                               "Смирнова Анна")
    yield http
    await http.aclose()


def _full_draft() -> dict:
    """Полностью заполненный черновик — все вехи до 90%."""
    return {
        "person": {"full_name": "Петрова Марина Ивановна", "birth_year": 1988,
                   "phone": "+7 900 111-22-33", "email": "petrova@example.demo",
                   "current_workplace": "ГБУ «Центр»"},
        "program": {"flow": "Время героев", "program_year": 2025,
                    "region": "Липецкая область",
                    "regional_program": "Герои Липецкой земли",
                    "regional_program_year": 2025},
        "reserve_act_number": "Акт-2025/014", "reserve_act_date": "2025-03-15",
        "work_status": "serving", "appointment_authority": "Администрация области",
        "service_periods": [{"start_date": "2018-01-10", "end_date": "2024-12-31",
                             "kind": "military", "officer_category": "senior"}],
        "kinship": {"has_relative": True, "received_payments": False,
                    "relatives": [{"full_name": "Петров И.И.", "degree": "spouse",
                                   "participant_status": "participating"}]},
        "payments": [
            {"category": c, "answer": "no", "records": []}
            for c in ["one_time", "allowance", "support", "insurance", "family",
                      "material_aid", "housing", "monetary_allowance",
                      "allowances", "non_monetary"]
        ],
        "activity_participates": False,
        "activities": [],
    }


async def _fill_and_submit(reservist_client: AsyncClient) -> dict:
    """Загружает документ-диплом, сохраняет черновик и публикует."""
    draft = _full_draft()
    r = await reservist_client.put("/api/profile", json=draft)
    assert r.status_code == 200, r.text
    files = {"file": ("diploma.json", b'{"synthetic": true, "kind": "diploma"}',
                      "application/json")}
    r = await reservist_client.post("/api/profile/documents",
                                    files=files, data={"kind": "diploma"})
    assert r.status_code == 201, r.text
    r = await reservist_client.get("/api/profile/completeness")
    assert r.json()["can_submit"] is True
    r = await reservist_client.post("/api/profile/submit")
    assert r.status_code == 201, r.text
    return r.json()


# ---------- черновик и роли ----------


async def test_draft_created_lazily_and_private(reservist_client):
    r = await reservist_client.get("/api/profile")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "draft"
    assert body["progress"] == 0
    assert body["payments"] == []  # блоки создаются при первом PUT
    assert body["versions_total"] == 0


async def test_draft_endpoints_require_reservist_role(auth_client, reviewer_client):
    # specialist и reviewer не имеют доступа к контуру резервиста
    for c in (auth_client, reviewer_client):
        assert (await c.get("/api/profile")).status_code == 403


async def test_unauthenticated_forbidden(client):
    assert (await client.get("/api/profile")).status_code == 401
    assert (await client.get("/api/reviewer/queue")).status_code == 401


# ---------- полнота ----------


async def test_completeness_milestones(reservist_client):
    draft = _full_draft()
    await reservist_client.put("/api/profile", json=draft)
    r = await reservist_client.get("/api/profile/completeness")
    body = r.json()
    # нет диплома → стоп на 10%
    assert body["progress"] == 10
    assert body["can_submit"] is False
    assert any("диплом" in m.lower() for m in body["missing"])
    done = {m["percent"]: m["done"] for m in body["milestones"]}
    assert done == {10: True, 30: False, 50: False, 70: False, 90: False}


async def test_put_draft_replaces_children(reservist_client):
    draft = _full_draft()
    await reservist_client.put("/api/profile", json=draft)
    draft["service_periods"] = [
        {"start_date": "2020-01-01", "end_date": None,
         "kind": "state", "officer_category": "higher"}]
    r = await reservist_client.put("/api/profile", json=draft)
    body = r.json()
    assert len(body["service_periods"]) == 1
    assert body["service_periods"][0]["kind"] == "state"
    assert body["kinship"]["has_relative"] is True
    assert len(body["relatives"]) == 1


# ---------- публикация и видимость ----------


async def test_submit_requires_90_percent(reservist_client):
    r = await reservist_client.post("/api/profile/submit")
    assert r.status_code == 422
    assert "заполнен" in r.json()["detail"].lower()


async def test_submit_creates_version_and_blocks_draft(reservist_client):
    version = await _fill_and_submit(reservist_client)
    assert version["number"] == 1
    assert version["status"] == "submitted"
    r = await reservist_client.get("/api/profile")
    assert r.json()["status"] == "submitted"
    # черновик заблокирован
    assert (await reservist_client.put("/api/profile", json=_full_draft())).status_code == 409
    # версия доступна и содержит слепок
    r = await reservist_client.get("/api/profile/versions/1")
    assert r.status_code == 200
    snap = r.json()["snapshot"]
    assert snap["person"]["full_name"] == "Петрова Марина Ивановна"
    assert len(snap["payments"]) == 10


async def test_draft_invisible_to_reviewer(reservist_client, reviewer_client):
    # черновик (не опубликован) невидим в очереди и по прямому id
    await reservist_client.put("/api/profile", json=_full_draft())
    r = await reservist_client.get("/api/profile")
    pid = r.json()["profile_id"]
    queue = (await reviewer_client.get("/api/reviewer/queue")).json()
    assert all(item["profile_id"] != pid for item in queue)
    assert (await reviewer_client.get(f"/api/reviewer/profiles/{pid}")).status_code == 404


async def test_reviewer_sees_submitted(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    r = await reviewer_client.get("/api/reviewer/queue")
    queue = r.json()
    assert len(queue) == 1
    assert queue[0]["status"] == "submitted"
    assert queue[0]["reviewer_name"]  # auto-assign
    pid = queue[0]["profile_id"]
    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}")
    body = r.json()
    assert body["version"]["number"] == 1
    assert body["version"]["snapshot"]["person"]["full_name"].startswith("Петрова")
    assert body["pending_signals"] == len(body["signals"])


# ---------- несоответствия ----------


async def test_profile_checks_generate_signals(reservist_client, reviewer_client):
    draft = _full_draft()
    draft["kinship"]["received_payments"] = True  # заявлены, записей нет → сигнал
    draft["service_periods"] = [{"start_date": "2024-01-01", "end_date": "2020-01-01",
                                 "kind": "military"}]  # конец < начала → сигнал
    r = await reservist_client.put("/api/profile", json=draft)
    assert r.status_code == 200
    await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("d.json", b'{"synthetic": true}', "application/json")},
        data={"kind": "diploma"})
    await reservist_client.post("/api/profile/submit")
    signals = (await reservist_client.get("/api/profile/signals")).json()
    rule_ids = {s["rule_id"] for s in signals}
    assert "period-order" in rule_ids
    assert "kinship-payments-missing" in rule_ids
    for s in signals:
        assert s["status"] == "unreviewed"
        assert s["explanation"] and s["action"]


async def test_signal_decision_lifecycle(reservist_client, reviewer_client):
    draft = _full_draft()
    draft["kinship"]["received_payments"] = True
    await reservist_client.put("/api/profile", json=draft)
    await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("d.json", b'{"synthetic": true}', "application/json")},
        data={"kind": "diploma"})
    await reservist_client.post("/api/profile/submit")
    signals = (await reservist_client.get("/api/profile/signals")).json()
    sig = signals[0]
    # короткий комментарий — 422
    r = await reviewer_client.post(
        f"/api/reviewer/signals/{sig['id']}/decision",
        json={"status": "reviewed", "comment": "ok"})
    assert r.status_code == 422
    r = await reviewer_client.post(
        f"/api/reviewer/signals/{sig['id']}/decision",
        json={"status": "reviewed", "comment": "Проверено по учебному документу"})
    assert r.status_code == 201
    assert r.json()["status"] == "reviewed"
    # статус сигнала обновился, история решений append-only
    signals = (await reservist_client.get("/api/profile/signals")).json()
    assert signals[0]["status"] == "reviewed"


# ---------- решения проверяющего по профилю ----------


async def test_reviewer_decision_flow(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]

    # accept
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "accept", "comment": "Принят к рассмотрению, вопросов нет"})
    assert r.status_code == 201
    assert r.json()["status"] == "accepted"

    # clarification → статус + вопрос резервисту
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "clarification", "comment": "Уточните реквизиты акта о зачислении"})
    assert r.json()["status"] == "clarification"
    msgs = (await reservist_client.get("/api/profile/messages")).json()
    assert msgs[-1]["kind"] == "question"
    assert "реквизиты" in msgs[-1]["text"]

    # резервист может править и повторно представить
    r = await reservist_client.put("/api/profile", json=_full_draft())
    assert r.status_code == 200
    r = await reservist_client.post("/api/profile/submit")
    assert r.json()["number"] == 2
    assert r.json()["status"] == "resubmitted"

    # remove требует основание
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "remove", "comment": "Снят по заявлению"})
    assert r.status_code == 422
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "remove", "comment": "Снят по заявлению кандидата",
              "basis": "Заявление от 01.11.2025 № 5"})
    assert r.json()["status"] == "removed"
    # повторное решение — 409
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "complete", "comment": "Финализация"})
    assert r.status_code == 409


async def test_complete_review_and_audit(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "complete",
              "comment": "Сведения достоверны в пределах представленных документов"})
    assert r.status_code == 201
    audit = (await reviewer_client.get(
        f"/api/reviewer/profiles/{pid}/audit")).json()
    actions = [a["action"] for a in audit]
    assert any("представлены" in a.lower() for a in actions)
    assert any("завершено" in a.lower() for a in actions)
    # приватный аудит («Черновик обновлён») проверяющему не виден
    assert all("Черновик" not in a for a in actions)
    # резервист видит весь журнал
    full = (await reservist_client.get("/api/profile/audit")).json()
    assert any("Черновик" in a["action"] for a in full)


# ---------- переписка ----------


async def test_messages(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/messages",
        json={"text": "Приложите скан приказа о выплате"})
    assert r.json()["kind"] == "question"
    r = await reservist_client.post(
        "/api/profile/messages", json={"text": "Приказ приложен к делу № 3"})
    assert r.json()["kind"] == "reply"
    msgs = (await reviewer_client.get(
        f"/api/reviewer/profiles/{pid}/messages")).json()
    assert [m["kind"] for m in msgs] == ["question", "reply"]


# ---------- документы ----------


async def test_document_upload_dedup_and_validation(reservist_client):
    payload = b'{"synthetic": true, "kind": "diploma"}'
    r1 = await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("d.json", payload, "application/json")},
        data={"kind": "diploma"})
    r2 = await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("d2.json", payload, "application/json")},
        data={"kind": "diploma"})
    assert r1.json()["id"] == r2.json()["id"]  # dedup по sha256
    # плохой тип документа и расширение
    r = await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("d.json", payload, "application/json")},
        data={"kind": "bogus"})
    assert r.status_code == 422
    r = await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("evil.exe", b"MZ", "application/octet-stream")},
        data={"kind": "diploma"})
    assert r.status_code == 422


async def test_export_result(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "complete", "comment": "Проверка завершена"})
    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}/export")
    assert r.status_code == 200
    body = r.json()
    assert body["profile"]["status"] == "completed"
    assert body["version"]["number"] == 1
    assert body["reviews"][0]["result"] == "completed"
    assert body["limitations"]
    # экспорт недоступен резервисту
    assert (await reservist_client.get(
        f"/api/reviewer/profiles/{pid}/export")).status_code == 403


async def test_reviewer_income_summary(reservist_client, reviewer_client):
    """SPEC §10.8: сводка «Сведения о доходах» — только monetary, без non_monetary/in_kind."""
    draft = _full_draft()
    blocks = {b["category"]: b for b in draft["payments"]}
    blocks["one_time"].update(answer="yes", records=[{
        "title": "Единовременная выплата", "form": "monetary", "amount": "50000.00"}])
    blocks["housing"].update(answer="yes", records=[{
        "title": "Субсидия на жильё", "form": "monetary", "amount": "120000.00",
        "housing_kind": "subsidy", "document_ref": "Приказ №5 от 01.02.2025"}])
    blocks["support"].update(answer="yes", records=[{
        "title": "Региональная поддержка", "form": "in_kind", "amount": "999.00",
        "level": "regional", "document_ref": "Решение №12"}])
    blocks["non_monetary"].update(answer="yes", records=[{
        "title": "Предоставление техники", "form": "monetary", "amount": "777.00",
        "document_ref": "Акт №3"}])
    blocks["family"].update(answer="yes", records=[{
        "title": "Выплата супруге", "form": "monetary", "amount": "30000.00",
        "recipient_kind": "family_member", "recipient_name": "Петров И.И."}])

    r = await reservist_client.put("/api/profile", json=draft)
    assert r.status_code == 200, r.text
    r = await reservist_client.post(
        "/api/profile/documents",
        files={"file": ("diploma.json", b'{"synthetic": true, "kind": "diploma"}',
                        "application/json")},
        data={"kind": "diploma"})
    assert r.status_code == 201, r.text
    assert (await reservist_client.get("/api/profile/completeness")).json()["can_submit"]
    r = await reservist_client.post("/api/profile/submit")
    assert r.status_code == 201, r.text

    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}")
    assert r.status_code == 200, r.text
    summary = r.json()["income_summary"]
    # 50000 + 120000 + 30000; in_kind (999) и non_monetary (777) исключены
    assert summary["total"] == "200000.00"
    assert summary["records"] == 3
    assert summary["currency"] == "RUB"
    by_cat = {c["category"]: c["total"] for c in summary["by_category"]}
    assert by_cat == {"family": "30000.00", "housing": "120000.00", "one_time": "50000.00"}


# ---------- справочник ----------


async def test_contacts_and_rules_registry(auth_client, db_session):
    from app.domains.profile import services as svc
    await svc.seed_contacts(db_session)
    await db_session.commit()
    r = await auth_client.get("/api/reference/contacts")
    assert r.status_code == 200
    assert len(r.json()) >= 3
    r = await auth_client.get("/api/reference/rules")
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert {"period-order", "housing-kind-required"} <= ids


# ---------- версии ----------


async def test_version_immutable_snapshot(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "clarification", "comment": "Уточните данные о службе"})
    # правка черновика и повторная публикация
    draft = _full_draft()
    draft["person"]["phone"] = "+7 900 999-88-77"
    await reservist_client.put("/api/profile", json=draft)
    await reservist_client.post("/api/profile/submit")
    v1 = (await reservist_client.get("/api/profile/versions/1")).json()
    v2 = (await reservist_client.get("/api/profile/versions/2")).json()
    assert v1["snapshot"]["person"]["phone"] == "+7 900 111-22-33"  # слепок не изменился
    assert v2["snapshot"]["person"]["phone"] == "+7 900 999-88-77"
    assert v2["status"] == "resubmitted"


async def _two_versions(reservist_client, reviewer_client) -> str:
    """Публикует v1, проверяющий просит уточнение, резервист правит и
    представляет v2. Возвращает profile_id."""
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    r = await reviewer_client.post(
        f"/api/reviewer/profiles/{pid}/decision",
        json={"action": "clarification", "comment": "Уточните данные о службе"})
    assert r.status_code == 201
    draft = _full_draft()
    draft["person"]["phone"] = "+7 900 999-88-77"
    draft["payments"][0] = {
        "category": "one_time", "answer": "yes",
        "records": [{"title": "Единовременная выплата", "basis": "Указ Президента № 1",
                     "form": "monetary", "amount": "10000.00",
                     "period_from": "2025-05-01"}],
    }
    r = await reservist_client.put("/api/profile", json=draft)
    assert r.status_code == 200
    r = await reservist_client.post("/api/profile/submit")
    assert r.json()["number"] == 2
    return pid


async def test_version_diff_reservist(reservist_client, reviewer_client):
    await _two_versions(reservist_client, reviewer_client)
    r = await reservist_client.get("/api/profile/versions/1/diff/2")
    assert r.status_code == 200
    body = r.json()
    assert (body["version_from"], body["version_to"]) == (1, 2)
    paths = {e["path"] for e in body["entries"]}
    assert "person.phone" in paths
    assert "payments[0].answer" in paths
    phone = next(e for e in body["entries"] if e["path"] == "person.phone")
    assert phone["before"] == "+7 900 111-22-33"
    assert phone["after"] == "+7 900 999-88-77"
    # технические id не попадают в diff
    assert all(not p.endswith(".id") for p in paths)
    assert body["changed"] == len(body["entries"])


async def test_version_diff_reviewer_and_version_param(reservist_client,
                                                       reviewer_client):
    pid = await _two_versions(reservist_client, reviewer_client)
    versions = (await reviewer_client.get(
        f"/api/reviewer/profiles/{pid}/versions")).json()
    assert [v["number"] for v in versions] == [1, 2]

    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}/diff")
    assert r.status_code == 200
    assert r.json()["version_from"] == 1 and r.json()["version_to"] == 2
    assert r.json()["changed"] > 0

    # выбор версии в карточке
    card = (await reviewer_client.get(
        f"/api/reviewer/profiles/{pid}?version=1")).json()
    assert card["version"]["number"] == 1
    assert card["version"]["snapshot"]["person"]["phone"] == "+7 900 111-22-33"
    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}?version=99")
    assert r.status_code == 404


async def test_diff_requires_two_versions(reservist_client, reviewer_client):
    await _fill_and_submit(reservist_client)
    pid = (await reviewer_client.get("/api/reviewer/queue")).json()[0]["profile_id"]
    r = await reviewer_client.get(f"/api/reviewer/profiles/{pid}/diff")
    assert r.status_code == 409
    r = await reservist_client.get("/api/profile/versions/1/diff/7")
    assert r.status_code == 404


# ---------- unit: структурный diff ----------


def test_diff_snapshots_unit():
    from app.domains.profile.diff import diff_snapshots

    assert diff_snapshots({"a": 1}, {"a": 1}) == []
    entries = diff_snapshots(
        {"a": 1, "b": {"c": "x"}, "l": [1, 2]},
        {"a": 1, "b": {"c": "y"}, "l": [1, 2, 3], "new": True},
    )
    paths = {e["path"] for e in entries}
    assert paths == {"b.c", "l[2]", "new"}
    by_path = {e["path"]: e for e in entries}
    assert by_path["l[2]"]["before"] is None and by_path["l[2]"]["after"] == 3
    # вложенные id игнорируются
    assert diff_snapshots({"r": {"id": "1", "v": 5}},
                          {"r": {"id": "2", "v": 5}}) == []
