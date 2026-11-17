"""Правило `obligation-balance`: сопоставление остатков обязательства (SPEC.md §7.5).

Срабатывает, когда для одного `object_id` встречается больше одного
различного числового `obligation_balance` — документы расходятся.
"""

import re
from collections import defaultdict

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


class ObligationBalanceRule:
    id = "obligation-balance"
    title = "Сопоставление обязательств"
    description = (
        "Сравнивает остатки одного обязательства из разных документов: "
        "сигнал при расхождении сумм по одному объекту."
    )
    sort = 1

    def evaluate(self, ctx: AnalysisContext) -> list[CandidateSignal]:
        by_object: dict[str, list[dict]] = defaultdict(list)
        for fact in ctx.facts:
            if fact.get("field") == "obligation_balance":
                by_object[fact.get("object_id") or ""].append(fact)

        signals = []
        for object_id, facts in sorted(by_object.items()):
            values = {_num(f.get("value", "")) for f in facts}
            values.discard(None)
            if len(values) < 2:
                continue
            labels = ", ".join(sorted({f.get("document_name") or "?" for f in facts}))
            signals.append(
                CandidateSignal(
                    rule_id=self.id,
                    title="Различаются остатки обязательства",
                    explanation=(
                        f"По объекту «{object_id or 'без идентификатора'}» документы "
                        f"({labels}) указывают разные остатки обязательства."
                    ),
                    action="Запросить актуальную справку об остатке задолженности.",
                    evidence_fact_ids=[f["id"] for f in facts],
                    sort=self.sort,
                )
            )
        return signals
