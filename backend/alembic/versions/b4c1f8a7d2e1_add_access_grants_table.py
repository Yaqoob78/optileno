"""add access grants table

Revision ID: b4c1f8a7d2e1
Revises: a3d7e9f1c2b4
Create Date: 2026-03-01 23:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4c1f8a7d2e1"
down_revision: Union[str, Sequence[str], None] = "a3d7e9f1c2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "access_grants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("tier", sa.String(), nullable=False, server_default="explorer"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("granted_by_user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_access_grants_id"), "access_grants", ["id"], unique=False)
    op.create_index(op.f("ix_access_grants_email"), "access_grants", ["email"], unique=True)
    op.create_index(op.f("ix_access_grants_expires_at"), "access_grants", ["expires_at"], unique=False)
    op.create_index(op.f("ix_access_grants_granted_by_user_id"), "access_grants", ["granted_by_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_access_grants_granted_by_user_id"), table_name="access_grants")
    op.drop_index(op.f("ix_access_grants_expires_at"), table_name="access_grants")
    op.drop_index(op.f("ix_access_grants_email"), table_name="access_grants")
    op.drop_index(op.f("ix_access_grants_id"), table_name="access_grants")
    op.drop_table("access_grants")
