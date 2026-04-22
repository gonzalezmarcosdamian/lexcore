import enum

from sqlalchemy import Enum, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.models.base import TenantModel


class UserRole(str, enum.Enum):
    admin = "admin"
    socio = "socio"
    asociado = "asociado"
    pasante = "pasante"


class AuthProvider(str, enum.Enum):
    email = "email"
    google = "google"


class User(TenantModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.asociado
    )

    # Auth
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider), nullable=False, default=AuthProvider.email
    )
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    google_refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)
    google_calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Reset contraseña
    reset_password_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    reset_password_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_superadmin: Mapped[bool] = mapped_column(default=False, nullable=False)
