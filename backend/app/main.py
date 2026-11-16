from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import health
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Резонанс API",
        version="0.1.0",
        description="API прототипа проверки сведений. Только синтетические данные.",
        # Swagger UI отдаётся nginx из frontend/public/docs; здесь только схема.
        docs_url=None,
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.include_router(health.router, prefix="/api")

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Единый формат ошибок клиента: {"detail": "..."} (SPEC.md §3).
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})

    return app


app = create_app()
