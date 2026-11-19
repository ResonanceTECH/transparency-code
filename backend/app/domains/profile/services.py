"""Сервисы домена profile: черновик, полнота, публикация, проверяющий.

Сервисы не коммитят — коммит в API-слое после успешной мутации (SPEC.md §2).
Проверяющий видит только опубликованные версии (`scope=submitted`); приватный
черновик и аудит `private` для него невидимы.
"""

import asyncio
import copy
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domains.identity.models import User, UserRole
from app.domains.profile import questionnaire as form
from app.domains.profile.files import original_available
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
    ProfileDocumentAssessment,
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

def _profile_query():
    return select(Profile).options(
        selectinload(Profile.service_periods),
        selectinload(Profile.relatives),
        selectinload(Profile.payment_blocks).selectinload(PaymentBlock.records),
        selectinload(Profile.activities),
        selectinload(Profile.documents),
        selectinload(Profile.versions),
    )


# Клиент делает несколько профильных GET-запросов параллельно. Локальная
# блокировка сериализует ленивое создание профиля внутри процесса; уникальный
# индекс owner_id остаётся защитой и для нескольких процессов.
_profile_create_lock = asyncio.Lock()


async def get_or_create_profile(db: AsyncSession, user: User) -> Profile:
    """Профиль резервиста — лениво создаётся при первом обращении."""
    async with _profile_create_lock:
        profile = await db.scalar(
            _profile_query().execution_options(populate_existing=True).where(Profile.owner_id == user.id)
        )
        if profile is None:
            # Учётная запись — не анкета: никакие сведения о кандидате не подставляются автоматически.
            profile = Profile(owner_id=user.id)
            # Пустые коллекции назначаются до add/flush — на pending-объекте это
            # не вызывает lazy-load (иначе MissingGreenlet в сериализаторах).
            profile.service_periods = []
            profile.relatives = []
            profile.payment_blocks = []
            profile.activities = []
            profile.documents = []
            profile.versions = []
            db.add(profile)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                profile = await db.scalar(_profile_query().where(Profile.owner_id == user.id))
                if profile is not None:
                    return profile
                raise
            add_audit(db, profile, user, "Черновик профиля создан", AuditScope.PRIVATE)
            # Создание профиля — идемпотентная операция; фиксируем его сразу,
            # чтобы параллельные GET из этого же процесса видели одну запись.
            await db.commit()
        return profile


def add_audit(db: AsyncSession, profile: Profile, user: User | None,
              action: str, scope: AuditScope, role: str | None = None) -> None:
    db.add(ProfileAudit(
        profile_id=profile.id,
        actor_name=user.display_name if user else "",
        actor_role=role or (user.role.value if user else ""),
        action=action,
        scope=scope,
        created_at=datetime.now(UTC),
    ))


class StateConflict(ValueError):
    """Конфликт версии/статуса, который нельзя исправлять тихим перезаписыванием."""


async def reserve_revision(db: AsyncSession, profile: Profile, expected: int | None) -> None:
    current = profile.revision
    if expected is not None and expected != current:
        raise StateConflict(
            "Профиль изменён в другой вкладке. Сохраните локальную копию и загрузите состояние с сервера"
        )
    result = await db.execute(update(Profile).where(
        Profile.id == profile.id, Profile.revision == current, Profile.status == profile.status,
    ).values(revision=current + 1, updated_at=datetime.now(UTC)))
    if result.rowcount != 1:
        raise StateConflict("Статус или версия профиля уже изменились. Обновите данные с сервера")
    profile.revision = current + 1


def attachment_out(doc: ProfileDocument, *, reviewer: bool = False) -> dict:
    prefix = f"/api/reviewer/profiles/{doc.profile_id}/documents" if reviewer else "/api/profile/documents"
    return {"id": str(doc.id), "name": doc.filename,
            "url": f"{prefix}/{doc.id}/file" if original_available(doc.storage_key) else "",
            "size": doc.size, "format": doc.filename.rsplit(".", 1)[-1].lower(), "section": doc.section,
            "kind": doc.kind if doc.kind in ("consent", "photo", "result") else "basis", "origin": doc.origin}


