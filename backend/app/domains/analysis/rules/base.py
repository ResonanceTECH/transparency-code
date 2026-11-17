"""Каркас детерминированных правил анализа (SPEC.md §7.5).

`ctx` — иммутабельный снапшот входа: реквизиты дела и факты в сериализованном
виде (`FactOut.model_dump(mode="json")`). Правила не делают I/O и не зависят
от времени — воспроизводимость запуска гарантируется.
"""

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


@dataclass(frozen=True)
class RuleContext:
    """Вход правила: реквизиты дела + факты (сериализованный `FactOut`)."""

    case: dict[str, Any]
    facts: list[dict[str, Any]]


@dataclass(frozen=True)
class CandidateSignal:
    """Сигнал-кандидат до записи в БД; `rule_id` проставляется при сохранении."""

    title: str
    explanation: str
    action: str
    evidence_fact_ids: list[str]
    sort: int = 0


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    description: str
    evaluate: Callable[[RuleContext], list[CandidateSignal]]


def num(value: Any) -> Decimal | None:
    """Число из значения факта; `None` — нечисловое/пустое (факт пропускается)."""
    try:
        return Decimal(str(value).replace(" ", "").replace(",", "."))
    except (InvalidOperation, ValueError):
        return None


def rub(amount: Decimal) -> str:
    """«1 450 000 ₽» — сумма для человекочитаемого объяснения."""
    quantized = amount.quantize(Decimal("1")) if amount == amount.to_integral() else amount.normalize()
    return f"{quantized:,}".replace(",", " ") + " ₽"


def sorted_facts(ctx: RuleContext, field: str) -> list[dict[str, Any]]:
    """Факты поля `field`, отсортированные по `id` — детерминированный порядок."""
    return sorted((f for f in ctx.facts if f.get("field") == field), key=lambda f: f["id"])
