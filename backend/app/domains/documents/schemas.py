"""Pydantic-схемы documents-домена: DTO документов и извлечённых фактов (SPEC.md §4–5)."""

import uuid
from datetime import date

from pydantic import BaseModel


class DocumentOut(BaseModel):
    """Метаданные документа в API; `name` ← `documents.filename`."""

    id: uuid.UUID
    name: str
    sha256: str
    status: str
    error: str | None
    downloadable: bool


class FactOut(BaseModel):
    """Извлечённое поле документа — единый формат для `facts[]` и `evidence[]`."""

    id: uuid.UUID
    document_id: uuid.UUID | None
    document_name: str
    field: str
    label: str
    value: str
    object_id: str
    date: date | None
    unit: str
    snippet: str
    confirmed: bool
