"""add cancellation_surveys table

Revision ID: e8c2f1a9b4d3
Revises: f7a2c9e4d6b1
Create Date: 2026-09-01 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8c2f1a9b4d3"
down_revision: Union[str, Sequence[str], None] = "f7a2c9e4d6b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cancellation_surveys",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("followup_answer", sa.Text(), nullable=True),
        sa.Column("offer_presented", sa.String(), nullable=True),
        sa.Column("offer_accepted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cancellation_surveys_id"), "cancellation_surveys", ["id"], unique=False)
    op.create_index(op.f("ix_cancellation_surveys_user_id"), "cancellation_surveys", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cancellation_surveys_user_id"), table_name="cancellation_surveys")
    op.drop_index(op.f("ix_cancellation_surveys_id"), table_name="cancellation_surveys")
    op.drop_table("cancellation_surveys")
