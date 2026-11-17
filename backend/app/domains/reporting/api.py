"""Reporting domain API — итоговый отчёт по делу (SPEC.md §5.3).

Роутер защищён `get_current_user` на уровне include_router (main.py).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User
from app.domains.reporting import services

router = APIRouter(tags=["reporting"])


@router.get(
    "/cases/{case_id}/report",
    summary="Рабочий итог по делу",
    description=(
        "JSON отчёта: реквизиты дела, последний запуск (сигналы и решения), "
        "ограничения анализа. Клиент скачивает его как `<number>.json`."
    ),
    responses={404: {"model": ErrorOut, "description": "Дело не найдено или чужое"}},
)
async def get_report(
    case_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    report = await services.build_report(db, user, case_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    return report
