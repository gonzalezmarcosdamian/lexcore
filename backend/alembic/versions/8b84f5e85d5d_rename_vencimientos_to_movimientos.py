"""rename vencimientos to movimientos (sprint 18)

Revision ID: 8b84f5e85d5d
Revises: 30460844d2a7
Create Date: 2026-04-24

PRE-MIGRATION COUNTS (prod):
  vencimientos = 21 rows
  notas con vencimiento_id = 2
  documentos con vencimiento_id = 5

STRATEGY:
  1. movimientos (bitacora entries) → actos_bitacora (preserve data)
  2. vencimientos → movimientos (main rename)
  3. descripcion → titulo + add descripcion TEXT
  4. cumplido bool → estado string
  5. notas.vencimiento_id → notas.movimiento_id
  6. documentos.vencimiento_id → documentos.movimiento_id

ROLLBACK: alembic downgrade -1
"""
from alembic import op
import sqlalchemy as sa

revision = '8b84f5e85d5d'
down_revision = '30460844d2a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PASO 1: Renombrar tabla de bitácora (old movimientos → actos_bitacora)
    op.rename_table('movimientos', 'actos_bitacora')

    # PASO 2: Renombrar vencimientos → movimientos
    op.rename_table('vencimientos', 'movimientos')

    # PASO 3: descripcion → titulo
    op.alter_column('movimientos', 'descripcion', new_column_name='titulo')

    # PASO 4: agregar campo descripcion (texto libre ampliado)
    op.add_column('movimientos', sa.Column('descripcion', sa.Text(), nullable=True))

    # PASO 5: cumplido bool → estado string
    op.add_column('movimientos', sa.Column('estado', sa.String(20), nullable=True))
    op.execute("UPDATE movimientos SET estado = CASE WHEN cumplido THEN 'cumplido' ELSE 'pendiente' END")
    op.alter_column('movimientos', 'estado', nullable=False, server_default='pendiente')
    op.drop_column('movimientos', 'cumplido')

    # PASO 6: notas.vencimiento_id → movimiento_id
    op.alter_column('notas', 'vencimiento_id', new_column_name='movimiento_id')

    # PASO 7: documentos.vencimiento_id → movimiento_id
    op.alter_column('documentos', 'vencimiento_id', new_column_name='movimiento_id')


def downgrade() -> None:
    # Invertir en orden opuesto

    # 7
    op.alter_column('documentos', 'movimiento_id', new_column_name='vencimiento_id')
    # 6
    op.alter_column('notas', 'movimiento_id', new_column_name='vencimiento_id')
    # 5
    op.add_column('movimientos', sa.Column('cumplido', sa.Boolean(), nullable=True))
    op.execute("UPDATE movimientos SET cumplido = (estado = 'cumplido')")
    op.alter_column('movimientos', 'cumplido', nullable=False, server_default='false')
    op.drop_column('movimientos', 'estado')
    # 4
    op.drop_column('movimientos', 'descripcion')
    # 3
    op.alter_column('movimientos', 'titulo', new_column_name='descripcion')
    # 2
    op.rename_table('movimientos', 'vencimientos')
    # 1
    op.rename_table('actos_bitacora', 'movimientos')
