import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SubscriptionEvent(Base):
    """Append-only — nunca se hace UPDATE ni DELETE."""
    __tablename__ = "subscription_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # created | charge_success | charge_failed | cancelled | upgraded | downgraded | manual_override | alert_sent
    plan: Mapped[str] = mapped_column(String(30), nullable=False)
    billing_cycle: Mapped[str | None] = mapped_column(String(20), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    mp_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mp_preapproval_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # JSON serializado
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
