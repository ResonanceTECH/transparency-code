"""Analysis domain API — правила, запуски, сигналы, решения (см. SPEC.md §4).

Роутер монтируется в app/main.py под префиксом /api.
"""

from fastapi import APIRouter

router = APIRouter(tags=["analysis"])