def questionnaire_for(profile: Profile) -> dict:
    q = copy.deepcopy(profile.questionnaire) if profile.questionnaire is not None else form.from_legacy(
        draft_snapshot(profile, include_questionnaire=False))
    available = {str(doc.id): doc for doc in profile.documents if doc.active and doc.scope == "candidate"}
    files = [
        attachment_out(available[file["id"]]) for file in q["attachments"]
        if file["id"] in available and available[file["id"]].kind != "photo"
    ]
    listed = {file["id"] for file in files}
    files.extend(
        attachment_out(doc) for key, doc in available.items() if key not in listed and doc.kind != "photo"
    )
    q["attachments"] = files
    if profile.questionnaire is None:
        for kind, field in (("diploma", "diploma_document_id"), ("reserve_act", "reserve_act_document_id")):
            q["candidate"][field] = next((str(doc.id) for doc in available.values() if doc.kind == kind), "")
        q["consent_document_id"] = next(
            (str(doc.id) for doc in available.values() if doc.kind == "consent"), ""
        )
    if q.get("photo") and q["photo"]["id"] in available and available[q["photo"]["id"]].kind == "photo":
        q["photo"] = attachment_out(available[q["photo"]["id"]])
    else:
        q["photo"] = None
    return form.Questionnaire.model_validate(q).model_dump()


def prepare_questionnaire(profile: Profile, q: dict, *, preserve_legacy: bool = True) -> dict:
    q = copy.deepcopy(q)
    docs = {str(doc.id): doc for doc in profile.documents if doc.active and doc.scope == "candidate"}
    for file in [*q["attachments"], *([q["photo"]] if q.get("photo") else [])]:
        if file["id"] not in docs:
            raise ValueError("В анкете указан чужой, удалённый или ещё не загруженный файл")
    basis_ids = {key for key, doc in docs.items() if doc.kind not in ("consent", "photo", "result")}
    for value in [q["candidate"]["diploma_document_id"], q["candidate"]["reserve_act_document_id"],
                  *(r.get("document_id", "") for rows in q["records"].values() for r in rows),
                  *(r.get("document_id", "") for r in q["activities"])]:
        if value and value not in basis_ids:
            raise ValueError("Документ-основание не принадлежит активному черновику")
    if q["consent_document_id"] and not any(
        key == q["consent_document_id"] and doc.kind == "consent" for key, doc in docs.items()
    ):
        raise ValueError("Для согласия нужен отдельно загруженный подписанный скан")
    if q.get("photo") and docs[q["photo"]["id"]].kind != "photo":
        raise ValueError("В поле фото нужен файл изображения")
    q["attachments"] = [attachment_out(doc) for doc in docs.values() if doc.kind != "photo"]
    q["photo"] = attachment_out(docs[q["photo"]["id"]]) if q.get("photo") else None
    if preserve_legacy:
        # Клиент не может подменять сохранённые дополнительные поля прежнего контракта.
        q["legacy_data"] = questionnaire_for(profile).get("legacy_data", {})
    return form.Questionnaire.model_validate(q).model_dump()


def can_load_demo(profile: Profile) -> bool:
    """Никогда не подменяем существующий профиль/историю готовым сценарием."""
    return profile.status == ProfileStatus.DRAFT and not profile.versions and not profile.documents \
        and profile.revision == 0 and profile.questionnaire is None and not any([
        profile.full_name, profile.birth_year, profile.phone, profile.email, profile.current_workplace,
        profile.flow,
        profile.program_year, profile.regional_program, profile.regional_program_year, profile.region,
        profile.reserve_act_number, profile.reserve_act_date, profile.work_status,
        profile.appointment_authority,
        profile.has_svo_relative is not None, profile.received_relative_payments is not None,
        profile.activity_participates is not None, profile.private_reply,
        profile.service_periods, profile.relatives, profile.payment_blocks, profile.activities,
    ])


# ---------- черновик ----------


