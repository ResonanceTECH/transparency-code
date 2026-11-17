"""Демо-генераторы учебных комплектов (SPEC.md §7.3).

Сидированные «документы» (`downloadable=false`, без файла на диске) + факты.
Детерминированные наборы: `clean=true` — факты без нарушений.
"""

import hashlib
import json
import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.documents.models import Document, DocumentStatus, Fact
from app.domains.documents.pipeline import _norm_fact, fact_label

DEMO_KINDS = {"trade_in", "apartment"}

# field → (value, object_id, date, unit, snippet)
_FactRow = tuple[str, str, str, str | None, str, str]


def _doc(
    name: str, rows: list[_FactRow]
) -> tuple[str, list[dict[str, Any]]]:
    facts = [
        {
            "field": field,
            "value": value,
            "object_id": obj,
            "date": dt,
            "unit": unit,
            "snippet": snippet,
        }
        for field, value, obj, dt, unit, snippet in rows
    ]
    return name, facts


def _dataset(kind: str, clean: bool) -> list[tuple[str, list[dict[str, Any]]]]:
    """Учебные комплекты: (имя документа, сырые факты)."""
    if kind == "trade_in":
        if clean:
            return [
                _doc(
                    "trade-in-dogovor.json",
                    [
                        ("sale_amount", "1450000", "trade-in-car", "2025-10-01", "RUB",
                         "Договор trade-in: продажа автомобиля за 1450000 руб."),
                        ("obligation_balance", "700000", "trade-in-car-loan", None, "RUB",
                         "Остаток обязательства по кредиту: 700000 руб."),
                    ],
                ),
                _doc(
                    "bank-vypiska.json",
                    [
                        ("obligation_balance", "700000", "trade-in-car-loan", None, "RUB",
                         "Выписка банка: остаток обязательства 700000 руб."),
                        ("obligation_payment", "25000", "trade-in-car-loan", None, "RUB",
                         "Ежемесячный платёж: 25000 руб."),
                    ],
                ),
                _doc(
                    "spravka-2ndfl.json",
                    [
                        ("income_declared", "1450000", "person", "2025-12-31", "RUB",
                         "Справка о доходах: 1450000 руб. за год."),
                    ],
                ),
            ]
        return [
            _doc(
                "trade-in-dogovor.json",
                [
                    ("sale_amount", "1450000", "trade-in-car", "2025-10-01", "RUB",
                     "Договор trade-in: продажа автомобиля за 1450000 руб."),
                    ("obligation_balance", "780000", "trade-in-car-loan", None, "RUB",
                     "График платежей: остаток обязательства 780000 руб."),
                ],
            ),
            _doc(
                "bank-vypiska.json",
                [
                    ("obligation_balance", "650000", "trade-in-car-loan", None, "RUB",
                     "Выписка банка: остаток обязательства 650000 руб."),
                    ("obligation_payment", "25000", "trade-in-car-loan", None, "RUB",
                     "Ежемесячный платёж: 25000 руб."),
                ],
            ),
            _doc(
                "spravka-2ndfl.json",
                [
                    ("income_declared", "900000", "person", "2025-12-31", "RUB",
                     "Справка о доходах: 900000 руб. за год."),
                    ("expense_amount", "300000", "person", "2025-12-31", "RUB",
                     "Задекларированные расходы: 300000 руб."),
                ],
            ),
        ]
    # apartment
    if clean:
        return [
            _doc(
                "pokupka-dogovor.json",
                [
                    ("purchase_price", "5400000", "flat-1", "2025-06-15", "RUB",
                     "Договор купли-продажи квартиры: 5400000 руб."),
                    ("ownership_years", "0", "flat-1", None, "years",
                     "Срок владения на момент проверки: 0 лет."),
                ],
            ),
            _doc(
                "ipoteka-vypiska.json",
                [
                    ("obligation_balance", "3200000", "flat-1-mortgage", None, "RUB",
                     "Остаток ипотечного обязательства: 3200000 руб."),
                ],
            ),
            _doc(
                "bank-istochniki.json",
                [
                    ("income_declared", "1800000", "person", "2025-12-31", "RUB",
                     "Справка о доходах: 1800000 руб. за год."),
                    ("expense_amount", "600000", "person", "2025-12-31", "RUB",
                     "Накопления и иные источники: 600000 руб."),
                ],
            ),
        ]
    return [
        _doc(
            "pokupka-dogovor.json",
            [
                ("purchase_price", "5400000", "flat-1", "2025-06-15", "RUB",
                 "Договор купли-продажи квартиры: 5400000 руб."),
            ],
        ),
        _doc(
            "ipoteka-dogovor.json",
            [
                ("obligation_balance", "3200000", "flat-1-mortgage", "2025-06-15", "RUB",
                 "Ипотечный договор: остаток 3200000 руб."),
            ],
        ),
        _doc(
            "ipoteka-vypiska.json",
            [
                ("obligation_balance", "4100000", "flat-1-mortgage", None, "RUB",
                 "Выписка банка: остаток обязательства 4100000 руб."),
            ],
        ),
    ]


async def load_demo(db: AsyncSession, case: Case, kind: str, clean: bool, author: str) -> int:
    """Добавить учебный комплект в дело; вернуть число созданных фактов."""
    if kind not in DEMO_KINDS:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Неизвестный тип комплекта: {kind}",
        )
    total = 0
    docs_count = 0
    for filename, raw_facts in _dataset(kind, clean):
        payload = json.dumps({"synthetic": True, "facts": raw_facts}, ensure_ascii=False)
        doc = Document(
            case_id=case.id,
            filename=filename,
            sha256=hashlib.sha256(payload.encode()).hexdigest(),
            mime="application/json",
            size_bytes=len(payload.encode()),
            status=DocumentStatus.READY,
            downloadable=False,
            storage_key="",
        )
        db.add(doc)
        await db.flush()
        docs_count += 1
        for raw in raw_facts:
            norm = _norm_fact(raw) or {}
            fact_date = None
            if norm.get("date"):
                try:
                    fact_date = date.fromisoformat(norm["date"])
                except ValueError:
                    fact_date = None
            db.add(
                Fact(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    document_id=doc.id,
                    field=norm.get("field", ""),
                    label=fact_label(norm.get("field", ""), norm.get("label") or None),
                    value=norm.get("value", ""),
                    object_id=norm.get("object_id", ""),
                    fact_date=fact_date,
                    unit=norm.get("unit", ""),
                    snippet=norm.get("snippet", ""),
                    confirmed=False,
                )
            )
            total += 1
        record_event(db, case, f"Учебный документ: {filename}", author=author)
    record_event(
        db,
        case,
        f"Демо-комплект добавлен: {kind}{' (чистый)' if clean else ''} — "
        f"{docs_count} док., {total} полей",
        author=author,
    )
    return total
