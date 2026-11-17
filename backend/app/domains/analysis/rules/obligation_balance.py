"""Правило `obligation-balance`: сопоставление остатков обязательства.

Для каждого объекта с фактом `obligation_initial` ожидаемый остаток считается
как «сумма по договору − подтверждённые платежи» и сравнивается с каждым
заявленным `obligation_balance` того же объекта.
"""

from decimal import Decimal

from app.domains.analysis.rules.base import CandidateSignal, RuleContext, num, rub, sorted_facts

FIELD_INITIAL = "obligation_initial"
FIELD_PAYMENT = "obligation_payment"
FIELD_BALANCE = "obligation_balance"


def _sum(facts: list[dict]) -> Decimal:
    total = Decimal(0)
    for fact in facts:
        value = num(fact.get("value"))
        if value is not None:
            total += value
    return total


def evaluate(ctx: RuleContext) -> list[CandidateSignal]:
    object_ids = sorted({f.get("object_id") or "" for f in sorted_facts(ctx, FIELD_INITIAL)})
    signals: list[CandidateSignal] = []
    for object_id in object_ids:
        same_object = lambda f, oid=object_id: (f.get("object_id") or "") == oid  # noqa: E731
        initial_facts = [f for f in sorted_facts(ctx, FIELD_INITIAL) if same_object(f)]
        payment_facts = [f for f in sorted_facts(ctx, FIELD_PAYMENT) if same_object(f)]
        balance_facts = [f for f in sorted_facts(ctx, FIELD_BALANCE) if same_object(f)]
        expected = _sum(initial_facts) - _sum(payment_facts)
        for balance in balance_facts:
            declared = num(balance.get("value"))
            if declared is None or declared == expected:
                continue
            signals.append(
                CandidateSignal(
                    title="Различаются остатки обязательства",
                    explanation=(
                        f"По объекту «{object_id or 'не указан'}» заявлен остаток {rub(declared)}, "
                        f"тогда как сумма по договору минус платежи даёт {rub(expected)}. "
                        f"Расхождение — {rub(abs(declared - expected))}."
                    ),
                    action=(
                        "Сверить график платежей и остаток обязательства с документами-основаниями. "
                        "При подтверждении расхождения запросить уточнение сведений — "
                        "сигнал не устанавливает нарушение."
                    ),
                    evidence_fact_ids=[
                        *(f["id"] for f in initial_facts),
                        *(f["id"] for f in payment_facts),
                        balance["id"],
                    ],
                    sort=20,
                )
            )
    return signals