async def apply_draft(db: AsyncSession, profile: Profile, data: DraftIn) -> None:
    """Полная замена черновика: скаляры профиля + все дочерние коллекции.

    Блоки выплат обновляются на месте по категории — у них UNIQUE
    (profile_id, category), поэтому replace-через-сирот бьётся о порядок
    insert/delete в одном flush. Остальные коллекции заменяются целиком
    через cascade delete-orphan (ограничений у них нет).
    """
    if data.questionnaire is not None:
        q = prepare_questionnaire(profile, data.questionnaire.model_dump())
    else:
        q = prepare_questionnaire(
            profile, form.from_legacy(data.model_dump(mode="json"), questionnaire_for(profile)),
            preserve_legacy=False,
        )
    if data.private_reply is not None:
        profile.private_reply = data.private_reply
    data = form.legacy_input(q)
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
                      officer_category=s.officer_category, extra=s.extra, sort=i)
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
            PaymentRecord(profile_id=profile.id, sort=j, **r.model_dump(exclude={"id"}))
            for j, r in enumerate(src.records)
        ] if src else []
    profile.activities = [
        Activity(organization=a.organization, kind=a.kind, engagement=a.engagement,
                  period_from=a.period_from, period_to=a.period_to,
                  basis_document=a.basis_document, extra=a.extra, sort=i)
        for i, a in enumerate(data.activities)
    ]
    profile.questionnaire = q
    db.add(profile)
    await db.flush()
    # Совместимые SQL-строки могут пересоздаваться, но логические ID анкеты
    # остаются прежними. Связываем оба ID, чтобы старый клиент, даже без extra,
    # не подмешал реквизиты соседней строки после перестановки или удаления.
    q = copy.deepcopy(q)
    old = q["legacy_data"]
    for name in ("service_periods", "activities"):
        rows = old.setdefault(name, {})
        for row, stored in zip(q[name], getattr(profile, name), strict=True):
            rows.setdefault(row["id"], {})["source_id"] = str(stored.id)
    rows = old.setdefault("records", {})
    for block in profile.payment_blocks:
        category = str(form.CATEGORIES.index(block.category.value))
        records = rows.setdefault(category, {})
        for row, stored in zip(q["records"][category], block.records, strict=True):
            records.setdefault(row["id"], {})["source_id"] = str(stored.id)
    if q["relative_answer"] == "Да":
        for relative, stored in zip(old.get("additional_relatives", []), profile.relatives[1:], strict=True):
            relative["id"] = str(stored.id)
    profile.questionnaire = q


def draft_snapshot(profile: Profile, *, include_questionnaire: bool = True) -> dict:
    """Канонический снапшот агрегата — хранится в ProfileVersion.snapshot и
    является входом детерминированных проверок."""
    snapshot = {
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
            {"id": str(s.id), "start_date": s.start_date.isoformat() if s.start_date else None,
             "end_date": s.end_date.isoformat() if s.end_date else None,
              "kind": s.kind, "officer_category": s.officer_category, "extra": s.extra or {}}
            for s in profile.service_periods
        ],
        "kinship": {
            "has_relative": profile.has_svo_relative,
            "received_payments": profile.received_relative_payments,
            "relatives": [
                {"id": str(r.id), "full_name": r.full_name, "degree": r.degree,
                 "participant_status": r.participant_status.value if r.participant_status else None}
                for r in profile.relatives
            ],
        },
        "payments": [
            {"category": b.category.value,
             "answer": b.answer.value if b.answer else None,
             "records": [
                  {
                      "id": str(r.id),
                     "recipient_kind": r.recipient_kind.value if r.recipient_kind else None,
                     "recipient_name": r.recipient_name,
                     "recipient_birth_year": r.recipient_birth_year,
                     "relation": r.relation,
                     "title": r.title, "kind_text": r.kind_text,
                     "basis": r.basis, "level": r.level, "form": r.form,
                     "amount": str(r.amount) if r.amount is not None else None,
                     "period_from": r.period_from.isoformat() if r.period_from else None,
                     "period_to": r.period_to.isoformat() if r.period_to else None,
                     "payment_date": r.payment_date.isoformat() if r.payment_date else None,
                     "event_date": r.event_date.isoformat() if r.event_date else None,
                     "housing_kind": r.housing_kind,
                     "document_ref": r.document_ref,
                     "document_id": str(r.document_id) if r.document_id else None,
                     "extra": r.extra or {},
                 }
                 for r in b.records
             ]}
            for b in profile.payment_blocks
        ],
        "activity_participates": profile.activity_participates,
        "activities": [
            {"id": str(a.id), "organization": a.organization, "kind": a.kind, "engagement": a.engagement,
             "period_from": a.period_from.isoformat() if a.period_from else None,
             "period_to": a.period_to.isoformat() if a.period_to else None,
              "basis_document": a.basis_document, "extra": a.extra or {}}
            for a in profile.activities
        ],
        "documents": [{"id": str(d.id), "filename": d.filename, "kind": d.kind, "size": d.size,
                       "section": d.section, "origin": d.origin}
                      for d in profile.documents if d.active and d.scope == "candidate"],
    }
    if include_questionnaire:
        snapshot["questionnaire"] = questionnaire_for(profile)
    return snapshot


