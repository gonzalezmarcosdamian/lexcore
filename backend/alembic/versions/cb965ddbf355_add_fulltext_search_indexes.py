"""add fulltext search indexes

Revision ID: cb965ddbf355
Revises: 7be62acadaaf
Create Date: 2026-04-16 13:31:27.062995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cb965ddbf355'
down_revision: Union[str, None] = '7be62acadaaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIN index sobre expedientes: numero || caratula
    op.execute("""
        CREATE INDEX ix_expedientes_fts
        ON expedientes
        USING GIN (to_tsvector('spanish', coalesce(numero, '') || ' ' || coalesce(caratula, '')))
    """)

    # GIN index sobre clientes: nombre || cuit_dni
    op.execute("""
        CREATE INDEX ix_clientes_fts
        ON clientes
        USING GIN (to_tsvector('spanish', coalesce(nombre, '') || ' ' || coalesce(cuit_dni, '')))
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_expedientes_fts")
    op.execute("DROP INDEX IF EXISTS ix_clientes_fts")
