"""Pydantic-схемы домена profile: черновик резервиста, версии, проверки, ревью.

Имена полей — snake_case, синхронизированы со снапшотом версии и с клиентом
`frontend/src/profile` (SPEC.md §10.5).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domains.profile.models import (
    MessageKind,
    ParticipantStatus,
    PaymentAnswer,
    PaymentCategory,
    ProfileStatus,
    RecipientKind,
    ReviewResult,
    SignalStatus,
    WorkStatus,
)
from app.domains.profile.questionnaire import Questionnaire

# ---------- Входные схемы черновика (PUT /api/profile — полная замена) ----------


class PersonIn(BaseModel):
    full_name: str = ""
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    phone: str = ""
    email: str = ""
    current_workplace: str = ""


class ProgramIn(BaseModel):
    flow: str = ""
    program_year: int | None = Field(default=None, ge=2000, le=2100)
    region: str = ""
    regional_program: str = ""
    regional_program_year: int | None = Field(default=None, ge=2000, le=2100)


class ServicePeriodIn(BaseModel):
    id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    kind: str = "military"
    officer_category: str = ""
    extra: dict = Field(default_factory=dict)


class KinshipRelativeIn(BaseModel):
    id: uuid.UUID | None = None
    full_name: str = ""
    degree: str = ""
    participant_status: ParticipantStatus | None = None


class KinshipIn(BaseModel):
    has_relative: bool | None = None
    received_payments: bool | None = None
    relatives: list[KinshipRelativeIn] = []


class PaymentRecordIn(BaseModel):
    id: uuid.UUID | None = None
    recipient_kind: RecipientKind | None = None
    recipient_name: str = ""
    recipient_birth_year: int | None = Field(default=None, ge=1900, le=2100)
    relation: str = ""
    title: str = ""
    kind_text: str = ""
    basis: str = ""
    level: str = ""
    form: str = ""
    amount: Decimal | None = None
    period_from: date | None = None
    period_to: date | None = None
    payment_date: date | None = None
    event_date: date | None = None
    housing_kind: str = ""
    document_ref: str = ""
    document_id: uuid.UUID | None = None
    extra: dict = {}


class PaymentBlockIn(BaseModel):
    category: PaymentCategory
    answer: PaymentAnswer | None = None
    records: list[PaymentRecordIn] = []


class ActivityIn(BaseModel):
    id: uuid.UUID | None = None
    organization: str = ""
    kind: str = ""
    engagement: str = ""
    period_from: date | None = None
    period_to: date | None = None
    basis_document: str = ""
    extra: dict = Field(default_factory=dict)


class DraftIn(BaseModel):
    """Полная замена черновика — идемпотентный PUT агрегата."""

    person: PersonIn = PersonIn()
    program: ProgramIn = ProgramIn()
    reserve_act_number: str = ""
    reserve_act_date: date | None = None
    work_status: WorkStatus | None = None
    appointment_authority: str = ""
    service_periods: list[ServicePeriodIn] = []
    kinship: KinshipIn = KinshipIn()
    payments: list[PaymentBlockIn] = []
    activity_participates: bool | None = None
    activities: list[ActivityIn] = []
    questionnaire: Questionnaire | None = None
    revision: int | None = Field(default=None, ge=0)
    private_reply: str | None = Field(default=None, max_length=4000)

    @field_validator("payments")
    @classmethod
    def unique_categories(cls, value: list[PaymentBlockIn]) -> list[PaymentBlockIn]:
        if len({block.category for block in value}) != len(value):
            raise ValueError("Категория выплат повторяется в черновике")
        return value


# ---------- Выходные схемы черновика ----------


class PersonOut(PersonIn):
    pass


class ProgramOut(ProgramIn):
    pass


class ServicePeriodOut(ServicePeriodIn):
    id: uuid.UUID


class KinshipRelativeOut(KinshipRelativeIn):
    id: uuid.UUID


class PaymentRecordOut(PaymentRecordIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class PaymentBlockOut(BaseModel):
    category: PaymentCategory
    answer: PaymentAnswer | None
    records: list[PaymentRecordOut]


class ActivityOut(ActivityIn):
    id: uuid.UUID


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    size: int
    kind: str
    created_at: datetime
    section: str = ""
    origin: Literal["upload", "sample"] = "upload"
    url: str = ""
    profile_revision: int = 0
    version_number: int | None = None


class DraftOut(BaseModel):
    """Агрегированный черновик профиля + статус и прогресс."""

    profile_id: uuid.UUID
    status: ProfileStatus
    progress: int
    person: PersonOut
    program: ProgramOut
    reserve_act_number: str
    reserve_act_date: date | None
    work_status: WorkStatus | None
    appointment_authority: str
    service_periods: list[ServicePeriodOut]
    kinship: KinshipIn  # relatives — с id? оставляем In-форму + ids через relatives ниже
    relatives: list[KinshipRelativeOut]
    payments: list[PaymentBlockOut]
    activity_participates: bool | None
    activities: list[ActivityOut]
    documents: list[DocumentOut]
    versions_total: int
    updated_at: datetime
    questionnaire: Questionnaire
    contract_version: Literal["questionnaire-v1"] = "questionnaire-v1"
    revision: int = 0
    private_reply: str = ""
    is_demo: bool = False
    editable: bool = True
    can_load_demo: bool = False


class MilestoneOut(BaseModel):
    percent: int
    title: str
    done: bool


class CompletenessOut(BaseModel):
    progress: int
    milestones: list[MilestoneOut]
    missing: list[str]
    can_submit: bool


class VersionOut(BaseModel):
    id: uuid.UUID
    number: int
    status: ProfileStatus
    progress: int
    created_at: datetime


class VersionDetailOut(VersionOut):
    snapshot: dict
    profile_revision: int = 0


class SubmitIn(BaseModel):
    confirmed: bool = False
    revision: int | None = Field(default=None, ge=0)


class SampleDocumentIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    section: str = Field(default="Учебный пример", max_length=300)
    kind: Literal["basis", "consent"] = "basis"
    revision: int = Field(ge=0)


class DiffEntryOut(BaseModel):
    """Одно изменение между снапшотами: путь + значение до/после.

    `before`/`after` — `null` при добавлении/удалении элемента списка."""

    path: str
    before: Any = None
    after: Any = None


class VersionDiffOut(BaseModel):
    """Результат сравнения двух опубликованных версий («что изменилось»)."""

    version_from: int
    version_to: int
    changed: int
    entries: list[DiffEntryOut]


# ---------- Проверяющий ----------


class QueueItemOut(BaseModel):
    profile_id: uuid.UUID
    full_name: str
    program: str  # региональная программа / поток
    status: ProfileStatus
    progress: int
    submitted_at: datetime | None
    pending_signals: int
    reviewer_name: str  # назначенный проверяющий
    version_number: int = 1
    region: str = ""
    reporting_period: str = ""
    program_year: str = ""
    is_demo: bool = False


class SignalOut(BaseModel):
    id: uuid.UUID
    rule_id: str
    title: str
    explanation: str
    action: str
    payload: dict
    status: SignalStatus
    created_at: datetime
    version_id: uuid.UUID | None = None
    version_number: int = 0
    decisions: list["SignalDecisionOut"] = Field(default_factory=list)


class SignalDecisionIn(BaseModel):
    status: Literal["reviewed", "clarification", "dismissed", "included"]
    comment: str = Field(min_length=5, max_length=2000)
    version: int = Field(ge=1)
    request_clarification: bool = False

    @field_validator("comment")
    @classmethod
    def meaningful_comment(cls, value: str) -> str:
        if len(value.strip()) < 5:
            raise ValueError("Комментарий должен содержать не менее пяти символов")
        return value.strip()


class SignalDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    status: SignalStatus
    comment: str
    author_name: str
    created_at: datetime


class ReviewDecisionIn(BaseModel):
    action: Literal["accept", "clarification", "complete", "remove"]
    comment: str = Field(min_length=5, max_length=4000)
    basis: str = Field(default="", max_length=4000)
    document_id: uuid.UUID | None = None
    checks: list[bool] = Field(default_factory=list, max_length=3)
    version: int = Field(ge=1)

    @field_validator("comment")
    @classmethod
    def meaningful_comment(cls, value: str) -> str:
        if len(value.strip()) < 5:
            raise ValueError("Комментарий должен содержать не менее пяти символов")
        return value.strip()


class DocumentAssessmentIn(BaseModel):
    version: int = Field(ge=1)
    status: Literal["usable", "details", "unreadable"]
    comment: str = Field(min_length=5, max_length=4000)
    request_clarification: bool = False

    @field_validator("comment")
    @classmethod
    def meaningful_comment(cls, value: str) -> str:
        if len(value.strip()) < 5:
            raise ValueError("Комментарий должен содержать не менее пяти символов")
        return value.strip()


class DocumentAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    document_id: uuid.UUID
    version_id: uuid.UUID
    version_number: int
    status: Literal["usable", "details", "unreadable"]
    comment: str
    author_name: str
    created_at: datetime


class ClientEventIn(BaseModel):
    event: Literal["view", "print", "template", "selfcheck", "open", "close"]
    screen: str = Field(default="", max_length=64)
    version: int | None = Field(default=None, ge=1)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)

    @field_validator("text")
    @classmethod
    def nonempty_message(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Сообщение не должно состоять только из пробелов")
        return value.strip()


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_role: str
    author_name: str
    kind: MessageKind
    text: str
    created_at: datetime
    version_number: int | None = None


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_name: str
    actor_role: str
    action: str
    created_at: datetime
    scope: Literal["private", "submitted"]


class ContactOut(BaseModel):
    id: uuid.UUID
    name: str
    responsibility: str
    phone: str
    email: str


class IncomeCategoryTotal(BaseModel):
    category: str
    total: str


class IncomeSummaryOut(BaseModel):
    """Финансовая сводка «Сведения о доходах» (SPEC §10.8): только денежные
    поступления (`form=monetary`); `non_monetary`/`in_kind` не входят."""

    currency: str = "RUB"
    total: str
    records: int
    family_total: str = "0.00"
    family_records: int = 0
    by_category: list[IncomeCategoryTotal]


class ReviewerProfileOut(BaseModel):
    """Карточка проверяющего: последняя опубликованная версия + сигналы + переписка."""

    profile_id: uuid.UUID
    full_name: str
    status: ProfileStatus
    revision: int
    version: VersionDetailOut
    signals: list[SignalOut]
    pending_signals: int
    messages: list[MessageOut]
    reviews: list["ReviewOut"]
    assigned_reviewer: str
    income_summary: IncomeSummaryOut
    document_assessments: list[DocumentAssessmentOut] = Field(default_factory=list)
    contract_version: Literal["questionnaire-v1"] = "questionnaire-v1"
    is_demo: bool = False
    result_documents: list[DocumentOut] = Field(default_factory=list)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    result: ReviewResult
    basis_text: str
    comment: str
    author_name: str
    created_at: datetime
    document_id: uuid.UUID | None = None
    version_id: uuid.UUID | None = None
    checks: list[bool] = Field(default_factory=list)


class ReviewStateOut(BaseModel):
    reviews: list[ReviewOut]
    document_assessments: list[DocumentAssessmentOut]
    result_documents: list[DocumentOut]


ReviewerProfileOut.model_rebuild()
SignalOut.model_rebuild()
