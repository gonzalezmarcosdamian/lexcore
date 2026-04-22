import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MetricsSnapshot(Base):
    """Snapshot manual de métricas globales. Solo accesible desde /superadmin."""
    __tablename__ = "metrics_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    data_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON con todas las métricas
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
