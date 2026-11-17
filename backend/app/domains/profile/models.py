"""Модель финансового профиля резервиста — этап 2 (SPEC.md §10).

Один профиль на пользователя-резервиста (`owner_id` уникален). Черновик приватен;
при публикации создаётся неизменный `ProfileVersion`-слепок всего агрегата —
проверяющий видит только опубликованные версии. Решения проверяющего, сигналы,
сообщения и аудит — append-only.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, JSONType
from app.domains.identity.models import UserRole  # noqa: F401 — типы аудита


class ProfileStatus(str, enum.Enum):
    DRAFT = "draft"  # черновик — виден только резервисту
    SUBMITTED = "submitted"  # «Сведения представлены»
    ACCEPTED = "accepted"  # «Принят к рассмотрению»
    CLARIFICATION = "clarification"  # «Требуется уточнение»
    RESUBMITTED = "resubmitted"  # повторно представлен после уточнений
    COMPLETED = "completed"  # «Рассмотрение завершено»
    REMOVED = "removed"  # «Снят с рассмотрения»


class WorkStatus(str, enum.Enum):
    SERVING = "serving"  # проходит службу
    OUTSIDE = "outside"  # вне службы
    RESERVE = "reserve"  # в запасе
    RETIRED = "retired"  # в отставке


class PaymentAnswer(str, enum.Enum):
    YES = "yes"
    NO = "no"
    PLANNED = "planned"


class PaymentCategory(str, enum.Enum):
    ONE_TIME = "one_time"  # единовременные выплаты
    ALLOWANCE = "allowance"  # пособия
    SUPPORT = "support"  # меры социальной поддержки
    INSURANCE = "insurance"  # страховое обеспечение
    FAMILY = "family"  # выплаты членам семьи
    MATERIAL_AID = "material_aid"  # материальная помощь
    HOUSING = "housing"  # жилищные меры
    MONETARY_ALLOWANCE = "monetary_allowance"  # денежное довольствие
    ALLOWANCES = "allowances"  # надбавки
    NON_MONETARY = "non_monetary"  # неденежные меры


PAYMENT_CATEGORIES: tuple[PaymentCategory, ...] = tuple(PaymentCategory)


class RecipientKind(str, enum.Enum):
    CANDIDATE = "candidate"  # кандидат
    FAMILY_MEMBER = "family_member"  # член семьи
    RELATIVE_PARTICIPANT = "relative_participant"  # родственник — участник СВО


class ParticipantStatus(str, enum.Enum):
    PARTICIPATING = "participating"  # участвует
    PARTICIPATED = "participated"  # участвовал
    DECEASED = "deceased"  # погиб
    MISSING = "missing"  # пропал без вести


class SignalStatus(str, enum.Enum):
    UNREVIEWED = "unreviewed"  # новое несоответствие
    REVIEWED = "reviewed"  # просмотрено проверяющим
    CLARIFICATION = "clarification"  # запрошено уточнение
    DISMISSED = "dismissed"  # признано несущественным


class ReviewResult(str, enum.Enum):
    COMPLETED = "completed"  # рассмотрение завершено
    REMOVED = "removed"  # снят с рассмотрения


class MessageKind(str, enum.Enum):
    QUESTION = "question"  # вопрос проверяющего
    REPLY = "reply"  # ответ резервиста
    NOTE = "note"  # служебная заметка проверяющего


class AuditScope(str, enum.Enum):
    PRIVATE = "private"  # действия резервиста до публикации
    SUBMITTED = "submitted"  # действия по опубликованной версии


class Profile(Base):
    """Агрегат профиля: анкета + поток + акт + дети (периоды, родственники, выплаты)."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # Анкета (SPEC §10.4, milestone 10%).
    full_name: Mapped[str] = mapped_column(String(300), default="")
    birth_year: Mapped[int | None] = mapped_column()
    phone: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    current_workplace: Mapped[str] = mapped_column(String(300), default="")

    # Поток и программа.
    flow: Mapped[str] = mapped_column(String(200), default="")  # поток
    program_year: Mapped[int | None] = mapped_column()  # год программы
    region: Mapped[str] = mapped_column(String(200), default="")  # регион
    regional_program: Mapped[str] = mapped_column(String(300), default="")
    regional_program_year: Mapped[int | None] = mapped_column()

    # Реквизиты акта о зачислении (milestone 30%).
    reserve_act_number: Mapped[str] = mapped_column(String(100), default="")
    reserve_act_date: Mapped[date | None] = mapped_column(Date)

    work_status: Mapped[WorkStatus | None] = mapped_column(
        Enum(WorkStatus, native_enum=False, validate_strings=True, length=32)
    )
    appointment_authority: Mapped[str] = mapped_column(String(300), default="")

    # Блок родства с участником СВО (вопросы да/нет — отдельно от списка родственников).
    has_svo_relative: Mapped[bool | None] = mapped_column()
    received_relative_payments: Mapped[bool | None] = mapped_column()
    # Участие в доп. деятельности (преподавание, экспертиза…).
    activity_participates: Mapped[bool | None] = mapped_column()

    status: Mapped[ProfileStatus] = mapped_column(
        Enum(ProfileStatus, native_enum=False, validate_strings=True, length=32),
        default=ProfileStatus.DRAFT,
        index=True,
    )
    progress: Mapped[int] = mapped_column(default=0)  # денормализовано для очереди
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    service_periods: Mapped[list["ServicePeriod"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="ServicePeriod.sort"
    )
    relatives: Mapped[list["KinshipRelative"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="KinshipRelative.sort"
    )
    payment_blocks: Mapped[list["PaymentBlock"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="PaymentBlock.sort"
    )
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="Activity.sort"
    )
    documents: Mapped[list["ProfileDocument"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    versions: Mapped[list["ProfileVersion"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="ProfileVersion.number"
    )


class ServicePeriod(Base):
    """Период службы / государственной службы (milestone 50%)."""

    __tablename__ = "service_periods"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)  # NULL — по настоящее время
    kind: Mapped[str] = mapped_column(String(64), default="military")  # military|state|other
    officer_category: Mapped[str] = mapped_column(String(64), default="")  # junior|senior|higher|volunteer
    sort: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="service_periods")


class KinshipRelative(Base):
    """Родственник — участник СВО (степень родства + статус участника)."""

    __tablename__ = "kinship_relatives"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(300), default="")
    degree: Mapped[str] = mapped_column(String(64), default="")  # spouse|child|parent|other
    participant_status: Mapped[ParticipantStatus | None] = mapped_column(
        Enum(ParticipantStatus, native_enum=False, validate_strings=True, length=32)
    )
    sort: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="relatives")


class PaymentBlock(Base):
    """Ответ по категории выплат (да/нет/планируется) + записи."""

    __tablename__ = "payment_blocks"
    __table_args__ = (UniqueConstraint("profile_id", "category", name="uq_payment_blocks_profile_category"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[PaymentCategory] = mapped_column(
        Enum(PaymentCategory, native_enum=False, validate_strings=True, length=32)
    )
    answer: Mapped[PaymentAnswer | None] = mapped_column(
        Enum(PaymentAnswer, native_enum=False, validate_strings=True, length=16)
    )
    sort: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="payment_blocks")
    records: Mapped[list["PaymentRecord"]] = relationship(
        back_populates="block", cascade="all, delete-orphan", order_by="PaymentRecord.sort"
    )


class PaymentRecord(Base):
    """Запись о выплате: получатель → вид → основание → период → документ.

    Общие поля — колонками; редкие реквизиты категорий (редакция НПА, код меры,
    дата решения, плановый год и т.п.) — в `extra` JSONB.
    """

    __tablename__ = "payment_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    block_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment_blocks.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    sort: Mapped[int] = mapped_column(default=0)

    recipient_kind: Mapped[RecipientKind | None] = mapped_column(
        Enum(RecipientKind, native_enum=False, validate_strings=True, length=32)
    )
    recipient_name: Mapped[str] = mapped_column(String(300), default="")
    recipient_birth_year: Mapped[int | None] = mapped_column()
    relation: Mapped[str] = mapped_column(String(120), default="")  # связь с кандидатом

    title: Mapped[str] = mapped_column(String(300), default="")  # наименование
    kind_text: Mapped[str] = mapped_column(String(300), default="")  # вид выплаты
    basis: Mapped[str] = mapped_column(String(300), default="")  # основание / НПА
    level: Mapped[str] = mapped_column(String(32), default="")  # federal|regional|municipal
    form: Mapped[str] = mapped_column(String(32), default="")  # monetary|in_kind
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    period_from: Mapped[date | None] = mapped_column(Date)
    period_to: Mapped[date | None] = mapped_column(Date)
    payment_date: Mapped[date | None] = mapped_column(Date)
    event_date: Mapped[date | None] = mapped_column(Date)  # дата события-основания
    housing_kind: Mapped[str] = mapped_column(String(64), default="")  # subsidy|compensation|property|credit
    document_ref: Mapped[str] = mapped_column(String(300), default="")  # реквизиты/имя документа
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profile_documents.id", ondelete="SET NULL")
    )
    extra: Mapped[dict] = mapped_column(JSONType, default=dict)

    block: Mapped[PaymentBlock] = relationship(back_populates="records")


class Activity(Base):
    """Дополнительная деятельность: преподавание, экспертиза, консультирование…"""

    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    organization: Mapped[str] = mapped_column(String(300), default="")
    # teaching|expertise|consulting|commission|other
    kind: Mapped[str] = mapped_column(String(64), default="")
    engagement: Mapped[str] = mapped_column(String(64), default="")  # periodic|one_time|contract
    period_from: Mapped[date | None] = mapped_column(Date)
    period_to: Mapped[date | None] = mapped_column(Date)
    basis_document: Mapped[str] = mapped_column(String(300), default="")  # документ-основание
    sort: Mapped[int] = mapped_column(default=0)

    profile: Mapped[Profile] = relationship(back_populates="activities")


class ProfileDocument(Base):
    """Документ профиля: диплом, акт о зачислении, приказ, договор, акт, письмо…"""

    __tablename__ = "profile_documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(300))
    storage_key: Mapped[str] = mapped_column(String(500))  # путь в UPLOAD_DIR/profiles/{id}
    sha256: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(default=0)
    # diploma|reserve_act|order|contract|act|letter|other
    kind: Mapped[str] = mapped_column(String(64), default="other")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Profile] = relationship(back_populates="documents")


