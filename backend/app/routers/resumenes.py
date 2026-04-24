"""
Router de resúmenes IA para expedientes.
Genera resúmenes usando OpenAI a partir del contexto del expediente.
Límite: 5 regeneraciones manuales por día por expediente.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente, Movimiento, Movimiento as Vencimiento
from app.models.honorario import Honorario, PagoHonorario
from app.models.resumen import ExpedienteResumen
from app.models.tarea import Tarea
from app.schemas.resumen import ResumenOut, ResumenStatus

router = APIRouter(prefix="/expedientes", tags=["resumenes"])

LIMITE_DIARIO = 5


def _get_expediente_or_404(db, expediente_id: str, tenant_id: str) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


def _get_or_create_resumen(db, expediente_id: str, tenant_id: str) -> ExpedienteResumen:
    resumen = db.query(ExpedienteResumen).filter(
        ExpedienteResumen.expediente_id == expediente_id,
        ExpedienteResumen.tenant_id == tenant_id,
    ).first()
    if not resumen:
        resumen = ExpedienteResumen(
            expediente_id=expediente_id,
            tenant_id=tenant_id,
            contenido="",
            version_contexto=0,
            version_resumen=0,
            regeneraciones_hoy=0,
        )
        db.add(resumen)
        db.flush()
    return resumen


def _build_context(db, exp: Expediente, tenant_id: str) -> str:
    """Construye el texto de contexto para enviar a OpenAI."""
    lines = [
        f"Expediente: {exp.numero}",
        f"Carátula: {exp.caratula}",
        f"Fuero: {exp.fuero or 'No especificado'}",
        f"Juzgado: {exp.juzgado or 'No especificado'}",
        f"Estado: {exp.estado.value}",
        "",
    ]

    movimientos = db.query(Movimiento).filter(
        Movimiento.expediente_id == exp.id,
        Movimiento.tenant_id == tenant_id,
    ).order_by(Movimiento.created_at.desc()).limit(10).all()
    if movimientos:
        lines.append("Últimos movimientos:")
        for m in movimientos:
            lines.append(f"- [{m.created_at.strftime('%Y-%m-%d')}] {m.texto}")
        lines.append("")

    vencimientos = db.query(Vencimiento).filter(
        Vencimiento.expediente_id == exp.id,
        Vencimiento.tenant_id == tenant_id,
        Vencimiento.estado == "pendiente",  # noqa: E712
    ).order_by(Vencimiento.fecha).limit(5).all()
    if vencimientos:
        lines.append("Vencimientos pendientes:")
        for v in vencimientos:
            lines.append(f"- {v.fecha}: {v.descripcion}")
        lines.append("")

    tareas = db.query(Tarea).filter(
        Tarea.expediente_id == exp.id,
        Tarea.tenant_id == tenant_id,
    ).filter(Tarea.estado != "hecha").limit(5).all()
    if tareas:
        lines.append("Tareas pendientes:")
        for t in tareas:
            lines.append(f"- [{t.estado.value}] {t.titulo}")
        lines.append("")

    honorarios = db.query(Honorario).filter(
        Honorario.expediente_id == exp.id,
        Honorario.tenant_id == tenant_id,
    ).all()
    if honorarios:
        total_acordado = sum(float(h.monto_acordado) for h in honorarios)
        pagos = db.query(PagoHonorario).filter(
            PagoHonorario.honorario_id.in_([h.id for h in honorarios]),
            PagoHonorario.tenant_id == tenant_id,
        ).all()
        total_cobrado = sum(float(p.importe) for p in pagos)
        lines.append(f"Honorarios: acordado ${total_acordado:,.2f} / cobrado ${total_cobrado:,.2f}")
        lines.append("")

    return "\n".join(lines)


def _llamar_openai(context: str) -> str:
    """Llama a OpenAI y devuelve el resumen generado."""
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Eres un asistente jurídico especializado. "
                    "Generás resúmenes concisos y profesionales de expedientes legales en español. "
                    "El resumen debe tener entre 3 y 6 oraciones, destacando el estado actual, "
                    "próximos vencimientos importantes, y cualquier acción urgente pendiente."
                ),
            },
            {
                "role": "user",
                "content": f"Generá un resumen ejecutivo de este expediente:\n\n{context}",
            },
        ],
        max_tokens=500,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


@router.get("/{expediente_id}/resumen", response_model=ResumenOut)
def obtener_resumen(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente_or_404(db, expediente_id, tenant_id)
    resumen = db.query(ExpedienteResumen).filter(
        ExpedienteResumen.expediente_id == expediente_id,
        ExpedienteResumen.tenant_id == tenant_id,
    ).first()
    if not resumen or not resumen.contenido:
        raise HTTPException(status_code=404, detail="No hay resumen generado aún")
    return ResumenOut(
        id=resumen.id,
        expediente_id=resumen.expediente_id,
        contenido=resumen.contenido,
        generado_en=resumen.generado_en,
        desactualizado=resumen.version_contexto > resumen.version_resumen,
        regeneraciones_hoy=resumen.regeneraciones_hoy,
    )


@router.get("/{expediente_id}/resumen/status", response_model=ResumenStatus)
def status_resumen(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    resumen = db.query(ExpedienteResumen).filter(
        ExpedienteResumen.expediente_id == expediente_id,
        ExpedienteResumen.tenant_id == tenant_id,
    ).first()
    if not resumen or not resumen.contenido:
        return ResumenStatus(tiene_resumen=False, desactualizado=False, regeneraciones_hoy=0)
    hoy = date.today().isoformat()
    regen_hoy = resumen.regeneraciones_hoy if resumen.ultima_regeneracion_fecha == hoy else 0
    return ResumenStatus(
        tiene_resumen=True,
        desactualizado=resumen.version_contexto > resumen.version_resumen,
        regeneraciones_hoy=regen_hoy,
    )


@router.post("/{expediente_id}/resumen/generar", response_model=ResumenOut)
def generar_resumen(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    Genera o regenera el resumen IA del expediente.
    Límite: 5 por día. Fallo silencioso si OpenAI falla (conserva resumen anterior).
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="Servicio de IA no configurado")

    tenant_id = current_user["studio_id"]
    exp = _get_expediente_or_404(db, expediente_id, tenant_id)
    resumen = _get_or_create_resumen(db, expediente_id, tenant_id)

    hoy = date.today().isoformat()
    if resumen.ultima_regeneracion_fecha == hoy:
        if resumen.regeneraciones_hoy >= LIMITE_DIARIO:
            raise HTTPException(
                status_code=429,
                detail=f"Límite diario de {LIMITE_DIARIO} regeneraciones alcanzado. Intentá mañana.",
            )
    else:
        resumen.regeneraciones_hoy = 0

    context = _build_context(db, exp, tenant_id)
    try:
        contenido = _llamar_openai(context)
    except Exception:
        if resumen.contenido:
            # Fallo silencioso: devuelve el resumen anterior
            db.commit()
            return ResumenOut(
                id=resumen.id,
                expediente_id=resumen.expediente_id,
                contenido=resumen.contenido,
                generado_en=resumen.generado_en,
                desactualizado=resumen.version_contexto > resumen.version_resumen,
                regeneraciones_hoy=resumen.regeneraciones_hoy,
            )
        raise HTTPException(status_code=502, detail="Error al generar resumen con IA. Intentá de nuevo.")

    resumen.contenido = contenido
    resumen.generado_en = datetime.now(timezone.utc)
    resumen.version_resumen = resumen.version_contexto
    resumen.regeneraciones_hoy = resumen.regeneraciones_hoy + 1
    resumen.ultima_regeneracion_fecha = hoy
    db.commit()
    db.refresh(resumen)

    return ResumenOut(
        id=resumen.id,
        expediente_id=resumen.expediente_id,
        contenido=resumen.contenido,
        generado_en=resumen.generado_en,
        desactualizado=False,
        regeneraciones_hoy=resumen.regeneraciones_hoy,
    )
