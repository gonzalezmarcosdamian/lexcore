"""add fecha_vencimiento to honorarios

Revision ID: 30460844d2a7
Revises: f95cf53e34ad
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = '30460844d2a7'
down_revision = 'f95cf53e34ad'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('honorarios', sa.Column('fecha_vencimiento', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('honorarios', 'fecha_vencimiento')
