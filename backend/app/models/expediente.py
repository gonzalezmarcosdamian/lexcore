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
    numero_judicial: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    caratula: Mapped[str] = mapped_column(String(500), nullable=False)
    fuero: Mapped[str | None] = mapped_column(String(100), nullable=True)
    juzgado: Mapped[str | None] = mapped_column(String(200), nullable=True)
    localidad: Mapped[str | None] = mapped_column(String(200), nullable=True)
    estado: Mapped[EstadoExpediente] = mapped_column(
        Enum(EstadoExpediente), nullable=False, default=EstadoExpediente.activo
    )
    flag_paralizado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cliente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("clientes.id"), nullable=True, index=True
    )

    clientes: Mapped[list["ExpedienteCliente"]] = relationship(
        "ExpedienteCliente", back_populates="expediente", cascade="all, delete-orphan"
    )
    abogados: Mapped[list["ExpedienteAbogado"]] = relationship(
        "ExpedienteAbogado", back_populates="expediente", cascade="all, delete-orphan"
    )
    actos_bitacora: Mapped[list["ActoBitacora"]] = relationship(
        "ActoBitacora", back_populates="expediente", cascade="all, delete-orphan"
    )
    movimientos: Mapped[list["Movimiento"]] = relationship(
        "Movimiento", back_populates="expediente", cascade="all, delete-orphan"
    )
    documentos: Mapped[list["Documento"]] = relationship(  # type: ignore[name-defined]
        "Documento", back_populates="expediente", cascade="all, delete-orphan"
    )


class ExpedienteCliente(TenantModel):
    __tablename__ = "expediente_clientes"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    cliente_id: Mapped[str] = mapped_column(
        String, ForeignKey("clientes.id"), nullable=False, index=True
    )

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="clientes")


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


class ActoBitacora(TenantModel):
    """Entrada libre de bitácora (legacy — era 'Movimiento')."""
    __tablename__ = "actos_bitacora"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_manual: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hora_acto: Mapped[str | None] = mapped_column(String(5), nullable=True)
    documento_id: Mapped[str | None] = mapped_column(String, ForeignKey("documentos.id", ondelete="SET NULL"), nullable=True)

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="actos_bitacora")


class Movimiento(TenantModel):
    """Movimiento procesal (era 'Vencimiento'). Entidad principal de la bitácora."""
    __tablename__ = "movimientos"

    expediente_id: Mapped[str] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=False, index=True
    )
    titulo: Mapped[str] = mapped_column(String(500), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha: Mapped[str] = mapped_column(String(10), nullable=False)
    hora: Mapped[str | None] = mapped_column(String(5), nullable=True)
    tipo: Mapped[str] = mapped_column(String(100), nullable=False, default="vencimiento")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    google_event_ids: Mapped[str | None] = mapped_column(Text, nullable=True)

    expediente: Mapped["Expediente"] = relationship("Expediente", back_populates="movimientos")
