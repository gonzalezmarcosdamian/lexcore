"""auth: provider, google_id, google_refresh_token en users

Revision ID: b4278af0ab0b
Revises: 89b41b5661c7
Create Date: 2026-04-15 15:48:53.335014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b4278af0ab0b'
down_revision: Union[str, None] = '89b41b5661c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

authprovider_enum = sa.Enum('email', 'google', name='authprovider')


def upgrade() -> None:
    authprovider_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column('auth_provider', authprovider_enum, nullable=False, server_default='email'))
    op.add_column('users', sa.Column('google_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('google_refresh_token', sa.String(), nullable=True))
    op.alter_column('users', 'hashed_password', existing_type=sa.VARCHAR(), nullable=True)
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.alter_column('users', 'hashed_password', existing_type=sa.VARCHAR(), nullable=False)
    op.drop_column('users', 'google_refresh_token')
    op.drop_column('users', 'google_id')
    op.drop_column('users', 'auth_provider')
    authprovider_enum.drop(op.get_bind(), checkfirst=True)
