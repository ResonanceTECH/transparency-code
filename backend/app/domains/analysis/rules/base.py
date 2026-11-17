"""Базовые типы движка правил (SPEC.md §7.5).

`Rule.evaluate(ctx)` — чистая функция: без I/O, случайности и текущего времени.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class CandidateSignal:
    """Сигнал-кандидат от правила; evidence — id фактов-оснований."""

    rule_id: str
    title: str
    explanation: str
    action: str
    evidence_fact_ids: list[Any] = field(default_factory=list)
    sort: int = 0


@dataclass(frozen=True)
class AnalysisContext:
    """Иммутабельный снапшот входа анализа: реквизиты дела + факты."""

    basis: str
    year: int
    name: str
    facts: tuple[dict[str, Any], ...]


class Rule(Protocol):
    """Контракт правила реестра."""

    id: str
    title: str
    description: str

    def evaluate(self, ctx: AnalysisContext) -> list[CandidateSignal]: ...
