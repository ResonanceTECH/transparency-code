"""Auth-зависимости identity-домена — публичный контракт для остальных доменов.

`get_current_user` — точка, через которую любой домен получает текущего
пользователя. При выделении identity в отдельный сервис эта зависимость
заменяется на проверку внутреннего токена (см. MICROSERVICES.md §5).
"""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.domains.identity.models import User
from app.domains.identity.services import SESSION_COOKIE, get_user_by_token


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """401, если нет валидной сессии; иначе пользователь из `sessions`.

    Валидный токен дополнительно кладётся в `request.state.session_token` —
    используется `logout` для удаления своей сессии.
    """
    token = request.cookies.get(SESSION_COOKIE)
    user = await get_user_by_token(db, token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")
    request.state.session_token = token
    return user
