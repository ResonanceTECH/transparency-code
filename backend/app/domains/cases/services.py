"""Cases services: CRUD дел, сборка summary/detail, события, `stale` (SPEC.md §5.3, §7).

Сервисы не коммитят транзакцию — это делает api-слой после успешных мутаций.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.analysis.models import AnalysisRun, Signal, SignalFact, SignalStatus
from app.domains.analysis.schemas import DecisionOut, RunOut, SignalOut
from app.domains.analysis.services import compute_input_hash
from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.cases.schemas import (
    CaseCreateIn,
    CaseDetailOut,
    CaseStatus,
    CaseSummaryOut,
    EventOut,
)
from app.domains.documents.models import Fact
from app.domains.documents.schemas import FactOut
from app.domains.documents.services import serialize_document, serialize_fact
from app.domains.identity.models import User

PENDING_STATUSES = {SignalStatus.UNREVIEWED, SignalStatus.CLARIFICATION, SignalStatus.FURTHER_REVIEW}


async def next_case_number(db: AsyncSession, year: int) -> str:
    """`PR-<year>-<seq:04d>`; seq — порядковый внутри года (SPEC.md §5.3)."""
    count = await db.scalar(select(func.count()).select_from(Case).where(Case.year == year))
    return f"PR-{year}-{(count or 0) + 1:04d}"


def _utc(dt: datetime | None) -> datetime:
    """Naive datetime из SQLite → UTC-aware для единообразной сериализации."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt  # type: ignore[return-value]


def _fact_dicts(facts: list[Fact]) -> list[dict]:
    return [serialize_fact(f).model_dump(mode="json") for f in facts]


def _input_hash(case: Case, facts: list[Fact]) -> str:
    return compute_input_hash(
        basis=case.basis.value,
        year=case.year,
        name=case.name,
        facts=_fact_dicts(facts),
    )


def _summarize(case: Case, run: AnalysisRun | None, signals: list[Signal], stale: bool) -> CaseSummaryOut:
    pending = sum(1 for s in signals if s.status in PENDING_STATUSES)
    status: CaseStatus = (
        "draft" if run is None else "attention" if pending else "completed"
    )
    return CaseSummaryOut(
        id=case.id,
        number=case.number,
        name=case.name,
        department=case.department,
        basis=case.basis.value,
        year=case.year,
        created_at=_utc(case.created_at),
        signals_count=len(signals),
        pending_count=pending,
        status=status,
        stale=stale,
    )


def serialize_signal(signal: Signal) -> SignalOut:
    evidence: list[FactOut] = []
    for link in signal.evidence_links:
        if link.fact_snapshot:
            evidence.append(FactOut(**link.fact_snapshot))
        elif link.fact is not None:
            evidence.append(serialize_fact(link.fact))
    return SignalOut(
        id=signal.id,
        run_id=signal.run_id,
        rule=signal.rule_id,
        title=signal.title,
        explanation=signal.explanation,
        action=signal.action,
        evidence=evidence,
        status=signal.status.value,
        decisions=[
            DecisionOut(
                id=d.id,
                status=d.status.value,
                comment=d.comment,
                created_at=_utc(d.created_at),
                author=d.author,
            )
            for d in signal.decisions
        ],
    )


def serialize_run(run: AnalysisRun) -> RunOut:
    return RunOut(
        id=run.id,
        created_at=_utc(run.created_at),
        rule_version=run.rule_version,
        enabled_rules=list(run.enabled_rules or []),
        input_hash=run.input_hash,
        warnings=list(run.warnings or []),
        signals=[serialize_signal(s) for s in run.signals],
    )


