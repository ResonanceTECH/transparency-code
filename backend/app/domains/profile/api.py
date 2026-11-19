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

import asyncio
import copy
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User, UserRole
from app.domains.profile import demo
from app.domains.profile import questionnaire as form
from app.domains.profile import services as svc
from app.domains.profile.diff import diff_snapshots
from app.domains.profile.files import (
    DOCUMENT_KINDS,
    MIME_TYPES,
    original_available,
    safe_name,
    store_file,
    stored_path,
    validate_file,
)
from app.domains.profile.models import (
    AuditScope,
    ProfileDocument,
    ProfileStatus,
    SignalStatus,
)
from app.domains.profile.schemas import (
    AuditEventOut,
    ClientEventIn,
    CompletenessOut,
    ContactOut,
    DocumentAssessmentIn,
    DocumentAssessmentOut,
    DocumentOut,
    DraftIn,
    DraftOut,
    IncomeSummaryOut,
    MessageIn,
    MessageOut,
    PaymentBlockOut,
    QueueItemOut,
    ReviewDecisionIn,
    ReviewerProfileOut,
    ReviewStateOut,
    SampleDocumentIn,
    SignalDecisionIn,
    SignalDecisionOut,
    SignalOut,
    SubmitIn,
    VersionDetailOut,
    VersionDiffOut,
    VersionOut,
)

router = APIRouter()

_demo_lock = asyncio.Lock()

_ERRORS = {
    401: {"model": ErrorOut, "description": "Не авторизован"},
    403: {"model": ErrorOut, "description": "Недостаточно прав роли"},
    404: {"model": ErrorOut, "description": "Не найдено"},
    409: {"model": ErrorOut, "description": "Конфликт состояния"},
    422: {"model": ErrorOut, "description": "Ошибка валидации"},
}


# ---------- зависимости ролей ----------


def _check_account(user: User, expected: str | None) -> None:
    if expected is not None and expected != user.username:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "В другой вкладке выполнен вход в иной аккаунт. Перезайдите; сведения не изменены",
        )


async def require_reservist(user: User = Depends(get_current_user),
                           account: str | None = Header(None, alias="X-Profile-Account")) -> User:
    _check_account(user, account)
    if user.role != UserRole.RESERVIST:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только резервисту")
    return user


async def require_reviewer(user: User = Depends(get_current_user),
                          account: str | None = Header(None, alias="X-Profile-Account")) -> User:
    _check_account(user, account)
    if user.role not in (UserRole.REVIEWER, UserRole.SPECIALIST):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только проверяющему")
    return user


# ---------- сериализация черновика ----------


def _draft_out(profile) -> DraftOut:
    return DraftOut(
        profile_id=profile.id,
        status=profile.status,
        progress=svc.compute_completeness(profile)[0],
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
              "kind": s.kind, "officer_category": s.officer_category, "extra": s.extra or {}}
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
              "period_to": a.period_to, "basis_document": a.basis_document, "extra": a.extra or {}}
            for a in profile.activities
        ],
        documents=[
            _document_out(d, profile.revision)
            for d in profile.documents if d.active and d.scope == "candidate" and d.kind != "photo"
        ],
        versions_total=len(profile.versions),
        updated_at=profile.updated_at,
        questionnaire=svc.questionnaire_for(profile), revision=profile.revision,
        private_reply=profile.private_reply, is_demo=profile.is_demo,
        editable=profile.status in svc.EDITABLE,
        can_load_demo=get_settings().allow_demo_login and svc.can_load_demo(profile),
    )


def _signal_out(s, number: int = 0) -> SignalOut:
    return SignalOut(
        id=s.id, rule_id=s.rule_id, title=s.title, explanation=s.explanation,
        action=s.action, payload=s.payload or {}, status=s.status,
        created_at=s.created_at, version_id=s.version_id, version_number=number,
        decisions=s.decisions)


