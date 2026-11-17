"""Pydantic-схемы домена profile: черновик резервиста, версии, проверки, ревью.

Имена полей — snake_case, синхронизированы со снапшотом версии и с клиентом
`frontend/src/profile` (SPEC.md §10.5).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
    start_date: date | None = None
    end_date: date | None = None
    kind: str = "military"
    officer_category: str = ""


class KinshipRelativeIn(BaseModel):
    full_name: str = ""
    degree: str = ""
    participant_status: ParticipantStatus | None = None


class KinshipIn(BaseModel):
    has_relative: bool | None = None
    received_payments: bool | None = None
    relatives: list[KinshipRelativeIn] = []


class PaymentRecordIn(BaseModel):
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
    organization: str = ""
    kind: str = ""
    engagement: str = ""
    period_from: date | None = None
    period_to: date | None = None
    basis_document: str = ""


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
    id: uuid.UUID
    filename: str
    size: int
    kind: str
    created_at: datetime


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


class SignalOut(BaseModel):
    id: uuid.UUID
    rule_id: str
    title: str
    explanation: str
    action: str
    payload: dict
    status: SignalStatus
    created_at: datetime


class SignalDecisionIn(BaseModel):
    status: Literal["reviewed", "clarification", "dismissed"]
    comment: str = Field(min_length=5, max_length=2000)


class SignalDecisionOut(BaseModel):
    id: uuid.UUID
    status: SignalStatus
    comment: str
    author_name: str
    created_at: datetime


class ReviewDecisionIn(BaseModel):
    action: Literal["accept", "clarification", "complete", "remove"]
    comment: str = Field(min_length=5, max_length=4000)
    basis: str = ""  # основание — обязательно для remove


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: uuid.UUID
    author_role: str
    author_name: str
    kind: MessageKind
    text: str
    created_at: datetime


class AuditEventOut(BaseModel):
    id: uuid.UUID
    actor_name: str
    actor_role: str
    action: str
    created_at: datetime


class ContactOut(BaseModel):
    id: uuid.UUID
    name: str
    responsibility: str
    phone: str
    email: str


class ReviewerProfileOut(BaseModel):
    """Карточка проверяющего: последняя опубликованная версия + сигналы + переписка."""

    profile_id: uuid.UUID
    full_name: str
    status: ProfileStatus
    version: VersionDetailOut
    signals: list[SignalOut]
    pending_signals: int
    messages: list[MessageOut]
    reviews: list["ReviewOut"]
    assigned_reviewer: str


class ReviewOut(BaseModel):
    id: uuid.UUID
    result: ReviewResult
    basis_text: str
    comment: str
    author_name: str
    created_at: datetime


ReviewerProfileOut.model_rebuild()
