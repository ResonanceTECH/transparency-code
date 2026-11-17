import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, JSONType

if TYPE_CHECKING:
    from app.domains.cases.models import Case
    from app.domains.documents.models import Fact


class SignalStatus(str, enum.Enum):
    UNREVIEWED = "unreviewed"
    CLARIFICATION = "clarification"
    RESOLVED = "resolved"
    FURTHER_REVIEW = "further_review"


class DecisionStatus(str, enum.Enum):
    CLARIFICATION = "clarification"
    RESOLVED = "resolved"
    FURTHER_REVIEW = "further_review"


class AnalysisRun(Base):
    """Иммутабельный запуск анализа: снапшот входа, версия и состав правил (SPEC.md §7.5)."""

    __tablename__ = "analysis_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    rule_version: Mapped[str] = mapped_column(String(32))
    enabled_rules: Mapped[list] = mapped_column(JSONType, default=list)
    input_hash: Mapped[str] = mapped_column(String(64), default="")
    warnings: Mapped[list] = mapped_column(JSONType, default=list)
    author: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    case: Mapped["Case"] = relationship(back_populates="runs")
    signals: Mapped[list["Signal"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="Signal.sort"
    )


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(300))
    explanation: Mapped[str] = mapped_column(Text, default="")
    action: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[SignalStatus] = mapped_column(
        Enum(SignalStatus, native_enum=False, validate_strings=True, length=24),
        default=SignalStatus.UNREVIEWED,
        index=True,
    )
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped[AnalysisRun] = relationship(back_populates="signals")
    case: Mapped["Case"] = relationship()
    evidence_links: Mapped[list["SignalFact"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan", order_by="SignalFact.ordinal"
    )
    decisions: Mapped[list["Decision"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan", order_by="Decision.created_at"
    )


class SignalFact(Base):
    """Связь «сигнал ↔ факт-основание» с порядком и слепком (SPEC.md §6, §7.5).

    `fact_snapshot` — сериализованный `Fact` на момент запуска: evidence
    иммутабельно и не меняется после `PATCH /facts`.
    """

    __tablename__ = "signal_facts"

    signal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"), primary_key=True
    )
    fact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("facts.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    # fact_snapshot временно убран для регенерации initial-миграции

    signal: Mapped[Signal] = relationship(back_populates="evidence_links")
    fact: Mapped["Fact"] = relationship()


class Decision(Base):
    """Решение специалиста; append-only (SPEC.md §7.6)."""

    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    signal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("signals.id", ondelete="CASCADE"), index=True)
    status: Mapped[DecisionStatus] = mapped_column(
        Enum(DecisionStatus, native_enum=False, validate_strings=True, length=24)
    )
    comment: Mapped[str] = mapped_column(Text)
    author: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    signal: Mapped[Signal] = relationship(back_populates="decisions")
