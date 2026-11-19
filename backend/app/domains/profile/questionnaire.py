"""Расширенная анкета v1: строгий контракт, комплектность и совместимое представление.

В БД нет браузерных blob-URL. Идентификаторы/метаданные файлов подтверждает API.
Неполный черновик сохраняется, но не может быть представлен проверяющему.
"""

import copy
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(max_length=4000)]


class FormModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FormCandidate(FormModel):
    full_name: Text = ""
    birth_year: Text = ""
    workplace: Text = ""
    work_status: Text = ""
    phone: Text = ""
    email: Text = ""
    reporting_period: Text = ""
    region: Text = ""
    flow: Text = ""
    program_year: Text = ""
    regional_program: Text = ""
    regional_program_year: Text = ""
    appointment_authority: Text = ""
    organizer: Text = ""
    diploma_details: Text = ""
    reserve_act_details: Text = ""
    diploma_document_id: Text = ""
    reserve_act_document_id: Text = ""


class FormEntity(BaseModel):
    model_config = ConfigDict(extra="allow")
    __pydantic_extra__: dict[str, Text] = Field(init=False)
    id: str = Field(min_length=1, max_length=128)


class FormKinship(FormModel):
    full_name: Text = ""
    degree: Text = ""
    status: Text = ""
    received_payments: Text = ""


class FormAttachment(FormModel):
    id: str = Field(min_length=1, max_length=128)
    name: Text = ""
    url: Text = ""
    size: int = Field(default=0, ge=0)
    format: Text = ""
    section: Text = ""
    kind: Literal["basis", "consent", "photo", "result"] = "basis"
    origin: Literal["sample", "upload"] = "upload"


class Questionnaire(FormModel):
    candidate: FormCandidate = Field(default_factory=FormCandidate)
    service_periods: list[FormEntity] = Field(default_factory=list, max_length=200)
    relative_answer: Text = ""
    kinship: FormKinship = Field(default_factory=FormKinship)
    family_recipients: list[FormEntity] = Field(default_factory=list, max_length=200)
    category_answers: dict[str, Text] = Field(default_factory=lambda: {str(i): "" for i in range(10)})
    support_levels: dict[str, Text] = Field(default_factory=lambda: {key: "" for key in LEVELS})
    personal_insurance_answer: Text = ""
    records: dict[str, list[FormEntity]] = Field(default_factory=lambda: {str(i): [] for i in range(10)})
    activity_answer: Text = ""
    activities: list[FormEntity] = Field(default_factory=list, max_length=200)
    attachments: list[FormAttachment] = Field(default_factory=list, max_length=500)
    consent_document_id: Text = ""
    photo: FormAttachment | None = None
    # Старые дополнительные реквизиты не исчезают при переходе на новый интерфейс.
    legacy_data: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def stable_collections(self):
        categories = {str(i) for i in range(10)}
        if set(self.category_answers) != categories or set(self.records) != categories:
            raise ValueError("В анкете должны быть ровно десять категорий")
        if set(self.support_levels) != set(LEVELS):
            raise ValueError("Укажите три уровня поддержки")
        collections = [self.service_periods, self.family_recipients, self.activities, *self.records.values()]
        identifiers = [row.id for rows in collections for row in rows]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Идентификаторы строк анкеты должны быть уникальны")
        for rows in collections:
            if len(rows) > 200 or len({row.id for row in rows}) != len(rows):
                raise ValueError("Список содержит повторяющиеся идентификаторы или более 200 записей")
        if len({file.id for file in self.attachments}) != len(self.attachments):
            raise ValueError("Идентификатор вложения повторяется")
        return self


CATEGORIES = ["monetary_allowance", "allowances", "one_time", "support", "insurance",
              "allowance", "family", "material_aid", "housing", "non_monetary"]
LEVELS = ["Федеральный", "Региональный", "Муниципальный"]
WORK = {"Проходит службу": "serving", "Работает вне государственной службы": "outside",
        "Находится в запасе": "reserve", "Находится в отставке": "retired"}
SERVICE = {"Военная служба": "military", "Государственная служба": "state", "Иное": "other"}
PARTICIPANT = {
    "Участвует": "participating", "Участвовал": "participated", "Погиб": "deceased",
    "Пропал без вести": "missing",
}
DEGREE = {"Супруг": "spouse", "Ребёнок": "child", "Родитель": "parent", "Иная степень родства": "other"}
RECIPIENT = {
    "Сам резервист": "candidate", "Член семьи": "family_member",
    "Резервист за родственника": "relative_participant",
}
ACTIVITY = {
    "Преподавание": "teaching", "Экспертиза": "expertise", "Консультирование": "consulting",
    "Участие в комиссии": "commission", "Иное": "other",
}
LEGACY_RECORD_KEYS = {
    "recipient": "recipient_name", "recipient_kind": "recipient_kind", "title": "title",
    "basis": "basis", "amount": "amount", "period_from": "period_from", "period_to": "period_to",
    "payment_date": "payment_date", "event_date": "event_date", "document_id": "document_id",
    "form": "form", "level": "level", "housing_kind": "housing_kind", "basis_type": "kind_text",
    "description": "title",
}


def _text(value) -> str:
    return "" if value is None else str(value)


def _reverse(mapping: dict, value) -> str:
    return next((key for key, code in mapping.items() if code == value), _text(value))


def _answer(value) -> str:
    if value is True or value == "yes":
        return "Да"
    if value is False or value == "no":
        return "Нет"
    return "Планируется" if value == "planned" else ""


