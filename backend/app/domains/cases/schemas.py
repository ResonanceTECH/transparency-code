"""Pydantic-схемы cases-домена: реестр и карточка дела (SPEC.md §5.3)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.domains.analysis.schemas import RunOut
from app.domains.cases.models import Basis
from app.domains.documents.schemas import DocumentOut, FactOut

CaseStatus = Literal["draft", "attention", "completed"]


class EventOut(BaseModel):
    id: uuid.UUID
    message: str
    created_at: datetime
    author: str


class CaseSummaryOut(BaseModel):
    """Строка реестра дел; `status`/`stale`/счётчики — вычисляемые (SPEC.md §7)."""

    id: uuid.UUID
    number: str
    name: str
    department: str
    basis: str
    year: int
    created_at: datetime
    signals_count: int
    pending_count: int
    status: CaseStatus
    stale: bool


class CaseDetailOut(CaseSummaryOut):
    """Карточка дела: summary + факты, документы, запуски анализа и события."""

    facts: list[FactOut]
    documents: list[DocumentOut]
    runs: list[RunOut]
    events: list[EventOut]


class CaseCreateIn(BaseModel):
    """Тело `POST /cases` — создание дела (SPEC.md §5.3)."""

    synthetic: bool
    name: str = Field(min_length=2, max_length=200)
    department: str = Field(default="", max_length=200)
    basis: Basis
    year: int = Field(ge=2000, le=2100)

    @field_validator("synthetic")
    @classmethod
    def _synthetic_only(cls, value: bool) -> bool:
        if not value:
            raise ValueError("synthetic=false не поддерживается: только синтетический контур")
        return value
