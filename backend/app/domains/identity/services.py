"""Identity services: пароли (argon2id), серверные сессии, сид demo-аккаунта.

Не зависит от FastAPI — принимает AsyncSession, возвращает доменные данные.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.domains.identity.models import User, UserRole, UserSession

_hasher = PasswordHasher()  # argon2id, параметры по умолчанию RFC 9106

# Фиктивный хэш для equal-time ответа при неизвестном логине (SPEC.md §4).
_DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$sSCULGtNjGiz99wXAwgPtA$"
    "d8W+FvnaPjdl2TLSfFS0P22rHnvBO9rmhu9MutnYgmA"
)

SESSION_COOKIE = "session"
# Продление сессии при активности — не чаще, чтобы не писать в БД на каждый запрос.
_RENEW_AFTER = timedelta(minutes=5)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    return await db.scalar(select(User).where(User.username == username))


async def authenticate(db: AsyncSession, username: str, password: str) -> User | None:
    """Проверка логина/пароля; при неизвестном пользователе — verify по фиктивному хэшу."""
    user = await get_user_by_username(db, username)
    stored = user.password_hash if user is not None else _DUMMY_HASH
    if not verify_password(password, stored):
        return None
    return user


async def create_session(db: AsyncSession, user: User) -> str:
    """Создаёт серверную сессию, возвращает токен для cookie. Просроченные чистим."""
    now = datetime.now(UTC)
    await db.execute(delete(UserSession).where(UserSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    ttl = timedelta(hours=get_settings().session_ttl_hours)
    db.add(
        UserSession(
            token=token,
            user_id=user.id,
            expires_at=now + ttl,
            last_seen_at=now,
        )
    )
    return token


async def get_user_by_token(db: AsyncSession, token: str | None) -> User | None:
    """Пользователь по session-токену; продлевает сессию при активности (SPEC.md §4)."""
    if not token:
        return None
    session = await db.scalar(
        select(UserSession)
        .where(UserSession.token == token)
        .options(selectinload(UserSession.user))
    )
    if session is None:
        return None
    now = datetime.now(UTC)
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= now:
        return None
    last_seen = session.last_seen_at
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=UTC)
    if last_seen is None or (now - last_seen).total_seconds() > _RENEW_AFTER.total_seconds():
        session.last_seen_at = now
        session.expires_at = now + timedelta(hours=get_settings().session_ttl_hours)
        # Явный commit: зависимость get_db не коммитит сама, а продление —
        # побочный эффект auth-проверки, не части доменной транзакции.
        await db.commit()
    return session.user


async def delete_session(db: AsyncSession, token: str | None) -> None:
    if token:
        await db.execute(delete(UserSession).where(UserSession.token == token))


async def seed_demo_user(db: AsyncSession) -> None:
    """Идемпотентный сид demo-аккаунтов из env (SPEC.md §4). Вызывать при старте."""
    settings = get_settings()
    if not settings.allow_demo_login:
        return
    user = await get_user_by_username(db, settings.demo_username)
    if user is None:
        db.add(
            User(
                id=uuid.uuid4(),
                username=settings.demo_username,
                password_hash=hash_password(settings.demo_password),
                display_name="Демо-специалист",
                role=UserRole.SPECIALIST,
            )
        )

    # Учебные аккаунты ролей этапа 2: кандидат в резерв и проверяющий (SPEC.md §10.3).
    for username, display, role in (
        ("reservist", "Ковалёв Алексей Сергеевич · кандидат в резерв (вым.)", UserRole.RESERVIST),
        ("reviewer", "Смирнова Анна · проверяющий (вым.)", UserRole.REVIEWER),
    ):
        account = await get_user_by_username(db, username)
        if account is None:
            db.add(
                User(
                    id=uuid.uuid4(),
                    username=username,
                    password_hash=hash_password(settings.demo_password),
                    display_name=display,
                    role=role,
                )
            )
        # Уже созданные пользователи, роли, имена и пароли при старте не изменяются.

    # Пронумерованные учебные аккаунты для автотестов интерфейса: у каждого теста
    # свой профиль, чтобы состояние на сервере не пересекалось между сценариями.
    if settings.seed_test_users:
        for index in range(1, 13):
            username = f"reservist{index}"
            if await get_user_by_username(db, username) is None:
                db.add(
                    User(
                        id=uuid.uuid4(),
                        username=username,
                        password_hash=hash_password(settings.demo_password),
                        display_name=f"Учебный кандидат в резерв {index} (вым.)",
                        role=UserRole.RESERVIST,
                    )
                )
        for index in range(1, 5):
            username = f"reviewer{index}"
            if await get_user_by_username(db, username) is None:
                db.add(
                    User(
                        id=uuid.uuid4(),
                        username=username,
                        password_hash=hash_password(settings.demo_password),
                        display_name=f"Учебный проверяющий {index} (вым.)",
                        role=UserRole.REVIEWER,
                    )
                )
