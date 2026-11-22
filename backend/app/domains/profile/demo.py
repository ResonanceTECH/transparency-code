"""Отдельный необязательный синтетический комплект. Не подменяет чужой черновик."""

import hashlib
import json
import re
import secrets
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.domains.identity.models import User, UserRole
from app.domains.identity.services import hash_password
from app.domains.profile import services as svc
from app.domains.profile.files import store_file, validate_file
from app.domains.profile.models import AuditScope, Profile, ReviewerAssignment
from app.domains.profile.questionnaire import Questionnaire
from app.domains.profile.schemas import DraftIn

SAMPLES = Path(__file__).parent / "demo_data"
SUPPORT_SAMPLE = "Решение_региональная_поддержка_демо.pdf"
CONSENT_SAMPLE = "Согласие_ПДн_учебный.pdf"


def ensure_enabled() -> None:
    if not get_settings().allow_demo_login:
        raise ValueError("Учебные комплекты отключены в этом контуре")


def sample_bytes(name: str) -> bytes:
    ensure_enabled()
    manifest = json.loads((SAMPLES / "documents.json").read_text(encoding="utf-8"))
    entry = next((item for item in manifest["documents"] if item["name"] == name), None)
    if entry is None:
        raise ValueError("Учебный файл не найден в разрешённом манифесте")
    content = (SAMPLES / entry["name"]).read_bytes()
    if hashlib.sha256(content).hexdigest() != entry["sha256"] or len(content) != entry["size"]:
        raise ValueError("Учебный файл не совпадает с манифестом")
    return content


def _snake(value):
    if isinstance(value, list):
        return [_snake(item) for item in value]
    if isinstance(value, dict):
        return {
            re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key).lower()
            if re.fullmatch(r"[A-Za-z0-9]+", key) else key: _snake(item)
            for key, item in value.items()
        }
    return value


async def load_demo_draft(db: AsyncSession, profile: Profile, user: User, *, complete: bool = False) -> None:
    ensure_enabled()
    if not svc.can_load_demo(profile):
        raise svc.StateConflict(
            "Учебные данные можно добавить только в пустой профиль. Существующие сведения не изменены"
        )
    await svc.reserve_revision(db, profile, 0)
    content = json.loads((SAMPLES / "profile.json").read_text(encoding="utf-8"))
    q = _snake(content["profile"])
    sources = q["attachments"]
    q["attachments"] = []
    ids = {}
    for source in sources:
        data = await run_in_threadpool(sample_bytes, source["name"])
        kinds = {"sample-diploma": "diploma", "sample-reserve": "reserve_act"}
        kind = kinds.get(source["id"], "basis")
        await run_in_threadpool(validate_file, data, source["name"], kind)
        key, digest = await run_in_threadpool(store_file, profile.id, data, source["name"])
        doc = await svc.add_document(db, profile, source["name"], key, digest, len(data), kind,
                                     section=source["section"], user=user, origin="sample")
        ids[source["id"]] = str(doc.id)
        q["attachments"].append(svc.attachment_out(doc))
    for key in ("diploma_document_id", "reserve_act_document_id"):
        q["candidate"][key] = ids[q["candidate"][key]]
    for row in [*(r for rows in q["records"].values() for r in rows), *q["activities"]]:
        if row.get("document_id"):
            row["document_id"] = ids[row["document_id"]]
    if complete:
        for name, kind, section in ((SUPPORT_SAMPLE, "basis", "Региональная поддержка"),
                                    (CONSENT_SAMPLE, "consent", "Учебное согласие на обработку ПДн")):
            data = await run_in_threadpool(sample_bytes, name)
            await run_in_threadpool(validate_file, data, name, kind)
            key, digest = await run_in_threadpool(store_file, profile.id, data, name)
            doc = await svc.add_document(db, profile, name, key, digest, len(data), kind,
                                         section=section, user=user, origin="sample")
            q["attachments"].append(svc.attachment_out(doc))
            if kind == "consent":
                q["consent_document_id"] = str(doc.id)
            else:
                q["records"]["3"][0]["document_id"] = str(doc.id)
        q["records"]["8"][0]["expected_year"] = "2028"
    profile.is_demo = True
    await svc.apply_draft(db, profile, DraftIn(questionnaire=Questionnaire.model_validate(q)))
    profile.progress = svc.compute_completeness(profile)[0]
    svc.add_audit(
        db, profile, user,
        "По явному запросу добавлены синтетические учебные сведения; исходный профиль был пуст",
        AuditScope.PRIVATE,
    )


async def create_demo_material(db: AsyncSession, reviewer: User) -> Profile:
    ensure_enabled()
    owner_prefix = f"material-{reviewer.id.hex}-"
    existing = await db.scalar(select(Profile).join(User, User.id == Profile.owner_id)
                              .join(ReviewerAssignment, ReviewerAssignment.profile_id == Profile.id)
                               .where(Profile.is_demo.is_(True), Profile.versions.any(),
                                      ReviewerAssignment.reviewer_id == reviewer.id,
                                     User.username.startswith(owner_prefix), User.role == UserRole.RESERVIST)
                              .order_by(Profile.created_at).limit(1))
    if existing is not None:
        return await svc.get_visible_profile(db, existing.id, reviewer)
    # Этот технический владелец не является reservist/demo и не имеет известного пароля.
    owner = User(id=uuid.uuid4(), username=f"{owner_prefix}{uuid.uuid4().hex[:12]}",
                 password_hash=hash_password(secrets.token_urlsafe(40)),
                  display_name="Ковалёв Алексей Сергеевич · отдельный учебный комплект",
                  role=UserRole.RESERVIST)
    db.add(owner)
    await db.flush()
    profile = await svc.get_or_create_profile(db, owner)
    await load_demo_draft(db, profile, reviewer, complete=True)
    db.add(ReviewerAssignment(reviewer_id=reviewer.id, profile_id=profile.id))
    await db.flush()
    await svc.submit_profile(db, profile, reviewer)
    svc.add_audit(
        db, profile, reviewer,
        "Открыт отдельный готовый учебный комплект. Приватные сведения аккаунта reservist не использованы",
        AuditScope.SUBMITTED,
    )
    return profile