def _document_out(
    doc, revision: int = 0, *, reviewer: bool = False, version: int | None = None,
) -> DocumentOut:
    url = svc.attachment_out(doc, reviewer=reviewer)["url"]
    if url and version is not None:
        url += f"?version={version}"
    return DocumentOut(id=doc.id, filename=doc.filename, size=doc.size, kind=doc.kind,
                       created_at=doc.created_at, section=doc.section, origin=doc.origin,
                        url=url, profile_revision=revision,
                       version_number=version)


def _version_detail(profile, version, *, reviewer: bool = False) -> VersionDetailOut:
    # Старые слепки адаптируются на чтении без правки БД и без чтения полей черновика.
    snapshot = copy.deepcopy(version.snapshot)
    legacy = not snapshot.get("questionnaire")
    q = snapshot.get("questionnaire") or form.from_legacy(snapshot)
    version_ids = {item["id"] for item in snapshot.get("documents", [])}
    documents = {str(doc.id): doc for doc in profile.documents if str(doc.id) in version_ids}
    if legacy:
        # Даже утраченный старый оригинал остаётся в реестре версии. Метаданные
        # берём из слепка, а не из текущего черновика или одноимённого нового файла.
        metadata = []
        for entry in snapshot.get("documents", []):
            kind = entry.get("kind", "basis")
            metadata.append({
                "id": entry["id"], "name": entry.get("filename", "Документ прежней версии"),
                "url": "", "size": entry.get("size", 0),
                "format": Path(entry.get("filename", "")).suffix.lstrip(".").lower(),
                "kind": kind if kind in ("consent", "photo", "result") else "basis",
                "section": entry.get("section", "Приложение прежней версии"),
                "origin": entry.get("origin", "upload"),
            })
        q["attachments"] = [entry for entry in metadata if entry["kind"] != "photo"]
        q["photo"] = next((entry for entry in metadata if entry["kind"] == "photo"), None)
        q["consent_document_id"] = next(
            (entry["id"] for entry in metadata if entry["kind"] == "consent"), ""
        )
        for kind, field in (("diploma", "diploma_document_id"), ("reserve_act", "reserve_act_document_id")):
            q["candidate"][field] = next(
                (entry["id"] for entry in snapshot.get("documents", []) if entry.get("kind") == kind), ""
            )
    for attachment in [*q["attachments"], *([q["photo"]] if q.get("photo") else [])]:
        doc = documents.get(attachment["id"])
        attachment["url"] = svc.attachment_out(doc, reviewer=reviewer)["url"] if doc else ""
        if attachment["url"]:
            attachment["url"] += f"?version={version.number}"
    snapshot["questionnaire"] = q
    snapshot.setdefault("_meta", {}).update({"profile_id": str(profile.id), "is_demo": profile.is_demo})
    return VersionDetailOut(id=version.id, number=version.number, status=version.status,
                             progress=version.progress, created_at=version.created_at, snapshot=snapshot,
                             profile_revision=profile.revision)


async def _domain(operation):
    try:
        return await operation
    except svc.StateConflict as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


def _assessment_out(item, profile) -> DocumentAssessmentOut:
    number = next((v.number for v in profile.versions if v.id == item.version_id), 0)
    return DocumentAssessmentOut(id=item.id, document_id=item.document_id, version_id=item.version_id,
                                 version_number=number, status=item.status, comment=item.comment,
                                 author_name=item.author_name, created_at=item.created_at)


def _messages_out(messages, profile) -> list[MessageOut]:
    numbers = {v.id: v.number for v in profile.versions}
    return [
        MessageOut.model_validate(msg).model_copy(update={"version_number": numbers.get(msg.version_id)})
        for msg in messages
    ]


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
    if data.revision is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Для сохранения черновика нужна текущая revision"
        )
    await _domain(svc.reserve_revision(db, profile, data.revision))
    await _domain(svc.apply_draft(db, profile, data))
    progress, _m, _missing = svc.compute_completeness(profile)
    profile.progress = progress
    svc.add_audit(db, profile, user, "Черновик обновлён", AuditScope.PRIVATE)
    # Читаем ответ внутри той же транзакции: после commit другая вкладка уже
    # могла бы изменить профиль, и её данные нельзя выдавать за эту сохранённую копию.
    profile = await svc.get_or_create_profile(db, user)
    result = _draft_out(profile)
    await db.commit()
    return result


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
    return CompletenessOut(
        progress=progress, milestones=milestones, missing=missing,
        can_submit=progress >= 90 and not missing and profile.status in svc.EDITABLE,
    )


