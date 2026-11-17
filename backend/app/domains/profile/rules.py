"""Детерминированные проверки профиля — несоответствия этапа 2 (SPEC.md §10.7).

Чистые функции над снапшотом `ProfileVersion.snapshot` (dict). Каждая проверка
возвращает список находок `{rule_id, title, explanation, action, payload}`.
Несоответствие — повод для уточнения, не нарушение: финальное решение —
у уполномоченного человека.
"""

from datetime import date
from typing import Any

# Категории, где запись обязана ссылаться на документ-основание.
_DOC_REQUIRED = {"support", "insurance", "housing", "monetary_allowance", "allowances"}


def _d(v: Any) -> date | None:
    """ISO-строка → date; пустое/некорректное → None."""
    if isinstance(v, date):
        return v
    if isinstance(v, str) and v:
        try:
            return date.fromisoformat(v)
        except ValueError:
            return None
    return None


def _iter_records(snapshot: dict):
    """(category, record) по всем блокам выплат снапшота."""
    for block in snapshot.get("payments", []):
        for rec in block.get("records", []):
            yield block.get("category", ""), rec


def _find(rule_id, title, explanation, action, payload=None) -> dict:
    return {
        "rule_id": rule_id,
        "title": title,
        "explanation": explanation,
        "action": action,
        "payload": payload or {},
    }


def check_period_order(snapshot: dict) -> list[dict]:
    """ПЕ-01: дата окончания раньше даты начала в записях, службе, деятельности."""
    out = []
    for cat, rec in _iter_records(snapshot):
        start, end = _d(rec.get("period_from")), _d(rec.get("period_to"))
        if start and end and end < start:
            out.append(_find(
                "period-order", "Период выплаты: конец раньше начала",
                f"Запись «{rec.get('title') or 'без названия'}»: "
                f"{start.isoformat()} → {end.isoformat()}.",
                "Уточните период выплаты",
                {"category": cat, "record": rec.get("title"), "from": str(start), "to": str(end)},
            ))
    for label, rows in (("службы", snapshot.get("service_periods", [])),
                        ("деятельности", snapshot.get("activities", []))):
        for row in rows:
            start, end = _d(row.get("start_date") or row.get("period_from")), _d(row.get("end_date") or row.get("period_to"))
            if start and end and end < start:
                out.append(_find(
                    "period-order", f"Период {label}: конец раньше начала",
                    f"{start.isoformat()} → {end.isoformat()}.",
                    "Уточните даты периода",
                    {"section": label, "from": str(start), "to": str(end)},
                ))
    return out


def check_relative_without_kinship(snapshot: dict) -> list[dict]:
    """РВ-01: получатель «родственник — участник СВО», а блок родства не заполнен."""
    kinship = snapshot.get("kinship", {})
    if kinship.get("has_relative") and kinship.get("relatives"):
        return []
    out = []
    for cat, rec in _iter_records(snapshot):
        if rec.get("recipient_kind") == "relative_participant":
            out.append(_find(
                "relative-without-kinship",
                "Выплата родственнику-участнику без данных о родстве",
                f"Запись «{rec.get('title') or 'без названия'}» указывает получателя — "
                "родственника участника СВО, но блок родства не заполнен.",
                "Заполните раздел о родстве с участником СВО",
                {"category": cat, "record": rec.get("title")},
            ))
    return out


def check_kinship_payments_missing(snapshot: dict) -> list[dict]:
    """РВ-02: заявлены выплаты, связанные с родственником, но записей нет."""
    kinship = snapshot.get("kinship", {})
    if not kinship.get("received_payments"):
        return []
    related = {"family_member", "relative_participant"}
    found = [rec.get("title") for _c, rec in _iter_records(snapshot)
             if rec.get("recipient_kind") in related]
    if found:
        return []
    return [_find(
        "kinship-payments-missing",
        "Заявлены выплаты родственникам, записей нет",
        "В разделе родства указано, что выплаты получали, "
        "но ни одна запись не связана с членом семьи или родственником.",
        "Добавьте записи о выплатах либо скорректируйте ответ",
    )]


