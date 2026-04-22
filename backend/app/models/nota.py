from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class Nota(TenantModel):
    """Notas/minutas de bitácora asociadas a una tarea o vencimiento."""
    __tablename__ = "notas"

    tarea_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=True, index=True
    )
    vencimiento_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("vencimientos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    autor_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    autor_nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
