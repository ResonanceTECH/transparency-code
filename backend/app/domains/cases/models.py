import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.domains.analysis.models import AnalysisRun
    from app.domains.documents.models import Document, Fact
    from app.domains.identity.models import User


class Basis(str, enum.Enum):
    """Контекст проверки (SPEC.md §5.3)."""

    CANDIDATE = "candidate"
    EXPENSE_REVIEW = "expense_review"


class Case(Base):
    """Дело проверки. status/stale/pending_count — вычисляемые, не хранятся (SPEC.md §7.1–7.2)."""

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    department: Mapped[str] = mapped_column(String(200), default="")
    basis: Mapped[Basis] = mapped_column(Enum(Basis, native_enum=False, validate_strings=True, length=32))
    year: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    owner: Mapped["User"] = relationship(back_populates="cases")
    documents: Mapped[list["Document"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    facts: Mapped[list["Fact"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    runs: Mapped[list["AnalysisRun"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="AnalysisRun.created_at.desc()"
    )
    events: Mapped[list["CaseEvent"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="CaseEvent.created_at"
    )


class CaseEvent(Base):
    """Лента «История действий» (SPEC.md §7.7)."""

    __tablename__ = "case_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp()
    )

    case: Mapped[Case] = relationship(back_populates="events")
