from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Documento(TenantModel):
    """
    Documento adjunto a un expediente.
    El binario vive en Cloudflare R2; aquí solo se guarda metadata.
    """
    __tablename__ = "documentos"

    expediente_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Adjunto opcional a tarea o vencimiento (además del expediente)
    tarea_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("tareas.id", ondelete="CASCADE"), nullable=True, index=True
    )
    vencimiento_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("vencimientos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    nombre: Mapped[str] = mapped_column(String, nullable=False)          # nombre display
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(String, nullable=True)
    file_key: Mapped[str] = mapped_column(String, nullable=False)        # clave en R2
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)    # MIME type
    uploaded_by: Mapped[str] = mapped_column(
        String, ForeignKey("users.id"), nullable=False
    )

    expediente: Mapped["Expediente"] = relationship(back_populates="documentos")  # type: ignore[name-defined]
