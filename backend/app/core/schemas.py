"""Общие схемы shared kernel — единый формат ошибок API (SPEC.md §3)."""

from pydantic import BaseModel


class ErrorOut(BaseModel):
    """`{"detail": "..."}` — ответ любой ошибки 4xx/5xx."""

    detail: str
