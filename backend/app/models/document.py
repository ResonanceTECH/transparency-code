import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import DocumentStatus

if TYPE_CHECKING:
    from app.models.case import Case


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_case_sha256", "case_id", "sha256"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(500))
    storage_key: Mapped[str] = mapped_column(String(1000), default="")
    sha256: Mapped[str] = mapped_column(String(64), default="")
    mime: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, native_enum=False, validate_strings=True, length=16),
        default=DocumentStatus.RECEIVED,
    )
    error: Mapped[str | None] = mapped_column(Text)
    downloadable: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="documents")
    facts: Mapped[list["Fact"]] = relationship(back_populates="document")


class Fact(Base):
    """Извлечённое поле документа. `document_name` в API собирается из documents.filename."""

    __tablename__ = "facts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), index=True)
    field: Mapped[str] = mapped_column(String(120))
    label: Mapped[str] = mapped_column(String(300), default="")
    value: Mapped[str] = mapped_column(Text, default="")
    object_id: Mapped[str] = mapped_column(String(200), default="")
    fact_date: Mapped[date | None] = mapped_column(Date)
    unit: Mapped[str] = mapped_column(String(30), default="")
    snippet: Mapped[str] = mapped_column(Text, default="")
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    case: Mapped["Case"] = relationship(back_populates="facts")
    document: Mapped[Document | None] = relationship(back_populates="facts")
