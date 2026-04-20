"""add_soporte_tickets_table

Revision ID: 25a4bc4a240a
Revises: 8d5217662d89
Create Date: 2026-04-16 14:09:23.950076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '25a4bc4a240a'
down_revision: Union[str, None] = '8d5217662d89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS soporte_ticket_numero_seq START 1")
    op.create_table('soporte_tickets',
    sa.Column('numero', sa.Integer(), server_default=sa.text("nextval('soporte_ticket_numero_seq')"), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('modulo', sa.Enum('expedientes', 'vencimientos', 'tareas', 'honorarios', 'contable', 'equipo', 'busqueda', 'perfil', 'whatsapp', 'otro', name='moduloticket'), nullable=False),
    sa.Column('descripcion', sa.Text(), nullable=False),
    sa.Column('captura_url', sa.String(length=500), nullable=True),
    sa.Column('urgente', sa.Boolean(), nullable=False),
    sa.Column('estado', sa.Enum('abierto', 'en_revision', 'resuelto', 'descartado', name='estadoticket'), nullable=False),
    sa.Column('url_origen', sa.String(length=500), nullable=True),
    sa.Column('browser_info', sa.String(length=300), nullable=True),
    sa.Column('nota_interna', sa.Text(), nullable=True),
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_soporte_tickets_tenant_id'), 'soporte_tickets', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_soporte_tickets_user_id'), 'soporte_tickets', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_soporte_tickets_user_id'), table_name='soporte_tickets')
    op.drop_index(op.f('ix_soporte_tickets_tenant_id'), table_name='soporte_tickets')
    op.drop_table('soporte_tickets')
    op.execute("DROP SEQUENCE IF EXISTS soporte_ticket_numero_seq")
