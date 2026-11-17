"""Platform domain: служебные эндпоинты (health, метаданные версии)."""

from fastapi import APIRouter

router = APIRouter(tags=["platform"])


@router.get(
    "/health",
    summary="Healthcheck",
    description="Публичный эндпоинт: `200 {\"status\": \"ok\"}` без авторизации.",
)
async def health() -> dict[str, str]:
    return {"status": "ok"}
