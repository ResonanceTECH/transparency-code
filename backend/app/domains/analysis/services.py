"""Analysis services: input_hash, запуск правил, решения (SPEC.md §7.5–7.6).

Сервисы не коммитят транзакцию — это делает api-слой.
"""

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
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
from app.domains.analysis.rules import RULES, RULES_BY_ID, RULE_VERSION, AnalysisContext
from app.domains.analysis.schemas import AnalysisRunIn, DecisionIn, DecisionOut
from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.documents.models import Fact
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
    """Naive datetime из SQLite → UTC-aware."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt  # type: ignore[return-value]


async def _case_facts(db: AsyncSession, case: Case) -> list[Fact]:
    return list(
        (
            await db.scalars(
                select(Fact)
                .where(Fact.case_id == case.id)
                .options(selectinload(Fact.document))
                .order_by(Fact.created_at, Fact.id)
            )
        ).all()
    )


def _fact_dicts(facts: list[Fact]) -> list[dict[str, Any]]:
    return [serialize_fact(f).model_dump(mode="json") for f in facts]


async def current_input_hash(db: AsyncSession, case: Case) -> str:
    """Hash текущего состояния дела — для проверок `stale` (SPEC.md §7.2)."""
    return compute_input_hash(
        basis=case.basis.value,
        year=case.year,
        name=case.name,
        facts=_fact_dicts(await _case_facts(db, case)),
    )


async def run_analysis(
    db: AsyncSession, case: Case, payload: AnalysisRunIn, author: str
) -> AnalysisRun:
    """Запуск выбранных правил → AnalysisRun + сигналы со слепками (SPEC.md §7.5).

    Старые запуски не трогаем — каждый запуск иммутабелен.
    """
    unknown = [rid for rid in payload.enabled_rules if rid not in RULES_BY_ID]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Неизвестные правила: {', '.join(unknown)}",
        )

    facts = await _case_facts(db, case)
    fact_dicts = _fact_dicts(facts)
    by_id = {f["id"]: f for f in fact_dicts}
    ctx = AnalysisContext(
        basis=case.basis.value, year=case.year, name=case.name, facts=tuple(fact_dicts)
    )
    input_hash = compute_input_hash(
        basis=ctx.basis, year=ctx.year, name=ctx.name, facts=fact_dicts
    )

    warnings: list[str] = []
    unconfirmed = sum(1 for f in facts if not f.confirmed)
    if unconfirmed:
        warnings.append(f"Есть неподтверждённые поля: {unconfirmed}")

    run = AnalysisRun(
        case_id=case.id,
        rule_version=RULE_VERSION,
        enabled_rules=list(payload.enabled_rules),
        input_hash=input_hash,
        warnings=warnings,
        author=author,
    )
    db.add(run)
    await db.flush()

    total = 0
    for rule_id in payload.enabled_rules:
        for candidate in RULES_BY_ID[rule_id].evaluate(ctx):
            signal = Signal(
                run_id=run.id,
                case_id=case.id,
                rule_id=candidate.rule_id,
                title=candidate.title,
                explanation=candidate.explanation,
                action=candidate.action,
                sort=candidate.sort,
            )
            db.add(signal)
            await db.flush()
            for ordinal, fact_id in enumerate(candidate.evidence_fact_ids):
                snapshot = by_id.get(str(fact_id))
                if snapshot is None:
                    continue
                db.add(
                    SignalFact(
                        signal_id=signal.id,
                        fact_id=uuid.UUID(str(fact_id)),
                        ordinal=ordinal,
                        fact_snapshot=snapshot,
                    )
                )
            total += 1

    record_event(db, case, f"Анализ выполнен: {total} сигналов", author=author)
    await db.refresh(run, attribute_names=["signals"])
    return run


_STATUS_LABELS = {
    DecisionStatus.CLARIFICATION: "Запрошено уточнение",
    DecisionStatus.RESOLVED: "Согласовано",
    DecisionStatus.FURTHER_REVIEW: "Направлено на дополнительную проверку",
}


async def add_decision(
    db: AsyncSession, user: User, signal_id: uuid.UUID, payload: DecisionIn
) -> Decision | None:
    """Решение специалиста; `None` — нет сигнала/чужое (→ 404).

    `409` — сигнал из архивного (не последнего) запуска или дело stale (SPEC.md §5.7).
    """
    signal = await db.scalar(
        select(Signal)
        .options(selectinload(Signal.run), selectinload(Signal.case))
        .where(Signal.id == signal_id)
    )
    if signal is None or signal.case is None or signal.case.owner_id != user.id:
        return None

    latest_run_id = await db.scalar(
        select(AnalysisRun.id)
        .where(AnalysisRun.case_id == signal.case_id)
        .order_by(AnalysisRun.created_at.desc(), AnalysisRun.id.desc())
        .limit(1)
    )
    if signal.run_id != latest_run_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Архивный запуск только для просмотра — решения недоступны",
        )
    if await current_input_hash(db, signal.case) != signal.run.input_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Сведения изменились после анализа — нужен повторный запуск",
        )

    decision = Decision(
        signal_id=signal.id,
        status=DecisionStatus(payload.status),
        comment=payload.comment,
        author=user.username,
    )
    db.add(decision)
    signal.status = SignalStatus(payload.status)
    label = _STATUS_LABELS[decision.status]
    record_event(
        db,
        signal.case,
        f"{label}: {signal.rule_id}. Комментарий: {payload.comment[:120]}",
        author=user.username,
    )
    await db.flush()
    return decision


def serialize_decision(decision: Decision) -> DecisionOut:
    return DecisionOut(
        id=decision.id,
        status=decision.status.value,
        comment=decision.comment,
        created_at=_utc(decision.created_at),
        author=decision.author,
    )
