"""Pydantic-схемы identity-домена: запросы и ответы auth-эндпоинтов (SPEC.md §4)."""

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    """Публичная карточка пользователя — только то, что ждёт клиент."""

    username: str
    display_name: str = ""
    role: str = ""  # specialist | reservist | reviewer — клиент строит контур по роли

    model_config = {"from_attributes": True}
