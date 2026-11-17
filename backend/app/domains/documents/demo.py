"""Демонстрационные комплекты `POST /cases/{id}/demo` (SPEC.md §7.3).

Сидированные «документы» (`downloadable=false`, без файла) + факты.
`clean=True` — комплект без нарушений (анализ даёт 0 сигналов).
Повторное наполнение идемпотентно: документ с тем же sha256 пропускается.
"""

import hashlib
import json
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cases.events import record_event
from app.domains.cases.models import Case
from app.domains.documents.models import Document, DocumentStatus, Fact
from app.domains.documents.pipeline import fact_label

# Учебные факты: field, value, object_id, date, unit, snippet — как в pipeline JSON.
DEMO_KITS: dict[str, dict[str, Any]] = {
    "trade_in": {
        "title": "Trade-in автомобиля",
        "documents": [
            {
                "filename": "trade_in.json",
                "facts": [
                    {
                        "field": "sale_amount",
                        "value": "1450000",
                        "object_id": "car-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебный документ: доход от продажи автомобиля 1450000 руб.",
                    },
                    {
                        "field": "income_declared",
                        "value": "900000",
                        "object_id": "car-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявлен доход от продажи 900000 руб.",
                    },
                ],
            },
            {
                "filename": "loan_obligation.json",
                "facts": [
                    {
                        "field": "obligation_initial",
                        "value": "1200000",
                        "object_id": "loan-1",
                        "date": "2025-01-15",
                        "unit": "RUB",
                        "snippet": "Учебный договор: сумма обязательства 1200000 руб.",
                    },
                    {
                        "field": "obligation_payment",
                        "value": "300000",
                        "object_id": "loan-1",
                        "date": "2025-06-15",
                        "unit": "RUB",
                        "snippet": "Учебная справка: погашено 300000 руб.",
                    },
                    {
                        "field": "obligation_balance",
                        "value": "950000",
                        "object_id": "loan-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявлен остаток обязательства 950000 руб.",
                    },
                ],
            },
        ],
        "clean": [
            {
                "filename": "trade_in.json",
                "facts": [
                    {
                        "field": "sale_amount",
                        "value": "900000",
                        "object_id": "car-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебный документ: доход от продажи автомобиля 900000 руб.",
                    },
                    {
                        "field": "income_declared",
                        "value": "900000",
                        "object_id": "car-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявлен доход от продажи 900000 руб.",
                    },
                ],
            },
            {
                "filename": "loan_obligation.json",
                "facts": [
                    {
                        "field": "obligation_initial",
                        "value": "1200000",
                        "object_id": "loan-1",
                        "date": "2025-01-15",
                        "unit": "RUB",
                        "snippet": "Учебный договор: сумма обязательства 1200000 руб.",
                    },
                    {
                        "field": "obligation_payment",
                        "value": "300000",
                        "object_id": "loan-1",
                        "date": "2025-06-15",
                        "unit": "RUB",
                        "snippet": "Учебная справка: погашено 300000 руб.",
                    },
                    {
                        "field": "obligation_balance",
                        "value": "900000",
                        "object_id": "loan-1",
                        "date": "2025-10-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявлен остаток обязательства 900000 руб.",
                    },
                ],
            },
        ],
    },
    "apartment": {
        "title": "Покупка квартиры",
        "documents": [
            {
                "filename": "apartment.json",
                "facts": [
                    {
                        "field": "purchase_price",
                        "value": "6000000",
                        "object_id": "flat-1",
                        "date": "2025-03-15",
                        "unit": "RUB",
                        "snippet": "Учебный договор: цена квартиры 6000000 руб.",
                    },
                    {
                        "field": "income_declared",
                        "value": "4500000",
                        "object_id": "flat-1",
                        "date": "2025-03-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявленные поступления 4500000 руб.",
                    },
                    {
                        "field": "obligation_initial",
                        "value": "1000000",
                        "object_id": "flat-1",
                        "date": "2025-03-10",
                        "unit": "RUB",
                        "snippet": "Учебный договор: привлечённое обязательство 1000000 руб.",
                    },
                ],
            },
        ],
        "clean": [
            {
                "filename": "apartment.json",
                "facts": [
                    {
                        "field": "purchase_price",
                        "value": "5000000",
                        "object_id": "flat-1",
                        "date": "2025-03-15",
                        "unit": "RUB",
                        "snippet": "Учебный договор: цена квартиры 5000000 руб.",
                    },
                    {
                        "field": "income_declared",
                        "value": "4000000",
                        "object_id": "flat-1",
                        "date": "2025-03-01",
                        "unit": "RUB",
                        "snippet": "Учебная справка: заявленные поступления 4000000 руб.",
                    },
                    {
                        "field": "obligation_initial",
                        "value": "1000000",
                        "object_id": "flat-1",
                        "date": "2025-03-10",
                        "unit": "RUB",
                        "snippet": "Учебный договор: привлечённое обязательство 1000000 руб.",
                    },
                ],
            },
        ],
    },
}


def _doc_sha256(kind: str, clean: bool, doc_def: dict) -> str:
    """Детерминированный «хэш» сидированного документа — нужен для идемпотентности."""
    payload = {"demo": kind, "clean": clean, "filename": doc_def["filename"], "facts": doc_def["facts"]}
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def apply_demo_kit(db: AsyncSession, case: Case, kind: str, clean: bool, author: str) -> int:
    """Наполнить дело учебным комплектом; возвращает число добавленных документов."""
    kit = DEMO_KITS[kind]
    documents = kit["clean"] if clean else kit["documents"]
    added = 0
    for doc_def in documents:
        sha256 = _doc_sha256(kind, clean, doc_def)
        existing = await db.scalar(
            select(Document).where(Document.case_id == case.id, Document.sha256 == sha256)
        )
        if existing is not None:
            continue  # идемпотентность: такой демо-документ уже есть в деле
        doc = Document(
            case_id=case.id,
            filename=doc_def["filename"],
            storage_key="",
            sha256=sha256,
            mime="application/json",
            size_bytes=0,
            status=DocumentStatus.READY,
            downloadable=False,
        )
        db.add(doc)
        await db.flush()
        for raw in doc_def["facts"]:
            fact_date = date.fromisoformat(raw["date"]) if raw.get("date") else None
            db.add(
                Fact(
                    case_id=case.id,
                    document_id=doc.id,
                    field=raw["field"],
                    label=fact_label(raw["field"]),
                    value=raw["value"],
                    object_id=raw.get("object_id", ""),
                    fact_date=fact_date,
                    unit=raw.get("unit", ""),
                    snippet=raw.get("snippet", ""),
                    confirmed=False,
                )
            )
        added += 1
    suffix = " (чистый комплект)" if clean else ""
    record_event(db, case, f"Добавлен демонстрационный комплект: {kit['title']}{suffix}", author=author)
    return added
