"""add_operativa_to_tareatipo

Revision ID: 6b8b40123572
Revises: b05941eaead4
Create Date: 2026-04-21 18:45:33.913685

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6b8b40123572'
down_revision: Union[str, None] = 'b05941eaead4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE tareatipo ADD VALUE IF NOT EXISTS 'operativa'")


def downgrade() -> None:
    pass  # PostgreSQL no soporta eliminar valores de enum
