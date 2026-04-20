"""add_whatsapp_fields_to_studios

Revision ID: 8d5217662d89
Revises: b01ebbc38c50
Create Date: 2026-04-16 14:00:43.230763

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8d5217662d89'
down_revision: Union[str, None] = 'b01ebbc38c50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('studios', sa.Column('whatsapp_phone_id', sa.String(length=50), nullable=True))
    op.add_column('studios', sa.Column('whatsapp_token', sa.String(length=512), nullable=True))
    op.add_column('studios', sa.Column('whatsapp_verify_token', sa.String(length=128), nullable=True))
    op.add_column('studios', sa.Column('whatsapp_active', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('studios', 'whatsapp_active')
    op.drop_column('studios', 'whatsapp_verify_token')
    op.drop_column('studios', 'whatsapp_token')
    op.drop_column('studios', 'whatsapp_phone_id')
