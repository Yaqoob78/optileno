"""add v2 goal scoring model

Revision ID: a3d7e9f1c2b4
Revises: 2e4f4fb2b8b9
Create Date: 2026-02-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3d7e9f1c2b4'
down_revision: Union[str, Sequence[str], None] = '2e4f4fb2b8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add v2 typed goal scoring columns and new tables."""

    # ── 1. New columns on `goals` table ──────────────────────────────────
    with op.batch_alter_table("goals") as batch_op:
        batch_op.add_column(
            sa.Column("scoring_version", sa.String(), nullable=False, server_default="v2")
        )
        batch_op.add_column(
            sa.Column("goal_type", sa.String(), nullable=True,
                       comment="fitness, learning, project, financial, creative, habit, exam, custom")
        )
        batch_op.add_column(
            sa.Column("horizon_days", sa.Integer(), nullable=True,
                       comment="Total days from creation to target_date")
        )
        batch_op.add_column(
            sa.Column("primary_metric_name", sa.String(), nullable=True,
                       comment="e.g. weight, pages, revenue")
        )
        batch_op.add_column(
            sa.Column("primary_metric_unit", sa.String(), nullable=True,
                       comment="e.g. kg, pages, USD")
        )
        batch_op.add_column(
            sa.Column("baseline_value", sa.Float(), nullable=True,
                       comment="Starting metric value")
        )
        batch_op.add_column(
            sa.Column("target_value", sa.Float(), nullable=True,
                       comment="Target metric value")
        )
        batch_op.add_column(
            sa.Column("trajectory_type", sa.String(), nullable=False, server_default="linear",
                       comment="linear, front_loaded, back_loaded, milestone")
        )

    # ── 2. goal_components table ─────────────────────────────────────────
    op.create_table(
        "goal_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("component_type", sa.String(), nullable=False,
                   comment="task, habit, deep_work, milestone, metric"),
        sa.Column("source_id", sa.Integer(), nullable=True,
                   comment="FK to tasks.id / plans.id (nullable for metric type)"),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0",
                   comment="Relative weight in composite score"),
        sa.Column("target_total", sa.Float(), nullable=False, server_default="0.0",
                   comment="Target value for this component"),
        sa.Column("current_total", sa.Float(), nullable=False, server_default="0.0",
                   comment="Current accumulated value"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("false"),
                   comment="Must complete for goal to succeed"),
        sa.Column("quality_weight", sa.Float(), nullable=False, server_default="1.0",
                   comment="Quality multiplier (0-2)"),
        sa.Column("overdue_penalty_per_day", sa.Float(), nullable=False, server_default="0.0",
                   comment="Score penalty per overdue day"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                   server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                   server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goal_components_id"), "goal_components", ["id"], unique=False)
    op.create_index(op.f("ix_goal_components_goal_id"), "goal_components", ["goal_id"], unique=False)
    op.create_index("ix_goal_components_goal_type", "goal_components", ["goal_id", "component_type"], unique=False)

    # ── 3. goal_progress_snapshots table ─────────────────────────────────
    op.create_table(
        "goal_progress_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        # Scoring dimensions (0-100)
        sa.Column("completion_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("pace_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("quality_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("risk_score", sa.Float(), nullable=False, server_default="0.0"),
        # Derived
        sa.Column("success_probability", sa.Float(), nullable=False, server_default="0.0",
                   comment="0-100 probability"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.2",
                   comment="0-1 confidence in the probability"),
        # Meta
        sa.Column("meta", sa.JSON(), nullable=True,
                   comment="Breakdown, component scores, anomalies"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                   server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goal_progress_snapshots_id"), "goal_progress_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_goal_progress_snapshots_goal_id"), "goal_progress_snapshots", ["goal_id"], unique=False)
    op.create_index("ix_gps_goal_date", "goal_progress_snapshots", ["goal_id", "date"], unique=True)


def downgrade() -> None:
    """Remove v2 goal scoring model."""

    # Drop snapshot table
    op.drop_index("ix_gps_goal_date", table_name="goal_progress_snapshots")
    op.drop_index(op.f("ix_goal_progress_snapshots_goal_id"), table_name="goal_progress_snapshots")
    op.drop_index(op.f("ix_goal_progress_snapshots_id"), table_name="goal_progress_snapshots")
    op.drop_table("goal_progress_snapshots")

    # Drop component table
    op.drop_index("ix_goal_components_goal_type", table_name="goal_components")
    op.drop_index(op.f("ix_goal_components_goal_id"), table_name="goal_components")
    op.drop_index(op.f("ix_goal_components_id"), table_name="goal_components")
    op.drop_table("goal_components")

    # Drop v2 columns from goals
    with op.batch_alter_table("goals") as batch_op:
        batch_op.drop_column("trajectory_type")
        batch_op.drop_column("target_value")
        batch_op.drop_column("baseline_value")
        batch_op.drop_column("primary_metric_unit")
        batch_op.drop_column("primary_metric_name")
        batch_op.drop_column("horizon_days")
        batch_op.drop_column("goal_type")
        batch_op.drop_column("scoring_version")
