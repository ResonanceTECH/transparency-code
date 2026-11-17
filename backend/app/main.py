import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.domains.analysis import api as analysis_api
from app.domains.cases import api as cases_api
from app.domains.documents import api as documents_api
from app.domains.identity import api as identity_api
from app.domains.identity import services as identity_services
from app.domains.identity.deps import get_current_user
from app.domains.reporting import api as reporting_api
from app.platform import api as platform_api

logger = logging.getLogger(__name__)

# Доменные роутеры, требующие сессии: защита на уровне роутера — забыть
# Depends в новом эндпоинте нельзя (SPEC.md §4). `identity` управляет auth сам.
_PROTECTED_ROUTERS = (cases_api, documents_api, analysis_api, reporting_api)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Сид demo-аккаунта при старте; недоступная БД не роняет healthcheck."""
    if get_settings().allow_demo_login:
        try:
            async with get_session_factory()() as session:
                await identity_services.seed_demo_user(session)
                await session.commit()
        except Exception:
            logger.warning("Не удалось создать demo-пользователя (БД недоступна?)", exc_info=True)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Резонанс API",
        version="0.1.0",
        description="API прототипа проверки сведений. Только синтетические данные.",
        lifespan=lifespan,
        # Swagger UI отдаётся nginx из frontend/public/docs; здесь только схема.
        docs_url=None,
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.include_router(platform_api.router, prefix="/api")
    app.include_router(identity_api.router, prefix="/api")
    for domain in _PROTECTED_ROUTERS:
        app.include_router(
            domain.router, prefix="/api", dependencies=[Depends(get_current_user)]
        )

    @app.middleware("http")
    async def no_store_api(request: Request, call_next):
        """`Cache-Control: no-store` на все `/api/*` — приватные данные (SPEC.md §8)."""
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Единый формат ошибок клиента: {"detail": "..."} (SPEC.md §3).
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})

    return app


app = create_app()
