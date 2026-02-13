"""Add goal_id column to plans table

Revision ID: add_goal_id_to_plans
Revises: 
Create Date: 2026-02-12 09:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_goal_id_to_plans'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add goal_id column to plans table
    op.add_column('plans', sa.Column('goal_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_plans_goal_id_goals', 
        'plans', 
        'goals', 
        ['goal_id'], 
        ['id'], 
        ondelete='SET NULL'
    )
    
    # Create index for better performance
    op.create_index('ix_plans_goal_id', 'plans', ['goal_id'])


def downgrade():
    # Remove index
    op.drop_index('ix_plans_goal_id', table_name='plans')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_plans_goal_id_goals', table_name='plans', type_='foreignkey')
    
    # Remove column
    op.drop_column('plans', 'goal_id')
