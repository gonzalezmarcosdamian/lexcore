"""add_performance_indexes

Revision ID: a1b2c3d4e5f6
Revises: 5fa0ba36dbc4
Create Date: 2026-04-30 00:00:00.000000

Agrega índices en columnas usadas frecuentemente en filtros y ORDER BY.
"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = '8b84f5e85d5d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # movimientos — filtro por fecha y estado en bitácora/agenda
    op.create_index("ix_movimientos_fecha", "movimientos", ["fecha"], unique=False)
    op.create_index("ix_movimientos_estado", "movimientos", ["estado"], unique=False)

    # tareas — filtro por fecha_limite y estado en agenda
    op.create_index("ix_tareas_fecha_limite", "tareas", ["fecha_limite"], unique=False)
    op.create_index("ix_tareas_estado", "tareas", ["estado"], unique=False)

    # gastos — filtro por mes+anio en módulo contable (query más frecuente)
    op.create_index("ix_gastos_mes_anio", "gastos", ["mes", "anio"], unique=False)
    op.create_index("ix_gastos_estado", "gastos", ["estado"], unique=False)

    # ingresos — filtro por mes+anio
    op.create_index("ix_ingresos_mes_anio", "ingresos", ["mes", "anio"], unique=False)

    # honorarios — filtro por fecha_vencimiento en cobros próximos
    op.create_index("ix_honorarios_fecha_vencimiento", "honorarios", ["fecha_vencimiento"], unique=False)

    # expedientes — filtro por estado en listado principal
    op.create_index("ix_expedientes_estado", "expedientes", ["estado"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_expedientes_estado", table_name="expedientes")
    op.drop_index("ix_honorarios_fecha_vencimiento", table_name="honorarios")
    op.drop_index("ix_ingresos_mes_anio", table_name="ingresos")
    op.drop_index("ix_gastos_estado", table_name="gastos")
    op.drop_index("ix_gastos_mes_anio", table_name="gastos")
    op.drop_index("ix_tareas_estado", table_name="tareas")
    op.drop_index("ix_tareas_fecha_limite", table_name="tareas")
    op.drop_index("ix_movimientos_estado", table_name="movimientos")
    op.drop_index("ix_movimientos_fecha", table_name="movimientos")