async def _metrics_by_case(
    db: AsyncSession, cases: list[Case]
) -> dict[uuid.UUID, tuple[AnalysisRun | None, list[Signal], bool]]:
    """Последний запуск + его сигналы + stale для каждого дела (SPEC.md §7.1–7.2)."""
    case_ids = [c.id for c in cases]
    if not case_ids:
        return {}
    runs = (
        await db.scalars(
            select(AnalysisRun)
            .where(AnalysisRun.case_id.in_(case_ids))
            .order_by(AnalysisRun.created_at.desc(), AnalysisRun.id.desc())
        )
    ).all()
    latest: dict[uuid.UUID, AnalysisRun] = {}
    for run in runs:
        latest.setdefault(run.case_id, run)  # первый в desc-выборке — последний
    run_ids = [r.id for r in latest.values()]
    signals = (
        (await db.scalars(select(Signal).where(Signal.run_id.in_(run_ids)))).all()
        if run_ids
        else []
    )
    signals_by_run: dict[uuid.UUID, list[Signal]] = {}
    for s in signals:
        signals_by_run.setdefault(s.run_id, []).append(s)
    facts = (
        await db.scalars(
            select(Fact)
            .where(Fact.case_id.in_(case_ids))
            .options(selectinload(Fact.document))
        )
    ).all()
    facts_by_case: dict[uuid.UUID, list[Fact]] = {}
    for f in facts:
        facts_by_case.setdefault(f.case_id, []).append(f)
    metrics: dict[uuid.UUID, tuple[AnalysisRun | None, list[Signal], bool]] = {}
    for case in cases:
        run = latest.get(case.id)
        case_signals = signals_by_run.get(run.id, []) if run else []
        stale = run is not None and _input_hash(case, facts_by_case.get(case.id, [])) != run.input_hash
        metrics[case.id] = (run, case_signals, stale)
    return metrics


async def list_cases(db: AsyncSession, user: User) -> list[CaseSummaryOut]:
    """Реестр дел пользователя, `created_at DESC` (SPEC.md §5.3)."""
    cases = (
        await db.scalars(
            select(Case)
            .where(Case.owner_id == user.id)
            .order_by(Case.created_at.desc(), Case.id.desc())
        )
    ).all()
    metrics = await _metrics_by_case(db, list(cases))
    return [
        _summarize(c, *metrics[c.id]) for c in cases
    ]


async def create_case(db: AsyncSession, user: User, payload: CaseCreateIn) -> CaseSummaryOut:
    """Создание дела + событие; номер `PR-<year>-<seq>` (SPEC.md §5.3)."""
    case = Case(
        number=await next_case_number(db, payload.year),
        owner_id=user.id,
        name=payload.name,
        department=payload.department or "Учебное подразделение",
        basis=payload.basis,
        year=payload.year,
    )
    db.add(case)
    await db.flush()  # id/created_at для события и ответа
    record_event(db, case, f"Дело создано: {case.name}", author=user.username)
    return _summarize(case, None, [], stale=False)


_CASE_DETAIL_OPTIONS = (
    selectinload(Case.facts).selectinload(Fact.document),
    selectinload(Case.documents),
    selectinload(Case.events),
    selectinload(Case.runs)
    .selectinload(AnalysisRun.signals)
    .selectinload(Signal.evidence_links)
    .selectinload(SignalFact.fact)
    .selectinload(Fact.document),
    selectinload(Case.runs)
    .selectinload(AnalysisRun.signals)
    .selectinload(Signal.decisions),
)


async def get_owned_case(db: AsyncSession, user: User, case_id: uuid.UUID) -> Case | None:
    """Дело пользователя или None — seam для других доменов (MICROSERVICES.md §5)."""
    return await db.scalar(
        select(Case).where(Case.id == case_id, Case.owner_id == user.id)
    )


async def get_case_detail(db: AsyncSession, user: User, case_id: uuid.UUID) -> CaseDetailOut | None:
    """Полная карточка дела; `None` — нет дела или чужое (→ 404, SPEC.md §5.3)."""
    case = await db.scalar(
        select(Case)
        .where(Case.id == case_id, Case.owner_id == user.id)
        .options(*_CASE_DETAIL_OPTIONS)
    )
    if case is None:
        return None
    run, signals, stale = (await _metrics_by_case(db, [case]))[case.id]
    facts = sorted(case.facts, key=lambda f: (_utc(f.created_at), str(f.id)))
    documents = sorted(case.documents, key=lambda d: (_utc(d.created_at), str(d.id)))
    events = sorted(case.events, key=lambda e: (_utc(e.created_at), str(e.id)))
    return CaseDetailOut(
        **_summarize(case, run, signals, stale).model_dump(),
        facts=[serialize_fact(f) for f in facts],
        documents=[serialize_document(d) for d in documents],
        runs=[serialize_run(r) for r in case.runs],
        events=[
            EventOut(
                id=e.id,
                message=e.message,
                created_at=_utc(e.created_at),
                author=e.author,
            )
            for e in events
        ],
    )
