"""Cases domain API — эндпоинты дел проверок (см. SPEC.md §4).

Роутер монтируется в app/main.py под префиксом /api.
"""

from fastapi import APIRouter

router = APIRouter(tags=["cases"])
