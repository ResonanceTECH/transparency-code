"""API домена profile — этап 2 (SPEC.md §10.5, §10.6).

`/api/profile/*` — контур резервиста (role=reservist): приватный черновик,
полнота, документы, публикация, версии, ответы на уточнения.
`/api/reviewer/*` — контур проверяющего (role=reviewer|specialist): очередь
опубликованных профилей, карточка с версией-слепком и несоответствиями,
решения, переписка, аудит submitted-scope.
`/api/reference/contacts` — справочник операторов для обеих ролей.

Сессия обязательна для всего роутера (подключается в main.py); роль проверяется
зависимостями `require_reservist` / `require_reviewer`.
"""

import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User, UserRole
from app.domains.profile import services as svc
from app.domains.profile.models import (
    AuditScope,
    ProfileDocument,
    ProfileStatus,
    SignalStatus,
)
from app.domains.profile.rules import PROFILE_RULES
from app.domains.profile.schemas import (
    AuditEventOut,
    CompletenessOut,
    ContactOut,
    DocumentOut,
    DraftIn,
    DraftOut,
    MessageIn,
    MessageOut,
    PaymentBlockOut,
    QueueItemOut,
    ReviewDecisionIn,
    ReviewerProfileOut,
    SignalDecisionIn,
    SignalDecisionOut,
    SignalOut,
    VersionDetailOut,
    VersionOut,
)

router = APIRouter()

ALLOWED_EXTENSIONS = {".json", ".xlsx", ".pdf", ".docx"}
DOCUMENT_KINDS = {"diploma", "reserve_act", "order", "contract", "act", "letter", "other"}

_ERRORS = {
    401: {"model": ErrorOut, "description": "Не авторизован"},
    403: {"model": ErrorOut, "description": "Недостаточно прав роли"},
    404: {"model": ErrorOut, "description": "Не найдено"},
    409: {"model": ErrorOut, "description": "Конфликт состояния"},
    422: {"model": ErrorOut, "description": "Ошибка валидации"},
}


# ---------- зависимости ролей ----------


