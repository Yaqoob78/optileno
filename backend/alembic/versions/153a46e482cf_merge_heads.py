"""merge heads

Revision ID: 153a46e482cf
Revises: 4b5c6d7e8f9a, add_goal_id_to_plans
Create Date: 2026-02-14 12:48:32.086946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '153a46e482cf'
down_revision: Union[str, Sequence[str], None] = ('4b5c6d7e8f9a', 'add_goal_id_to_plans')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