def _bool(value):
    return True if value == "Да" else False if value == "Нет" else None


def _date(value):
    try:
        parsed = date.fromisoformat(value)
        return parsed.isoformat() if parsed.isoformat() == value else None
    except (ValueError, TypeError):
        return None


def _year(value):
    return int(value) if re.fullmatch(r"(?:19|20)\d{2}", value or "") else None


def _amount(value):
    value = re.sub(r"\s", "", value or "").replace(",", ".")
    if not re.fullmatch(r"\d+(?:\.\d{1,2})?", value):
        return None
    try:
        number = Decimal(value)
        return str(number) if number < Decimal("1000000000000") else None
    except InvalidOperation:
        return None


def active_records(q: dict, category: int) -> list[dict]:
    key = str(category)
    if q["category_answers"].get(key) not in ("Да", "Планируется") or category == 5:
        return []
    rows = q["records"].get(key, [])
    if category == 3:
        return [r for r in rows if q["support_levels"].get(r.get("level")) == "Да"]
    if category == 4:
        return [r for r in rows if (
            q["relative_answer"] == "Да" and q["kinship"]["received_payments"] == "Да"
            if r.get("recipient_kind") == "Резервист за родственника"
            else q["personal_insurance_answer"] == "Да"
        )]
    return rows


def record_keys(q: dict, category: int, row: dict) -> set[str]:
    """Поля показанной формы. Скрытые поля условного черновика не публикуются."""
    common = {"id", "title", "basis", "document_id"}
    if category in (0, 1):
        return common | {"period_from", "period_to", "payer", "recipient", "amount"} | (
            {"assignment_id"} if category == 1 else set()
        )
    if category == 2:
        return common | {"event_kind", "event_date", "recipient_kind", "recipient", "amount", "payer",
                         "period_from", "period_to", "payment_date", "assignment_id"}
    if category == 3:
        return common | {"level", "authority", "code", "payment_date", "recipient", "amount"}
    if category == 4:
        return common | {"recipient_kind", "recipient", "basis_type", "payment_date", "period_from",
                         "period_to", "amount"}
    if category == 6:
        return common | {"recipient_id", "amount", "payment_date"}
    if category == 7:
        return common | {"form", "organization", "recipient"} | (
            {"amount"} if row.get("form") == "Денежная" else {"description"}
        )
    if category == 8:
        return common | {"expected_year"} if q["category_answers"]["8"] == "Планируется" else {
            "id", "housing_kind", "basis", "decision_date", "acquisition_date", "document_id",
        }
    if category == 9:
        return {"id", "description", "basis", "document_id"}
    return {"id"}


