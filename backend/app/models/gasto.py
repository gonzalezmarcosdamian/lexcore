import enum
from decimal import Decimal

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel
from app.models.honorario import Moneda  # reuse enum


class IngresoCategoria(str, enum.Enum):
    honorarios_cobrados = "honorarios_cobrados"
    reintegros = "reintegros"
    consultas = "consultas"
    otros = "otros"


class Ingreso(TenantModel):
    """
    Ingreso concreto del estudio.
    Puede estar asociado a un expediente o ser general.
    """
    __tablename__ = "ingresos"

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    categoria: Mapped[IngresoCategoria] = mapped_column(Enum(IngresoCategoria), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO YYYY-MM-DD
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    expediente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=True, index=True
    )
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)


class GastoCategoria(str, enum.Enum):
    alquiler = "alquiler"
    sueldos = "sueldos"
    servicios = "servicios"
    costos_judiciales = "costos_judiciales"
    honorarios_terceros = "honorarios_terceros"
    otros = "otros"


class GastoEstado(str, enum.Enum):
    pendiente = "pendiente"
    confirmado = "confirmado"


class GastoPlantilla(TenantModel):
    """
    Definición de un gasto recurrente.
    Se crea una vez y genera instancias mensuales automáticamente.
    """
    __tablename__ = "gasto_plantillas"

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    categoria: Mapped[GastoCategoria] = mapped_column(Enum(GastoCategoria), nullable=False)
    monto_esperado: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    dia_del_mes: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1-31
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    instancias: Mapped[list["Gasto"]] = relationship(
        "Gasto", back_populates="plantilla", cascade="all, delete-orphan"
    )


class Gasto(TenantModel):
    """
    Gasto concreto de un período.
    Puede ser puntual (plantilla_id=None) o instancia de una plantilla recurrente.
    """
    __tablename__ = "gastos"

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    categoria: Mapped[GastoCategoria] = mapped_column(Enum(GastoCategoria), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[Moneda] = mapped_column(Enum(Moneda), nullable=False, default=Moneda.ARS)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date YYYY-MM-DD
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[GastoEstado] = mapped_column(
        Enum(GastoEstado), nullable=False, default=GastoEstado.confirmado
    )
    expediente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=True, index=True
    )
    plantilla_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("gasto_plantillas.id"), nullable=True, index=True
    )
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    plantilla: Mapped["GastoPlantilla | None"] = relationship(
        "GastoPlantilla", back_populates="instancias"
    )