class ProfileVersion(Base):
    """Неизменный слепок черновика при публикации. Проверяющий видит только версии."""

    __tablename__ = "profile_versions"
    __table_args__ = (UniqueConstraint("profile_id", "number", name="uq_profile_versions_profile_number"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column()
    snapshot: Mapped[dict] = mapped_column(JSONType)  # весь агрегат на момент submit
    progress: Mapped[int] = mapped_column(default=0)
    status: Mapped[ProfileStatus] = mapped_column(
        Enum(ProfileStatus, native_enum=False, validate_strings=True, length=32)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Profile] = relationship(back_populates="versions")


class ProfileSignal(Base):
    """Несоответствие по опубликованной версии (детерминированные проверки §10.7)."""

    __tablename__ = "profile_signals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profile_versions.id", ondelete="CASCADE"), index=True
    )
    rule_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(300))
    explanation: Mapped[str] = mapped_column(Text, default="")  # что сопоставлено
    action: Mapped[str] = mapped_column(String(300), default="")  # что нужно сделать
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)  # left/right сопоставление
    status: Mapped[SignalStatus] = mapped_column(
        Enum(SignalStatus, native_enum=False, validate_strings=True, length=32),
        default=SignalStatus.UNREVIEWED,
        index=True,
    )
    sort: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    decisions: Mapped[list["ProfileSignalDecision"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan", order_by="ProfileSignalDecision.created_at"
    )


class ProfileSignalDecision(Base):
    """Append-only решение проверяющего по несоответствию."""

    __tablename__ = "profile_signal_decisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    signal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profile_signals.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[SignalStatus] = mapped_column(
        Enum(SignalStatus, native_enum=False, validate_strings=True, length=32)
    )
    comment: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    signal: Mapped[ProfileSignal] = relationship(back_populates="decisions")