def income_summary(snapshot: dict) -> dict:
    """Агрегат «Сведения о доходах» для проверяющего (SPEC §10.8).

    Только активные денежные записи; выплаты семье отдельно от резервиста.
    Жилищные, неденежные меры и пособия с одним ответом да/нет не суммируются.
    Вход — слепок `ProfileVersion.snapshot` (иммутабелен, совпадает с показанным).
    """
    q = snapshot.get("questionnaire") or form.from_legacy(snapshot)
    by_category: dict[str, Decimal] = {}
    total = Decimal("0")
    family_total = Decimal("0")
    count = family_count = 0
    for index, category in enumerate(form.CATEGORIES):
        if index in (5, 8, 9):
            continue
        for rec in form.active_records(q, index):
            retained = q.get("legacy_data", {}).get("records", {}).get(str(index), {}).get(rec["id"], {})
            additional = retained.get("fields", {})
            if rec.get("form") == "Натуральная" or (
                not rec.get("form") and additional.get("form") == "in_kind"
            ):
                continue
            value = form._amount(rec.get("amount"))
            if value is None:
                continue
            amount = Decimal(value)
            if index == 6 or rec.get("recipient_kind") == "Член семьи" or (
                not rec.get("recipient_kind") and additional.get("recipient_kind") == "family_member"
            ):
                family_total += amount
                family_count += 1
                continue
            by_category[category] = by_category.get(category, Decimal("0")) + amount
            total += amount
            count += 1
    return {
        "currency": "RUB",
        "total": str(total.quantize(Decimal("0.01"))),
        "records": count,
        "family_total": str(family_total.quantize(Decimal("0.01"))),
        "family_records": family_count,
        "by_category": [
            {"category": cat, "total": str(amount.quantize(Decimal("0.01")))}
            for cat, amount in sorted(by_category.items())
        ],
    }


def compute_completeness(profile: Profile) -> tuple[int, list[dict], list[str]]:
    """Одинаковая проверка семи групп и согласия для обоих клиентов API."""
    return form.completeness(questionnaire_for(profile))


# ---------- публикация и версии ----------


async def submit_profile(db: AsyncSession, profile: Profile, user: User) -> ProfileVersion:
    """Публикация: слепок версии + детерминированные проверки + auto-assign."""
    progress, _m, missing = compute_completeness(profile)
    if progress < 90 or missing:
        raise ValueError("Профиль заполнен не полностью: " + "; ".join(missing))
    if profile.status == ProfileStatus.CLARIFICATION and len(profile.private_reply.strip()) < 10:
        raise ValueError("При повторном представлении добавьте пояснение не менее десяти символов")
    q = form.published(prepare_questionnaire(profile, questionnaire_for(profile)))
    referenced = {file["id"] for file in q["attachments"]}
    if q.get("photo"):
        referenced.add(q["photo"]["id"])
    for doc in profile.documents:
        if str(doc.id) in referenced and not original_available(doc.storage_key):
            raise ValueError(f"Оригинал файла недоступен: {doc.filename}. Загрузите документ заново")

    number = (profile.versions[-1].number + 1) if profile.versions else 1
    new_status = (ProfileStatus.RESUBMITTED
                  if profile.status == ProfileStatus.CLARIFICATION or number > 1
                  else ProfileStatus.SUBMITTED)
    snapshot = form.legacy_input(q).model_dump(
        mode="json", exclude={"questionnaire", "revision", "private_reply"}
    )
    timestamp = datetime.now(UTC)
    snapshot.update({"questionnaire": q,
                      "documents": [
                          {"id": file["id"], "filename": file["name"], "kind": file["kind"],
                           "size": file["size"], "section": file["section"], "origin": file["origin"]}
                          for file in [*q["attachments"], *([q["photo"]] if q.get("photo") else [])]
                      ],
                     "reply": profile.private_reply.strip(),
                     "_meta": {"profile_id": str(profile.id), "is_demo": profile.is_demo,
                               "transfer_confirmed_at": timestamp.isoformat(), "confirmed": True}})
    version = ProfileVersion(number=number, snapshot=snapshot,
                              progress=progress, status=new_status, created_at=timestamp)
    profile.versions.append(version)
    await db.flush()

    for i, hit in enumerate(form.signal_hits(q)):
        db.add(ProfileSignal(profile_id=profile.id, version_id=version.id, sort=i, **hit))

    profile.status, profile.progress, profile.submitted_at = (
        new_status, progress, datetime.now(UTC))
    await _auto_assign(db, profile)
    if profile.private_reply.strip():
        db.add(ProfileMessage(profile_id=profile.id, version_id=version.id, author_role="reservist",
                              author_name=user.display_name, kind=MessageKind.REPLY,
                              text=profile.private_reply.strip(), created_at=timestamp))
    profile.private_reply = ""
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
    else:
        raise ValueError("Нет проверяющего для назначения доступа. Обратитесь к оператору")


