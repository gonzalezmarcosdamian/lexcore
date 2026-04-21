import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class TipoCliente(str, enum.Enum):
    fisica = "fisica"
    juridica = "juridica"


class Cliente(TenantModel):
    __tablename__ = "clientes"

    nombre: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    tipo: Mapped[TipoCliente] = mapped_column(Enum(TipoCliente), nullable=False)
    cuit_dni: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)  # legacy
    dni: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cuit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    archivado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
