"""Analysis domain API — правила, запуски анализа, решения (SPEC.md §5.6–5.7)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.analysis import services
from app.domains.analysis.rules import RULES
from app.domains.analysis.schemas import (
    AnalysisRunIn,
    DecisionIn,
    DecisionOut,
    RuleOut,
    RulesOut,
    RunOut,
)
from app.domains.cases import services as cases_services
from app.domains.cases.schemas import CaseDetailOut
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User

router = APIRouter(tags=["analysis"])

_NOT_FOUND = {404: {"model": ErrorOut, "description": "Дело/сигнал не найдено или чужое"}}
_CONFLICT = {409: {"model": ErrorOut, "description": "Архивный запуск или устаревшие сведения"}}


@router.get(
    "/rules",
    response_model=RulesOut,
    summary="Реестр правил анализа",
    description="Идентификаторы, названия и описания правил; порядок стабильный.",
)
async def list_rules() -> RulesOut:
    return RulesOut(rules=[RuleOut(id=r.id, title=r.title, description=r.description) for r in RULES])


@router.post(
    "/cases/{case_id}/analysis-runs",
    response_model=RunOut,
    status_code=status.HTTP_201_CREATED,
    summary="Запустить анализ",
    description=(
        "Детерминированный прогон выбранных правил: новый `analysis_runs` + сигналы "
        "со слепками фактов; прежние запуски сохраняются."
    ),
    responses={
        **_NOT_FOUND,
        422: {"model": ErrorOut, "description": "Пустой список или неизвестный id правила"},
    },
)
async def create_analysis_run(
    case_id: uuid.UUID,
    payload: AnalysisRunIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunOut:
    case = await cases_services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    run = await services.run_analysis(db, case, payload, author=user.username)
    await db.commit()
    return cases_services.serialize_run(run)


@router.post(
    "/signals/{signal_id}/decisions",
    response_model=DecisionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Решение по сигналу",
    description=(
        "Append-only решение специалиста; обновляет статус сигнала. "
        "`409` — сигнал из архивного запуска или сведения устарели (stale)."
    ),
    responses={**_NOT_FOUND, **_CONFLICT, 422: {"model": ErrorOut, "description": "comment < 5 симв."}},
)
async def create_decision(
    signal_id: uuid.UUID,
    payload: DecisionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DecisionOut:
    decision = await services.add_decision(db, user, signal_id, payload)
    if decision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сигнал не найден")
    await db.commit()
    return services.serialize_decision(decision)