# ---------- проверяющий ----------


async def reviewer_queue(db: AsyncSession, status: ProfileStatus | None, user: User) -> list[tuple]:
    """Очередь опубликованных профилей + назначенный проверяющий + pending."""
    visible = [ProfileStatus.SUBMITTED, ProfileStatus.ACCEPTED, ProfileStatus.CLARIFICATION,
               ProfileStatus.RESUBMITTED, ProfileStatus.COMPLETED, ProfileStatus.REMOVED]
    q = (select(Profile).join(ReviewerAssignment, ReviewerAssignment.profile_id == Profile.id)
         .where(Profile.status.in_(visible))
         .where(ReviewerAssignment.reviewer_id == user.id)
         .options(selectinload(Profile.versions))
         .order_by(Profile.submitted_at.desc().nullslast()))
    if status:
        q = q.where(Profile.status == status)
    profiles = (await db.scalars(q)).all()
    out = []
    for p in profiles:
        if not p.versions:
            continue
        pending = await db.scalar(
            select(func.count(ProfileSignal.id)).where(
                ProfileSignal.profile_id == p.id,
                ProfileSignal.version_id == p.versions[-1].id,
                 ProfileSignal.status.in_([SignalStatus.UNREVIEWED, SignalStatus.CLARIFICATION]))) or 0
        reviewer = await db.scalar(
            select(User.display_name)
            .join(ReviewerAssignment, ReviewerAssignment.reviewer_id == User.id)
            .where(ReviewerAssignment.profile_id == p.id).limit(1)) or ""
        out.append((p, pending, reviewer))
    return out


async def get_visible_profile(db: AsyncSession, profile_id: uuid.UUID, user: User) -> Profile | None:
    """Профиль, видимый проверяющему: есть хотя бы одна опубликованная версия."""
    profile = await db.scalar(
        _profile_query().execution_options(populate_existing=True)
        .join(ReviewerAssignment, ReviewerAssignment.profile_id == Profile.id)
        .where(Profile.id == profile_id, ReviewerAssignment.reviewer_id == user.id))
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
                        status: SignalStatus, comment: str, version_number: int | None = None,
                        request_clarification: bool = False,
                        ) -> ProfileSignalDecision | None:
    signal = await db.scalar(
        select(ProfileSignal).where(ProfileSignal.id == signal_id))
    if signal is None:
        return None
    profile = await get_visible_profile(db, signal.profile_id, user)
    if profile is None:
        return None
    ensure_current_review(profile, version_number)
    if signal.version_id != profile.versions[-1].id:
        raise StateConflict("Сигналы предыдущей версии доступны только для чтения")
    if len(comment.strip()) < 5:
        raise ValueError("Для решения по сигналу нужен содержательный комментарий")
    if request_clarification and status != SignalStatus.CLARIFICATION:
        raise ValueError("Запрос уточнения должен иметь соответствующий статус")
    await reserve_revision(db, profile, profile.revision)
    decision = ProfileSignalDecision(signal_id=signal.id, status=status,
                                      comment=comment,
                                      author_name=user.display_name, created_at=datetime.now(UTC))
    db.add(decision)
    signal.status = status
    add_audit(
        db, profile, user,
        f"Сигнал «{signal.title}», v{profile.versions[-1].number}: {status.value}. {comment}",
        AuditScope.SUBMITTED,
    )
    if request_clarification:
        await review_decision(db, profile, user, "clarification", comment, "")
    await db.flush()
    return decision


