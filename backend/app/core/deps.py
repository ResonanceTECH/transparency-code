from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI-зависимость: сессия БД на запрос (shared kernel).

    В микросервисной фазе заменяется на клиент соответствующего сервиса
    или пробрасывается внутренний токен — зависимость остаётся точкой подмены.
    """
    async with get_session_factory()() as session:
        yield session