def completeness(q: dict) -> tuple[int, list[dict], list[str]]:
    """Сервер повторяет обязательные поля/условия семи групп, независимо от UI."""
    groups: list[list[str]] = [[] for _ in range(7)]
    basis_ids = {a["id"] for a in q["attachments"] if a["kind"] == "basis" and a["url"]}
    recipient_ids = {r["id"] for r in q["family_recipients"]}

    def fields(row, required, target, *, years=(), dates=(), money=(), docs=(), choices=None):
        for key in required:
            if not row.get(key, "").strip():
                target.append(f"Заполните поле: {key}")
        for key in years:
            if row.get(key) and _year(row[key]) is None:
                target.append(f"Некорректный год: {key}")
        for key in dates:
            if row.get(key) and _date(row[key]) is None:
                target.append(f"Некорректная дата: {key}")
        for end, start in (("end", "start"), ("period_to", "period_from")):
            if end in dates and row.get(end) and row.get(start) and row[end] < row[start]:
                target.append("Окончание периода раньше начала")
        for key in money:
            if row.get(key) and _amount(row[key]) is None:
                target.append("Укажите неотрицательную сумму, не более двух знаков после запятой")
        for key in docs:
            if row.get(key) and row[key] not in basis_ids:
                target.append(f"Прикрепите доступный документ-основание: {key}")
        for key, options in (choices or {}).items():
            if row.get(key) and row[key] not in options:
                target.append(f"Выберите значение из списка: {key}")

    c = q["candidate"]
    personal = []
    program = []
    identity = []
    fields(
        c, ["full_name", "birth_year", "workplace", "phone", "email", "work_status", "reporting_period"],
        personal, years=["birth_year"], choices={
            "work_status": WORK,
            "appointment_authority": [
                "Не указан", "ОИВ субъекта Российской Федерации", "Федеральный орган исполнительной власти",
            ],
        },
    )
    if c.get("email") and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", c["email"]):
        personal.append("Проверьте адрес электронной почты")
    fields(
        c, ["flow", "program_year", "region", "organizer"], identity,
        years=["program_year", "regional_program_year"],
    )
    program.extend(identity)
    fields(
        c, ["diploma_details", "reserve_act_details", "diploma_document_id", "reserve_act_document_id"],
        program, docs=["diploma_document_id", "reserve_act_document_id"],
    )
    groups[0] = personal + program
    if not q["service_periods"]:
        groups[1].append("Добавьте период службы или работы")
    for row in q["service_periods"]:
        fields(
            row, ["kind", "organization", "start"]
            + (["category"] if row.get("kind") == "Военная служба" else []), groups[1],
            dates=["start", "end"], choices={"kind": SERVICE, "category": [
                "Не применяется", "Младший офицерский состав", "Старший офицерский состав",
                "Высший офицерский состав", "Волонтёр",
            ]},
        )
    if q["relative_answer"] not in ("Да", "Нет"):
        groups[1].append("Ответьте на вопрос о родстве")
    if q["relative_answer"] == "Да":
        fields(
            q["kinship"], ["full_name", "degree", "status"], groups[1],
            choices={"degree": DEGREE, "status": PARTICIPANT},
        )
        if q["kinship"]["received_payments"] not in ("Да", "Нет"):
            groups[1].append("Ответьте на вопрос о выплатах за родственника")
    if q["category_answers"].get("6") == "Да":
        if not q["family_recipients"]:
            groups[1].append("Добавьте получателя — члена семьи")
        for row in q["family_recipients"]:
            fields(row, ["full_name", "relation", "year"], groups[1], years=["year"])
    answers = q["category_answers"]
    if set(answers) != {str(i) for i in range(10)} or any(
        answers.get(str(i)) not in (["Да", "Нет", "Планируется"] if i == 8 else ["Да", "Нет"])
        for i in range(10)
    ):
        groups[2].append("Дайте ответ по всем десяти категориям выплат")
    if set(q["support_levels"]) != set(LEVELS) or any(
        q["support_levels"].get(level) not in ("Да", "Нет") for level in LEVELS
    ):
        groups[2].append("Ответьте по каждому уровню поддержки")
    if q["personal_insurance_answer"] not in ("Да", "Нет"):
        groups[2].append("Ответьте на вопрос о личных страховых выплатах")
    if all(q["support_levels"].get(level) in ("Да", "Нет") for level in LEVELS) and answers.get("3") != (
        "Да" if "Да" in q["support_levels"].values() else "Нет"
    ):
        groups[2].append("Ответ по поддержке должен соответствовать ответам по уровням")
    insurance_yes = q["personal_insurance_answer"] == "Да" or (
        q["relative_answer"] == "Да" and q["kinship"]["received_payments"] == "Да"
    )
    if q["personal_insurance_answer"] in ("Да", "Нет") and answers.get("4") != (
        "Да" if insurance_yes else "Нет"
    ):
        groups[2].append("Ответ по страховым выплатам должен соответствовать выбранным получателям")
    answer_errors = list(groups[2])
    for attachment in [*q["attachments"], *([q["photo"]] if q.get("photo") else [])]:
        if not attachment["url"]:
            groups[2].append(f"Недоступен оригинал приложения: {attachment['name']}")
    for category in range(10):
        if answers.get(str(category)) == "Нет" or category == 5:
            continue
        target = groups[3] if category == 3 else groups[4] if category == 8 else groups[2]
        rows = active_records(q, category)
        if not rows:
            target.append(f"Добавьте запись или ответьте «Нет»: категория {category + 1}")
        for row in rows:
            required = ["title", "basis", "document_id"]
            if category in (0, 1):
                required += ["period_from", "period_to", "payer", "recipient", "amount"]
            elif category == 2:
                required = [
                    "title", "event_kind", "event_date", "recipient_kind", "recipient", "amount", "payer",
                    "basis", "period_from", "period_to", "payment_date",
                ]
            elif category == 3:
                required += ["level", "authority", "payment_date", "recipient", "amount"]
            elif category == 4:
                required += [
                    "recipient_kind", "recipient", "basis_type", "payment_date", "period_from", "period_to",
                    "amount",
                ]
            elif category == 6:
                required += ["recipient_id", "amount", "payment_date"]
                if row.get("recipient_id") not in recipient_ids:
                    target.append("Выберите получателя из списка членов семьи")
            elif category == 7:
                required += [
                    "form", "organization", "recipient",
                    "amount" if row.get("form") == "Денежная" else "description",
                ]
            elif category == 8:
                required = ["expected_year", "title", "basis", "document_id"] if (
                    answers.get("8") == "Планируется"
                ) else ["housing_kind", "basis", "decision_date", "acquisition_date", "document_id"]
            elif category == 9:
                required = ["description", "basis", "document_id"]
            visible = record_keys(q, category, row)
            choices = {"level": LEVELS, "form": ["Денежная", "Натуральная"], "recipient_kind": RECIPIENT,
                       "basis_type": ["За личное участие", "В связи с родственником"],
                       "housing_kind": ["Субсидия", "Компенсация", "Предоставление жилья",
                                        "Кредит · учитывается отдельно"]}
            fields(
                row, required, target, years=visible & {"expected_year"}, money=visible & {"amount"},
                docs=["document_id"], dates=visible & {
                    "period_from", "period_to", "payment_date", "event_date", "decision_date",
                    "acquisition_date",
                }, choices={key: options for key, options in choices.items() if key in visible},
            )
            if "expected_year" in visible and row.get("expected_year") and not re.fullmatch(
                r"20\d{2}", row["expected_year"]
            ):
                target.append("Предполагаемый год должен быть в диапазоне 2000–2099")
            if category == 4 and row.get("recipient_kind") == "Член семьи":
                target.append("Для страховой записи выберите резервиста либо выплату за родственника")
        if category == 3:
            for level, answer in q["support_levels"].items():
                if answer == "Да" and not any(row.get("level") == level for row in rows):
                    target.append(f"Добавьте сведения: {level} уровень поддержки")
        if category == 4:
            for condition, recipient in [
                (q["personal_insurance_answer"] == "Да", "Сам резервист"),
                (q["relative_answer"] == "Да" and q["kinship"]["received_payments"] == "Да",
                 "Резервист за родственника"),
            ]:
                if condition and not any(row.get("recipient_kind") == recipient for row in rows):
                    target.append(f"Добавьте запись страховой выплаты: {recipient}")
    if q["activity_answer"] not in ("Да", "Нет"):
        groups[5].append("Ответьте на вопрос о деятельности")
    elif q["activity_answer"] == "Да":
        if not q["activities"]:
            groups[5].append("Добавьте деятельность или ответьте «Нет»")
        for row in q["activities"]:
            fields(
                row, ["organization", "kind", "engagement", "period_from", "basis", "document_id"], groups[5],
                dates=["period_from", "period_to"], docs=["document_id"], choices={
                    "kind": ACTIVITY, "engagement": [
                        "Трудовой договор", "Срочный трудовой договор", "Совместительство",
                        "Гражданско-правовой договор", "Безвозмездная деятельность",
                    ],
                },
            )
    if not any(
        a["id"] == q["consent_document_id"] and a["kind"] == "consent" and a["url"]
        for a in q["attachments"]
    ):
        groups[6].append("Прикрепите подписанный скан согласия на обработку персональных данных")
    titles = [
        "Личность, программа и включение в резерв", "Служба, родство и получатели",
        "Ответы и записи по категориям",
        "Основания мер поддержки", "Жилищная мера", "Дополнительная деятельность",
        "Подписанное согласие на обработку ПДн",
    ]
    progress = 0
    if not personal and not identity:
        progress = 10
        if not program:
            progress = 30
            if not groups[1]:
                progress = 50
                if not answer_errors:
                    progress = 70 if any(groups) else 90
    milestones = [{"percent": value, "title": title, "done": progress >= value} for value, title in [
        (10, "Анкета и программа"), (30, "Диплом и акт"), (50, "Служба и родство"),
        (70, "Ответы по категориям"), (90, "Записи, документы и согласие"),
    ]]
    missing = [f"{title}: {issue}" for title, issues in zip(titles, groups, strict=True) for issue in issues]
    return progress, milestones, missing


