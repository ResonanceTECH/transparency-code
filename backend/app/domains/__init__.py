"""Доменные модули (bounded contexts) — см. MICROSERVICES.md.

Импорт всех моделей здесь гарантирует заполнение `Base.metadata`
для Alembic и тестов.
"""

from app.domains.analysis import models as _analysis_models  # noqa: F401
from app.domains.cases import models as _cases_models  # noqa: F401
from app.domains.documents import models as _documents_models  # noqa: F401
from app.domains.identity import models as _identity_models  # noqa: F401
