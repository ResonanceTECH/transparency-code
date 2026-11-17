"""Identity domain API — auth-эндпоинты (SPEC.md §4).

`login` публичный; `me`/`logout` требуют сессию. Все ответы — JSON
(клиент всегда парсит `response.json()`, включая logout → `{}`).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_db
from app.domains.identity import services
from app.domains.identity.deps import get_current_user
from app.domains.identity.models import User
from app.domains.identity.schemas import LoginIn, UserOut
from app.domains.identity.services import SESSION_COOKIE

router = APIRouter(tags=["identity"])


@router.post("/auth/login", response_model=UserOut)
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


@router.get("/auth/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/auth/logout")
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
