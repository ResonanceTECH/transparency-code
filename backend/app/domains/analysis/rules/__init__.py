"""Реестр детерминированных правил анализа (SPEC.md §7.5).

Каждое правило — `Rule{id,title,description,evaluate(ctx)}`: чистая функция
над иммутабельным снапшотом (реквизиты дела + сериализованные факты), без I/O,
случайности и времени — одинаковый вход даёт одинаковый набор сигналов.
"""

from app.domains.analysis.rules import expense_coverage, obligation_balance, sale_income_gap
from app.domains.analysis.rules.base import CandidateSignal, Rule, RuleContext

RULES: tuple[Rule, ...] = (
    Rule(
        id="sale-income-gap",
        title="Полнота доходов от продажи",
        description=(
            "Сопоставляет доход от продажи имущества с заявленными поступлениями "
            "по тому же объекту: превышение — возможный пропуск дохода в сведениях."
        ),
        evaluate=sale_income_gap.evaluate,
    ),
    Rule(
        id="obligation-balance",
        title="Сопоставление обязательств",
        description=(
            "Проверяет, что заявленный остаток обязательства равен сумме "
            "обязательства по договору за вычетом подтверждённых платежей."
        ),
        evaluate=obligation_balance.evaluate,
    ),
    Rule(
        id="expense-coverage",
        title="Покрытие расходов источниками",
        description=(
            "Сопоставляет расход (цену покупки) с заявленными источниками средств: "
            "доходами и привлечёнными обязательствами по тому же объекту."
        ),
        evaluate=expense_coverage.evaluate,
    ),
)

RULES_BY_ID: dict[str, Rule] = {rule.id: rule for rule in RULES}

__all__ = ["RULES", "RULES_BY_ID", "CandidateSignal", "Rule", "RuleContext"]