async def require_reservist(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.RESERVIST:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только резервисту")
    return user


async def require_reviewer(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.REVIEWER, UserRole.SPECIALIST):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только проверяющему")
    return user


# ---------- сериализация черновика ----------


def _draft_out(profile) -> DraftOut:
    return DraftOut(
        profile_id=profile.id,
        status=profile.status,
        progress=profile.progress,
        person={
            "full_name": profile.full_name, "birth_year": profile.birth_year,
            "phone": profile.phone, "email": profile.email,
            "current_workplace": profile.current_workplace,
        },
        program={
            "flow": profile.flow, "program_year": profile.program_year,
            "region": profile.region, "regional_program": profile.regional_program,
            "regional_program_year": profile.regional_program_year,
        },
        reserve_act_number=profile.reserve_act_number,
        reserve_act_date=profile.reserve_act_date,
        work_status=profile.work_status,
        appointment_authority=profile.appointment_authority,
        service_periods=[
            {"id": s.id, "start_date": s.start_date, "end_date": s.end_date,
             "kind": s.kind, "officer_category": s.officer_category}
            for s in profile.service_periods
        ],
        kinship={
            "has_relative": profile.has_svo_relative,
            "received_payments": profile.received_relative_payments,
            "relatives": [],
        },
        relatives=[
            {"id": r.id, "full_name": r.full_name, "degree": r.degree,
             "participant_status": r.participant_status}
            for r in profile.relatives
        ],
        payments=[
            PaymentBlockOut(
                category=b.category, answer=b.answer,
                records=[
                    {"id": r.id, "recipient_kind": r.recipient_kind,
                     "recipient_name": r.recipient_name,
                     "recipient_birth_year": r.recipient_birth_year,
                     "relation": r.relation, "title": r.title,
                     "kind_text": r.kind_text, "basis": r.basis, "level": r.level,
                     "form": r.form, "amount": r.amount,
                     "period_from": r.period_from, "period_to": r.period_to,
                     "payment_date": r.payment_date, "event_date": r.event_date,
                     "housing_kind": r.housing_kind, "document_ref": r.document_ref,
                     "document_id": r.document_id, "extra": r.extra or {}}
                    for r in b.records
                ])
            for b in profile.payment_blocks
        ],
        activity_participates=profile.activity_participates,
        activities=[
            {"id": a.id, "organization": a.organization, "kind": a.kind,
             "engagement": a.engagement, "period_from": a.period_from,
             "period_to": a.period_to, "basis_document": a.basis_document}
            for a in profile.activities
        ],
        documents=[
            {"id": d.id, "filename": d.filename, "size": d.size,
             "kind": d.kind, "created_at": d.created_at}
            for d in profile.documents
        ],
        versions_total=len(profile.versions),
        updated_at=profile.updated_at,
    )


def _signal_out(s) -> SignalOut:
    return SignalOut(
        id=s.id, rule_id=s.rule_id, title=s.title, explanation=s.explanation,
        action=s.action, payload=s.payload or {}, status=s.status,
        created_at=s.created_at)


# ---------- контур резервиста ----------


@router.get(
    "/profile", response_model=DraftOut, tags=["profile"],
    summary="Черновик профиля резервиста",
    description="Возвращает агрегированный черновик; при первом обращении создаётся пустой. "
                "Доступен только владельцу (role=reservist).",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def get_draft(user: User = Depends(require_reservist),
                    db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    await db.commit()
    return _draft_out(profile)


@router.put(
    "/profile", response_model=DraftOut, tags=["profile"],
    summary="Сохранить черновик (полная замена)",
    description="Идемпотентно заменяет весь агрегат черновика. Редактирование возможно "
                "в статусах draft и clarification; при опубликованном профиле — 409. "
                "Записывает аудит scope=private.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 409)},
)
async def put_draft(data: DraftIn, user: User = Depends(require_reservist),
                    db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Черновик недоступен для редактирования в текущем статусе")
    svc.apply_draft(db, profile, data)
    progress, _m, _missing = svc.compute_completeness(profile)
    profile.progress = progress
    svc.add_audit(db, profile, user, "Черновик обновлён", AuditScope.PRIVATE)
    await db.commit()
    # Повторный eager-запрос: свежий updated_at + загруженные коллекции
    # (refresh выгружал бы relationships → lazy-load вне контекста).
    profile = await svc.get_or_create_profile(db, user)
    return _draft_out(profile)


@router.get(
    "/profile/completeness", response_model=CompletenessOut, tags=["profile"],
    summary="Полнота профиля по вехам 10–90%",
    description="Прогресс, список вех и недостающих сведений; `can_submit` — на 90%.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def get_completeness(user: User = Depends(require_reservist),
                           db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    progress, milestones, missing = svc.compute_completeness(profile)
    return CompletenessOut(progress=progress, milestones=milestones,
                           missing=missing, can_submit=progress >= 90)


@router.post(
    "/profile/documents", response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED, tags=["profile"],
    summary="Загрузить документ профиля",
    description="Диплом, акт о зачислении, приказ, договор и др. "
                "Форматы: .json/.xlsx/.pdf/.docx ≤ 5 МБ. Дубликаты по sha256 дедуплицируются.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 422)},
)
async def upload_document(
    file: UploadFile = File(...),
    kind: str = Form("other"),
    user: User = Depends(require_reservist),
    db: AsyncSession = Depends(get_db),
):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Профиль недоступен для редактирования")
    if kind not in DOCUMENT_KINDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Неизвестный вид документа: {kind}")
    data = await file.read()
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Файл больше {get_settings().max_upload_mb} МБ")
    name = Path(file.filename or "document").name
    if Path(name).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Недопустимый формат файла")
    digest = hashlib.sha256(data).hexdigest()
    existing = next((d for d in profile.documents if d.sha256 == digest), None)
    if existing:
        return DocumentOut(id=existing.id, filename=existing.filename,
                           size=existing.size, kind=existing.kind,
                           created_at=existing.created_at)
    storage = Path(get_settings().upload_dir) / "profiles" / str(profile.id)
    storage.mkdir(parents=True, exist_ok=True)
    key = f"{uuid.uuid4().hex}_{name}"
    (storage / key).write_bytes(data)
    doc = await svc.add_document(db, profile, name,
                                 f"profiles/{profile.id}/{key}", digest, len(data), kind)
    svc.add_audit(db, profile, user, f"Документ загружен: {name}", AuditScope.PRIVATE)
    await db.commit()
    return DocumentOut(id=doc.id, filename=doc.filename, size=doc.size,
                       kind=doc.kind, created_at=doc.created_at)


@router.delete(
    "/profile/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT,
    tags=["profile"], summary="Удалить документ черновика",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404, 409)},
)
async def delete_document(doc_id: uuid.UUID,
                          user: User = Depends(require_reservist),
                          db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Профиль недоступен для редактирования")
    doc = next((d for d in profile.documents if d.id == doc_id), None)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    file_path = Path(get_settings().upload_dir) / doc.storage_key
    await svc.remove_document(db, profile, doc_id)
    svc.add_audit(db, profile, user, f"Документ удалён: {doc.filename}",
                  AuditScope.PRIVATE)
    await db.commit()
    file_path.unlink(missing_ok=True)


@router.get(
    "/profile/versions", response_model=list[VersionOut], tags=["profile"],
    summary="Опубликованные версии профиля",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def list_versions(user: User = Depends(require_reservist),
                        db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    return [VersionOut(id=v.id, number=v.number, status=v.status,
                       progress=v.progress, created_at=v.created_at)
            for v in profile.versions]


@router.get(
    "/profile/versions/{number}", response_model=VersionDetailOut, tags=["profile"],
    summary="Слепок конкретной версии",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def get_version(number: int, user: User = Depends(require_reservist),
                      db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    version = next((v for v in profile.versions if v.number == number), None)
    if version is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Версия не найдена")
    return VersionDetailOut(id=version.id, number=version.number,
                            status=version.status, progress=version.progress,
                            created_at=version.created_at, snapshot=version.snapshot)


@router.post(
    "/profile/submit", response_model=VersionOut,
    status_code=status.HTTP_201_CREATED, tags=["profile"],
    summary="Представить сведения",
    description="Проверяет полноту (≥90%), создаёт неизменный слепок версии, "
                "запускает детерминированные проверки и назначает проверяющего. "
                "После публикации черновик блокируется до решения проверяющего.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 409, 422)},
)
async def submit(user: User = Depends(require_reservist),
                 db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Профиль уже на рассмотрении или завершён")
    try:
        version = await svc.submit_profile(db, profile, user)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    await db.commit()
    return VersionOut(id=version.id, number=version.number, status=version.status,
                      progress=version.progress, created_at=version.created_at)


@router.get(
    "/profile/signals", response_model=list[SignalOut], tags=["profile"],
    summary="Несоответствия по опубликованным версиям",
    description="Видны резервисту после публикации — это поводы для уточнения, "
                "а не выводы о нарушениях.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def my_signals(user: User = Depends(require_reservist),
                     db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    signals = await svc.profile_signals(db, profile.id, None)
    return [_signal_out(s) for s in signals]


@router.get(
    "/profile/messages", response_model=list[MessageOut], tags=["profile"],
    summary="Переписка по профилю",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def list_my_messages(user: User = Depends(require_reservist),
                           db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    return await svc.profile_messages(db, profile.id)


@router.post(
    "/profile/messages", response_model=MessageOut,
    status_code=status.HTTP_201_CREATED, tags=["profile"],
    summary="Ответ резервиста проверяющему",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 409)},
)
async def post_my_message(data: MessageIn, user: User = Depends(require_reservist),
                          db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if not profile.versions:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Переписка доступна после представления сведений")
    msg = await svc.add_message(db, profile, user, data.text)
    await db.commit()
    return msg


@router.get(
    "/profile/audit", response_model=list[AuditEventOut], tags=["profile"],
    summary="Журнал действий по профилю",
    description="Резервист видит события обоих контуров своего профиля.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def my_audit(user: User = Depends(require_reservist),
                   db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    return await svc.profile_audit(db, profile.id)


# ---------- контур проверяющего ----------


@router.get(
    "/reviewer/queue", response_model=list[QueueItemOut], tags=["reviewer"],
    summary="Очередь опубликованных профилей",
    description="Только профили с опубликованными версиями; приватные черновики "
                "в очередь не попадают. Фильтр `status` — по статусу профиля.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def queue(status_filter: ProfileStatus | None = Query(None, alias="status"),
                user: User = Depends(require_reviewer),
                db: AsyncSession = Depends(get_db)):
    rows = await svc.reviewer_queue(db, status_filter)
    return [
        QueueItemOut(
            profile_id=p.id, full_name=p.full_name,
            program=p.regional_program or p.flow, status=p.status,
            progress=p.progress, submitted_at=p.submitted_at,
            pending_signals=pending, reviewer_name=reviewer)
        for p, pending, reviewer in rows
    ]


async def _get_visible(db: AsyncSession, profile_id: uuid.UUID):
    profile = await svc.get_visible_profile(db, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Профиль не найден")
    return profile


@router.get(
    "/reviewer/profiles/{profile_id}", response_model=ReviewerProfileOut,
    tags=["reviewer"], summary="Карточка профиля для проверяющего",
    description="Последняя опубликованная версия (слепок), несоответствия, "
                "переписка и решения. Черновики сюда не попадают — 404.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_profile(profile_id: uuid.UUID,
                           user: User = Depends(require_reviewer),
                           db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id)
    version = profile.versions[-1]
    signals = await svc.profile_signals(db, profile.id, version.id)
    messages = await svc.profile_messages(db, profile.id)
    reviews = await svc.profile_reviews(db, profile.id)
    pending = sum(1 for s in signals if s.status == SignalStatus.UNREVIEWED)
    reviewer = await _assigned_name(db, profile.id)
    return ReviewerProfileOut(
        profile_id=profile.id, full_name=profile.full_name, status=profile.status,
        version=VersionDetailOut(id=version.id, number=version.number,
                                 status=version.status, progress=version.progress,
                                 created_at=version.created_at,
                                 snapshot=version.snapshot),
        signals=[_signal_out(s) for s in signals],
        pending_signals=pending,
        messages=messages,
        reviews=reviews,
        assigned_reviewer=reviewer,
    )


async def _assigned_name(db: AsyncSession, profile_id: uuid.UUID) -> str:
    from sqlalchemy import select

    from app.domains.profile.models import ReviewerAssignment
    return await db.scalar(
        select(User.display_name)
        .join(ReviewerAssignment, ReviewerAssignment.reviewer_id == User.id)
        .where(ReviewerAssignment.profile_id == profile_id).limit(1)) or ""


@router.post(
    "/reviewer/profiles/{profile_id}/decision",
    status_code=status.HTTP_201_CREATED, tags=["reviewer"],
    summary="Решение по профилю",
    description="accept → «Принят к рассмотрению»; clarification → «Требуется "
                "уточнение» (комментарий уходит резервисту вопросом); "
                "complete → «Рассмотрение завершено»; remove → «Снят с "
                "рассмотрения» (требует `basis`). Комментарий ≥ 5 символов.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404, 409, 422)},
)
async def decide_profile(profile_id: uuid.UUID, data: ReviewDecisionIn,
                         user: User = Depends(require_reviewer),
                         db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id)
    if profile.status in (ProfileStatus.COMPLETED, ProfileStatus.REMOVED):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Рассмотрение уже завершено")
    if data.action == "remove" and not data.basis:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Для снятия с рассмотрения требуется основание (basis)")
    await svc.review_decision(db, profile, user, data.action, data.comment, data.basis)
    await db.commit()
    return {"status": profile.status.value}


@router.post(
    "/reviewer/signals/{signal_id}/decision",
    response_model=SignalDecisionOut,
    status_code=status.HTTP_201_CREATED, tags=["reviewer"],
    summary="Решение по несоответствию",
    description="reviewed — просмотрено; clarification — запрошено уточнение; "
                "dismissed — признано несущественным. Решения append-only, "
                "комментарий ≥ 5 символов.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404, 422)},
)
async def decide_signal(signal_id: uuid.UUID, data: SignalDecisionIn,
                        user: User = Depends(require_reviewer),
                        db: AsyncSession = Depends(get_db)):
    signal = await svc.decide_signal(db, signal_id, user,
                                     SignalStatus(data.status), data.comment)
    if signal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Несоответствие не найдено")
    await db.commit()
    decision = signal.decisions[-1]
    return SignalDecisionOut(id=decision.id, status=decision.status,
                             comment=decision.comment,
                             author_name=decision.author_name,
                             created_at=decision.created_at)


@router.get(
    "/reviewer/profiles/{profile_id}/messages",
    response_model=list[MessageOut], tags=["reviewer"],
    summary="Переписка по профилю",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_messages(profile_id: uuid.UUID,
                            user: User = Depends(require_reviewer),
                            db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id)
    return await svc.profile_messages(db, profile.id)


@router.post(
    "/reviewer/profiles/{profile_id}/messages",
    response_model=MessageOut, status_code=status.HTTP_201_CREATED,
    tags=["reviewer"], summary="Вопрос резервисту",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_post_message(profile_id: uuid.UUID, data: MessageIn,
                                user: User = Depends(require_reviewer),
                                db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id)
    msg = await svc.add_message(db, profile, user, data.text)
    await db.commit()
    return msg


@router.get(
    "/reviewer/profiles/{profile_id}/audit",
    response_model=list[AuditEventOut], tags=["reviewer"],
    summary="Аудит опубликованного контура",
    description="Только события scope=submitted — приватная история черновика "
                "проверяющему недоступна.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_audit(profile_id: uuid.UUID,
                         user: User = Depends(require_reviewer),
                         db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id)
    return await svc.profile_audit(db, profile.id, AuditScope.SUBMITTED)


# ---------- справочник ----------


@router.get(
    "/reference/contacts", response_model=list[ContactOut], tags=["reference"],
    summary="Ответственные операторы",
    description="Справочник контактов — виден обеим ролям (SPEC §10.12).",
    responses={401: _ERRORS[401]},
)
async def contacts(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select

    from app.domains.profile.models import ReferenceContact
    return list((await db.scalars(
        select(ReferenceContact).order_by(ReferenceContact.sort))).all())


@router.get(
    "/reference/rules", tags=["reference"],
    summary="Реестр проверок профиля",
    description="Детерминированные проверки несоответствий этапа 2.",
    responses={401: _ERRORS[401]},
)
async def profile_rule_registry():
    return PROFILE_RULES


__all__ = ["ProfileDocument", "router"]
