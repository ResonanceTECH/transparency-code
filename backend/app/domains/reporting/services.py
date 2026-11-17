"""Reporting services: рабочий итог по делу `GET /cases/{id}/report` (SPEC.md §5.3).

Собирается из `CaseDetail` — отдельных таблиц у домена нет (MICROSERVICES.md).
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cases import services as cases_services
from app.domains.identity.models import User

LIMITATIONS: list[str] = [
    "Анализ ограничен подтверждёнными полями загруженного синтетического комплекта и выбранными правилами.",
    "Доступа к Госуслугам, банкам и ведомственным реестрам у прототипа нет — "
    "сопоставление выполняется только по представленным сведениям.",
    "Сигнал не устанавливает нарушение: решение и квалификация остаются за уполномоченным специалистом.",
    "Качество анализа на реальных (несинтетических) сведениях не установлено.",
]


async def build_report(db: AsyncSession, user: User, case_id: uuid.UUID) -> dict[str, Any] | None:
    """JSON рабочего документа; `None` — нет дела или чужое (→ 404)."""
    detail = await cases_services.get_case_detail(db, user, case_id)
    if detail is None:
        return None
    latest = detail.runs[0] if detail.runs else None
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "case": {
            "id": str(detail.id),
            "number": detail.number,
            "name": detail.name,
            "department": detail.department,
            "basis": detail.basis,
            "year": detail.year,
            "status": detail.status,
            "stale": detail.stale,
        },
        "latest_run": latest.model_dump(mode="json") if latest else None,
        "signals_total": len(latest.signals) if latest else 0,
        "pending_count": detail.pending_count,
        "limitations": LIMITATIONS,
    }
