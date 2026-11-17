"""Контракт analysis/reporting-доменов и demo-наполнения (SPEC.md §5.6–5.7, §7.3–7.6)."""

import uuid

ALL_RULES = {"enabled_rules": ["sale-income-gap", "obligation-balance", "expense-coverage"]}


async def _create_case(client) -> str:
    resp = await client.post(
        "/api/cases",
        json={
            "synthetic": True,
            "name": "Соколова Елена · вымышленное лицо",
            "department": "Учебное подразделение",
            "basis": "candidate",
            "year": 2025,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _demo(client, case_id: str, kind: str = "trade_in", clean: bool = False) -> dict:
    resp = await client.post(f"/api/cases/{case_id}/demo?kind={kind}&clean={str(clean).lower()}")
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _analyze(client, case_id: str, rules: list[str] | None = None) -> dict:
    resp = await client.post(
        f"/api/cases/{case_id}/analysis-runs", json=rules or ALL_RULES
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- rules ---------------------------------------------------------------


async def test_rules_registry(auth_client):
    resp = await auth_client.get("/api/rules")
    assert resp.status_code == 200
    rules = resp.json()["rules"]
    ids = [r["id"] for r in rules]
    assert ids == ["sale-income-gap", "obligation-balance", "expense-coverage"]
    titles = {r["id"]: r["title"] for r in rules}
    assert titles["obligation-balance"] == "Сопоставление обязательств"
    assert all(r["description"] for r in rules)


# --- demo kits -----------------------------------------------------------


async def test_demo_trade_in_creates_facts(auth_client):
    case_id = await _create_case(auth_client)
    detail = await _demo(auth_client, case_id)
    fields = {f["field"] for f in detail["facts"]}
    assert {"sale_amount", "income_declared", "obligation_initial", "obligation_payment",
            "obligation_balance"} <= fields
    assert len(detail["documents"]) == 2
    assert all(not d["downloadable"] and d["status"] == "ready" for d in detail["documents"])
    assert all(f["document_name"] for f in detail["facts"])
    assert any(m["message"].startswith("Добавлен демонстрационный комплект") for m in detail["events"])


async def test_demo_idempotent_and_404s(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    detail = await _demo(auth_client, case_id)  # повтор — без дублей
    assert len(detail["documents"]) == 2
    assert (await auth_client.post(f"/api/cases/{uuid.uuid4()}/demo")).status_code == 404


# --- analysis runs -------------------------------------------------------


async def test_analysis_run_signals_and_evidence(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    await auth_client.post(f"/api/cases/{case_id}/confirm-facts")
    run = await _analyze(auth_client, case_id)

    assert run["rule_version"] and len(run["input_hash"]) == 64
    assert {s["rule"] for s in run["signals"]} == {"sale-income-gap", "obligation-balance"}
    titles = {s["title"] for s in run["signals"]}
    assert "Возможный пропуск дохода от продажи" in titles
    assert "Различаются остатки обязательства" in titles
    assert all(s["status"] == "unreviewed" and s["evidence"] for s in run["signals"])

    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    assert detail["status"] == "attention" and detail["pending_count"] == 2
    assert detail["stale"] is False and detail["signals_count"] == 2
    assert detail["runs"][0]["id"] == run["id"]


async def test_analysis_deterministic_and_clean_kit(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    first, second = await _analyze(auth_client, case_id), await _analyze(auth_client, case_id)
    assert first["input_hash"] == second["input_hash"]  # детерминизм снапшота
    assert {s["title"] for s in first["signals"]} == {s["title"] for s in second["signals"]}

    clean_id = await _create_case(auth_client)
    await _demo(auth_client, clean_id, clean=True)
    run = await _analyze(auth_client, clean_id)
    assert run["signals"] == []
    detail = (await auth_client.get(f"/api/cases/{clean_id}")).json()
    assert detail["status"] == "completed" and detail["pending_count"] == 0


async def test_analysis_validates_rules(auth_client):
    case_id = await _create_case(auth_client)
    assert (await auth_client.post(
        f"/api/cases/{case_id}/analysis-runs", json={"enabled_rules": []})).status_code == 422
    assert (await auth_client.post(
        f"/api/cases/{case_id}/analysis-runs",
        json={"enabled_rules": ["no-such-rule"]})).status_code == 422
    assert (await auth_client.post(
        f"/api/cases/{uuid.uuid4()}/analysis-runs", json=ALL_RULES)).status_code == 404


async def test_unconfirmed_facts_warn(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)  # без confirm-facts
    run = await _analyze(auth_client, case_id)
    assert run["warnings"] and "неподтвержд" in run["warnings"][0]


# --- decisions -----------------------------------------------------------


async def test_decision_flow_and_blocking(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    run = await _analyze(auth_client, case_id)
    signal = next(s for s in run["signals"] if s["rule"] == "sale-income-gap")

    # комментарий < 5 → 422
    resp = await auth_client.post(
        f"/api/signals/{signal['id']}/decisions", json={"status": "resolved", "comment": "мало"}
    )
    assert resp.status_code == 422

    resp = await auth_client.post(
        f"/api/signals/{signal['id']}/decisions",
        json={"status": "resolved", "comment": "Расхождение объяснено учебным договором."},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "resolved" and resp.json()["author"] == "demo"

    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    updated = next(s for s in detail["runs"][0]["signals"] if s["id"] == signal["id"])
    assert updated["status"] == "resolved" and len(updated["decisions"]) == 1
    assert detail["pending_count"] == 1  # остался obligation-balance

    assert (await auth_client.post(
        f"/api/signals/{uuid.uuid4()}/decisions",
        json={"status": "resolved", "comment": "нет такого сигнала"})).status_code == 404


async def test_stale_and_archived_decisions_blocked(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    run = await _analyze(auth_client, case_id)
    sale_signal = next(s for s in run["signals"] if s["rule"] == "sale-income-gap")
    sale_fact = next(f for f in sale_signal["evidence"] if f["field"] == "sale_amount")

    # правка факта → stale → 409 на решения
    await auth_client.patch(f"/api/facts/{sale_fact['id']}", json={"value": "900000"})
    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    assert detail["stale"] is True
    resp = await auth_client.post(
        f"/api/signals/{sale_signal['id']}/decisions",
        json={"status": "resolved", "comment": "Поздно: снимок уже устарел."},
    )
    assert resp.status_code == 409 and "повторный" in resp.json()["detail"]

    # повторный анализ → старый сигнал «архивный» → 409
    rerun = await _analyze(auth_client, case_id)
    assert {s["rule"] for s in rerun["signals"]} == {"obligation-balance"}  # sale покрыт 900000
    resp = await auth_client.post(
        f"/api/signals/{sale_signal['id']}/decisions",
        json={"status": "resolved", "comment": "Решение по архивному запуску."},
    )
    assert resp.status_code == 409 and "Архивный" in resp.json()["detail"]

    # evidence — слепок: архивный сигнал хранит старое значение 1450000
    detail = (await auth_client.get(f"/api/cases/{case_id}")).json()
    archived = next(s for s in detail["runs"][1]["signals"] if s["id"] == sale_signal["id"])
    assert next(f for f in archived["evidence"] if f["field"] == "sale_amount")["value"] == "1450000"


# --- report --------------------------------------------------------------


async def test_report_structure_and_404(auth_client):
    case_id = await _create_case(auth_client)
    await _demo(auth_client, case_id)
    await _analyze(auth_client, case_id)

    resp = await auth_client.get(f"/api/cases/{case_id}/report")
    assert resp.status_code == 200
    report = resp.json()
    assert report["case"]["number"].startswith("PR-2025-")
    assert report["latest_run"]["input_hash"] and report["signals_total"] == 2
    assert report["latest_run"]["signals"][0]["rule"]
    assert report["limitations"]
    assert (await auth_client.get(f"/api/cases/{uuid.uuid4()}/report")).status_code == 404
