"""Правило `sale-income-gap`: пропуск дохода от продажи (SPEC.md §7.5).

Срабатывает, когда есть `sale_amount`, а `income_declared` отсутствует
или численно не совпадает с суммой продажи.
"""

import re

from app.domains.analysis.rules.base import AnalysisContext, CandidateSignal

_NUMBER_RE = re.compile(r"\d[\d\s]*")


def _num(value: str) -> float | None:
    match = _NUMBER_RE.search(value or "")
    if not match:
        return None
    try:
        return float(match.group(0).replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def _by_field(ctx: AnalysisContext, field_name: str) -> list[dict]:
    return [f for f in ctx.facts if f.get("field") == field_name]


class SaleIncomeGapRule:
    id = "sale-income-gap"
    title = "Сверка доходов от продажи"
    description = (
        "Сравнивает сумму продажи имущества с заявленным доходом: "
        "сигнал, если доход от продажи не отражён в справке о доходах."
    )
    sort = 0

    def evaluate(self, ctx: AnalysisContext) -> list[CandidateSignal]:
        sales = _by_field(ctx, "sale_amount")
        if not sales:
            return []
        incomes = _by_field(ctx, "income_declared")
        sale = sales[0]
        sale_num = _num(sale.get("value", ""))
        income = incomes[0] if incomes else None
        income_num = _num(income.get("value", "")) if income else None
        if sale_num is not None and income_num is not None and sale_num == income_num:
            return []  # доход заявлен полностью — сигнала нет
        evidence = [sale["id"]]
        if income is not None:
            evidence.append(income["id"])
        return [
            CandidateSignal(
                rule_id=self.id,
                title="Возможный пропуск дохода от продажи",
                explanation=(
                    f"Сумма продажи ({sale.get('value', '')}) не совпадает с заявленным "
                    "доходом в справке — проверьте, отражён ли доход полностью."
                    if income is not None
                    else "В деле есть сумма продажи, но заявленный доход не найден — "
                    "проверьте отражение дохода в справке."
                ),
                action="Сопоставить справку о доходах с договором продажи.",
                evidence_fact_ids=evidence,
                sort=self.sort,
            )
        ]
