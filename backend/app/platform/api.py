"""Platform domain: служебные эндпоинты (health, метаданные версии)."""

from fastapi import APIRouter

router = APIRouter(tags=["platform"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
