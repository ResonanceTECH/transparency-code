"""Pipeline извлечения фактов из документов (SPEC.md §7.4, учебный шаблон v1).

Каждый парсер возвращает список «сырых» фактов (dict) до записи в БД.
Обработка синхронная — учебные файлы малы.
"""

import io
import json
import re
import zipfile
from datetime import date
from pathlib import Path
from typing import Any

# Серверный словарь подписей полей (SPEC.md §7.4); расширяется с реестром правил.
FIELD_LABELS = {
    "sale_amount": "Доход от продажи в справке",
    "obligation_balance": "Остаток обязательства",
    "obligation_payment": "Платёж по обязательству",
    "income_declared": "Заявленный доход",
    "expense_amount": "Сумма расхода",
    "purchase_price": "Цена покупки",
    "ownership_years": "Срок владения имуществом",
}

ALLOWED_EXTENSIONS = {".json", ".xlsx", ".pdf", ".docx"}

_FACT_KEYS = ("field", "value", "object_id", "date", "unit", "snippet", "label")

# Строка-факт текстовых форматов: field=x; value=y; object_id=z; …
_KV_RE = re.compile(r"([A-Za-z_]+)\s*=\s*([^;]+)")
_KV_KEYS = {"field", "value", "object_id", "date", "unit", "snippet", "label"}

# Заголовки XLSX: канонические + русские синонимы → ключ факта.
_XLSX_HEADERS = {
    "field": "field", "поле": "field",
    "value": "value", "значение": "value",
    "object_id": "object_id", "object": "object_id", "объект": "object_id",
    "date": "date", "дата": "date",
    "unit": "unit", "единица": "unit",
    "snippet": "snippet", "фрагмент": "snippet",
    "label": "label", "название": "label",
}


class ExtractionError(Exception):
    """Документ не удалось разобрать — статус `failed` с этим текстом."""


def extract_facts(filename: str, content: bytes) -> list[dict[str, Any]]:
    """Извлечь факты по расширению файла; ExtractionError — шаблон не распознан."""
    ext = Path(filename).suffix.lower()
    if ext == ".json":
        return _parse_json(content)
    if ext == ".xlsx":
        return _parse_xlsx(content)
    if ext == ".pdf":
        return _parse_pdf(content)
    if ext == ".docx":
        return _parse_docx(content)
    raise ExtractionError(f"Неподдерживаемый формат: {ext or 'без расширения'}")


def fact_label(field: str, explicit: str | None = None) -> str:
    """Подпись поля: явная из файла → словарь → сам field."""
    return explicit or FIELD_LABELS.get(field, field)


def _norm_fact(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Нормализация одного факта; None — нет обязательных field/value."""
    field = str(raw.get("field") or "").strip()
    if "value" not in raw or raw.get("value") is None:
        return None
    value = str(raw.get("value")).strip()
    if not field or not value:
        return None
    fact_date = raw.get("date")
    if fact_date in (None, ""):
        parsed_date = None
    else:
        try:
            parsed_date = date.fromisoformat(str(fact_date).strip()).isoformat()
        except ValueError:
            parsed_date = None
    return {
        "field": field[:120],
        "value": value[:2000],
        "object_id": str(raw.get("object_id") or "")[:200],
        "date": parsed_date,
        "unit": str(raw.get("unit") or "")[:30],
        "snippet": str(raw.get("snippet") or "")[:4000],
        "label": str(raw.get("label") or "")[:300],
    }


def _collect(raw_facts: list[Any]) -> list[dict[str, Any]]:
    facts = [f for f in (_norm_fact(r) for r in raw_facts if isinstance(r, dict)) if f]
    if not facts:
        raise ExtractionError("В документе не найдено ни одного поля fact")
    return facts


def _parse_json(content: bytes) -> list[dict[str, Any]]:
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ExtractionError("Файл не является корректным JSON") from exc
    if not isinstance(data, dict) or data.get("synthetic") is not True:
        raise ExtractionError("Документ не является синтетическим (synthetic !== true)")
    raw = data.get("facts")
    if not isinstance(raw, list):
        raise ExtractionError("В JSON нет массива facts")
    return _collect(raw)


def _parse_xlsx(content: bytes) -> list[dict[str, Any]]:
    try:
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise ExtractionError("Файл не является корректной книгой XLSX") from exc
    try:
        ws = wb.worksheets[0] if wb.worksheets else None
        if ws is None:
            raise ExtractionError("Книга XLSX не содержит листов")
        rows = ws.iter_rows(values_only=True)
        header = next(rows, None)
        if not header:
            raise ExtractionError("Пустой лист XLSX")
        columns = {
            idx: _XLSX_HEADERS[str(cell).strip().lower()]
            for idx, cell in enumerate(header)
            if cell is not None and str(cell).strip().lower() in _XLSX_HEADERS
        }
        if "field" not in columns.values() or "value" not in columns.values():
            raise ExtractionError("В XLSX нет обязательных колонок field/value")
        raw = []
        for row in rows:
            item = {
                key: row[idx]
                for idx, key in columns.items()
                if idx < len(row) and row[idx] is not None
            }
            if item:
                raw.append(item)
        return _collect(raw)
    finally:
        wb.close()


def _parse_marker_text(text: str) -> list[dict[str, Any]]:
    """Строки вида `field=x; value=y; …` — общий формат PDF/DOCX (SPEC §7.4)."""
    raw = []
    for line in text.splitlines():
        pairs = {
            k.lower(): v.strip()
            for k, v in _KV_RE.findall(line)
            if k.lower() in _KV_KEYS
        }
        if "field" in pairs and "value" in pairs:
            raw.append(pairs)
    return _collect(raw)


def _parse_pdf(content: bytes) -> list[dict[str, Any]]:
    if not content.startswith(b"%PDF"):
        raise ExtractionError("Файл не является PDF")
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError("Не удалось прочитать PDF") from exc
    return _parse_marker_text(text)


def _parse_docx(content: bytes) -> list[dict[str, Any]]:
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise ExtractionError("Файл не является DOCX")
    try:
        import docx

        document = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in document.paragraphs)
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError("Не удалось прочитать DOCX") from exc
    return _parse_marker_text(text)