def published(q: dict) -> dict:
    result = copy.deepcopy(q)
    result["records"] = {
        str(i): [{key: value for key, value in row.items() if key in record_keys(q, i, row)}
                 for row in active_records(q, i)]
        for i in range(10)
    }
    if q["relative_answer"] != "Да":
        result["kinship"] = FormKinship().model_dump()
    if q["category_answers"].get("6") != "Да":
        result["family_recipients"] = []
    if q["activity_answer"] != "Да":
        result["activities"] = []
    # Передаём дополнительные реквизиты только тех строк, которые действительно представлены.
    # Полная прежняя анкета/скрытые записи никогда не попадают в слепок автоматически.
    old = q.get("legacy_data") or {}
    result["legacy_data"] = {
        key: copy.deepcopy(old[key])
        for key in ("reserve_act_date", "reserve_act_number", "reserve_act_details_source")
        if key in old
    }
    if q["relative_answer"] == "Да":
        result["legacy_data"]["additional_relatives"] = copy.deepcopy(old.get("additional_relatives", []))
    for name in ("service_periods", "activities"):
        ids = {row["id"] for row in result[name]}
        result["legacy_data"][name] = {
            key: copy.deepcopy(value) for key, value in old.get(name, {}).items() if key in ids
        }
    result["legacy_data"]["records"] = {
        category: {
            key: published_record_extra(q, int(category), row, value)
            for key, value in old.get("records", {}).get(category, {}).items()
            for row in rows if row["id"] == key
        }
        for category, rows in result["records"].items()
    }
    return result


def published_record_extra(q: dict, category: int, row: dict, retained: dict) -> dict:
    """Старые реквизиты не должны возвращать скрытое поле условной формы в слепок."""
    hidden = set()
    if category == 7:
        hidden = {"description"} if row.get("form") == "Денежная" else {"amount"}
    elif category == 8:
        hidden = {"housing_kind", "decision_date", "acquisition_date"} if (
            q["category_answers"]["8"] == "Планируется"
        ) else {"expected_year", "title"}
    result = copy.deepcopy(retained)
    for container in ("fields", "extra"):
        values = result.get(container)
        if isinstance(values, dict):
            result[container] = {key: value for key, value in values.items() if key not in hidden}
    embedded = result.get("extra", {}).get("questionnaire_record")
    if isinstance(embedded, dict):
        result["extra"]["questionnaire_record"] = {
            key: value for key, value in embedded.items() if key not in hidden
        }
    return result


