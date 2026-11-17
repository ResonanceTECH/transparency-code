"""Documents services: приём файлов, pipeline извлечения, факты (SPEC.md §5.4–5.5, §7.4).

Сервисы не коммитят транзакцию — это делает api-слой.
"""

import hashlib
import logging
import re
from datetime import date
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.documents.models import Document, DocumentStatus, Fact
from app.domains.documents.pipeline import (
    ALLOWED_EXTENSIONS,
    ExtractionError,
    extract_facts,
    fact_label,
)
from app.domains.documents.schemas import DocumentOut, FactOut, FactPatchIn
from app.domains.identity.models import User


def serialize_fact(fact: Fact) -> FactOut:
    """Fact → FactOut. Требует загруженной связи `fact.document` (selectinload)."""
    return FactOut(
        id=fact.id,
        document_id=fact.document_id,
        document_name=fact.document.filename if fact.document else "",
        field=fact.field,
        label=fact.label,
        value=fact.value,
        object_id=fact.object_id,
        date=fact.fact_date,
        unit=fact.unit,
        snippet=fact.snippet,
        confirmed=fact.confirmed,
    )


def serialize_document(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        name=document.filename,
        sha256=document.sha256,
        status=document.status.value,
        error=document.error,
        downloadable=document.downloadable,
    )

logger = logging.getLogger(__name__)

_SAFE_NAME_RE = re.compile(r"[^\w.\- ()\[\]А-Яа-яЁё]+", re.UNICODE)


def _safe_filename(name: str) -> str:
    """basename без path traversal и опасных символов."""
    base = Path(name or "document").name
    cleaned = _SAFE_NAME_RE.sub("_", base).strip("._ ") or "document"
    return cleaned[:200]


def _storage_path(settings: Settings, case_id, doc_id, filename: str) -> Path:
    path = Path(settings.upload_dir) / "cases" / str(case_id) / f"{doc_id}_{filename}"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


async def upload_document(
    db: AsyncSession, case: Case, upload: UploadFile, settings: Settings, author: str
) -> tuple[Document, bool]:
    """Загрузить и обработать документ → (документ, создан_ли_новый).

    Дедупликация по sha256 внутри дела возвращает существующий документ.
    """
    filename = _safe_filename(upload.filename or "document")
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Неподдерживаемый тип файла. Допустимо: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Пустой файл")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл больше {settings.max_upload_mb} МБ",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    existing = await db.scalar(
        select(Document).where(Document.case_id == case.id, Document.sha256 == sha256)
    )
    if existing is not None:
        return existing, False  # дедупликация по sha256 внутри дела (SPEC.md §7.4)

    doc = Document(
        case_id=case.id,
        filename=filename,
        sha256=sha256,
        mime=upload.content_type or "application/octet-stream",
        size_bytes=len(content),
        status=DocumentStatus.RECEIVED,
    )
    db.add(doc)
    await db.flush()  # id для имени файла и связей

    path = _storage_path(settings, case.id, doc.id, filename)
    path.write_bytes(content)
    doc.storage_key = str(path)

    record_event(db, case, f"Документ загружен: {filename}", author=author)
    await _extract(db, case, doc, content, filename, author)
    return doc, True


async def _extract(
    db: AsyncSession, case: Case, doc: Document, content: bytes, filename: str, author: str
) -> None:
    """Конвейер извлечения: processing → ready/failed + факты (SPEC.md §7.4)."""
    doc.status = DocumentStatus.PROCESSING
    try:
        raw_facts = extract_facts(filename, content)
    except ExtractionError as exc:
        doc.status = DocumentStatus.FAILED
        doc.error = str(exc)
        record_event(db, case, f"Документ не распознан: {filename}", author=author)
        return
    for raw in raw_facts:
        fact_date: date | None = None
        if raw.get("date"):
            try:
                fact_date = date.fromisoformat(str(raw["date"]))
            except ValueError:
                fact_date = None
        db.add(
            Fact(
                case_id=case.id,
                document_id=doc.id,
                field=raw["field"],
                label=fact_label(raw["field"], raw.get("label") or None),
                value=raw["value"],
                object_id=raw.get("object_id", ""),
                fact_date=fact_date,
                unit=raw.get("unit", ""),
                snippet=raw.get("snippet", ""),
                confirmed=False,
            )
        )
    doc.status = DocumentStatus.READY
    doc.error = None
    record_event(
        db, case, f"Документ обработан: {filename} — {len(raw_facts)} полей", author=author
    )


async def patch_fact(
    db: AsyncSession, user: User, fact_id, payload: FactPatchIn
) -> Fact | None:
    """`PATCH /facts/{id}`: частичное обновление + событие (SPEC.md §5.5).

    `None` — факт не найден или дело чужое (→ 404).
    """
    fact = await db.scalar(
        select(Fact)
        .join(Fact.case)
        .where(Fact.id == fact_id, Case.owner_id == user.id)
        .options(selectinload(Fact.document), selectinload(Fact.case))
    )
    if fact is None:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "value" in data:
        fact.value = data["value"]
    if "date" in data:
        fact.fact_date = data["date"]
    if "unit" in data:
        fact.unit = data["unit"]
    if "confirmed" in data:
        fact.confirmed = data["confirmed"]
    if fact.case is not None:
        record_event(db, fact.case, f"Поле уточнено: {fact.label}", author=user.username)
    return fact


async def confirm_case_facts(db: AsyncSession, case: Case, author: str) -> int:
    """`POST /cases/{id}/confirm-facts`: confirmed=true всем неподтверждённым (SPEC.md §5.3)."""
    facts = (
        await db.scalars(select(Fact).where(Fact.case_id == case.id, Fact.confirmed.is_(False)))
    ).all()
    for fact in facts:
        fact.confirmed = True
    if facts:
        record_event(db, case, f"Поля подтверждены: {len(facts)}", author=author)
    return len(facts)


async def get_document_file(
    db: AsyncSession, user: User, case_id, doc_id
) -> tuple[Document, Path] | None:
    """Файл для скачивания; `None` — нет доступа/файла (→ 404, SPEC.md §5.4)."""
    doc = await db.scalar(
        select(Document)
        .join(Document.case)
        .where(
            Document.id == doc_id,
            Document.case_id == case_id,
            Case.owner_id == user.id,
        )
    )
    if doc is None or not doc.downloadable or not doc.storage_key:
        return None
    path = Path(doc.storage_key)
    if not path.is_file():
        return None
    return doc, path
