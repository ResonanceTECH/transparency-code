"""Реестр правил анализа (SPEC.md §7.5): порядок стабильный, версии — semver."""

from app.domains.analysis.rules.base import AnalysisContext, CandidateSignal, Rule
from app.domains.analysis.rules.income import SaleIncomeGapRule
from app.domains.analysis.rules.obligations import ObligationBalanceRule

RULE_VERSION = "0.1.0"

RULES: tuple[Rule, ...] = (SaleIncomeGapRule(), ObligationBalanceRule())
RULES_BY_ID: dict[str, Rule] = {rule.id: rule for rule in RULES}

__all__ = [
    "RULES",
    "RULES_BY_ID",
    "RULE_VERSION",
    "AnalysisContext",
    "CandidateSignal",
    "Rule",
]
