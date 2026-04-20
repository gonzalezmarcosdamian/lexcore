"""
Endpoints de seed para desarrollo. NO montar en producción.
Solo disponible cuando DEBUG=true en settings.
"""
from fastapi import APIRouter, HTTPException
from datetime import date, timedelta
import random

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente
from app.models.tarea import Tarea, TareaEstado

router = APIRouter(prefix="/dev", tags=["dev"])

TAREAS_DUMMY = [
    {
        "titulo": "Presentar escrito de apelación",
        "descripcion": "Redactar y presentar recurso de apelación ante Cámara",
        "estado": TareaEstado.pendiente,
        "dias_offset": 3,
    },
    {
        "titulo": "Notificar al cliente el resultado",
        "descripcion": "Llamar a García Pérez y enviar resolución por email",
        "estado": TareaEstado.hecha,
        "dias_offset": -2,
    },
    {
        "titulo": "Revisar prueba documental",
        "descripcion": "Analizar documentación recibida del perito contable",
        "estado": TareaEstado.en_curso,
        "dias_offset": 1,
    },
    {
        "titulo": "Preparar demanda laboral",
        "descripcion": "Redactar escrito inicial para juzgado laboral N°4",
        "estado": TareaEstado.pendiente,
        "dias_offset": 7,
    },
    {
        "titulo": "Contestar traslado de demanda",
        "descripcion": "Vence el plazo para contestar. Revisar con el socio antes.",
        "estado": TareaEstado.pendiente,
        "dias_offset": 0,  # hoy
    },
    {
        "titulo": "Solicitar pericia médica",
        "descripcion": None,
        "estado": TareaEstado.pendiente,
        "dias_offset": 14,
    },
    {
        "titulo": "Actualizar liquidación de honorarios",
        "descripcion": "Recalcular con tasas actualizadas del BCRA",
        "estado": TareaEstado.hecha,
        "dias_offset": -5,
    },
]


@router.post("/seed-tareas", summary="Crea tareas dummy para el estudio actual")
def seed_tareas(db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]

    # Tomar el primer expediente del tenant
    exp = db.query(Expediente).filter(Expediente.tenant_id == tenant_id).first()
    if not exp:
        raise HTTPException(
            status_code=400,
            detail="El estudio no tiene expedientes. Creá uno primero.",
        )

    creadas = 0
    hoy = date.today()
    for d in TAREAS_DUMMY:
        fecha = (hoy + timedelta(days=d["dias_offset"])).isoformat()
        t = Tarea(
            tenant_id=tenant_id,
            expediente_id=exp.id,
            titulo=d["titulo"],
            descripcion=d["descripcion"],
            estado=d["estado"],
            fecha_limite=fecha,
        )
        db.add(t)
        creadas += 1

    db.commit()
    return {"creadas": creadas, "expediente_id": exp.id, "expediente": exp.caratula}
