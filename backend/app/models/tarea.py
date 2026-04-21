import enum

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class TareaEstado(str, enum.Enum):
    pendiente = "pendiente"
    en_curso = "en_curso"
    hecha = "hecha"


class TareaTipo(str, enum.Enum):
    judicial = "judicial"
    extrajudicial = "extrajudicial"
    administrativa = "administrativa"
    operativa = "operativa"


class Tarea(TenantModel):
    """Tareas vinculadas a un expediente, con responsable y fecha límite."""
    __tablename__ = "tareas"

    expediente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("expedientes.id"), nullable=True, index=True
    )
    titulo: Mapped[str] = mapped_column(String(500), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsable_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True, index=True
    )
    tipo: Mapped[TareaTipo] = mapped_column(Enum(TareaTipo), nullable=False, default=TareaTipo.judicial)
    fecha_limite: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO date
    hora: Mapped[str | None] = mapped_column(String(5), nullable=True)  # HH:MM
    estado: Mapped[TareaEstado] = mapped_column(
        Enum(TareaEstado), nullable=False, default=TareaEstado.pendiente
    )
