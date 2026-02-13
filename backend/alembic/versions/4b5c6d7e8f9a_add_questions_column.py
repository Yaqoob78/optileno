"""add_questions_column

Revision ID: 4b5c6d7e8f9a
Revises: 3a4b5c6d7e8f
Create Date: 2026-02-05 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b5c6d7e8f9a'
down_revision: Union[str, Sequence[str], None] = '3a4b5c6d7e8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add questions column to big_five_tests."""
    op.add_column('big_five_tests', sa.Column('questions', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema - Remove questions column."""
    op.drop_column('big_five_tests', 'questions')
