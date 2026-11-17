"""Pydantic-схемы отчёта (SPEC.md §5.3): контракт `GET /cases/{id}/report`."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ReportCaseOut(BaseModel):
    number: str
    name: str
    department: str
    basis: str
    year: int
    status: str
    stale: bool


class ReportDecisionOut(BaseModel):
    status: str
    comment: str
    created_at: datetime
    author: str


class ReportSignalOut(BaseModel):
    rule: str
    title: str
    status: str
    explanation: str
    action: str
    decisions: list[ReportDecisionOut]


class ReportRunOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    rule_version: str
    enabled_rules: list[str]
    input_hash: str
    warnings: list[str]
    signals: list[ReportSignalOut]


class ReportDocumentOut(BaseModel):
    name: str
    status: str
    downloadable: bool


class ReportOut(BaseModel):
    """Рабочий документ по делу; клиент сохраняет как `{number}.json`."""

    generated_at: datetime
    synthetic: Literal[True] = True
    case: ReportCaseOut
    latest_run: ReportRunOut | None
    facts_total: int = Field(ge=0)
    facts_confirmed: int = Field(ge=0)
    documents: list[ReportDocumentOut]
    limitations: list[str]
