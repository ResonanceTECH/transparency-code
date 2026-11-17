"""Аудит-события дел — cross-domain seam (SPEC.md §5.3).

Вынесено из services.py, чтобы другие домены могли писать события
без циклического импорта services↔services (MICROSERVICES.md §5).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cases.models import Case, CaseEvent


def record_event(db: AsyncSession, case: Case, message: str, author: str = "") -> None:
    """Событие в ленту «История действий»; формат сообщения — «Короткое: детали»."""
    db.add(CaseEvent(case_id=case.id, message=message, author=author))
