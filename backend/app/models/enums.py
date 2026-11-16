import enum


class Basis(str, enum.Enum):
    """Контекст проверки (SPEC.md §5.3)."""

    CANDIDATE = "candidate"
    EXPENSE_REVIEW = "expense_review"


class DocumentStatus(str, enum.Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class SignalStatus(str, enum.Enum):
    UNREVIEWED = "unreviewed"
    CLARIFICATION = "clarification"
    RESOLVED = "resolved"
    FURTHER_REVIEW = "further_review"


class DecisionStatus(str, enum.Enum):
    CLARIFICATION = "clarification"
    RESOLVED = "resolved"
    FURTHER_REVIEW = "further_review"


class UserRole(str, enum.Enum):
    SPECIALIST = "specialist"
    RESERVIST = "reservist"
    REVIEWER = "reviewer"
