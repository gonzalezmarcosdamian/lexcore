"""sprint02-03: clientes, expedientes, movimientos, vencimientos, invitaciones

Revision ID: 91e6d398e2a5
Revises: b4278af0ab0b
Create Date: 2026-04-15 16:02:39.631022

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = '91e6d398e2a5'
down_revision: Union[str, None] = 'b4278af0ab0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tipocliente = PgEnum('fisica', 'juridica', name='tipocliente', create_type=False)
estadoexpediente = PgEnum('activo', 'archivado', 'cerrado', name='estadoexpediente', create_type=False)
rolenexpediente = PgEnum('responsable', 'colaborador', 'supervision', name='rolenexpediente', create_type=False)
userrole = PgEnum('admin', 'socio', 'asociado', 'pasante', name='userrole', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    PgEnum('fisica', 'juridica', name='tipocliente').create(bind, checkfirst=True)
    PgEnum('activo', 'archivado', 'cerrado', name='estadoexpediente').create(bind, checkfirst=True)
    PgEnum('responsable', 'colaborador', 'supervision', name='rolenexpediente').create(bind, checkfirst=True)

    op.create_table('clientes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('nombre', sa.String(length=300), nullable=False),
        sa.Column('tipo', tipocliente, nullable=False),
        sa.Column('cuit_dni', sa.String(length=20), nullable=True),
        sa.Column('telefono', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('archivado', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_clientes_cuit_dni'), 'clientes', ['cuit_dni'])
    op.create_index(op.f('ix_clientes_nombre'), 'clientes', ['nombre'])
    op.create_index(op.f('ix_clientes_tenant_id'), 'clientes', ['tenant_id'])

    op.create_table('invitaciones',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=200), nullable=False),
        sa.Column('rol', userrole, nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('usado', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invitaciones_email'), 'invitaciones', ['email'])
    op.create_index(op.f('ix_invitaciones_tenant_id'), 'invitaciones', ['tenant_id'])
    op.create_index(op.f('ix_invitaciones_token'), 'invitaciones', ['token'], unique=True)

    op.create_table('expedientes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('numero', sa.String(length=100), nullable=False),
        sa.Column('caratula', sa.String(length=500), nullable=False),
        sa.Column('fuero', sa.String(length=100), nullable=True),
        sa.Column('juzgado', sa.String(length=200), nullable=True),
        sa.Column('estado', estadoexpediente, nullable=False),
        sa.Column('cliente_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id'],),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expedientes_cliente_id'), 'expedientes', ['cliente_id'])
    op.create_index(op.f('ix_expedientes_numero'), 'expedientes', ['numero'])
    op.create_index(op.f('ix_expedientes_tenant_id'), 'expedientes', ['tenant_id'])

    op.create_table('expediente_abogados',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expediente_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('rol', rolenexpediente, nullable=False),
        sa.ForeignKeyConstraint(['expediente_id'], ['expedientes.id'],),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_expediente_abogados_expediente_id'), 'expediente_abogados', ['expediente_id'])
    op.create_index(op.f('ix_expediente_abogados_tenant_id'), 'expediente_abogados', ['tenant_id'])
    op.create_index(op.f('ix_expediente_abogados_user_id'), 'expediente_abogados', ['user_id'])

    op.create_table('movimientos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expediente_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('texto', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['expediente_id'], ['expedientes.id'],),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_movimientos_expediente_id'), 'movimientos', ['expediente_id'])
    op.create_index(op.f('ix_movimientos_tenant_id'), 'movimientos', ['tenant_id'])

    op.create_table('vencimientos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expediente_id', sa.String(), nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('fecha', sa.String(length=10), nullable=False),
        sa.Column('tipo', sa.String(length=100), nullable=False),
        sa.Column('cumplido', sa.Boolean(), nullable=False),
        sa.Column('google_event_ids', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['expediente_id'], ['expedientes.id'],),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vencimientos_expediente_id'), 'vencimientos', ['expediente_id'])
    op.create_index(op.f('ix_vencimientos_tenant_id'), 'vencimientos', ['tenant_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_vencimientos_tenant_id'), table_name='vencimientos')
    op.drop_index(op.f('ix_vencimientos_expediente_id'), table_name='vencimientos')
    op.drop_table('vencimientos')
    op.drop_index(op.f('ix_movimientos_tenant_id'), table_name='movimientos')
    op.drop_index(op.f('ix_movimientos_expediente_id'), table_name='movimientos')
    op.drop_table('movimientos')
    op.drop_index(op.f('ix_expediente_abogados_user_id'), table_name='expediente_abogados')
    op.drop_index(op.f('ix_expediente_abogados_tenant_id'), table_name='expediente_abogados')
    op.drop_index(op.f('ix_expediente_abogados_expediente_id'), table_name='expediente_abogados')
    op.drop_table('expediente_abogados')
    op.drop_index(op.f('ix_expedientes_tenant_id'), table_name='expedientes')
    op.drop_index(op.f('ix_expedientes_numero'), table_name='expedientes')
    op.drop_index(op.f('ix_expedientes_cliente_id'), table_name='expedientes')
    op.drop_table('expedientes')
    op.drop_index(op.f('ix_invitaciones_token'), table_name='invitaciones')
    op.drop_index(op.f('ix_invitaciones_tenant_id'), table_name='invitaciones')
    op.drop_index(op.f('ix_invitaciones_email'), table_name='invitaciones')
    op.drop_table('invitaciones')
    op.drop_index(op.f('ix_clientes_tenant_id'), table_name='clientes')
    op.drop_index(op.f('ix_clientes_nombre'), table_name='clientes')
    op.drop_index(op.f('ix_clientes_cuit_dni'), table_name='clientes')
    op.drop_table('clientes')
    bind = op.get_bind()
    rolenexpediente.drop(bind, checkfirst=True)
    estadoexpediente.drop(bind, checkfirst=True)
    tipocliente.drop(bind, checkfirst=True)
