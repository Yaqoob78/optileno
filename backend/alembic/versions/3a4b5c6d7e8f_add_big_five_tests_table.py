"""add_big_five_tests_table

Revision ID: 3a4b5c6d7e8f
Revises: 8f49708f8e03
Create Date: 2026-02-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a4b5c6d7e8f'
down_revision: Union[str, Sequence[str], None] = '8f49708f8e03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create big_five_tests table."""
    op.create_table(
        'big_five_tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        
        # Core Big Five Scores (0-100 scale)
        sa.Column('openness', sa.Integer(), nullable=True, default=50),
        sa.Column('conscientiousness', sa.Integer(), nullable=True, default=50),
        sa.Column('extraversion', sa.Integer(), nullable=True, default=50),
        sa.Column('agreeableness', sa.Integer(), nullable=True, default=50),
        sa.Column('neuroticism', sa.Integer(), nullable=True, default=50),
        
        # Test metadata
        sa.Column('questions_asked', sa.Integer(), nullable=True, default=0),
        sa.Column('test_completed', sa.Boolean(), nullable=True, default=False),
        sa.Column('test_in_progress', sa.Boolean(), nullable=True, default=False),
        
        # Current question tracking
        sa.Column('current_question_index', sa.Integer(), nullable=True, default=0),
        sa.Column('question_responses', sa.JSON(), nullable=True),
        
        # Behavioral adjustments
        sa.Column('openness_adjustment', sa.Float(), nullable=True, default=0.0),
        sa.Column('conscientiousness_adjustment', sa.Float(), nullable=True, default=0.0),
        sa.Column('extraversion_adjustment', sa.Float(), nullable=True, default=0.0),
        sa.Column('agreeableness_adjustment', sa.Float(), nullable=True, default=0.0),
        sa.Column('neuroticism_adjustment', sa.Float(), nullable=True, default=0.0),
        
        # Timestamps
        sa.Column('test_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('test_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_test_available_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_big_five_tests_id'), 'big_five_tests', ['id'], unique=False)
    op.create_index(op.f('ix_big_five_tests_user_id'), 'big_five_tests', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Drop big_five_tests table."""
    op.drop_index(op.f('ix_big_five_tests_user_id'), table_name='big_five_tests')
    op.drop_index(op.f('ix_big_five_tests_id'), table_name='big_five_tests')
    op.drop_table('big_five_tests')
