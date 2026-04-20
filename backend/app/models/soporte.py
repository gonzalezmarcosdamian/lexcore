import enum

from sqlalchemy import Boolean, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class ModuloTicket(str, enum.Enum):
    expedientes = "expedientes"
    vencimientos = "vencimientos"
    tareas = "tareas"
    honorarios = "honorarios"
    contable = "contable"
    equipo = "equipo"
    busqueda = "busqueda"
    perfil = "perfil"
    whatsapp = "whatsapp"
    otro = "otro"


class EstadoTicket(str, enum.Enum):
    abierto = "abierto"
    en_revision = "en_revision"
    resuelto = "resuelto"
    descartado = "descartado"


class SoporteTicket(TenantModel):
    __tablename__ = "soporte_tickets"

    # En PostgreSQL la secuencia la maneja la migración (soporte_ticket_numero_seq).
    # Integer sin Sequence es compatible con SQLite en tests.
    numero: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    modulo: Mapped[ModuloTicket] = mapped_column(Enum(ModuloTicket), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    captura_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    urgente: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    estado: Mapped[EstadoTicket] = mapped_column(
        Enum(EstadoTicket), nullable=False, default=EstadoTicket.abierto
    )
    # Contexto técnico auto-capturado
    url_origen: Mapped[str | None] = mapped_column(String(500), nullable=True)
    browser_info: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Respuesta interna
    nota_interna: Mapped[str | None] = mapped_column(Text, nullable=True)
