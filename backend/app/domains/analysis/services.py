"""Analysis services: снапшот входа, `input_hash`, запуски, решения (SPEC.md §5.6–5.7, §7.5–7.6).

Сервисы не коммитят транзакцию — это делает api-слой.
"""

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.analysis.models import (
    AnalysisRun,
    Decision,
    DecisionStatus,
    Signal,
    SignalFact,
    SignalStatus,
)
from app.domains.analysis.rules import RULES, RULES_BY_ID, RuleContext
from app.domains.analysis.schemas import DecisionIn, DecisionOut, RunOut, SignalOut
from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.documents.models import Fact
from app.domains.documents.schemas import FactOut
from app.domains.documents.services import serialize_fact
from app.domains.identity.models import User


def compute_input_hash(*, basis: str, year: int, name: str, facts: list[dict[str, Any]]) -> str:
    """SHA-256 канонического снапшота входа анализа.

    `facts` — список сериализованных `FactOut` (`model_dump(mode="json")`);
    внутри сортируются по `id` — порядок выборки из БД не влияет на hash.
    """
    payload = {
        "case": {"basis": basis, "year": year, "name": name},
        "facts": sorted(facts, key=lambda f: f["id"]),
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _utc(dt: datetime | None) -> datetime:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt  # type: ignore[return-value]


async def _case_facts(db: AsyncSession, case: Case) -> list[Fact]:
    return list(
        (
            await db.scalars(
                select(Fact).where(Fact.case_id == case.id).options(selectinload(Fact.document))
            )
        ).all()
    )


def _fact_dicts(facts: list[Fact]) -> list[dict[str, Any]]:
    return [serialize_fact(f).model_dump(mode="json") for f in facts]


async def current_input_hash(db: AsyncSession, case: Case) -> str:
    """Hash текущего снапшота дела — сравнение с `run.input_hash` даёт `stale`."""
    facts = await _case_facts(db, case)
    return compute_input_hash(
        basis=case.basis.value, year=case.year, name=case.name, facts=_fact_dicts(facts)
    )


async def latest_run(db: AsyncSession, case: Case) -> AnalysisRun | None:
    return await db.scalar(
        select(AnalysisRun)
        .where(AnalysisRun.case_id == case.id)
        .order_by(AnalysisRun.created_at.desc(), AnalysisRun.id.desc())
        .limit(1)
    )


def list_rules() -> list[dict[str, str]]:
    """Реестр `GET /rules` — порядок стабилен (SPEC.md §5.6)."""
    return [{"id": r.id, "title": r.title, "description": r.description} for r in RULES]


def known_rule_ids() -> set[str]:
    return set(RULES_BY_ID)


async def run_analysis(
    db: AsyncSession, case: Case, enabled_rules: list[str], author: str, rule_version: str
) -> RunOut:
    """`POST /cases/{id}/analysis-runs`: снапшот → правила → сигналы (SPEC.md §5.6, §7.5).

    `RunOut` собирается из созданных объектов без lazy-загрузки связей
    (async-SQLAlchemy не позволяет lazy-атрибуты вне загрузчиков).
    """
    facts = await _case_facts(db, case)
    fact_dicts = _fact_dicts(facts)
    run = AnalysisRun(
        case_id=case.id,
        rule_version=rule_version,
        enabled_rules=list(enabled_rules),
        input_hash=compute_input_hash(
            basis=case.basis.value, year=case.year, name=case.name, facts=fact_dicts
        ),
        author=author,
    )
    unconfirmed = sum(1 for f in facts if not f.confirmed)
    if unconfirmed:
        run.warnings = [
            f"Есть неподтверждённые поля: {unconfirmed}. Анализ выполнен по текущему снимку сведений."
        ]
    db.add(run)
    await db.flush()

    ctx = RuleContext(
        case={"basis": case.basis.value, "year": case.year, "name": case.name},
        facts=fact_dicts,
    )
    fact_by_id = {str(f.id): f for f in facts}
    dict_by_id = {f["id"]: f for f in fact_dicts}
    signal_outs: list[SignalOut] = []
    for rule_id in enabled_rules:
        rule = RULES_BY_ID[rule_id]
        for candidate in rule.evaluate(ctx):
            snapshots = [
                dict_by_id[fact_id]
                for fact_id in candidate.evidence_fact_ids
                if fact_id in fact_by_id
            ]
            signal = Signal(
                run_id=run.id,
                case_id=case.id,
                rule_id=rule.id,
                title=candidate.title,
                explanation=candidate.explanation,
                action=candidate.action,
                status=SignalStatus.UNREVIEWED,
                sort=candidate.sort,
            )
            db.add(signal)
            await db.flush()
            for ordinal, snapshot in enumerate(snapshots):
                db.add(
                    SignalFact(
                        signal_id=signal.id,
                        fact_id=uuid.UUID(snapshot["id"]),
                        ordinal=ordinal,
                        fact_snapshot=snapshot,
                    )
                )
            signal_outs.append(
                SignalOut(
                    id=signal.id,
                    run_id=run.id,
                    rule=rule.id,
                    title=candidate.title,
                    explanation=candidate.explanation,
                    action=candidate.action,
                    evidence=[FactOut(**snap) for snap in snapshots],
                    status=SignalStatus.UNREVIEWED.value,
                    decisions=[],
                )
            )
    await db.flush()

    record_event(db, case, f"Анализ выполнен: {len(signal_outs)} сигналов", author=author)
    return RunOut(
        id=run.id,
        created_at=_utc(run.created_at) or datetime.now(UTC),
        rule_version=run.rule_version,
        enabled_rules=list(enabled_rules),
        input_hash=run.input_hash,
        warnings=list(run.warnings or []),
        signals=signal_outs,
    )


async def add_decision(
    db: AsyncSession, user: User, signal_id: uuid.UUID, payload: DecisionIn
) -> tuple[Decision | None, str | None]:
    """`POST /signals/{id}/decisions`: решение специалиста (SPEC.md §5.7).

    Возвращает `(decision, None)` либо `(None, код_ошибки)`:
    `not_found` → 404; `archived`/`stale` → 409.
    """
    signal = await db.scalar(
        select(Signal).where(Signal.id == signal_id).options(selectinload(Signal.run))
    )
    if signal is None:
        return None, "not_found"
    case = await db.scalar(select(Case).where(Case.id == signal.case_id))
    if case is None or case.owner_id != user.id:
        return None, "not_found"
    latest = await latest_run(db, case)
    if latest is None or signal.run_id != latest.id:
        return None, "archived"
    if (await current_input_hash(db, case)) != latest.input_hash:
        return None, "stale"
    decision = Decision(
        signal_id=signal.id,
        status=DecisionStatus(payload.status),
        comment=payload.comment,
        author=user.username,
    )
    db.add(decision)
    signal.status = SignalStatus(payload.status)
    record_event(
        db,
        case,
        f"{payload.status}: {signal.rule_id}. Комментарий: {payload.comment}",
        author=user.username,
    )
    await db.flush()
    return decision, None
