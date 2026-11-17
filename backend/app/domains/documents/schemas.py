"""Pydantic-схемы documents-домена: документы, факты, патч (SPEC.md §5.4–5.5)."""

from datetime import date as date_type
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: UUID
    name: str
    sha256: str
    status: str
    error: str | None
    downloadable: bool


class FactOut(BaseModel):
    id: UUID
    document_id: UUID
    document_name: str
    field: str
    label: str
    value: str
    object_id: str
    date: date_type | None
    unit: str
    snippet: str
    confirmed: bool


class FactPatchIn(BaseModel):
    """Тело `PATCH /facts/{id}` — все поля опциональны, меняются только переданные."""

    value: str | None = Field(default=None, min_length=1, max_length=300)
    date: date_type | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    confirmed: bool | None = None
