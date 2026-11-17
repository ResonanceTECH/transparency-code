"""Smoke-тест схемы на SQLite: create_all + граф дело→документ→факт→запуск→сигнал→решение."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.domains.analysis.models import (
    AnalysisRun,
    Decision,
    DecisionStatus,
    Signal,
    SignalFact,
    SignalStatus,
)
from app.domains.cases.models import Basis, Case
from app.domains.documents.models import Document, DocumentStatus, Fact
from app.domains.identity.models import User


@pytest.fixture
async def session(db_session):
    yield db_session


async def test_full_graph(session):
    user = User(username="demo", password_hash="hash", display_name="Демо")
    session.add(user)
    await session.flush()

    case = Case(
        number="PR-2026-0001",
        owner_id=user.id,
        name="Тестовое дело",
        department="Учебное подразделение",
        basis=Basis.CANDIDATE,
        year=2025,
    )
    doc = Document(
        case=case,
        filename="facts.json",
        sha256="ab" * 32,
        status=DocumentStatus.READY,
        downloadable=False,
    )
    fact = Fact(
        case=case,
        document=doc,
        field="sale_amount",
        label="Доход от продажи",
        value="1450000",
        object_id="car-1",
        unit="RUB",
        confirmed=True,
    )
    run = AnalysisRun(
        case=case,
        rule_version="0.1.0",
        enabled_rules=["sale-income-gap"],
        input_hash="cd" * 32,
        warnings=["есть неподтверждённые поля"],
        author="demo",
    )
    signal = Signal(
        run=run,
        case=case,
        rule_id="sale-income-gap",
        title="Возможный пропуск дохода от продажи",
        explanation="…",
        action="…",
        status=SignalStatus.UNREVIEWED,
        evidence_links=[SignalFact(fact=fact, ordinal=0)],
    )
    session.add_all([case, run])
    await session.commit()

    decision = Decision(
        signal=signal, status=DecisionStatus.CLARIFICATION, comment="Нужно уточнение", author="demo"
    )
    session.add(decision)
    await session.commit()

    loaded = await session.scalar(
        select(Case)
        .where(Case.number == "PR-2026-0001")
        .options(
            selectinload(Case.owner),
            selectinload(Case.facts).selectinload(Fact.document),
            selectinload(Case.runs)
            .selectinload(AnalysisRun.signals)
            .selectinload(Signal.evidence_links)
            .selectinload(SignalFact.fact),
            selectinload(Case.runs)
            .selectinload(AnalysisRun.signals)
            .selectinload(Signal.decisions),
        )
    )
    assert loaded is not None and loaded.owner.username == "demo"
    assert loaded.facts[0].document.filename == "facts.json"
    assert loaded.runs[0].signals[0].evidence_links[0].fact.value == "1450000"
    assert loaded.runs[0].signals[0].decisions[0].status == DecisionStatus.CLARIFICATION
    assert loaded.runs[0].enabled_rules == ["sale-income-gap"]
