"""Правило `sale-income-gap`: пропуск дохода от продажи (SPEC.md §7.5).

Для каждого факта `sale_amount` сумма заявленных поступлений
(`income_declared`) по тому же `object_id` сопоставляется со стоимостью
продажи: превышение — сигнал о возможном пропуске дохода.
"""

from app.domains.analysis.rules.base import CandidateSignal, RuleContext, num, rub, sorted_facts

FIELD_SALE = "sale_amount"
FIELD_DECLARED = "income_declared"


def evaluate(ctx: RuleContext) -> list[CandidateSignal]:
    declared = sorted_facts(ctx, FIELD_DECLARED)
    declared_by_object: dict[str, list] = {}
    for fact in declared:
        value = num(fact.get("value"))
        if value is not None:
            declared_by_object.setdefault(fact.get("object_id") or "", []).append((fact, value))

    signals: list[CandidateSignal] = []
    for sale_fact in sorted_facts(ctx, FIELD_SALE):
        sale = num(sale_fact.get("value"))
        if sale is None:
            continue
        object_id = sale_fact.get("object_id") or ""
        declared_facts = declared_by_object.get(object_id, [])
        declared_total = sum(value for _, value in declared_facts)
        if sale <= declared_total:
            continue
        signals.append(
            CandidateSignal(
                title="Возможный пропуск дохода от продажи",
                explanation=(
                    f"Доход от продажи {rub(sale)} по объекту «{object_id or 'не указан'}» "
                    f"превышает заявленные поступления {rub(declared_total)} "
                    f"на {rub(sale - declared_total)}. Возможно, часть дохода не отражена "
                    "в представленных сведениях."
                ),
                action=(
                    "Сверить справку о доходе от продажи с заявленными поступлениями по объекту. "
                    "При подтверждении расхождения запросить уточнение сведений — "
                    "сигнал не устанавливает нарушение."
                ),
                evidence_fact_ids=[sale_fact["id"], *(f["id"] for f, _ in declared_facts)],
                sort=10,
            )
        )
    return signals