async def review_decision(db: AsyncSession, profile: Profile, user: User,
                          action: str, comment: str, basis: str,
                          document_id: uuid.UUID | None = None, checks: list[bool] | None = None) -> None:
    """Решение проверяющего по профилю: статус-машина SPEC §10.2."""
    version = profile.versions[-1] if profile.versions else None
    if action == "accept":
        if profile.status not in (ProfileStatus.SUBMITTED, ProfileStatus.RESUBMITTED):
            raise StateConflict("Приём доступен только для новой представленной версии")
        profile.status = ProfileStatus.ACCEPTED
        add_audit(db, profile, user, f"Принят к рассмотрению: {comment}",
                  AuditScope.SUBMITTED)
    elif action == "clarification":
        profile.status = ProfileStatus.CLARIFICATION
        db.add(ProfileMessage(profile_id=profile.id, version_id=version.id, author_role="reviewer",
                              author_name=user.display_name,
                              kind=MessageKind.QUESTION, text=comment, created_at=datetime.now(UTC)))
        add_audit(db, profile, user, f"Требуются уточнения: {comment}",
                  AuditScope.SUBMITTED)
    elif action in ("complete", "remove"):
        if profile.status == ProfileStatus.CLARIFICATION:
            raise StateConflict("Сначала дождитесь повторного представления сведений")
        if len(comment.strip()) < 10 or len(basis.strip()) < 5 or checks != [True, True, True]:
            raise ValueError(
                "Для итогового статуса нужны три подтверждения, реквизиты основания "
                "и комментарий не менее десяти символов"
            )
        doc = next((d for d in profile.documents if d.id == document_id and d.scope == "result"
                    and d.review_version_id == version.id), None)
        if doc is None or not original_available(doc.storage_key):
            raise ValueError("Прикрепите подтверждающий документ результата для текущей версии")
        signals = await profile_signals(db, profile.id, version.id)
        if any(
            s.status not in (SignalStatus.REVIEWED, SignalStatus.DISMISSED, SignalStatus.INCLUDED)
            or not s.decisions or len(s.decisions[-1].comment.strip()) < 5
            or s.decisions[-1].status != s.status
            for s in signals
        ):
            raise ValueError("Сначала рассмотрите все сигналы текущей версии с комментариями")
        assessments = await document_assessments(db, profile.id, version.id)
        latest = {item.document_id: item for item in assessments}
        document_ids = {d["id"] for d in version.snapshot.get("documents", []) if d.get("kind") != "photo"}
        if any(
            not latest.get(uuid.UUID(key)) or latest[uuid.UUID(key)].status != "usable"
            or len(latest[uuid.UUID(key)].comment.strip()) < 5
            for key in document_ids
        ):
            raise ValueError(
                "Сначала оцените каждый документ текущей версии; "
                "нечитаемые и неполные сканы требуют уточнения"
            )
        originals = {str(document.id): document for document in profile.documents}
        if any(
            key not in originals or not original_available(originals[key].storage_key) for key in document_ids
        ):
            raise ValueError("Оригинал документа текущей версии недоступен; запросите повторную загрузку")
        result = ReviewResult.COMPLETED if action == "complete" else ReviewResult.REMOVED
        profile.status = (ProfileStatus.COMPLETED if action == "complete"
                          else ProfileStatus.REMOVED)
        db.add(ProfileReview(profile_id=profile.id,
                             version_id=version.id if version else None,
                              result=result, basis_text=basis, comment=comment,
                              document_id=document_id, checks=checks, author_name=user.display_name,
                              created_at=datetime.now(UTC)))
        title = "Рассмотрение завершено" if action == "complete" \
            else "Снят с рассмотрения"
        add_audit(db, profile, user, f"{title}: {basis or comment}",
                  AuditScope.SUBMITTED)


def ensure_current_review(profile: Profile, version_number: int | None = None) -> None:
    if profile.status in (ProfileStatus.COMPLETED, ProfileStatus.REMOVED):
        raise StateConflict("Рассмотрение уже завершено; материал доступен только для чтения")
    if not profile.versions or (version_number is not None and version_number != profile.versions[-1].number):
        raise StateConflict("Решение относится не к текущей представленной версии. Обновите материал")


async def document_assessments(db: AsyncSession, profile_id: uuid.UUID,
                               version_id: uuid.UUID | None = None) -> list[ProfileDocumentAssessment]:
    query = select(ProfileDocumentAssessment).where(ProfileDocumentAssessment.profile_id == profile_id)
    if version_id is not None:
        query = query.where(ProfileDocumentAssessment.version_id == version_id)
    return list((await db.scalars(query.order_by(
        ProfileDocumentAssessment.created_at, ProfileDocumentAssessment.id,
    ))).all())


