"""Identity domain API — auth-эндпоинты (SPEC.md §4).

`login` публичный; `me`/`logout` требуют сессию. Все ответы — JSON
(клиент всегда парсит `response.json()`, включая logout → `{}`).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_db
from app.core.schemas import ErrorOut
from app.domains.identity import services
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User
from app.domains.identity.schemas import LoginIn, SessionOut, UserOut
from app.domains.identity.services import SESSION_COOKIE, get_user_by_token

router = APIRouter(tags=["identity"])

_UNAUTHORIZED = {401: {"model": ErrorOut, "description": "Требуется вход / неверные реквизиты"}}


@router.post(
    "/auth/login",
    response_model=UserOut,
    summary="Вход специалиста",
    description="Проверяет логин/пароль, создаёт серверную сессию и ставит cookie `session`.",
    responses=_UNAUTHORIZED,
)
async def login(
    payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    user = await services.authenticate(db, payload.username, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль"
        )
    token = await services.create_session(db, user)
    await db.commit()
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="lax",
        path="/",
        # Secure только за TLS-прокси; в dev по http:// cookie должен работать.
        secure=settings.environment != "development",
    )
    return user


@router.get(
    "/auth/me",
    response_model=UserOut,
    summary="Текущий пользователь",
    description="Возвращает username по session-cookie; `401` — сессии нет или она истекла.",
    responses=_UNAUTHORIZED,
)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get(
    "/auth/session",
    response_model=SessionOut,
    summary="Проверка сессии без 401",
    description=(
        "Всегда `200`: `authenticated` + карточка пользователя либо `null`. "
        "Boot-запрос клиента — альтернатива `GET /auth/me` без 401."
    ),
)
async def session_state(request: Request, db: AsyncSession = Depends(get_db)) -> SessionOut:
    user = await get_user_by_token(db, request.cookies.get(SESSION_COOKIE))
    if user is None:
        return SessionOut(authenticated=False)
    return SessionOut(authenticated=True, user=UserOut.model_validate(user))


@router.post(
    "/auth/logout",
    summary="Выход",
    description="Удаляет серверную сессию и очищает cookie; ответ — `{}` (клиент парсит JSON).",
    responses=_UNAUTHORIZED,
)
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    del user  # сессия уже проверена зависимостью; нужен только токен
    await services.delete_session(db, getattr(request.state, "session_token", None))
    await db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {}
