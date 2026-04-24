"""add hora_acto and documento_id to movimientos

Revision ID: f95cf53e34ad
Revises: 5fa0ba36dbc4
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = 'f95cf53e34ad'
down_revision = '5fa0ba36dbc4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('movimientos', sa.Column('hora_acto', sa.String(5), nullable=True))
    op.add_column('movimientos', sa.Column('documento_id', sa.String(), nullable=True))
    op.create_foreign_key(
        'fk_movimientos_documento_id',
        'movimientos', 'documentos',
        ['documento_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_movimientos_documento_id', 'movimientos', type_='foreignkey')
    op.drop_column('movimientos', 'documento_id')
    op.drop_column('movimientos', 'hora_acto')
