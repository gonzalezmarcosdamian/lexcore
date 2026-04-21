import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class FeriadoCache(Base):
    """Feriados nacionales AR — compartidos entre todos los tenants, cacheados desde argentinadatos.com."""
    __tablename__ = "feriados_cache"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fecha: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50), nullable=True)  # inamovible, trasladable, puente, etc.
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DiaInhabil(Base):
    """Días inhábiles del estudio — feriados judiciales, feria, etc. Por tenant."""
    __tablename__ = "dias_inhabiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    descripcion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
