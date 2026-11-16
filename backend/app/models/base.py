from sqlalchemy import JSON, MetaData
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase

_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Базовый класс ORM-моделей (см. SPEC.md §6)."""

    metadata = MetaData(naming_convention=_CONVENTION)


# JSONB в PostgreSQL, обычный JSON в SQLite (для тестов без сервера).
JSONType = JSON().with_variant(JSONB(), "postgresql")
