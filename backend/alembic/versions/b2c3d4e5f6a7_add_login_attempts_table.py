"""add_login_attempts_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-30 00:00:00.000000

Rate limiter DB-backed: persiste entre deploys de Railway.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ip", sa.String(45), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_attempts_ip_created_at", "login_attempts", ["ip", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_login_attempts_ip_created_at", table_name="login_attempts")
    op.drop_table("login_attempts")
