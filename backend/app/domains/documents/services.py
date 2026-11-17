"""Documents services: сериализация фактов/документов в API-DTO.

`serialize_fact` — единая точка маппинга ORM→FactOut; используется также
analysis-доменом для `signal_facts.fact_snapshot` (шов — MICROSERVICES.md §5).
"""

from app.domains.documents.models import Document, Fact
from app.domains.documents.schemas import DocumentOut, FactOut


def serialize_fact(fact: Fact) -> FactOut:
    """Fact → FactOut. Требует загруженной связи `fact.document` (selectinload)."""
    return FactOut(
        id=fact.id,
        document_id=fact.document_id,
        document_name=fact.document.filename if fact.document else "",
        field=fact.field,
        label=fact.label,
        value=fact.value,
        object_id=fact.object_id,
        date=fact.fact_date,
        unit=fact.unit,
        snippet=fact.snippet,
        confirmed=fact.confirmed,
    )


def serialize_document(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        name=document.filename,
        sha256=document.sha256,
        status=document.status.value,
        error=document.error,
        downloadable=document.downloadable,
    )
