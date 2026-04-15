import enum

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class EstadoExpediente(str, enum.Enum):
    activo = "activo"
    archivado = "archivado"
    cerrado = "cerrado"


class RolEnExpediente(str, enum.Enum):
    responsable = "responsable"
    colaborador = "colaborador"
    supervision = "supervision"


class Expediente(TenantModel):
    __tablename__ = "expedientes"

    numero: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    caratula: Mapped[str] = mapped_column(String(500), nullable=False)
    fuero: Mapped[str | None] = mapped_column(String(100), nullable=True)
    juzgado: Mapped[str | None] = mapped_column(String(200), nullable=True)
    estado: Mapped[EstadoExpediente] = mapped_column(
        Enum(EstadoExpediente), nullable=False, default=EstadoExpediente.activo
    )
    cliente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("clientes.id"), nullable=True, index=True
    )

    abogados: Mapped[list["ExpedienteAbogado"]] = relationship(
        "ExpedienteAbogado", back_populates="expediente", cascade="all, delete-orphan"
    )
    movimientos: Mapped[list["Movimiento"]] = relationship(
        "Movimiento", back_populates="expediente", cascade="all, delete-orphan"
    )
    vencimientos: Mapped[list["Vencimiento"]] = relationship(
        "Vencimiento", back_populates="expediente", cascade="all, delete-orphan"
    )
    documentos: Mapped[list["Documento"]] = relationship(  # type: ignore[name-defined]
        "Documento", back_populates="expediente", cascade="all, delete-orphan"
    )


class ExpedienteAbogado(TenantModel):
    __tablename__ = "expediente_abogados"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    rol: Mapped[RolEnExpediente] = mapped_column(
        Enum(RolEnExpediente), nullable=False, default=RolEnExpediente.colaborador
    )

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="abogados")


class Movimiento(TenantModel):
    __tablename__ = "movimientos"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="movimientos")


class Vencimiento(TenantModel):
    __tablename__ = "vencimientos"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date YYYY-MM-DD
    tipo: Mapped[str] = mapped_column(String(100), nullable=False, default="vencimiento")
    cumplido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    google_event_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON {user_id: event_id}

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="vencimientos")
