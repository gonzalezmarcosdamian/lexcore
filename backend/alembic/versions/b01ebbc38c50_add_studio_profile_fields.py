"""add studio profile fields

Revision ID: b01ebbc38c50
Revises: cb965ddbf355
Create Date: 2026-04-16 13:36:01.365283

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b01ebbc38c50'
down_revision: Union[str, None] = 'cb965ddbf355'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIN indexes son funcionales — gestionados manualmente en cb965ddbf355, no tocar
    op.add_column('studios', sa.Column('logo_url', sa.String(length=500), nullable=True))
    op.add_column('studios', sa.Column('direccion', sa.String(length=500), nullable=True))
    op.add_column('studios', sa.Column('telefono', sa.String(length=50), nullable=True))
    op.add_column('studios', sa.Column('email_contacto', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('studios', 'email_contacto')
    op.drop_column('studios', 'telefono')
    op.drop_column('studios', 'direccion')
    op.drop_column('studios', 'logo_url')
