import enum
from decimal import Decimal

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel
from app.models.honorario import Moneda  # reuse enum


class GastoCategoria(str, enum.Enum):
    alquiler = "alquiler"
    sueldos = "sueldos"
    servicios = "servicios"
    costos_judiciales = "costos_judiciales"
    honorarios_terceros = "honorarios_terceros"
    otros = "otros"


class Gasto(TenantModel):
    """Gastos y costos del estudio."""
    __tablename__ = "gastos"

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    categoria: Mapped[GastoCategoria] = mapped_column(Enum(GastoCategoria), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date
    expediente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=True, index=True
    )
    recurrente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
