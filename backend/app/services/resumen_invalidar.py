"""
Helper para invalidar el resumen IA de un expediente.
Se llama cuando hay nuevos movimientos, vencimientos, tareas o pagos.
Incrementa version_contexto para marcar el resumen como desactualizado.
"""
from sqlalchemy.orm import Session

from app.models.resumen import ExpedienteResumen


def invalidar_resumen(db: Session, expediente_id: str, tenant_id: str) -> None:
    """Marca el resumen existente como desactualizado (si existe)."""
    resumen = db.query(ExpedienteResumen).filter(
        ExpedienteResumen.expediente_id == expediente_id,
        ExpedienteResumen.tenant_id == tenant_id,
    ).first()
    if resumen and resumen.contenido:
        resumen.version_contexto = resumen.version_contexto + 1
        # No commit — el caller hace commit