def legacy_input(q: dict):
    """Проекция расширенной анкеты в прежний контракт. Потерь в questionnaire нет."""
    from app.domains.profile.schemas import DraftIn

    c = q["candidate"]
    old = q.get("legacy_data") or {}
    payments = []
    for i, category in enumerate(CATEGORIES):
        records = []
        for row in q["records"].get(str(i), []):
            family = next((r for r in q["family_recipients"] if r["id"] == row.get("recipient_id")), {})
            retained = old.get("records", {}).get(str(i), {}).get(row["id"], {})
            extra = copy.deepcopy(retained.get("extra") or {})
            embedded = extra.get("questionnaire_record")
            embedded = embedded if isinstance(embedded, dict) else {}
            extra["questionnaire_record"] = {**embedded, **copy.deepcopy(row)}
            record = {
                "id": retained.get("source_id"),
                "recipient_kind": "family_member" if i == 6 else RECIPIENT.get(row.get("recipient_kind")),
                "recipient_name": family.get("full_name", row.get("recipient", "")),
                "recipient_birth_year": _year(family.get("year", "")) if i == 6
                else retained.get("recipient_birth_year"),
                "relation": family.get("relation", retained.get("relation", "")),
                "title": row.get("title", row.get("description", "")),
                "kind_text": row.get("basis_type", retained.get("kind_text", "")),
                "basis": row.get("basis", ""),
                "level": {"Федеральный": "federal", "Региональный": "regional", "Муниципальный": "municipal"}
                .get(row.get("level"), retained.get("level", "")),
                "form": "in_kind" if i in (8, 9) or row.get("form") == "Натуральная" else "monetary",
                "amount": _amount(row.get("amount")),
                "period_from": _date(row.get("period_from")), "period_to": _date(row.get("period_to")),
                "payment_date": _date(row.get("payment_date")), "event_date": _date(row.get("event_date")),
                "housing_kind": {
                    "Субсидия": "subsidy", "Компенсация": "compensation", "Предоставление жилья": "property",
                    "Кредит · учитывается отдельно": "credit",
                }.get(row.get("housing_kind"), retained.get("housing_kind", "")),
                "document_id": row.get("document_id") or None,
                "document_ref": next(
                    (a["name"] for a in q["attachments"] if a["id"] == row.get("document_id")),
                    retained.get("document_ref", ""),
                ),
                "extra": extra,
            }
            # Поля старого контракта, которых нет в этой форме, остаются отдельными
            # реквизитами. Например, исходная натуральная форма не становится денежной.
            source_keys = {source: key for key, source in LEGACY_RECORD_KEYS.items()}
            for key, value in retained.get("fields", {}).items():
                if source_keys.get(key, key) not in row:
                    record[key] = copy.deepcopy(value)
            records.append(record)
        payments.append({
            "category": category,
            "answer": {"Да": "yes", "Нет": "no", "Планируется": "planned"}
            .get(q["category_answers"].get(str(i))),
            "records": records,
        })
    service = []
    for row in q["service_periods"]:
        retained = old.get("service_periods", {}).get(row["id"], {})
        extra = copy.deepcopy(retained.get("extra") or {})
        extra.update(row)
        service.append({
            "id": retained.get("source_id"),
            "start_date": _date(row.get("start")), "end_date": _date(row.get("end")),
            "kind": SERVICE.get(row.get("kind"), "other"), "officer_category": row.get("category", ""),
            "extra": extra,
        })
    activities = []
    for row in q["activities"]:
        retained = old.get("activities", {}).get(row["id"], {})
        extra = copy.deepcopy(retained.get("extra") or {})
        extra.update(row)
        activities.append({
            "id": retained.get("source_id"),
            "organization": row.get("organization", ""), "kind": ACTIVITY.get(row.get("kind"), "other"),
            "engagement": row.get("engagement", ""), "period_from": _date(row.get("period_from")),
            "period_to": _date(row.get("period_to")), "basis_document": row.get("basis", ""), "extra": extra,
        })
    act_number = c["reserve_act_details"]
    if act_number == old.get("reserve_act_details_source"):
        act_number = old.get("reserve_act_number", act_number)
    result = {
        "person": {
            "full_name": c["full_name"], "birth_year": _year(c["birth_year"]), "phone": c["phone"],
            "email": c["email"], "current_workplace": c["workplace"],
        },
        "program": {
            "flow": c["flow"], "program_year": _year(c["program_year"]), "region": c["region"],
            "regional_program": c["regional_program"],
            "regional_program_year": _year(c["regional_program_year"]),
        },
        "reserve_act_number": act_number, "reserve_act_date": old.get("reserve_act_date"),
        "work_status": WORK.get(c["work_status"]), "appointment_authority": c["appointment_authority"],
        "service_periods": service,
        "kinship": {
            "has_relative": _bool(q["relative_answer"]),
            "received_payments": _bool(q["kinship"]["received_payments"]),
            "relatives": [{
                "full_name": q["kinship"]["full_name"], "degree": DEGREE.get(q["kinship"]["degree"], ""),
                "participant_status": PARTICIPANT.get(q["kinship"]["status"]),
            }] if q["relative_answer"] == "Да" else [],
        },
        "payments": payments, "activity_participates": _bool(q["activity_answer"]),
        "activities": activities,
    }
    if q["relative_answer"] == "Да":
        result["kinship"]["relatives"].extend(old.get("additional_relatives", []))
    # Колонки старого контракта ограничены по длине; полный текст всегда в questionnaire.
    limits = {"phone": 64, "email": 200, "flow": 200, "region": 200, "reserve_act_number": 100,
              "degree": 64, "kind": 64, "officer_category": 64, "engagement": 64, "level": 32,
              "form": 32, "housing_kind": 64, "relation": 120}

    def clip(value):
        if isinstance(value, list):
            return [clip(item) for item in value]
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                if key == "extra":
                    result[key] = item
                elif isinstance(item, str):
                    result[key] = item[:limits.get(key, 300)]
                else:
                    result[key] = clip(item)
            return result
        return value

    result = clip(result)
    for key in ("program_year", "regional_program_year"):
        if result["program"][key] is not None and result["program"][key] < 2000:
            result["program"][key] = None
    return DraftIn.model_validate(result)


