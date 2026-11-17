"""Documents domain API — загрузка и факты документов (см. SPEC.md §4).

Роутер монтируется в app/main.py под префиксом /api.
"""

from fastapi import APIRouter

router = APIRouter(tags=["documents"])
