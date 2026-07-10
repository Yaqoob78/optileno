"""add growth leads and events

Revision ID: d1f8c3a2b7e5
Revises: b4c1f8a7d2e1
Create Date: 2026-05-02 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1f8c3a2b7e5"
down_revision: Union[str, Sequence[str], None] = "b4c1f8a7d2e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "growth_leads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("tool", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("utm", sa.JSON(), nullable=True),
        sa.Column("result_snapshot", sa.JSON(), nullable=True),
        sa.Column("consent", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_growth_leads_id"), "growth_leads", ["id"], unique=False)
    op.create_index(op.f("ix_growth_leads_email"), "growth_leads", ["email"], unique=True)
    op.create_index(op.f("ix_growth_leads_tool"), "growth_leads", ["tool"], unique=False)

    op.create_table(
        "growth_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("tool", sa.String(), nullable=True),
        sa.Column("anonymous_id", sa.String(), nullable=True),
        sa.Column("lead_email", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("source_path", sa.String(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("utm", sa.JSON(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_growth_events_id"), "growth_events", ["id"], unique=False)
    op.create_index(op.f("ix_growth_events_tool"), "growth_events", ["tool"], unique=False)
    op.create_index(op.f("ix_growth_events_anonymous_id"), "growth_events", ["anonymous_id"], unique=False)
    op.create_index(op.f("ix_growth_events_lead_email"), "growth_events", ["lead_email"], unique=False)
    op.create_index(op.f("ix_growth_events_user_id"), "growth_events", ["user_id"], unique=False)
    op.create_index("ix_growth_events_type_created", "growth_events", ["event_type", "created_at"], unique=False)
    op.create_index("ix_growth_events_tool_created", "growth_events", ["tool", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_growth_events_tool_created", table_name="growth_events")
    op.drop_index("ix_growth_events_type_created", table_name="growth_events")
    op.drop_index(op.f("ix_growth_events_user_id"), table_name="growth_events")
    op.drop_index(op.f("ix_growth_events_lead_email"), table_name="growth_events")
    op.drop_index(op.f("ix_growth_events_anonymous_id"), table_name="growth_events")
    op.drop_index(op.f("ix_growth_events_tool"), table_name="growth_events")
    op.drop_index(op.f("ix_growth_events_id"), table_name="growth_events")
    op.drop_table("growth_events")

    op.drop_index(op.f("ix_growth_leads_tool"), table_name="growth_leads")
    op.drop_index(op.f("ix_growth_leads_email"), table_name="growth_leads")
    op.drop_index(op.f("ix_growth_leads_id"), table_name="growth_leads")
    op.drop_table("growth_leads")