class ProfileMessage(Base):
    """Переписка по профилю: вопросы проверяющего, ответы резервиста, заметки."""

    __tablename__ = "profile_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    author_role: Mapped[str] = mapped_column(String(32))  # reservist|reviewer
    author_name: Mapped[str] = mapped_column(String(200), default="")
    kind: Mapped[MessageKind] = mapped_column(
        Enum(MessageKind, native_enum=False, validate_strings=True, length=32)
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, server_default=func.now()
    )


class ProfileReview(Base):
    """Итоговое решение проверяющего по версии (завершено / снят с рассмотрения)."""

    __tablename__ = "profile_reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profile_versions.id", ondelete="SET NULL")
    )
    result: Mapped[ReviewResult] = mapped_column(
        Enum(ReviewResult, native_enum=False, validate_strings=True, length=32)
    )
    basis_text: Mapped[str] = mapped_column(Text, default="")  # основание решения
    comment: Mapped[str] = mapped_column(Text, default="")
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profile_documents.id", ondelete="SET NULL")
    )
    author_name: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProfileAudit(Base):
    """Журнал действий по профилю. scope=private — до публикации, виден резервисту;
    scope=submitted — по опубликованным версиям, виден обеим сторонам."""

    __tablename__ = "profile_audit"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    actor_name: Mapped[str] = mapped_column(String(200), default="")
    actor_role: Mapped[str] = mapped_column(String(32), default="")
    action: Mapped[str] = mapped_column(Text)  # «Короткое: детали»
    scope: Mapped[AuditScope] = mapped_column(
        Enum(AuditScope, native_enum=False, validate_strings=True, length=16),
        default=AuditScope.PRIVATE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, server_default=func.now()
    )


class ReviewerAssignment(Base):
    """Назначение проверяющего на профиль (в учебном контуре — auto-assign демо)."""

    __tablename__ = "reviewer_assignments"
    __table_args__ = (
        UniqueConstraint("reviewer_id", "profile_id", name="uq_reviewer_assignments_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReferenceContact(Base):
    """Справочник ответственных операторов (SPEC §10.12) — виден обеим ролям."""

    __tablename__ = "reference_contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    responsibility: Mapped[str] = mapped_column(String(300), default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    sort: Mapped[int] = mapped_column(default=0)