@router.post(
    "/profile/documents", response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED, tags=["profile"],
    summary="Загрузить документ профиля",
    description="Диплом, акт о зачислении, приказ, договор и др. "
                 "PDF/DOCX (совместимость: JSON/XLSX), скан согласия PDF/PNG/JPG, фото PNG/JPG; ≤ 5 МБ. "
                 "Проверяется контейнер, не текст/подпись. Каждое вложение получает отдельный ID.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 422)},
)
async def upload_document(
    file: UploadFile = File(...),
    kind: str = Form("other"),
    section: str = Form("", max_length=300),
    revision: int | None = Form(None, ge=0),
    user: User = Depends(require_reservist),
    db: AsyncSession = Depends(get_db),
):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Профиль недоступен для редактирования")
    if kind not in DOCUMENT_KINDS or kind == "result":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                             f"Неизвестный вид документа: {kind}")
    if revision is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Для загрузки файла нужна текущая revision")
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    name = await _domain(run_in_threadpool(safe_name, file.filename))
    await _domain(run_in_threadpool(validate_file, data, name, kind))
    await _domain(svc.reserve_revision(db, profile, revision))
    key, digest = await _domain(run_in_threadpool(store_file, profile.id, data, name))
    doc = await svc.add_document(db, profile, name, key, digest, len(data), kind, section=section, user=user)
    profile.progress = svc.compute_completeness(profile)[0]
    svc.add_audit(db, profile, user, f"Документ загружен: {name}", AuditScope.PRIVATE)
    await db.commit()
    return _document_out(doc, profile.revision)


@router.post(
    "/profile/documents/sample", response_model=DocumentOut, status_code=status.HTTP_201_CREATED,
    tags=["profile"], summary="Добавить существующий учебный файл",
)
async def add_sample(data: SampleDocumentIn, user: User = Depends(require_reservist),
                     db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Черновик недоступен для редактирования")
    content = await _domain(run_in_threadpool(demo.sample_bytes, data.name))
    await _domain(run_in_threadpool(validate_file, content, data.name, data.kind))
    await _domain(svc.reserve_revision(db, profile, data.revision))
    key, digest = await _domain(run_in_threadpool(store_file, profile.id, content, data.name))
    doc = await svc.add_document(db, profile, data.name, key, digest, len(content), data.kind,
                                 section=data.section, user=user, origin="sample")
    profile.progress = svc.compute_completeness(profile)[0]
    svc.add_audit(
        db, profile, user, f"По явному запросу приложен учебный файл: {data.name}", AuditScope.PRIVATE
    )
    await db.commit()
    return _document_out(doc, profile.revision)


@router.post("/profile/demo", response_model=DraftOut, tags=["profile"],
             summary="Заполнить только пустой профиль синтетическим сценарием")
async def demo_draft(user: User = Depends(require_reservist), db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    async with _demo_lock:
        await _domain(demo.load_demo_draft(db, profile, user))
        result = _draft_out(await svc.get_or_create_profile(db, user))
        await db.commit()
    return result


@router.delete(
    "/profile/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT,
    tags=["profile"], summary="Удалить документ черновика",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404, 409)},
)
async def delete_document(doc_id: uuid.UUID,
                          revision: int | None = Query(None, ge=0),
                          user: User = Depends(require_reservist),
                          db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                             "Профиль недоступен для редактирования")
    if revision is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Для удаления из черновика нужна текущая revision"
        )
    doc = next((d for d in profile.documents if d.id == doc_id and d.active and d.scope == "candidate"), None)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Документ не найден")
    await _domain(svc.reserve_revision(db, profile, revision))
    await svc.remove_document(db, profile, doc_id)
    svc.add_audit(
        db, profile, user,
        f"Документ удалён только из черновика; оригинал и старые версии сохранены: {doc.filename}",
        AuditScope.PRIVATE,
    )
    await db.commit()


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
    return _version_detail(profile, version)


