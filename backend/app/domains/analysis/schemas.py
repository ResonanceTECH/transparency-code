"""Pydantic-схемы analysis-домена: запуски, сигналы, решения (SPEC.md §5.6–5.7)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domains.documents.schemas import FactOut


class DecisionOut(BaseModel):
    id: uuid.UUID
    status: str
    comment: str
    created_at: datetime
    author: str


class SignalOut(BaseModel):
    """Сигнал анализа; `rule` в API ← `signals.rule_id`, `evidence` — слепки фактов."""

    id: uuid.UUID
    run_id: uuid.UUID
    rule: str
    title: str
    explanation: str
    action: str
    evidence: list[FactOut]
    status: str
    decisions: list[DecisionOut]


class RunOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    rule_version: str
    enabled_rules: list[str]
    input_hash: str
    warnings: list[str]
    signals: list[SignalOut]


class RuleOut(BaseModel):
    """Правило реестра для страницы «Правила проверки»."""

    id: str
    title: str
    description: str


class RulesOut(BaseModel):
    rules: list[RuleOut]


class AnalysisRunIn(BaseModel):
    """Тело `POST /cases/{id}/analysis-runs`."""

    enabled_rules: list[str] = Field(min_length=1)


class DecisionIn(BaseModel):
    """Тело `POST /signals/{id}/decisions` (SPEC.md §5.7)."""

    status: Literal["clarification", "resolved", "further_review"]
    comment: str = Field(min_length=5, max_length=4000)
