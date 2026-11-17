"""Правило `expense-coverage`: покрытие расхода заявленными источниками.

Расход по объекту (`purchase_price`, `expense_amount`) сопоставляется с
заявленными источниками средств того же объекта: `income_declared`,
`obligation_initial` (привлечённое обязательство) и `sale_amount`
(выручка от продажи). Непокрытый остаток — сигнал.
"""

from app.domains.analysis.rules.base import CandidateSignal, RuleContext, num, rub, sorted_facts

EXPENSE_FIELDS = ("purchase_price", "expense_amount")
SOURCE_FIELDS = ("income_declared", "obligation_initial", "sale_amount")


def evaluate(ctx: RuleContext) -> list[CandidateSignal]:
    expense_facts = [f for field in EXPENSE_FIELDS for f in sorted_facts(ctx, field)]
    object_ids = sorted({f.get("object_id") or "" for f in expense_facts})
    signals: list[CandidateSignal] = []
    for object_id in object_ids:
        same_object = lambda f: (f.get("object_id") or "") == object_id  # noqa: E731
        expenses = [f for f in expense_facts if same_object(f)]
        sources = [
            f
            for field in SOURCE_FIELDS
            for f in sorted_facts(ctx, field)
            if same_object(f) and num(f.get("value")) is not None
        ]
        expense_total = sum(num(f["value"]) for f in expenses if num(f.get("value")) is not None)
        sources_total = sum(num(f["value"]) for f in sources)
        if expense_total <= sources_total:
            continue
        signals.append(
            CandidateSignal(
                title="Расход не покрыт заявленными поступлениями",
                explanation=(
                    f"Расход по объекту «{object_id or 'не указан'}» составляет {rub(expense_total)}, "
                    f"заявленные источники средств — {rub(sources_total)}. "
                    f"Непокрытый остаток — {rub(expense_total - sources_total)}."
                ),
                action=(
                    "Сверить источники средств на расход с документами-основаниями. "
                    "При подтверждении расхождения запросить уточнение сведений — "
                    "сигнал не устанавливает нарушение."
                ),
                evidence_fact_ids=[*(f["id"] for f in expenses), *(f["id"] for f in sources)],
                sort=30,
            )
        )
    return signals
