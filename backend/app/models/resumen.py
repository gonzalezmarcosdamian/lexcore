from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel, utcnow


class ExpedienteResumen(TenantModel):
    """Resumen generado por IA para un expediente."""
    __tablename__ = "expediente_resumenes"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    generado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    # Para detectar si el resumen está desactualizado
    # Se incrementa cuando hay nuevos movimientos/vencimientos/tareas/pagos
    version_contexto: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version_resumen: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Cuántas veces se regeneró manualmente hoy
    regeneraciones_hoy: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ultima_regeneracion_fecha: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO date

    __table_args__ = (
        UniqueConstraint("tenant_id", "expediente_id", name="uq_resumen_tenant_expediente"),
    )
