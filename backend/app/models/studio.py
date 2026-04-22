import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _trial_ends_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=30)


class Studio(Base):
    """Tenant raíz. No hereda TenantModel porque ES el tenant."""
    __tablename__ = "studios"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=_trial_ends_at
    )

    # Perfil del estudio
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    direccion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email_contacto: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # WhatsApp Business
    whatsapp_phone_id: Mapped[str | None] = mapped_column(String(50), nullable=True)   # Phone Number ID de Meta
    whatsapp_token: Mapped[str | None] = mapped_column(String(512), nullable=True)      # Bearer token permanente
    whatsapp_verify_token: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Token de verificación webhook
    whatsapp_active: Mapped[bool] = mapped_column(default=False)

    # Suscripción
    plan: Mapped[str] = mapped_column(String(30), nullable=False, default="trial")
    # trial | starter | pro | estudio | read_only
    billing_cycle: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # monthly | annual
    subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)       # MP preapproval_id
    subscription_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # active | paused | cancelled | pending
    next_billing_date: Mapped[str | None] = mapped_column(String(10), nullable=True)       # ISO date YYYY-MM-DD
    plan_price_id: Mapped[str | None] = mapped_column(String(100), nullable=True)          # FK a plan_prices.id
    subscription_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
