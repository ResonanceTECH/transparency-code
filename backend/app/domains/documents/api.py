"""Documents domain API — загрузка, скачивание, факты (SPEC.md §5.4–5.5).

Роутер защищён `get_current_user` на уровне include_router (main.py).
"""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.cases import services as cases_services
from app.domains.documents import services
from app.domains.documents.schemas import DocumentOut, FactOut, FactPatchIn
from app.domains.documents.services import serialize_document, serialize_fact
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User

router = APIRouter(tags=["documents"])

_NOT_FOUND = {404: {"model": ErrorOut, "description": "Дело/документ/поле не найдено или чужое"}}


@router.post(
    "/cases/{case_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузить документ",
    description=(
        "Multipart-поле `file`: .json/.xlsx/.pdf/.docx, ≤ 5 МБ. "
        "Извлечение синхронное: `ready`/`failed` + факты. "
        "Повтор того же sha256 в деле возвращает существующий документ."
    ),
    responses={**_NOT_FOUND, 413: {"model": ErrorOut, "description": "Файл больше лимита"},
               415: {"model": ErrorOut, "description": "Неподдерживаемый тип"},
               422: {"model": ErrorOut, "description": "Пустой/битый файл"}},
)
async def upload_document(
    case_id: uuid.UUID,
    response: Response,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DocumentOut:
    case = await cases_services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    doc, created = await services.upload_document(db, case, file, settings, author=user.username)
    await db.commit()
    if not created:
        response.status_code = status.HTTP_200_OK  # дедуп по sha256 — документ уже есть
    return serialize_document(doc)


@router.get(
    "/cases/{case_id}/documents/{doc_id}",
    summary="Скачать документ",
    description="Исходный файл вложения; `404` — нет файла или `downloadable=false`.",
    responses=_NOT_FOUND,
    response_class=FileResponse,
)
async def download_document(
    case_id: uuid.UUID,
    doc_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    found = await services.get_document_file(db, user, case_id, doc_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден")
    doc, path = found
    return FileResponse(
        path,
        filename=doc.filename,
        media_type=doc.mime or "application/octet-stream",
    )


@router.patch(
    "/facts/{fact_id}",
    response_model=FactOut,
    summary="Уточнить поле",
    description="Частичное обновление извлечённого поля; меняет input_hash → stale у анализов.",
    responses=_NOT_FOUND,
)
async def patch_fact(
    fact_id: uuid.UUID,
    payload: FactPatchIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FactOut:
    fact = await services.patch_fact(db, user, fact_id, payload)
    if fact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Поле не найдено")
    await db.commit()
    return serialize_fact(fact)


@router.post(
    "/cases/{case_id}/confirm-facts",
    summary="Подтвердить все поля",
    description="`confirmed=true` всем неподтверждённым фактам дела; ответ `{\"confirmed\": N}`.",
    responses=_NOT_FOUND,
)
async def confirm_facts(
    case_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    case = await cases_services.get_owned_case(db, user, case_id)
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дело не найдено")
    confirmed = await services.confirm_case_facts(db, case, author=user.username)
    await db.commit()
    return {"confirmed": confirmed}
