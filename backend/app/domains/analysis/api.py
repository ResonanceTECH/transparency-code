"""Analysis domain API — правила, запуски, решения (SPEC.md §5.6–5.7).

Роутер защищён `get_current_user` на уровне include_router (main.py);
`user` в сигнатурах нужен для owner-изоляции и автора решений.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.analysis import services
from app.domains.analysis.schemas import AnalysisRunIn, DecisionIn, DecisionOut, RunOut
from app.domains.cases import services as cases_services
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User

router = APIRouter(tags=["analysis"])

_NOT_FOUND = {404: {"model": ErrorOut, "description": "Дело/сигнал не найдено или чужое"}}
_CONFLICT = {409: {"model": ErrorOut, "description": "Архивный запуск или устаревший снимок"}}
_VALIDATION = {422: {"model": ErrorOut, "description": "Ошибка валидации"}}


@router.get(
    "/rules",
    summary="Реестр правил проверки",
    description="Стабильный порядок; `id` используется в `enabled_rules` запуска.",
)
async def get_rules() -> dict:
    return {"rules": services.list_rules()}


@router.post(
    "/cases/{case_id}/analysis-runs",
    response_model=RunOut,
    status_code=status.HTTP_201_CREATED,
    summary="Запустить анализ",
    description=(
        "Детерминированный запуск по снимку текущих фактов: `input_hash` фиксирует вход, "
        "сигналы сохраняются с иммутабельными слепками значений-оснований. "
        "Предыдущие запуски не изменяются."
    ),
    responses={**_NOT_FOUND, **_VALIDATION},
)
async def create_analysis_run(
    case_id: uuid.UUID,
    payload: AnalysisRunIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RunOut:
    case = await cases_services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    unknown = sorted(set(payload.enabled_rules) - services.known_rule_ids())
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Неизвестные правила: {', '.join(unknown)}",
        )
    run = await services.run_analysis(
        db,
        case,
        enabled_rules=list(dict.fromkeys(payload.enabled_rules)),
        author=user.username,
        rule_version=settings.rule_version,
    )
    await db.commit()
    return run


@router.post(
    "/signals/{signal_id}/decisions",
    response_model=DecisionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Решение по сигналу",
    description=(
        "Решение специалиста (`clarification`/`resolved`/`further_review`, комментарий ≥ 5). "
        "`409` — сигнал не последнего запуска или снимок устарел (`stale`)."
    ),
    responses={**_NOT_FOUND, **_CONFLICT, **_VALIDATION},
)
async def create_decision(
    signal_id: uuid.UUID,
    payload: DecisionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DecisionOut:
    decision, error = await services.add_decision(db, user, signal_id, payload)
    if error == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сигнал не найден")
    if error == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Архивный запуск доступен только для просмотра",
        )
    if error == "stale":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Сведения изменены после анализа — нужен повторный запуск",
        )
    await db.commit()
    assert decision is not None
    return DecisionOut(
        id=decision.id,
        status=decision.status.value,
        comment=decision.comment,
        created_at=decision.created_at,
        author=decision.author,
    )
