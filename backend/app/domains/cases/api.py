"""Cases domain API — реестр и карточка дел проверок (SPEC.md §5.3).

Роутер уже защищён `get_current_user` на уровне include_router (main.py);
`user` в сигнатурах нужен для owner-изоляции и автора событий.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.cases import services
from app.domains.cases.schemas import CaseCreateIn, CaseDetailOut, CaseSummaryOut
from app.domains.documents.demo import apply_demo_kit
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User

router = APIRouter(tags=["cases"])

_NOT_FOUND = {404: {"model": ErrorOut, "description": "Дело не найдено или чужое"}}


@router.get(
    "/cases",
    response_model=list[CaseSummaryOut],
    summary="Реестр дел",
    description="Дела текущего пользователя, `created_at DESC`; статус/stale вычисляются.",
)
async def list_cases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CaseSummaryOut]:
    return await services.list_cases(db, user)


@router.post(
    "/cases",
    response_model=CaseSummaryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Создать дело",
    description="Номер `PR-<year>-<seq:04d>` генерирует сервер; `synthetic` обязан быть `true`.",
)
async def create_case(
    payload: CaseCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseSummaryOut:
    summary = await services.create_case(db, user, payload)
    await db.commit()
    return summary


@router.get(
    "/cases/{case_id}",
    response_model=CaseDetailOut,
    summary="Карточка дела",
    description="Summary + факты, документы, запуски анализа (с сигналами и решениями), события.",
    responses=_NOT_FOUND,
)
async def get_case(
    case_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseDetailOut:
    detail = await services.get_case_detail(db, user, case_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено"
        )
    return detail


@router.post(
    "/cases/{case_id}/demo",
    response_model=CaseDetailOut,
    summary="Добавить учебный комплект",
    description=(
        "Сидированные документы и поля по сценариям `trade_in`/`apartment`; "
        "`clean=true` — комплект без нарушений. Документы `downloadable=false`."
    ),
    responses={**_NOT_FOUND, 422: {"model": ErrorOut, "description": "Неизвестный kind"}},
)
async def load_demo(
    case_id: uuid.UUID,
    kind: str = "trade_in",
    clean: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseDetailOut:
    case = await services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    await demo_services.load_demo(db, case, kind=kind, clean=clean, author=user.username)
    await db.commit()
    detail = await services.get_case_detail(db, user, case_id)
    assert detail is not None
    return detail


@router.post(
    "/cases/{case_id}/demo",
    response_model=CaseDetailOut,
    summary="Наполнить демо-комплектом",
    description=(
        "Учебные «документы» и факты сценария `kind` (`trade_in`/`apartment`); "
        "`clean=true` — комплект без расхождений. Повторное наполнение "
        "идемпотентно (дедупликация по sha256 документа)."
    ),
    responses={**_NOT_FOUND, 422: {"model": ErrorOut, "description": "Неизвестный kind"}},
)
async def load_demo_kit(
    case_id: uuid.UUID,
    kind: Literal["trade_in", "apartment"] = Query(default="trade_in"),
    clean: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CaseDetailOut:
    case = await services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено"
        )
    await apply_demo_kit(db, case, kind=kind, clean=clean, author=user.username)
    await db.commit()
    detail = await services.get_case_detail(db, user, case_id)
    assert detail is not None
    return detail
