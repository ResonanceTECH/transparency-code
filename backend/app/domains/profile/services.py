"""Сервисы домена profile: черновик, полнота, публикация, проверяющий.

Сервисы не коммитят — коммит в API-слое после успешной мутации (SPEC.md §2).
Проверяющий видит только опубликованные версии (`scope=submitted`); приватный
черновик и аудит `private` для него невидимы.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.identity.models import User, UserRole
from app.domains.profile import rules as profile_rules
from app.domains.profile.models import (
    PAYMENT_CATEGORIES,
    Activity,
    AuditScope,
    KinshipRelative,
    MessageKind,
    PaymentBlock,
    PaymentCategory,
    PaymentRecord,
    Profile,
    ProfileAudit,
    ProfileDocument,
    ProfileMessage,
    ProfileReview,
    ProfileSignal,
    ProfileSignalDecision,
    ProfileStatus,
    ProfileVersion,
    ReferenceContact,
    ReviewerAssignment,
    ReviewResult,
    ServicePeriod,
    SignalStatus,
    WorkStatus,
)
from app.domains.profile.schemas import DraftIn

# Статусы, в которых резервист ещё может править черновик.
EDITABLE = {ProfileStatus.DRAFT, ProfileStatus.CLARIFICATION}

_MILESTONES = [
    (10, "Анкета и поток заполнены"),
    (30, "Загружены диплом и реквизиты акта о зачислении"),
    (50, "Периоды службы и родство с участником СВО"),
    (70, "Ответы по всем категориям выплат"),
    (90, "Записи и обязательные документы"),
]


def _profile_query():
    return select(Profile).options(
        selectinload(Profile.service_periods),
        selectinload(Profile.relatives),
        selectinload(Profile.payment_blocks).selectinload(PaymentBlock.records),
        selectinload(Profile.activities),
        selectinload(Profile.documents),
        selectinload(Profile.versions),
    )


async def get_or_create_profile(db: AsyncSession, user: User) -> Profile:
    """Профиль резервиста — лениво создаётся при первом обращении."""
    profile = await db.scalar(_profile_query().where(Profile.owner_id == user.id))
    if profile is None:
        profile = Profile(owner_id=user.id, full_name=user.display_name)
        # Пустые коллекции назначаются до add/flush — на pending-объекте это
        # не вызывает lazy-load (иначе MissingGreenlet в сериализаторах).
        profile.service_periods = []
        profile.relatives = []
        profile.payment_blocks = []
        profile.activities = []
        profile.documents = []
        profile.versions = []
        db.add(profile)
        await db.flush()
        add_audit(db, profile, user, "Черновик профиля создан", AuditScope.PRIVATE)
    else:
        # selectinload не перечитывает уже загруженные коллекции identity-map
        # объекта — при повторном обращении в той же сессии они устаревают.
        for attr in ("service_periods", "relatives", "payment_blocks",
                     "activities", "documents", "versions"):
            await db.refresh(profile, [attr])
        for block in profile.payment_blocks:
            await db.refresh(block, ["records"])
    return profile


def add_audit(db: AsyncSession, profile: Profile, user: User | None,
              action: str, scope: AuditScope, role: str | None = None) -> None:
    db.add(ProfileAudit(
        profile_id=profile.id,
        actor_name=user.display_name if user else "",
        actor_role=role or (user.role.value if user else ""),
        action=action,
        scope=scope,
    ))


# ---------- черновик ----------


async def apply_draft(db: AsyncSession, profile: Profile, data: DraftIn) -> None:
    """Полная замена черновика: скаляры профиля + все дочерние коллекции.

    Блоки выплат обновляются на месте по категории — у них UNIQUE
    (profile_id, category), поэтому replace-через-сирот бьётся о порядок
    insert/delete в одном flush. Остальные коллекции заменяются целиком
    через cascade delete-orphan (ограничений у них нет).
    """
    p, pr = data.person, data.program
    profile.full_name, profile.birth_year = p.full_name, p.birth_year
    profile.phone, profile.email, profile.current_workplace = p.phone, p.email, p.current_workplace
    profile.flow, profile.program_year, profile.region = pr.flow, pr.program_year, pr.region
    profile.regional_program = pr.regional_program
    profile.regional_program_year = pr.regional_program_year
    profile.reserve_act_number, profile.reserve_act_date = (
        data.reserve_act_number, data.reserve_act_date)
    profile.work_status, profile.appointment_authority = (
        data.work_status, data.appointment_authority)
    profile.has_svo_relative = data.kinship.has_relative
    profile.received_relative_payments = data.kinship.received_payments
    profile.activity_participates = data.activity_participates

    profile.service_periods = [
        ServicePeriod(start_date=s.start_date, end_date=s.end_date, kind=s.kind,
                      officer_category=s.officer_category, sort=i)
        for i, s in enumerate(data.service_periods)
    ]
    profile.relatives = [
        KinshipRelative(full_name=r.full_name, degree=r.degree,
                        participant_status=r.participant_status, sort=i)
        for i, r in enumerate(data.kinship.relatives)
    ]
    incoming = {b.category: b for b in data.payments}
    existing = {b.category: b for b in profile.payment_blocks}
    for i, cat in enumerate(PAYMENT_CATEGORIES):
        src = incoming.get(cat)
        block = existing.get(cat)
        if block is None:
            block = PaymentBlock(profile_id=profile.id, category=cat, sort=i)
            profile.payment_blocks.append(block)
        block.answer = src.answer if src else None
        block.sort = i
        block.records = [
            PaymentRecord(profile_id=profile.id, sort=j, **r.model_dump())
            for j, r in enumerate(src.records)
        ] if src else []
    profile.activities = [
        Activity(organization=a.organization, kind=a.kind, engagement=a.engagement,
                 period_from=a.period_from, period_to=a.period_to,
                 basis_document=a.basis_document, sort=i)
        for i, a in enumerate(data.activities)
    ]
    db.add(profile)


def draft_snapshot(profile: Profile) -> dict:
    """Канонический снапшот агрегата — хранится в ProfileVersion.snapshot и
    является входом детерминированных проверок."""
    return {
        "person": {
            "full_name": profile.full_name, "birth_year": profile.birth_year,
            "phone": profile.phone, "email": profile.email,
            "current_workplace": profile.current_workplace,
        },
        "program": {
            "flow": profile.flow, "program_year": profile.program_year,
            "region": profile.region, "regional_program": profile.regional_program,
            "regional_program_year": profile.regional_program_year,
        },
        "reserve_act_number": profile.reserve_act_number,
        "reserve_act_date": profile.reserve_act_date.isoformat() if profile.reserve_act_date else None,
        "work_status": profile.work_status.value if profile.work_status else None,
        "appointment_authority": profile.appointment_authority,
        "service_periods": [
            {"start_date": s.start_date.isoformat() if s.start_date else None,
             "end_date": s.end_date.isoformat() if s.end_date else None,
             "kind": s.kind, "officer_category": s.officer_category}
            for s in profile.service_periods
        ],
        "kinship": {
            "has_relative": profile.has_svo_relative,
            "received_payments": profile.received_relative_payments,
            "relatives": [
                {"full_name": r.full_name, "degree": r.degree,
                 "participant_status": r.participant_status.value if r.participant_status else None}
                for r in profile.relatives
            ],
        },
        "payments": [
            {"category": b.category.value,
             "answer": b.answer.value if b.answer else None,
             "records": [
                 {**{k: v for k, v in r.__dict__.items() if not k.startswith("_")},
                  "recipient_kind": r.recipient_kind.value if r.recipient_kind else None,
                  "amount": str(r.amount) if r.amount is not None else None,
                  "period_from": r.period_from.isoformat() if r.period_from else None,
                  "period_to": r.period_to.isoformat() if r.period_to else None,
                  "payment_date": r.payment_date.isoformat() if r.payment_date else None,
                  "event_date": r.event_date.isoformat() if r.event_date else None,
                  "document_id": str(r.document_id) if r.document_id else None}
                 for r in b.records
             ]}
            for b in profile.payment_blocks
        ],
        "activity_participates": profile.activity_participates,
        "activities": [
            {"organization": a.organization, "kind": a.kind, "engagement": a.engagement,
             "period_from": a.period_from.isoformat() if a.period_from else None,
             "period_to": a.period_to.isoformat() if a.period_to else None,
             "basis_document": a.basis_document}
            for a in profile.activities
        ],
        "documents": [{"id": str(d.id), "filename": d.filename, "kind": d.kind}
                      for d in profile.documents],
    }


def compute_completeness(profile: Profile) -> tuple[int, list[dict], list[str]]:
    """Вехи прогресса 10→90% (SPEC §10.4). Возвращает (progress, milestones, missing)."""
    missing: list[str] = []
    done: dict[int, bool] = {}

    # 10% — анкета + поток.
    m10 = all([profile.full_name, profile.birth_year, profile.phone, profile.email,
               profile.current_workplace, profile.flow, profile.program_year,
               profile.region])
    if not m10:
        missing.append("Анкета: ФИО, год рождения, телефон, e-mail, место работы")
        missing.append("Поток: направление, год программы, регион")
    done[10] = m10

    # 30% — диплом + реквизиты акта.
    has_diploma = any(d.kind == "diploma" for d in profile.documents)
    m30 = m10 and has_diploma and profile.reserve_act_number and profile.reserve_act_date
    if m10 and not m30:
        if not has_diploma:
            missing.append("Загрузите диплом об образовании")
        if not (profile.reserve_act_number and profile.reserve_act_date):
            missing.append("Укажите реквизиты акта о зачислении в резерв")
    done[30] = bool(m30)

    # 50% — служба + родство.
    kinship_ok = (profile.has_svo_relative is False
                  or (profile.has_svo_relative is True and len(profile.relatives) > 0))
    m50 = m30 and len(profile.service_periods) > 0 and kinship_ok \
        and profile.has_svo_relative is not None
    if done[30] and not m50:
        if not profile.service_periods:
            missing.append("Добавьте хотя бы один период службы")
        if profile.has_svo_relative is None:
            missing.append("Ответьте, есть ли родственник — участник СВО")
        elif profile.has_svo_relative and not profile.relatives:
            missing.append("Укажите родственника — участника СВО")
    done[50] = bool(m50)

    # 70% — ответ по каждой категории.
    answers = {b.category: b.answer for b in profile.payment_blocks}
    unanswered = [c.value for c in PAYMENT_CATEGORIES if answers.get(c) is None]
    m70 = m50 and not unanswered
    if done[50] and unanswered:
        missing.append(f"Нет ответа по категориям: {', '.join(unanswered)}")
    done[70] = bool(m70)

    # 90% — записи по «да/планируется» + обязательные документы.
    blocks = {b.category: b for b in profile.payment_blocks}
    no_records = []
    incomplete = []
    for c in PAYMENT_CATEGORIES:
        b = blocks.get(c)
        if b and b.answer and b.answer.value in ("yes", "planned"):
            if not b.records:
                no_records.append(c.value)
            elif any(not (r.document_ref or r.document_id)
                     and c.value in profile_rules._DOC_REQUIRED for r in b.records):
                incomplete.append(c.value)
    m90 = m70 and not no_records and not incomplete
    if done[70] and not m90:
        if no_records:
            missing.append(f"Нет записей по категориям: {', '.join(no_records)}")
        if incomplete:
            missing.append(f"Нет документа-основания в записях: {', '.join(incomplete)}")
    done[90] = bool(m90)

    progress = 0
    for pct, _title in _MILESTONES:
        if done.get(pct):
            progress = pct
        else:
            break
    milestones = [{"percent": pct, "title": title, "done": done.get(pct, False)}
                  for pct, title in _MILESTONES]
    return progress, milestones, missing


# ---------- публикация и версии ----------


async def submit_profile(db: AsyncSession, profile: Profile, user: User) -> ProfileVersion:
    """Публикация: слепок версии + детерминированные проверки + auto-assign."""
    progress, _m, missing = compute_completeness(profile)
    if progress < 90:
        raise ValueError("Профиль заполнен не полностью: " + "; ".join(missing))

    number = (profile.versions[-1].number + 1) if profile.versions else 1
    new_status = (ProfileStatus.RESUBMITTED
                  if profile.status == ProfileStatus.CLARIFICATION or number > 1
                  else ProfileStatus.SUBMITTED)
    snapshot = draft_snapshot(profile)
    version = ProfileVersion(profile_id=profile.id, number=number, snapshot=snapshot,
                             progress=progress, status=new_status)
    db.add(version)
    await db.flush()

    for i, hit in enumerate(profile_rules.run_profile_checks(snapshot)):
        db.add(ProfileSignal(profile_id=profile.id, version_id=version.id, sort=i, **hit))

    profile.status, profile.progress, profile.submitted_at = (
        new_status, progress, datetime.now(UTC))
    await _auto_assign(db, profile)
    add_audit(db, profile, user,
              f"Сведения представлены: версия {number}", AuditScope.SUBMITTED)
    return version


async def _auto_assign(db: AsyncSession, profile: Profile) -> None:
    """Назначение на свободного проверяющего — в учебном контуре на demo-reviewer."""
    assigned = await db.scalar(
        select(ReviewerAssignment.reviewer_id).where(ReviewerAssignment.profile_id == profile.id))
    if assigned:
        return
    reviewer = await db.scalar(
        select(User).where(User.role == UserRole.REVIEWER).order_by(User.created_at).limit(1))
    if reviewer:
        db.add(ReviewerAssignment(reviewer_id=reviewer.id, profile_id=profile.id))


# ---------- проверяющий ----------


async def reviewer_queue(db: AsyncSession, status: ProfileStatus | None) -> list[tuple]:
    """Очередь опубликованных профилей + назначенный проверяющий + pending."""
    visible = [ProfileStatus.SUBMITTED, ProfileStatus.ACCEPTED, ProfileStatus.CLARIFICATION,
               ProfileStatus.RESUBMITTED, ProfileStatus.COMPLETED, ProfileStatus.REMOVED]
    q = (select(Profile)
         .where(Profile.status.in_(visible))
         .options(selectinload(Profile.versions))
         .order_by(Profile.submitted_at.desc().nullslast()))
    if status:
        q = q.where(Profile.status == status)
    profiles = (await db.scalars(q)).all()
    out = []
    for p in profiles:
        pending = await db.scalar(
            select(func.count(ProfileSignal.id)).where(
                ProfileSignal.profile_id == p.id,
                ProfileSignal.status == SignalStatus.UNREVIEWED)) or 0
        reviewer = await db.scalar(
            select(User.display_name)
            .join(ReviewerAssignment, ReviewerAssignment.reviewer_id == User.id)
            .where(ReviewerAssignment.profile_id == p.id).limit(1)) or ""
        out.append((p, pending, reviewer))
    return out


async def get_visible_profile(db: AsyncSession, profile_id: uuid.UUID) -> Profile | None:
    """Профиль, видимый проверяющему: есть хотя бы одна опубликованная версия."""
    profile = await db.scalar(
        _profile_query().where(Profile.id == profile_id))
    if profile is None or not profile.versions:
        return None
    return profile


async def profile_signals(db: AsyncSession, profile_id: uuid.UUID,
                          version_id: uuid.UUID | None) -> list[ProfileSignal]:
    q = (select(ProfileSignal)
         .options(selectinload(ProfileSignal.decisions))
         .where(ProfileSignal.profile_id == profile_id)
         .order_by(ProfileSignal.sort))
    if version_id:
        q = q.where(ProfileSignal.version_id == version_id)
    return list((await db.scalars(q)).all())


async def decide_signal(db: AsyncSession, signal_id: uuid.UUID, user: User,
                        status: SignalStatus, comment: str
                        ) -> ProfileSignalDecision | None:
    signal = await db.scalar(
        select(ProfileSignal).where(ProfileSignal.id == signal_id))
    if signal is None:
        return None
    decision = ProfileSignalDecision(signal_id=signal.id, status=status,
                                     comment=comment,
                                     author_name=user.display_name)
    db.add(decision)
    signal.status = status
    profile = await db.scalar(select(Profile).where(Profile.id == signal.profile_id))
    if profile:
        add_audit(db, profile, user, f"Несоответствие «{signal.title}»: {status.value}",
                  AuditScope.SUBMITTED)
    await db.flush()
    return decision


async def review_decision(db: AsyncSession, profile: Profile, user: User,
                          action: str, comment: str, basis: str) -> None:
    """Решение проверяющего по профилю: статус-машина SPEC §10.2."""
    version = profile.versions[-1] if profile.versions else None
    if action == "accept":
        profile.status = ProfileStatus.ACCEPTED
        add_audit(db, profile, user, f"Принят к рассмотрению: {comment}",
                  AuditScope.SUBMITTED)
    elif action == "clarification":
        profile.status = ProfileStatus.CLARIFICATION
        db.add(ProfileMessage(profile_id=profile.id, author_role="reviewer",
                              author_name=user.display_name,
                              kind=MessageKind.QUESTION, text=comment))
        add_audit(db, profile, user, f"Требуются уточнения: {comment}",
                  AuditScope.SUBMITTED)
    elif action in ("complete", "remove"):
        result = ReviewResult.COMPLETED if action == "complete" else ReviewResult.REMOVED
        profile.status = (ProfileStatus.COMPLETED if action == "complete"
                          else ProfileStatus.REMOVED)
        db.add(ProfileReview(profile_id=profile.id,
                             version_id=version.id if version else None,
                             result=result, basis_text=basis, comment=comment,
                             author_name=user.display_name))
        title = "Рассмотрение завершено" if action == "complete" \
            else "Снят с рассмотрения"
        add_audit(db, profile, user, f"{title}: {basis or comment}",
                  AuditScope.SUBMITTED)


async def add_message(db: AsyncSession, profile: Profile, user: User,
                      text: str) -> ProfileMessage:
    is_reviewer = user.role in (UserRole.REVIEWER, UserRole.SPECIALIST)
    kind = MessageKind.QUESTION if is_reviewer else MessageKind.REPLY
    msg = ProfileMessage(profile_id=profile.id,
                         author_role="reviewer" if is_reviewer else "reservist",
                         author_name=user.display_name, kind=kind, text=text)
    db.add(msg)
    add_audit(db, profile, user,
              ("Вопрос проверяющего" if is_reviewer else "Ответ резервиста")
              + f": {text[:80]}", AuditScope.SUBMITTED)
    return msg


async def profile_messages(db: AsyncSession, profile_id: uuid.UUID) -> list[ProfileMessage]:
    return list((await db.scalars(
        select(ProfileMessage).where(ProfileMessage.profile_id == profile_id)
        .order_by(ProfileMessage.created_at))).all())


async def profile_audit(db: AsyncSession, profile_id: uuid.UUID,
                        scope: AuditScope | None = None) -> list[ProfileAudit]:
    q = (select(ProfileAudit).where(ProfileAudit.profile_id == profile_id)
         .order_by(ProfileAudit.created_at))
    if scope:
        q = q.where(ProfileAudit.scope == scope)
    return list((await db.scalars(q)).all())


async def profile_reviews(db: AsyncSession, profile_id: uuid.UUID) -> list[ProfileReview]:
    return list((await db.scalars(
        select(ProfileReview).where(ProfileReview.profile_id == profile_id)
        .order_by(ProfileReview.created_at))).all())


async def add_document(db: AsyncSession, profile: Profile, filename: str,
                       storage_key: str, sha256: str, size: int,
                       kind: str) -> ProfileDocument:
    doc = ProfileDocument(profile_id=profile.id, filename=filename,
                          storage_key=storage_key, sha256=sha256, size=size, kind=kind)
    db.add(doc)
    await db.flush()
    return doc


async def seed_contacts(db: AsyncSession) -> None:
    """Справочник операторов — идемпотентный сид (учебный контур)."""
    if await db.scalar(select(func.count(ReferenceContact.id))):
        return
    for i, c in enumerate([
        ("Смирнова Анна Владимировна", "Приём и первичная проверка сведений",
         "+7 (900) 000-11-22", "smirnova@resonance.demo"),
        ("Ким Денис Олегович", "Уточнения по выплатам и документам",
         "+7 (900) 000-33-44", "kim@resonance.demo"),
        ("Ахметова Лейла Рашитовна", "Итоговые решения по профилям",
         "+7 (900) 000-55-66", "akhmetova@resonance.demo"),
    ]):
        db.add(ReferenceContact(name=c[0], responsibility=c[1], phone=c[2],
                                email=c[3], sort=i))


async def delete_profile_documents_dir(profile_id: uuid.UUID) -> None:  # pragma: no cover
    """Заглушка очистки файлов — управление storage на API-слое."""
    _ = profile_id


async def remove_document(db: AsyncSession, profile: Profile, doc_id: uuid.UUID) -> bool:
    res = await db.execute(
        delete(ProfileDocument).where(ProfileDocument.id == doc_id,
                                      ProfileDocument.profile_id == profile.id))
    return res.rowcount > 0  # type: ignore[union-attr]


__all__ = [
    "EDITABLE",
    "PAYMENT_CATEGORIES",
    "PaymentCategory",
    "ProfileStatus",
    "ReviewResult",
    "SignalStatus",
    "WorkStatus",
]
