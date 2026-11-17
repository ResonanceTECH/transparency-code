"""Reporting domain API — итоговый отчёт по делу (см. SPEC.md §4).

Роутер монтируется в app/main.py под префиксом /api.
"""

from fastapi import APIRouter

router = APIRouter(tags=["reporting"])