async def assess_document(db: AsyncSession, profile: Profile, user: User, document_id: uuid.UUID,
                         version_number: int, status: str, comment: str,
                         request_clarification: bool = False) -> ProfileDocumentAssessment:
    ensure_current_review(profile, version_number)
    version = profile.versions[-1]
    if str(document_id) not in {doc["id"] for doc in version.snapshot.get("documents", [])}:
        raise ValueError("Документ не входит в эту представленную версию")
    document = next((doc for doc in profile.documents if doc.id == document_id), None)
    if document is None:
        raise ValueError("Оригинал документа недоступен; запросите повторную загрузку")
    if status == "usable" and not original_available(document.storage_key):
        raise ValueError(
            "Оригинал файла отсутствует. Отметьте необходимость уточнения и запросите повторную загрузку"
        )
    if len(comment.strip()) < 5:
        raise ValueError("Для оценки документа нужен содержательный комментарий")
    await reserve_revision(db, profile, profile.revision)
    assessment = ProfileDocumentAssessment(profile_id=profile.id, version_id=version.id,
        document_id=document_id, status=status, comment=comment.strip(),
        author_name=user.display_name, created_at=datetime.now(UTC))
    db.add(assessment)
    add_audit(
        db, profile, user,
        f"Оценка файла «{document.filename}», v{version_number}: {status}. {comment.strip()}",
        AuditScope.SUBMITTED,
    )
    if request_clarification:
        await review_decision(
            db, profile, user, "clarification", f"Документ «{document.filename}»: {comment.strip()}", ""
        )
    await db.flush()
    return assessment


async def add_message(db: AsyncSession, profile: Profile, user: User,
                      text: str) -> ProfileMessage:
    is_reviewer = user.role in (UserRole.REVIEWER, UserRole.SPECIALIST)
    kind = MessageKind.QUESTION if is_reviewer else MessageKind.REPLY
    msg = ProfileMessage(profile_id=profile.id,
                         version_id=profile.versions[-1].id if profile.versions else None,
                         author_role="reviewer" if is_reviewer else "reservist",
                         author_name=user.display_name, kind=kind, text=text, created_at=datetime.now(UTC))
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
                       kind: str, section: str = "", scope: str = "candidate", user: User | None = None,
                       origin: str = "upload", review_version_id: uuid.UUID | None = None) -> ProfileDocument:
    doc = ProfileDocument(profile_id=profile.id, filename=filename,
                           storage_key=storage_key, sha256=sha256, size=size, kind=kind,
                           section=section, scope=scope, uploaded_by=user.id if user else None,
                           origin=origin, review_version_id=review_version_id, active=True,
                           created_at=datetime.now(UTC))
    db.add(doc)
    await db.flush()
    profile.documents.append(doc)
    if scope == "candidate":
        q = questionnaire_for(profile)
        if kind == "photo":
            q["photo"] = attachment_out(doc)
        elif kind == "consent":
            q["consent_document_id"] = str(doc.id)
        profile.questionnaire = q
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
    doc = next((d for d in profile.documents if d.id == doc_id and d.active and d.scope == "candidate"), None)
    if doc is None:
        return False
    q = questionnaire_for(profile)
    doc.active = False
    key = str(doc_id)
    q["attachments"] = [file for file in q["attachments"] if file["id"] != key]
    if q.get("photo") and q["photo"]["id"] == key:
        q["photo"] = None
    if q["consent_document_id"] == key:
        q["consent_document_id"] = ""
    for field in ("diploma_document_id", "reserve_act_document_id"):
        if q["candidate"][field] == key:
            q["candidate"][field] = ""
    for row in [*(r for rows in q["records"].values() for r in rows), *q["activities"]]:
        if row.get("document_id") == key:
            row["document_id"] = ""
    for block in profile.payment_blocks:
        for row in block.records:
            if row.document_id == doc_id:
                row.document_id = None
    profile.questionnaire = q
    profile.progress = compute_completeness(profile)[0]
    return True


__all__ = [
    "EDITABLE",
    "PAYMENT_CATEGORIES",
    "PaymentCategory",
    "ProfileStatus",
    "ReviewResult",
    "SignalStatus",
    "WorkStatus",
]