def from_legacy(snapshot: dict, previous: dict | None = None) -> dict:
    """Адаптация по ID, не по позиции; исходные extra и точные строки не теряются."""
    q = copy.deepcopy(previous) if previous else Questionnaire().model_dump()
    old_data = q.get("legacy_data") or {}
    baseline = legacy_input(previous).model_dump(mode="json") if previous else {}
    kin = snapshot.get("kinship") or {}
    retained = {
        "reserve_act_date": snapshot.get("reserve_act_date"),
        "reserve_act_number": snapshot.get("reserve_act_number", ""),
        "additional_relatives": copy.deepcopy((kin.get("relatives") or [])[1:]),
        "service_periods": {}, "records": {}, "activities": {},
    }

    def update_fields(row, mapped, raw, projected, keys=None):
        for key, value in mapped.items():
            source = (keys or {}).get(key, key)
            # Не округляем сумму/не урезаем строку, если прежний клиент вернул
            # неизменённую совместимую проекцию. Вложенные extra ниже тоже сохраняются.
            if key not in row or not projected or raw.get(source) != projected.get(source):
                row[key] = value

    c = q["candidate"]
    person, program = snapshot.get("person") or {}, snapshot.get("program") or {}
    update_fields(c, {
        "full_name": _text(person.get("full_name")), "birth_year": _text(person.get("birth_year")),
        "phone": _text(person.get("phone")), "email": _text(person.get("email")),
        "workplace": _text(person.get("current_workplace")),
    }, person, baseline.get("person"), {"workplace": "current_workplace"})
    update_fields(c, {key: _text(program.get(key)) for key in (
        "flow", "program_year", "region", "regional_program", "regional_program_year",
    )}, program, baseline.get("program"))
    update_fields(c, {
        "work_status": _reverse(WORK, snapshot.get("work_status")),
        "appointment_authority": _text(snapshot.get("appointment_authority")),
    }, snapshot, baseline)
    if not baseline or any(
        snapshot.get(key) != baseline.get(key) for key in ("reserve_act_number", "reserve_act_date")
    ):
        c["reserve_act_details"] = " от ".join(filter(None, [
            snapshot.get("reserve_act_number"), snapshot.get("reserve_act_date"),
        ]))
    retained["reserve_act_details_source"] = c["reserve_act_details"]
    q["relative_answer"] = _answer(kin.get("has_relative"))
    relative = (kin.get("relatives") or [{}])[0]
    old_kin = baseline.get("kinship") or {}
    old_relative = (old_kin.get("relatives") or [{}])[0]
    if relative or kin.get("has_relative") is True or not previous:
        update_fields(q["kinship"], {
            "full_name": _text(relative.get("full_name")), "degree": _reverse(DEGREE, relative.get("degree")),
            "status": _reverse(PARTICIPANT, relative.get("participant_status")),
        }, relative, old_relative, {"status": "participant_status"})
    if not previous or kin.get("received_payments") != old_kin.get("received_payments"):
        q["kinship"]["received_payments"] = _answer(kin.get("received_payments"))
    if kin.get("has_relative") is not True and previous:
        retained["additional_relatives"] = copy.deepcopy(old_data.get("additional_relatives", []))
    elif previous:
        prior = old_data.get("additional_relatives", [])
        projected_relatives = old_kin.get("relatives", [])[1:]
        for index, relative in enumerate(retained["additional_relatives"]):
            original = next((item for item in prior if (
                item.get("id") and item.get("id") == relative.get("id")
            )), None)
            projected = next((item for item in projected_relatives
                              if item.get("id") and item.get("id") == relative.get("id")), None)
            if original is None and not relative.get("id") and index < len(prior):
                original = prior[index]
                projected = projected_relatives[index] if index < len(projected_relatives) else None
            if original and projected:
                for key in ("full_name", "degree", "participant_status"):
                    if relative.get(key) == projected.get(key):
                        relative[key] = copy.deepcopy(original.get(key))

    def flat(extra) -> dict[str, str]:
        if not isinstance(extra, dict):
            return {}
        return {key: value for key, value in extra.items() if isinstance(value, str) and len(value) <= 4000}

    def merge_row(raw, index, name, previous_rows, projected_rows, stored_rows):
        extra = raw.get("extra") or {}
        embedded = extra.get("questionnaire_record") if name.startswith("record-") else extra
        identity = _text((embedded or {}).get("id")) if isinstance(embedded, dict) else ""
        source_id = _text(raw.get("id"))
        by_id = {row["id"]: row for row in previous_rows}
        old_row = by_id.get(identity) or by_id.get(source_id)
        if old_row is None and source_id:
            old_row = next((row for row in previous_rows
                            if stored_rows.get(row["id"], {}).get("source_id") == source_id), None)
        # Старый контракт без ID может адресовать строку лишь по позиции. Этот
        # fallback не применяется к новой/переставленной строке с явным ID.
        if old_row is None and not identity and not source_id and index < len(previous_rows):
            old_row = previous_rows[index]
        logical_id = identity or (old_row or {}).get("id") or source_id or f"legacy-{name}-{index}"
        row = {**(old_row or {}), **flat(embedded)}
        row["id"] = logical_id
        def embedded_identity(item):
            values = item.get("extra") or {}
            if name.startswith("record-"):
                values = values.get("questionnaire_record")
            return values.get("id") if isinstance(values, dict) else None

        projected = next((item for item in projected_rows if embedded_identity(item) == logical_id), None)
        return row, extra, projected, source_id

    def remaining_extra(extra, mapped_keys, original=None, projected=None):
        result = {key: copy.deepcopy(value) for key, value in extra.items()
                  if key not in {"id", "questionnaire_record"}
                  and (key not in mapped_keys or not isinstance(value, str))}
        embedded = extra.get("questionnaire_record")
        if "questionnaire_record" in extra and not projected:
            # Имя внутреннего поля могло уже встречаться в неизвестных старых
            # данных — сохраняем даже скаляр/список и совпадающие имена реквизитов.
            result["questionnaire_record"] = copy.deepcopy(embedded)
        elif isinstance(embedded, dict):
            additional = {key: copy.deepcopy(value) for key, value in embedded.items()
                          if key not in mapped_keys | {"id"}}
            prior = (original or {}).get("questionnaire_record")
            if isinstance(prior, dict):
                result["questionnaire_record"] = {**copy.deepcopy(prior), **additional}
            elif prior is None and additional:
                result["questionnaire_record"] = additional
        elif "questionnaire_record" in extra:
            result["questionnaire_record"] = copy.deepcopy(embedded)
        return result

    def merged_rows(name, convert, keys):
        rows = []
        previous_rows = q[name]
        for index, raw in enumerate(snapshot.get(name, [])):
            row, extra, projected, source_id = merge_row(
                raw, index, name, previous_rows, baseline.get(name, []), old_data.get(name, {}),
            )
            update_fields(row, convert(raw, extra), raw, projected, keys)
            rows.append(row)
            retained[name][row["id"]] = {
                "source_id": source_id or None,
                "extra": {
                    **old_data.get(name, {}).get(row["id"], {}).get("extra", {}),
                    **remaining_extra(extra, {
                    "kind", "category", "organization", "start", "end", "engagement",
                    "period_from", "period_to", "basis", "document_id",
                    }, original=old_data.get(name, {}).get(row["id"], {}).get("extra"), projected=projected),
                },
            }
        return rows

    q["service_periods"] = merged_rows("service_periods", lambda r, e: {
        "kind": _reverse(SERVICE, r.get("kind")), "category": _text(r.get("officer_category")),
        "organization": _text(e.get("organization", "")),
        "start": _text(r.get("start_date")), "end": _text(r.get("end_date")),
    }, {"category": "officer_category", "start": "start_date", "end": "end_date"})
    family = {row["id"]: row for row in q["family_recipients"]}
    blocks = {block["category"]: block for block in snapshot.get("payments", [])}
    projected_blocks = {block["category"]: block for block in baseline.get("payments", [])}
    projection_keys = LEGACY_RECORD_KEYS
    for index, category_name in enumerate(CATEGORIES):
        category = str(index)
        block = blocks.get(category_name, {})
        q["category_answers"][category] = _answer(block.get("answer"))
        previous_rows = q["records"].get(category, [])
        projected_rows = projected_blocks.get(category_name, {}).get("records", [])
        rows = []
        retained["records"][category] = {}
        for ordinal, raw in enumerate(block.get("records", [])):
            row, extra, projected, source_id = merge_row(
                raw, ordinal, f"record-{category}", previous_rows, projected_rows,
                old_data.get("records", {}).get(category, {}),
            )
            mapped = {
                "recipient": _text(raw.get("recipient_name")),
                "recipient_kind": _reverse(RECIPIENT, raw.get("recipient_kind")),
                "title": _text(raw.get("title")), "basis": _text(raw.get("basis")),
                "amount": _text(raw.get("amount")), "period_from": _text(raw.get("period_from")),
                "period_to": _text(raw.get("period_to")), "payment_date": _text(raw.get("payment_date")),
                "event_date": _text(raw.get("event_date")), "document_id": _text(raw.get("document_id")),
                "form": _reverse({"Денежная": "monetary", "Натуральная": "in_kind"}, raw.get("form")),
                "level": _reverse({"Федеральный": "federal", "Региональный": "regional",
                                   "Муниципальный": "municipal"}, raw.get("level")),
                "housing_kind": _reverse({
                    "Субсидия": "subsidy", "Компенсация": "compensation", "Предоставление жилья": "property",
                    "Кредит · учитывается отдельно": "credit",
                }, raw.get("housing_kind")),
            }
            if index == 4:
                mapped["basis_type"] = _text(raw.get("kind_text"))
            if index == 9:
                mapped["description"] = _text(raw.get("title"))
            update_fields(row, mapped, raw, projected, projection_keys)
            for key, value in flat(extra).items():
                if key not in row:
                    row[key] = value
            if index == 9 and "description" not in row:
                row["description"] = _text(raw.get("title"))
            if index == 6:
                recipient_id = row.get("recipient_id") or f"legacy-family-{row['id']}"
                row["recipient_id"] = recipient_id
                recipient = family.get(recipient_id, {"id": recipient_id})
                update_fields(recipient, {
                    "full_name": _text(raw.get("recipient_name")), "relation": _text(raw.get("relation")),
                    "year": _text(raw.get("recipient_birth_year")),
                }, raw, projected, {"full_name": "recipient_name", "year": "recipient_birth_year"})
                family[recipient_id] = recipient
            rows.append(row)
            # Обычные поля уже сохранены точно в row. Здесь остаются лишь реквизиты,
            # которых нет в форме, и вложенные extra; скрытый row.amount не дублируется.
            previous_extra = old_data.get("records", {}).get(category, {}).get(row["id"], {})
            retained_record = {}
            for key in ("recipient_birth_year", "relation", "document_ref", "kind_text"):
                if key not in raw or index == 6 or (index == 4 and key == "kind_text"):
                    continue
                value = previous_extra[key] if (
                    key in previous_extra and projected and raw.get(key) == projected.get(key)
                ) else raw[key]
                retained_record[key] = copy.deepcopy(value)
            retained["records"][category][row["id"]] = retained_record
            visible_sources = {projection_keys.get(key, key) for key in record_keys(q, index, row)}
            additional_fields = {}
            for key, value in raw.items():
                if key in visible_sources | {"id", "extra", *retained_record} or value is None or value == "":
                    continue
                original = previous_extra.get("fields", {}).get(key, value)
                additional_fields[key] = copy.deepcopy(original if (
                    projected and value == projected.get(key)
                ) else value)
            retained["records"][category][row["id"]].update({
                "source_id": source_id or None,
                "fields": additional_fields,
                "extra": {
                    **old_data.get("records", {}).get(category, {}).get(row["id"], {}).get("extra", {}),
                    **remaining_extra(extra, set(projection_keys) | {
                    "assignment_id", "payer", "authority", "code", "event_kind", "expected_year",
                    "decision_date", "acquisition_date", "description", "organization", "recipient_id",
                    }, original=previous_extra.get("extra"), projected=projected),
                },
            })
        q["records"][category] = rows
        if index == 3:
            if block.get("answer") == "no":
                q["support_levels"] = dict.fromkeys(LEVELS, "Нет")
            else:
                for level in LEVELS:
                    if any(row.get("level") == level for row in rows):
                        q["support_levels"][level] = "Да"
                    elif not previous:
                        # Общий ответ «Да» не означает, что на остальных уровнях выплат не было.
                        q["support_levels"][level] = ""
        if index == 4:
            if block.get("answer") == "no":
                q["personal_insurance_answer"] = "Нет"
            elif any(row.get("recipient_kind") == "Сам резервист" for row in rows):
                q["personal_insurance_answer"] = "Да"
            elif not previous:
                q["personal_insurance_answer"] = ""
    q["family_recipients"] = list(family.values())
    q["activity_answer"] = _answer(snapshot.get("activity_participates"))
    q["activities"] = merged_rows("activities", lambda r, e: {
        "organization": _text(r.get("organization")), "kind": _reverse(ACTIVITY, r.get("kind")),
        "engagement": _text(r.get("engagement")), "period_from": _text(r.get("period_from")),
        "period_to": _text(r.get("period_to")), "basis": _text(r.get("basis_document")),
    }, {"basis": "basis_document"})
    q["legacy_data"] = retained
    return Questionnaire.model_validate(q).model_dump()


