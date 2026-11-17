from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Конфигурация сервиса из переменных окружения и .env (см. SPEC.md §9)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Резонанс API"
    environment: str = "development"

    # Реальные креды — только в .env; в коде паролей нет.
    database_url: str = "postgresql+asyncpg://resonance@localhost:5432/resonance"
    secret_key: str = ""

    demo_username: str = "demo"
    # Демо-логин учебного контура (синтетические данные); отключается ALLOW_DEMO_LOGIN=false.
    demo_password: str = "resonance-demo-2026"
    allow_demo_login: bool = True

    upload_dir: str = "./uploads"
    session_ttl_hours: int = 12
    max_upload_mb: int = 5
    rule_version: str = "0.1.0"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