def check_housing_kind(snapshot: dict) -> list[dict]:
    """ЖМ-01: жилищная мера без вида (субсидия/компенсация/имущество/кредит)."""
    out = []
    for cat, rec in _iter_records(snapshot):
        if cat == "housing" and not rec.get("housing_kind"):
            out.append(_find(
                "housing-kind-required",
                "Жилищная мера без указания вида",
                f"Запись «{rec.get('title') or 'без названия'}» не содержит вида "
                "жилищной меры.",
                "Укажите вид: субсидия, компенсация, имущество или кредит",
                {"record": rec.get("title")},
            ))
    return out


def check_document_basis(snapshot: dict) -> list[dict]:
    """ДО-01: запись в категории с обязательным документом без ссылки на него."""
    out = []
    for cat, rec in _iter_records(snapshot):
        if cat in _DOC_REQUIRED and not rec.get("document_ref") and not rec.get("document_id"):
            out.append(_find(
                "document-basis-required",
                "Запись без документа-основания",
                f"Категория «{cat}», запись «{rec.get('title') or 'без названия'}» "
                "требует указания документа-основания.",
                "Приложите документ или укажите его реквизиты",
                {"category": cat, "record": rec.get("title")},
            ))
    return out


def check_activity_outside_service(snapshot: dict) -> list[dict]:
    """ДД-01: период доп. деятельности не покрыт ни одним периодом службы."""
    periods = [
        (_d(p.get("start_date")), _d(p.get("end_date")) or date.max)
        for p in snapshot.get("service_periods", [])
    ]
    periods = [(s, e) for s, e in periods if s]
    out = []
    for act in snapshot.get("activities", []):
        start, end = _d(act.get("period_from")), _d(act.get("period_to")) or date.max
        if not start:
            continue
        covered = any(s <= start and end <= e for s, e in periods)
        if not covered:
            out.append(_find(
                "activity-outside-service",
                "Деятельность вне периодов службы",
                f"«{act.get('organization') or 'организация не указана'}»: "
                f"{start.isoformat()} — {end.isoformat() if end != date.max else 'н.в.'} "
                "не перекрывается периодами службы.",
                "Уточните период деятельности или службы",
                {"organization": act.get("organization"),
                 "from": str(start), "to": "" if end == date.max else str(end)},
            ))
    return out


PROFILE_RULES: list[dict] = [
    {"id": "period-order", "title": "Согласованность периодов",
     "description": "Дата окончания периода не может быть раньше даты начала (выплаты, служба, деятельность)."},
    {"id": "relative-without-kinship", "title": "Родство с участником СВО",
     "description": "Получатель «родственник — участник СВО» требует заполненного раздела родства."},
    {"id": "kinship-payments-missing", "title": "Выплаты родственникам",
     "description": "Заявленные выплаты, связанные с родственником, должны иметь записи."},
    {"id": "housing-kind-required", "title": "Вид жилищной меры",
     "description": "Для жилищной меры должен быть указан вид: субсидия, компенсация, имущество, кредит."},
    {"id": "document-basis-required", "title": "Документ-основание",
     "description": "Записи в обязательных категориях должны ссылаться на документ-основание."},
    {"id": "activity-outside-service", "title": "Деятельность и служба",
     "description": "Период дополнительной деятельности должен перекрываться периодами службы."},
]

_CHECKS = {
    "period-order": check_period_order,
    "relative-without-kinship": check_relative_without_kinship,
    "kinship-payments-missing": check_kinship_payments_missing,
    "housing-kind-required": check_housing_kind,
    "document-basis-required": check_document_basis,
    "activity-outside-service": check_activity_outside_service,
}


def run_profile_checks(snapshot: dict, enabled: list[str] | None = None) -> list[dict]:
    """Все включённые проверки над снапшотом; порядок — порядок реестра."""
    wanted = set(enabled) if enabled else set(_CHECKS)
    out: list[dict] = []
    for meta in PROFILE_RULES:
        if meta["id"] in wanted:
            out.extend(_CHECKS[meta["id"]](snapshot))
    return out