@router.get(
    "/profile/versions/{number}/diff/{other}",
    response_model=VersionDiffOut, tags=["profile"],
    summary="Сравнение двух версий («что изменилось»)",
    description="Структурный diff снапшотов: изменённые поля, добавленные и "
                "удалённые элементы списков. Технические ключи (id, метки "
                "времени) из сравнения исключены.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def diff_versions(number: int, other: int,
                        user: User = Depends(require_reservist),
                        db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    by_number = {v.number: v for v in profile.versions}
    base, target = by_number.get(number), by_number.get(other)
    if base is None or target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Версия не найдена")
    entries = diff_snapshots(base.snapshot, target.snapshot)
    return VersionDiffOut(version_from=number, version_to=other,
                          changed=len(entries), entries=entries)


@router.post(
    "/profile/submit", response_model=VersionDetailOut,
    status_code=status.HTTP_201_CREATED, tags=["profile"],
    summary="Представить сведения",
    description="Проверяет полноту (≥90%), создаёт неизменный слепок версии, "
                "запускает детерминированные проверки и назначает проверяющего. "
                "После публикации черновик блокируется до решения проверяющего.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 409, 422)},
)
async def submit(data: SubmitIn | None = Body(None), user: User = Depends(require_reservist),
                 db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    if profile.status not in svc.EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Профиль уже на рассмотрении или завершён")
    if data is None or not data.confirmed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Подтвердите передачу этой версии; галочка не заменяет подписанный скан согласия",
        )
    if data.revision is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Для представления версии нужна текущая revision"
        )
    await _domain(svc.reserve_revision(db, profile, data.revision))
    version = await _domain(svc.submit_profile(db, profile, user))
    await db.commit()
    return _version_detail(profile, version)


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
    numbers = {v.id: v.number for v in profile.versions}
    return [_signal_out(s, numbers.get(s.version_id, 0)) for s in signals]


