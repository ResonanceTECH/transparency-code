"""Контракт cases-домена по SPEC.md §5.3/§7: CRUD, валидация, изоляция, события."""

import uuid

from sqlalchemy import select

from app.domains.cases.models import Case, CaseEvent
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password

VALID_PAYLOAD = {
    "synthetic": True,
    "name": "Иванов Алексей · вымышленное лицо",
    "department": "Учебное подразделение",
    "basis": "candidate",
    "year": 2025,
}


async def test_cases_require_auth(client):
    """Роутер-level защита: без сессии — 401 (SPEC.md §4)."""
    assert (await client.get("/api/cases")).status_code == 401
    assert (await client.post("/api/cases", json=VALID_PAYLOAD)).status_code == 401


async def test_create_and_list_case(auth_client):
    resp = await auth_client.post("/api/cases", json=VALID_PAYLOAD)
    assert resp.status_code == 201, resp.text
    case = resp.json()
    assert case["number"] == "PR-2025-0001"
    assert case["status"] == "draft"
    assert case["signals_count"] == 0 and case["pending_count"] == 0
    assert case["stale"] is False

    resp = await auth_client.get("/api/cases")
    assert resp.status_code == 200
    assert [c["number"] for c in resp.json()] == ["PR-2025-0001"]


async def test_case_number_sequence_per_year(auth_client):
    await auth_client.post("/api/cases", json=VALID_PAYLOAD)
    second = await auth_client.post(
        "/api/cases", json={**VALID_PAYLOAD, "name": "Петров Иван · вымышленное лицо"}
    )
    other_year = await auth_client.post(
        "/api/cases", json={**VALID_PAYLOAD, "year": 2024}
    )
    assert second.json()["number"] == "PR-2025-0002"
    assert other_year.json()["number"] == "PR-2024-0001"


async def test_create_case_validation(auth_client):
    cases = [
        ({**VALID_PAYLOAD, "synthetic": False}, "synthetic=false — только синтетика"),
        ({**VALID_PAYLOAD, "basis": "bogus"}, "неизвестный basis"),
        ({**VALID_PAYLOAD, "name": "Я"}, "name < 2 символов"),
        ({**VALID_PAYLOAD, "year": 1999}, "year вне диапазона"),
        ({**VALID_PAYLOAD, "department": "x" * 201}, "department > 200"),
    ]
    for payload, why in cases:
        resp = await auth_client.post("/api/cases", json=payload)
        assert resp.status_code == 422, f"{why}: {resp.status_code} {resp.text}"
        assert resp.json()["detail"], why  # единый формат ошибок клиента


async def test_department_defaults_when_empty(auth_client):
    resp = await auth_client.post(
        "/api/cases", json={**VALID_PAYLOAD, "department": ""}
    )
    assert resp.status_code == 201
    assert resp.json()["department"] == "Учебное подразделение"


async def test_case_detail(auth_client):
    created = (await auth_client.post("/api/cases", json=VALID_PAYLOAD)).json()
    resp = await auth_client.get(f"/api/cases/{created['id']}")
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["number"] == "PR-2025-0001"
    assert detail["facts"] == [] and detail["documents"] == [] and detail["runs"] == []
    # Событие создания записано в ленту формата «Короткое: детали».
    assert len(detail["events"]) == 1
    assert detail["events"][0]["message"].startswith("Дело создано:")
    assert detail["events"][0]["author"] == "demo"


async def test_case_not_found(auth_client):
    resp = await auth_client.get(f"/api/cases/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Дело не найдено"}


async def test_owner_isolation(auth_client, client, db_session):
    """Чужое дело: нет в списке и 404 в деталях (SPEC.md §5.3)."""
    created = (await auth_client.post("/api/cases", json=VALID_PAYLOAD)).json()

    other = User(
        id=uuid.uuid4(),
        username="other",
        password_hash=hash_password("other-pass-1"),
        display_name="Другой",
        role=UserRole.SPECIALIST,
    )
    db_session.add(other)
    await db_session.commit()

    # Перелогиниваемся под вторым пользователем (cookie перезапишется).
    resp = await client.post(
        "/api/auth/login", json={"username": "other", "password": "other-pass-1"}
    )
    assert resp.status_code == 200

    assert (await client.get("/api/cases")).json() == []
    resp = await client.get(f"/api/cases/{created['id']}")
    assert resp.status_code == 404


async def test_case_events_recorded(auth_client, db_session):
    """Событие создания лежит в case_events с автором (SPEC.md §7.7)."""
    await auth_client.post("/api/cases", json=VALID_PAYLOAD)
    case = await db_session.scalar(select(Case).where(Case.number == "PR-2025-0001"))
    events = (
        await db_session.scalars(
            select(CaseEvent).where(CaseEvent.case_id == case.id)
        )
    ).all()
    assert len(events) == 1
    assert events[0].message.startswith("Дело создано:")
    assert events[0].author == "demo"