QUESTIONNAIRE_RULES = [
    {"id": "РО-01", "title": "Получатель и основание выплаты",
     "description": "Связь с родственником при основании личного участия; сопоставление человеком."},
    {"id": "ДУ-01", "title": "Возможный дубль назначения",
     "description": "Совпадение назначения, получателя, плательщика и суммы; без автоматического вычитания."},
    {"id": "ДЕ-01", "title": "Пересечение периодов деятельности и службы",
     "description": "Сопоставление введённых периодов; юридическую применимость оценивает специалист."},
]


def signal_hits(q: dict) -> list[dict]:
    """Три вопроса только по введённым полям. OCR/выводы о нарушении отсутствуют."""
    hits = []
    relative = next((r for r in active_records(q, 4) if (
        r.get("recipient_kind") == "Резервист за родственника" and r.get("basis_type") == "За личное участие"
    )), None)
    if relative:
        hits.append({
            "rule_id": "РО-01", "title": "Получатель и основание выплаты",
            "explanation": "Указана связь с родственником, но выбрано основание личного участия. "
                           "Содержание файла не распознавалось.",
            "action": "Сопоставьте основание с оригиналом документа",
            "payload": {"record_id": relative["id"]},
        })
    records = [r for category in range(5) for r in active_records(q, category)]

    def same_assignment(row, other):
        amount, other_amount = _amount(row.get("amount")), _amount(other.get("amount"))
        return bool(row.get("assignment_id")) and row["id"] != other["id"] and all(
            other.get(key) == row.get(key) for key in ("assignment_id", "recipient", "payer")
        ) and amount is not None and other_amount is not None and Decimal(amount) == Decimal(other_amount)

    duplicate = next((row for row in records if any(same_assignment(row, other) for other in records)), None)
    if duplicate:
        other = next(row for row in records if same_assignment(duplicate, row))
        hits.append({
            "rule_id": "ДУ-01", "title": "Возможный дубль назначения",
            "explanation": "Совпадают получатель, сумма, плательщик и идентификатор назначения. "
                           "Это не доказательство повторной выплаты.",
            "action": "Сопоставьте оба документа; не вычитайте сумму автоматически",
            "payload": {"record_id": duplicate["id"], "other_record_id": other["id"]},
        })
    if q["activity_answer"] == "Да" and any(
        s.get("kind") == "Военная служба" and s.get("start") and a.get("period_from")
        and s["start"] <= (a.get("period_to") or "9999-12-31")
        and a["period_from"] <= (s.get("end") or "9999-12-31")
        for s in q["service_periods"] for a in q["activities"]
    ):
        hits.append({
            "rule_id": "ДЕ-01", "title": "Пересечение периодов деятельности и службы",
            "explanation": "Периоды из введённых сведений пересекаются. "
                           "Юридическую применимость оценивает специалист.",
            "action": "Сопоставьте договор, период и необходимость уведомления", "payload": {},
        })
    return hits