@router.get(
    "/profile/messages", response_model=list[MessageOut], tags=["profile"],
    summary="Переписка по профилю",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403)},
)
async def list_my_messages(user: User = Depends(require_reservist),
                           db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    return _messages_out(await svc.profile_messages(db, profile.id), profile)


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
    if profile.status in (ProfileStatus.COMPLETED, ProfileStatus.REMOVED):
        raise HTTPException(status.HTTP_409_CONFLICT, "Рассмотрение закрыто")
    await _domain(svc.reserve_revision(db, profile, profile.revision))
    msg = await svc.add_message(db, profile, user, data.text)
    await db.commit()
    return _messages_out([msg], profile)[0]


@router.get("/profile/review-state", response_model=ReviewStateOut, tags=["profile"],
            summary="Ручные оценки и итоговый результат своего профиля")
async def owner_review_state(user: User = Depends(require_reservist), db: AsyncSession = Depends(get_db)):
    profile = await svc.get_or_create_profile(db, user)
    reviews = await svc.profile_reviews(db, profile.id)
    documents = {review.document_id for review in reviews if review.document_id}
    return ReviewStateOut(
        reviews=reviews,
        document_assessments=[
            _assessment_out(item, profile) for item in await svc.document_assessments(db, profile.id)
        ],
        result_documents=[
            _document_out(doc, version=next((v.number for v in profile.versions
                                            if v.id == doc.review_version_id), None))
            for doc in profile.documents if doc.id in documents
        ],
    )


async def _serve_document(db, profile, doc_id, user, *, reviewer=False, number=None, download=False):
    doc = next((item for item in profile.documents if item.id == doc_id), None)
    versions = [v for v in profile.versions if number is None or v.number == number]
    published_ids = {entry["id"] for v in versions for entry in v.snapshot.get("documents", [])}
    reviews = await svc.profile_reviews(db, profile.id)
    result_visible = doc is not None and doc.scope == "result" and (
        any(review.document_id == doc.id and (
            number is None or review.version_id in {v.id for v in versions}
        ) for review in reviews)
        or (reviewer and doc.uploaded_by == user.id and doc.review_version_id in {v.id for v in versions})
    )
    owner_draft = (
        not reviewer and number is None and doc is not None and doc.active and doc.scope == "candidate"
    )
    if doc is None or not (str(doc_id) in published_ids or owner_draft or result_visible):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не входит в доступный материал")
    if not original_available(doc.storage_key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Оригинал файла отсутствует. Нужна повторная загрузка")
    target = stored_path(doc.storage_key)
    scope = AuditScope.SUBMITTED if reviewer or number is not None or result_visible else AuditScope.PRIVATE
    svc.add_audit(
        db, profile, user, f"{'Выгрузка' if download else 'Просмотр'} оригинала: {doc.filename}", scope
    )
    await db.commit()
    extension = Path(doc.filename).suffix.lower()
    inline = not download and extension in {".pdf", ".png", ".jpg", ".jpeg"}
    return FileResponse(
        target, media_type=MIME_TYPES.get(extension, "application/octet-stream"), filename=doc.filename,
        content_disposition_type="inline" if inline else "attachment",
        headers={
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
        },
    )


@router.get("/profile/documents/{doc_id}/file", tags=["profile"], response_class=FileResponse,
            summary="Оригинал своего документа, включая сохранённые версии")
async def own_document_file(
    doc_id: uuid.UUID, version: int | None = Query(None, ge=1), download: bool = Query(False),
    user: User = Depends(require_reservist), db: AsyncSession = Depends(get_db),
):
    profile = await svc.get_or_create_profile(db, user)
    return await _serve_document(db, profile, doc_id, user, number=version, download=download)


async def _client_event(db, profile, user, data: ClientEventIn, reviewer=False):
    screens = {
        "home", "profile", "kinship", "payments", "category", "payment", "support", "insurance", "housing",
        "activities", "documents", "selfcheck", "messages", "queue", "case", "signals", "result", "history",
        "instructions", "print", "templates",
    }
    if data.screen and data.screen not in screens:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Неизвестный раздел")
    if data.version is not None and not any(v.number == data.version for v in profile.versions):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Версия не найдена")
    titles = {
        "view": "Просмотр раздела", "print": "Печать единой анкеты", "template": "Печать учебного шаблона",
        "selfcheck": "Самопроверка личного черновика", "open": "Открыт кабинет",
        "close": "Запрошен выход из кабинета",
    }
    scope = AuditScope.SUBMITTED if reviewer or data.version is not None else AuditScope.PRIVATE
    if reviewer and data.event == "selfcheck":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Самопроверка черновика доступна только владельцу")
    svc.add_audit(
        db, profile, user,
        f"{titles[data.event]}: {data.screen}" + (f", v{data.version}" if data.version else ""), scope,
    )
    await db.commit()
    return {"recorded": True}


@router.post("/profile/events", tags=["profile"], summary="Журнал просмотра, самопроверки и печати владельца")
async def owner_event(
    data: ClientEventIn, user: User = Depends(require_reservist), db: AsyncSession = Depends(get_db),
):
    profile = await svc.get_or_create_profile(db, user)
    return await _client_event(db, profile, user, data)


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
    rows = await svc.reviewer_queue(db, status_filter, user)
    result = []
    for profile, pending, reviewer in rows:
        version = profile.versions[-1]
        content = version.snapshot.get("questionnaire") or form.from_legacy(version.snapshot)
        candidate = content["candidate"]
        result.append(QueueItemOut(
            profile_id=profile.id, full_name=candidate["full_name"],
            program=candidate["regional_program"] or candidate["flow"], status=profile.status,
            progress=version.progress, submitted_at=version.created_at,
            pending_signals=pending, reviewer_name=reviewer, version_number=version.number,
            region=candidate["region"], reporting_period=candidate["reporting_period"],
            program_year=candidate["regional_program_year"] or candidate["program_year"],
            is_demo=profile.is_demo,
        ))
    return result


async def _get_visible(db: AsyncSession, profile_id: uuid.UUID, user: User):
    profile = await svc.get_visible_profile(db, profile_id, user)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Профиль не найден")
    return profile


@router.post("/reviewer/demo", response_model=ReviewerProfileOut, tags=["reviewer"],
             summary="Открыть отдельный синтетический комплект без использования личных черновиков")
async def reviewer_demo(user: User = Depends(require_reviewer), db: AsyncSession = Depends(get_db)):
    async with _demo_lock:
        profile = await _domain(demo.create_demo_material(db, user))
        await db.commit()
    return await reviewer_profile(profile.id, None, user, db)


@router.post(
    "/reviewer/profiles/{profile_id}/events", tags=["reviewer"],
    summary="Журнал просмотра и печати назначенного материала",
)
async def reviewer_event(profile_id: uuid.UUID, data: ClientEventIn,
                         user: User = Depends(require_reviewer), db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    return await _client_event(db, profile, user, data, reviewer=True)


@router.get(
    "/reviewer/profiles/{profile_id}/documents/{doc_id}/file", tags=["reviewer"],
    response_class=FileResponse, summary="Оригинал файла только из назначенных представленных версий",
)
async def reviewer_document_file(
    profile_id: uuid.UUID, doc_id: uuid.UUID, version: int | None = Query(None, ge=1),
    download: bool = Query(False), user: User = Depends(require_reviewer),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_visible(db, profile_id, user)
    return await _serve_document(db, profile, doc_id, user, reviewer=True, number=version, download=download)


@router.post(
    "/reviewer/profiles/{profile_id}/documents", response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED, tags=["reviewer"],
    summary="Загрузить основание итогового решения текущей версии",
)
async def upload_review_document(
    profile_id: uuid.UUID, file: UploadFile = File(...), version: int = Form(..., ge=1),
    section: str = Form("Основание результата", max_length=300),
    user: User = Depends(require_reviewer), db: AsyncSession = Depends(get_db),
):
    profile = await _get_visible(db, profile_id, user)

    async def apply():
        svc.ensure_current_review(profile, version)
        content = await file.read(get_settings().max_upload_mb * 1024 * 1024 + 1)
        name = safe_name(file.filename)
        await run_in_threadpool(validate_file, content, name, "result")
        await svc.reserve_revision(db, profile, profile.revision)
        key, digest = await run_in_threadpool(store_file, profile.id, content, name)
        document = await svc.add_document(
            db, profile, name, key, digest, len(content), "result", section=section,
            scope="result", user=user, review_version_id=profile.versions[-1].id,
        )
        svc.add_audit(
            db, profile, user, f"Загружено основание результата v{version}: {name}", AuditScope.SUBMITTED
        )
        return document

    document = await _domain(apply())
    await db.commit()
    return _document_out(document, profile.revision, reviewer=True, version=version)


@router.post(
    "/reviewer/profiles/{profile_id}/documents/{doc_id}/assessment", response_model=DocumentAssessmentOut,
    status_code=status.HTTP_201_CREATED, tags=["reviewer"],
    summary="Ручная оценка файла конкретной версии с комментарием",
)
async def assess_review_document(
    profile_id: uuid.UUID, doc_id: uuid.UUID, data: DocumentAssessmentIn,
    user: User = Depends(require_reviewer), db: AsyncSession = Depends(get_db),
):
    profile = await _get_visible(db, profile_id, user)
    assessment = await _domain(svc.assess_document(
        db, profile, user, doc_id, data.version, data.status, data.comment, data.request_clarification,
    ))
    await db.commit()
    return _assessment_out(assessment, profile)


@router.get(
    "/reviewer/profiles/{profile_id}", response_model=ReviewerProfileOut,
    tags=["reviewer"], summary="Карточка профиля для проверяющего",
    description="Опубликованная версия-слепок (последняя или заданная "
                "параметром `version`), несоответствия, переписка и решения. "
                "Черновики сюда не попадают — 404.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_profile(profile_id: uuid.UUID,
                           version: int | None = Query(None),
                           user: User = Depends(require_reviewer),
                           db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    if version is None:
        version = profile.versions[-1]
    else:
        version = next((v for v in profile.versions if v.number == version), None)
        if version is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Версия не найдена")
    signals = await svc.profile_signals(db, profile.id, version.id)
    messages = await svc.profile_messages(db, profile.id)
    reviews = await svc.profile_reviews(db, profile.id)
    pending = sum(1 for s in signals if s.status in (SignalStatus.UNREVIEWED, SignalStatus.CLARIFICATION))
    reviewer = await _assigned_name(db, profile.id)
    detail = _version_detail(profile, version, reviewer=True)
    return ReviewerProfileOut(
        profile_id=profile.id, full_name=detail.snapshot["questionnaire"]["candidate"]["full_name"],
        status=profile.status, revision=profile.revision, version=detail,
        signals=[_signal_out(s, version.number) for s in signals],
        pending_signals=pending,
        messages=_messages_out(messages, profile),
        reviews=reviews,
        assigned_reviewer=reviewer,
        income_summary=IncomeSummaryOut(**svc.income_summary(version.snapshot)),
        document_assessments=[
            _assessment_out(item, profile)
            for item in await svc.document_assessments(db, profile.id, version.id)
        ],
        is_demo=profile.is_demo,
        result_documents=[
            _document_out(doc, reviewer=True, version=next((v.number for v in profile.versions
                                                          if v.id == doc.review_version_id), None))
            for doc in profile.documents if doc.scope == "result" and (
                (doc.review_version_id == version.id and doc.uploaded_by == user.id)
                or any(r.document_id == doc.id for r in reviews)
            )
        ],
    )


@router.get(
    "/reviewer/profiles/{profile_id}/versions",
    response_model=list[VersionOut], tags=["reviewer"],
    summary="Все опубликованные версии профиля",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_versions(profile_id: uuid.UUID,
                            user: User = Depends(require_reviewer),
                            db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    return [VersionOut(id=v.id, number=v.number, status=v.status,
                       progress=v.progress, created_at=v.created_at)
            for v in profile.versions]


@router.get(
    "/reviewer/profiles/{profile_id}/diff",
    response_model=VersionDiffOut, tags=["reviewer"],
    summary="Изменения между двумя последними версиями",
    description="Структурный diff снапшотов последней и предпоследней "
                "версий — «что изменилось» при повторном представлении.",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404, 409)},
)
async def reviewer_diff(profile_id: uuid.UUID,
                        user: User = Depends(require_reviewer),
                        db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    if len(profile.versions) < 2:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Для сравнения нужны минимум две версии")
    base, target = profile.versions[-2], profile.versions[-1]
    entries = diff_snapshots(base.snapshot, target.snapshot)
    return VersionDiffOut(version_from=base.number, version_to=target.number,
                          changed=len(entries), entries=entries)


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
    profile = await _get_visible(db, profile_id, user)

    async def apply():
        svc.ensure_current_review(profile, data.version)
        await svc.reserve_revision(db, profile, profile.revision)
        await svc.review_decision(
            db, profile, user, data.action, data.comment, data.basis, data.document_id, data.checks
        )

    await _domain(apply())
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
    decision = await _domain(svc.decide_signal(
        db, signal_id, user, SignalStatus(data.status), data.comment, data.version,
        data.request_clarification,
    ))
    if decision is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Несоответствие не найдено")
    await db.commit()
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
    profile = await _get_visible(db, profile_id, user)
    return _messages_out(await svc.profile_messages(db, profile.id), profile)


@router.post(
    "/reviewer/profiles/{profile_id}/messages",
    response_model=MessageOut, status_code=status.HTTP_201_CREATED,
    tags=["reviewer"], summary="Вопрос резервисту",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def reviewer_post_message(profile_id: uuid.UUID, data: MessageIn,
                                user: User = Depends(require_reviewer),
                                db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    if profile.status in (ProfileStatus.COMPLETED, ProfileStatus.REMOVED):
        raise HTTPException(status.HTTP_409_CONFLICT, "Рассмотрение закрыто")
    await _domain(svc.reserve_revision(db, profile, profile.revision))
    msg = await svc.add_message(db, profile, user, data.text)
    await db.commit()
    return _messages_out([msg], profile)[0]


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
    profile = await _get_visible(db, profile_id, user)
    return await svc.profile_audit(db, profile.id, AuditScope.SUBMITTED)


@router.get(
    "/reviewer/profiles/{profile_id}/export", tags=["reviewer"],
    summary="Выгрузка результата рассмотрения",
    description="JSON: метаданные профиля, последняя версия, несоответствия с "
                "решениями, итоговое решение и ограничения прототипа (SPEC §10.8).",
    responses={k: v for k, v in _ERRORS.items() if k in (401, 403, 404)},
)
async def export_profile(profile_id: uuid.UUID,
                         user: User = Depends(require_reviewer),
                         db: AsyncSession = Depends(get_db)):
    profile = await _get_visible(db, profile_id, user)
    version = profile.versions[-1]
    signals = await svc.profile_signals(db, profile.id, version.id)
    reviews = await svc.profile_reviews(db, profile.id)
    assessments = await svc.document_assessments(db, profile.id)
    svc.add_audit(
        db, profile, user, f"Сформирована выгрузка результата и представленной версии {version.number}",
        AuditScope.SUBMITTED,
    )
    await db.commit()
    detail = _version_detail(profile, version, reviewer=True)
    candidate = detail.snapshot["questionnaire"]["candidate"]
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": {
            "id": str(profile.id), "full_name": candidate["full_name"], "status": profile.status.value,
            "program": candidate["regional_program"] or candidate["flow"], "is_demo": profile.is_demo,
        },
        "version": {"number": version.number, "created_at": version.created_at, "snapshot": detail.snapshot},
        "signals": [
            {"rule_id": s.rule_id, "title": s.title, "status": s.status.value,
             "explanation": s.explanation,
             "decisions": [{"status": d.status.value, "comment": d.comment,
                            "author": d.author_name,
                            "created_at": d.created_at.isoformat()}
                           for d in s.decisions]}
            for s in signals
        ],
        "reviews": [
            {"result": r.result.value, "basis": r.basis_text,
             "comment": r.comment, "author": r.author_name,
             "created_at": r.created_at.isoformat(),
             "document_id": str(r.document_id) if r.document_id else None,
             "checks": r.checks}
            for r in reviews
        ],
        "document_assessments": [
            _assessment_out(item, profile).model_dump(mode="json") for item in assessments
        ],
        "result_documents": [
            _document_out(doc, reviewer=True, version=next(
                (v.number for v in profile.versions if v.id == doc.review_version_id), None,
            )).model_dump(mode="json") for doc in profile.documents
            if any(review.document_id == doc.id for review in reviews)
        ],
        "limitations": [
            "Несоответствия — не выводы о нарушениях; решения принимает "
            "уполномоченный человек.",
            "Проверки выполнены только над представленными синтетическими "
            "сведениями; внешние реестры не использовались.",
        ],
    }


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
    description="Три проверки questionnaire-v1 по введённым полям. Не OCR и не юридические выводы.",
    responses={401: _ERRORS[401]},
)
async def profile_rule_registry():
    return form.QUESTIONNAIRE_RULES


__all__ = ["ProfileDocument", "router"]
