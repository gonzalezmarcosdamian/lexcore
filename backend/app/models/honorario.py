import enum
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Moneda(str, enum.Enum):
    ARS = "ARS"
    USD = "USD"


class Honorario(TenantModel):
    """Honorarios acordados para un expediente."""
    __tablename__ = "honorarios"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    concepto: Mapped[str] = mapped_column(String(500), nullable=False)
    monto_acordado: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    fecha_acuerdo: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    pagos: Mapped[list["PagoHonorario"]] = relationship(
        "PagoHonorario", back_populates="honorario", cascade="all, delete-orphan"
    )


class PagoHonorario(TenantModel):
    """Pagos recibidos contra un honorario acordado."""
    __tablename__ = "pagos_honorarios"

    honorario_id: Mapped[str] = mapped_column(
        String, ForeignKey("honorarios.id"), nullable=False, index=True
    )
    importe: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date
    comprobante: Mapped[str | None] = mapped_column(String(500), nullable=True)

    honorario: Mapped["Honorario"] = relationship("Honorario", back_populates="pagos")
