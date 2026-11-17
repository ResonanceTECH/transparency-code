"""Pydantic-схемы documents-домена: патч фактов и подтверждение (SPEC.md §5.4–5.5)."""

from datetime import date

from pydantic import BaseModel, Field


class FactPatchIn(BaseModel):
    """Тело `PATCH /facts/{id}` — все поля опциональны, меняются только переданные."""

    value: str | None = Field(default=None, min_length=1, max_length=300)
    date: date | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    confirmed: bool | None = None
