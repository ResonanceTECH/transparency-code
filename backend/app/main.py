from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domains.analysis import api as analysis_api
from app.domains.cases import api as cases_api
from app.domains.documents import api as documents_api
from app.domains.identity import api as identity_api
from app.domains.reporting import api as reporting_api
from app.platform import api as platform_api

_DOMAIN_ROUTERS = (identity_api, cases_api, documents_api, analysis_api, reporting_api)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Резонанс API",
        version="0.1.0",
        description="API прототипа проверки сведений. Только синтетические данные.",
        # Swagger UI отдаётся nginx из frontend/public/docs; здесь только схема.
        docs_url=None,
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.include_router(platform_api.router, prefix="/api")
    for domain in _DOMAIN_ROUTERS:
        app.include_router(domain.router, prefix="/api")

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Единый формат ошибок клиента: {"detail": "..."} (SPEC.md §3).
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})

    return app


app = create_app()
