"""Persistent questionnaire, retained files and version-specific human assessments.

Revision ID: c72f6a904e11
Revises: e14c17090890
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c72f6a904e11"
down_revision: str | Sequence[str] | None = "e14c17090890"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    # Все новые поля добавляются без изменения владельцев, паролей, слепков и файлов.
    with op.batch_alter_table("profiles") as batch:
        batch.add_column(sa.Column("questionnaire", json_type, nullable=True))
        batch.add_column(sa.Column("revision", sa.Integer(), server_default="0", nullable=False))
        batch.add_column(sa.Column("private_reply", sa.Text(), server_default="", nullable=False))
        batch.add_column(sa.Column("is_demo", sa.Boolean(), server_default=sa.false(), nullable=False))
    for table in ("service_periods", "activities", "profile_reviews"):
        name, default = ("checks", "[]") if table == "profile_reviews" else ("extra", "{}")
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column(name, json_type, server_default=default, nullable=False))
    with op.batch_alter_table("profile_documents") as batch:
        batch.add_column(sa.Column("section", sa.String(300), server_default="", nullable=False))
        batch.add_column(sa.Column("scope", sa.String(32), server_default="candidate", nullable=False))
        batch.add_column(sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False))
        batch.add_column(sa.Column("origin", sa.String(16), server_default="upload", nullable=False))
        batch.add_column(sa.Column("uploaded_by", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("review_version_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_profile_documents_uploaded_by_users", "users", ["uploaded_by"], ["id"], ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_profile_documents_review_version_id_profile_versions", "profile_versions",
            ["review_version_id"], ["id"], ondelete="SET NULL",
        )
    op.create_table(
        "profile_document_assessments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("profile_id", sa.Uuid(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", sa.Uuid(), sa.ForeignKey("profile_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("profile_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("author_name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp(), nullable=False),
    )
    for column in ("profile_id", "version_id", "document_id"):
        op.create_index(f"ix_profile_document_assessments_{column}", "profile_document_assessments", [column])
    with op.batch_alter_table("profile_messages") as batch:
        batch.add_column(sa.Column("version_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_profile_messages_version_id_profile_versions", "profile_versions", ["version_id"], ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # Вызывать только после отдельной резервной копии: downgrade удаляет новые данные.
    op.drop_table("profile_document_assessments")
    with op.batch_alter_table("profile_messages") as batch:
        batch.drop_constraint("fk_profile_messages_version_id_profile_versions", type_="foreignkey")
        batch.drop_column("version_id")
    with op.batch_alter_table("profile_documents") as batch:
        batch.drop_constraint("fk_profile_documents_review_version_id_profile_versions", type_="foreignkey")
        batch.drop_constraint("fk_profile_documents_uploaded_by_users", type_="foreignkey")
        for column in ("review_version_id", "uploaded_by", "origin", "active", "scope", "section"):
            batch.drop_column(column)
    for table, column in (("profile_reviews", "checks"), ("activities", "extra"), ("service_periods", "extra")):
        with op.batch_alter_table(table) as batch:
            batch.drop_column(column)
    with op.batch_alter_table("profiles") as batch:
        for column in ("is_demo", "private_reply", "revision", "questionnaire"):
            batch.drop_column(column)
