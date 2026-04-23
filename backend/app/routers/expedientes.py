from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession, RequireFullAccess
from app.models.expediente import (
    Expediente, ExpedienteAbogado, ExpedienteCliente, Movimiento, Vencimiento, RolEnExpediente
)
from app.models.user import User
from app.models.cliente import Cliente
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.schemas.expediente import (
    AbogadoEnExpedienteOut, ClienteMin,
    AsignarAbogadoRequest,
    ExpedienteCreate, ExpedienteOut, ExpedienteUpdate,
    MovimientoCreate, MovimientoOut, MovimientoUpdate,
)


class ActividadItem(BaseModel):
    id: str
    tipo: str        # movimiento | honorario | pago | vencimiento | tarea | documento
    subtipo: str     # creado | cumplido | completado | pago | etc.
    descripcion: str
    meta: Dict[str, Any] = {}
    created_at: datetime

router = APIRouter(prefix="/expedientes", tags=["expedientes"])


def _enriquecer_abogados(db, exp: Expediente) -> ExpedienteOut:
    out = ExpedienteOut.model_validate(exp)
    for i, a in enumerate(exp.abogados):
        user = db.query(User).filter(User.id == a.user_id).first()
        out.abogados[i] = AbogadoEnExpedienteOut(
            id=a.id, user_id=a.user_id, rol=a.rol,
            full_name=user.full_name if user else None,
        )
    if exp.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == exp.cliente_id).first()
        out.cliente_nombre = cliente.nombre if cliente else None
    # clientes extra (junction table)
    out.clientes_extra = []
    for ec in exp.clientes:
        c = db.query(Cliente).filter(Cliente.id == ec.cliente_id).first()
        if c:
            out.clientes_extra.append(ClienteMin(id=c.id, nombre=c.nombre, tipo=c.tipo))
    return out


def _get_expediente(db, expediente_id: str, tenant_id: str) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


@router.get("", response_model=List[ExpedienteOut])
def listar_expedientes(
    db: DbSession,
    current_user: CurrentUser,
    q: Optional[str] = Query(None, description="Buscar por número o carátula"),
    estado: Optional[str] = Query(None),
    cliente_id: Optional[str] = Query(None),
):
    tenant_id = current_user["studio_id"]
    query = db.query(Expediente).filter(Expediente.tenant_id == tenant_id)
    if q:
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Expediente.numero.ilike(f"%{q}%"),
                Expediente.caratula.ilike(f"%{q}%"),
            )
        )
    if estado:
        query = query.filter(Expediente.estado == estado)
    if cliente_id:
        query = query.filter(Expediente.cliente_id == cliente_id)
    exps = query.order_by(Expediente.created_at.desc()).all()
    return [_enriquecer_abogados(db, e) for e in exps]


def _generar_numero(db, tenant_id: str) -> str:
    from datetime import datetime
    year = datetime.utcnow().year
    count = db.query(Expediente).filter(Expediente.tenant_id == tenant_id).count()
    return f"EXP-{year}-{count + 1:04d}"


@router.post("", response_model=ExpedienteOut, status_code=status.HTTP_201_CREATED, dependencies=[RequireFullAccess])
def crear_expediente(
    body: ExpedienteCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    data = body.model_dump(exclude={"abogado_ids", "cliente_ids"})
    # primer cliente de la lista como cliente_id principal
    if not data.get("cliente_id") and body.cliente_ids:
        data["cliente_id"] = body.cliente_ids[0]
    numero = _generar_numero(db, tenant_id)
    expediente = Expediente(
        tenant_id=tenant_id,
        numero=numero,
        estado="activo",
        **data,
    )
    db.add(expediente)
    db.flush()

    # El creador siempre es responsable
    db.add(ExpedienteAbogado(
        tenant_id=tenant_id, expediente_id=expediente.id,
        user_id=current_user["sub"], rol=RolEnExpediente.responsable,
    ))
    for uid in body.abogado_ids:
        if uid != current_user["sub"]:
            db.add(ExpedienteAbogado(
                tenant_id=tenant_id, expediente_id=expediente.id,
                user_id=uid, rol=RolEnExpediente.colaborador,
            ))

    # Junction clientes (todos, incluyendo el principal)
    seen = set()
    for cid in body.cliente_ids:
        if cid not in seen:
            seen.add(cid)
            db.add(ExpedienteCliente(
                tenant_id=tenant_id, expediente_id=expediente.id, cliente_id=cid
            ))
    # si vino cliente_id pero no en cliente_ids, agregarlo igual
    if data.get("cliente_id") and data["cliente_id"] not in seen:
        db.add(ExpedienteCliente(
            tenant_id=tenant_id, expediente_id=expediente.id, cliente_id=data["cliente_id"]
        ))

    db.commit()
    db.refresh(expediente)
    return _enriquecer_abogados(db, expediente)


@router.get("/{expediente_id}", response_model=ExpedienteOut)
def obtener_expediente(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    exp = _get_expediente(db, expediente_id, current_user["studio_id"])
    return _enriquecer_abogados(db, exp)


@router.patch("/{expediente_id}", response_model=ExpedienteOut)
def actualizar_expediente(
    expediente_id: str,
    body: ExpedienteUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    exp = _get_expediente(db, expediente_id, current_user["studio_id"])
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(exp, field, value)
    exp.updated_at = utcnow()
    db.commit()
    db.refresh(exp)
    return _enriquecer_abogados(db, exp)


# ── Movimientos ──────────────────────────────────────────────────────────────

@router.get("/{expediente_id}/movimientos", response_model=List[MovimientoOut])
def listar_movimientos(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    _get_expediente(db, expediente_id, current_user["studio_id"])
    return (
        db.query(Movimiento)
        .filter(Movimiento.expediente_id == expediente_id)
        .order_by(Movimiento.created_at.desc())
        .all()
    )


@router.post(
    "/{expediente_id}/movimientos",
    response_model=MovimientoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_movimiento(
    expediente_id: str,
    body: MovimientoCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    _get_expediente(db, expediente_id, current_user["studio_id"])
    mov = Movimiento(
        tenant_id=current_user["studio_id"],
        expediente_id=expediente_id,
        user_id=current_user["sub"],
        texto=body.texto,
        fecha_manual=body.fecha_manual,
    )
    db.add(mov)
    invalidar_resumen(db, expediente_id, current_user["studio_id"])
    db.commit()
    db.refresh(mov)
    return mov


@router.patch("/{expediente_id}/movimientos/{movimiento_id}", response_model=MovimientoOut)
def editar_movimiento(
    expediente_id: str,
    movimiento_id: str,
    body: MovimientoUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)
    mov = db.query(Movimiento).filter(
        Movimiento.id == movimiento_id,
        Movimiento.expediente_id == expediente_id,
        Movimiento.tenant_id == tenant_id,
    ).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(mov, field, value)
    from app.models.base import utcnow
    mov.updated_at = utcnow()
    db.commit()
    db.refresh(mov)
    return mov


@router.delete("/{expediente_id}/movimientos/{movimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_movimiento(
    expediente_id: str,
    movimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)
    mov = db.query(Movimiento).filter(
        Movimiento.id == movimiento_id,
        Movimiento.expediente_id == expediente_id,
        Movimiento.tenant_id == tenant_id,
    ).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    db.delete(mov)
    db.commit()


# ── Clientes ─────────────────────────────────────────────────────────────────

class AgregarClienteRequest(BaseModel):
    cliente_id: str


@router.post("/{expediente_id}/clientes", status_code=status.HTTP_201_CREATED)
def agregar_cliente(
    expediente_id: str,
    body: AgregarClienteRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    exp = _get_expediente(db, expediente_id, tenant_id)
    cliente = db.query(Cliente).filter(Cliente.id == body.cliente_id, Cliente.tenant_id == tenant_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    exists = db.query(ExpedienteCliente).filter(
        ExpedienteCliente.expediente_id == expediente_id,
        ExpedienteCliente.cliente_id == body.cliente_id,
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Cliente ya asociado")
    db.add(ExpedienteCliente(
        tenant_id=tenant_id, expediente_id=expediente_id, cliente_id=body.cliente_id
    ))
    # si no tiene cliente principal, asignarlo
    if not exp.cliente_id:
        exp.cliente_id = body.cliente_id
    db.commit()
    db.refresh(exp)
    return _enriquecer_abogados(db, exp)


@router.delete("/{expediente_id}/clientes/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_cliente(
    expediente_id: str,
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)
    ec = db.query(ExpedienteCliente).filter(
        ExpedienteCliente.expediente_id == expediente_id,
        ExpedienteCliente.cliente_id == cliente_id,
        ExpedienteCliente.tenant_id == tenant_id,
    ).first()
    if not ec:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    db.delete(ec)
    db.commit()


# ── Abogados ─────────────────────────────────────────────────────────────────

@router.post("/{expediente_id}/abogados", status_code=status.HTTP_201_CREATED)
def asignar_abogado(
    expediente_id: str,
    body: AsignarAbogadoRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)

    exists = db.query(ExpedienteAbogado).filter(
        ExpedienteAbogado.expediente_id == expediente_id,
        ExpedienteAbogado.user_id == body.user_id,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="El abogado ya está asignado")

    db.add(ExpedienteAbogado(
        tenant_id=tenant_id,
        expediente_id=expediente_id,
        user_id=body.user_id,
        rol=body.rol,
    ))
    db.commit()
    return {"ok": True}


@router.delete("/{expediente_id}/abogados/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_abogado(
    expediente_id: str,
    user_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)

    abogado = db.query(ExpedienteAbogado).filter(
        ExpedienteAbogado.expediente_id == expediente_id,
        ExpedienteAbogado.user_id == user_id,
    ).first()
    if not abogado:
        raise HTTPException(status_code=404, detail="Abogado no encontrado en este expediente")
    if abogado.rol == RolEnExpediente.responsable:
        raise HTTPException(status_code=400, detail="No se puede quitar al abogado responsable")
    db.delete(abogado)
    db.commit()


@router.get("/{expediente_id}/actividad", response_model=List[ActividadItem])
def actividad_expediente(expediente_id: str, db: DbSession, current_user: CurrentUser):
    """Feed cronológico unificado del expediente."""
    from app.models.honorario import Honorario, PagoHonorario
    from app.models.tarea import Tarea
    from app.models.documento import Documento

    tenant_id = current_user["studio_id"]
    _get_expediente(db, expediente_id, tenant_id)

    items: List[ActividadItem] = []

    # Movimientos manuales
    for m in db.query(Movimiento).filter(Movimiento.expediente_id == expediente_id).all():
        items.append(ActividadItem(
            id=m.id, tipo="movimiento", subtipo="manual",
            descripcion=m.texto, created_at=m.created_at,
        ))

    # Honorarios
    for h in db.query(Honorario).filter(Honorario.expediente_id == expediente_id, Honorario.tenant_id == tenant_id).all():
        items.append(ActividadItem(
            id=h.id, tipo="honorario", subtipo="creado",
            descripcion=f"Honorario: {h.concepto}",
            meta={"monto": float(h.monto_acordado), "moneda": h.moneda.value},
            created_at=h.created_at,
        ))
        for p in h.pagos:
            items.append(ActividadItem(
                id=p.id, tipo="pago", subtipo=str(p.tipo),
                descripcion=f"Pago registrado — {p.tipo}: {p.moneda} {p.importe:,.0f}",
                meta={"importe": float(p.importe), "moneda": p.moneda.value, "tipo": str(p.tipo)},
                created_at=p.created_at,
            ))

    # Vencimientos
    for v in db.query(Vencimiento).filter(Vencimiento.expediente_id == expediente_id, Vencimiento.tenant_id == tenant_id).all():
        items.append(ActividadItem(
            id=v.id, tipo="vencimiento", subtipo="creado",
            descripcion=f"Vencimiento: {v.descripcion}",
            meta={"fecha": str(v.fecha), "hora": str(v.hora) if v.hora else None, "tipo": str(v.tipo), "cumplido": bool(v.cumplido)},
            created_at=v.created_at,
        ))

    # Tareas
    for t in db.query(Tarea).filter(Tarea.expediente_id == expediente_id, Tarea.tenant_id == tenant_id).all():
        items.append(ActividadItem(
            id=t.id, tipo="tarea", subtipo="creada",
            descripcion=t.titulo,
            meta={"estado": t.estado.value, "fecha_limite": str(t.fecha_limite) if t.fecha_limite else None, "tipo": t.tipo.value if t.tipo else "judicial"},
            created_at=t.created_at,
        ))

    # Documentos (del expediente + los adjuntos a sus tareas/vencimientos)
    tarea_ids = [t.id for t in db.query(Tarea.id).filter(Tarea.expediente_id == expediente_id, Tarea.tenant_id == tenant_id).all()]
    vcto_ids = [v.id for v in db.query(Vencimiento.id).filter(Vencimiento.expediente_id == expediente_id, Vencimiento.tenant_id == tenant_id).all()]
    from sqlalchemy import or_
    doc_filter = [Documento.expediente_id == expediente_id]
    if tarea_ids:
        doc_filter.append(Documento.tarea_id.in_(tarea_ids))
    if vcto_ids:
        doc_filter.append(Documento.vencimiento_id.in_(vcto_ids))
    # Mapa tarea_id -> titulo para contexto de adjuntos
    tarea_map = {t.id: t.titulo for t in db.query(Tarea).filter(Tarea.expediente_id == expediente_id, Tarea.tenant_id == tenant_id).all()}
    vcto_map = {v.id: v.descripcion for v in db.query(Vencimiento).filter(Vencimiento.expediente_id == expediente_id, Vencimiento.tenant_id == tenant_id).all()}

    for d in db.query(Documento).filter(Documento.tenant_id == tenant_id, or_(*doc_filter)).all():
        nombre_display = d.label or d.nombre
        adjunto_en = None
        if d.tarea_id and d.tarea_id in tarea_map:
            adjunto_en = f"Tarea: {tarea_map[d.tarea_id]}"
        elif d.vencimiento_id and d.vencimiento_id in vcto_map:
            adjunto_en = f"Vencimiento: {vcto_map[d.vencimiento_id]}"
        items.append(ActividadItem(
            id=d.id, tipo="documento", subtipo="subido",
            descripcion=nombre_display,
            meta={"nombre": d.nombre, "label": d.label, "size_bytes": d.size_bytes, "content_type": d.content_type, "adjunto_en": adjunto_en, "tarea_id": d.tarea_id, "vencimiento_id": d.vencimiento_id},
            created_at=d.created_at,
        ))

    def _sort_key(item: ActividadItem) -> str:
        m = item.meta or {}
        if item.tipo == "vencimiento" and m.get("fecha"):
            return str(m["fecha"]) + "T23:59:59"
        if item.tipo == "tarea" and m.get("fecha_limite"):
            return str(m["fecha_limite"]) + "T23:59:59"
        ca = item.created_at
        return ca.isoformat() if hasattr(ca, "isoformat") else str(ca)

    items.sort(key=_sort_key, reverse=True)
    return items


@router.get("/{expediente_id}/pdf-unificado")
def descargar_pdf_unificado(expediente_id: str, db: DbSession, current_user: CurrentUser):
    from app.models.documento import Documento
    from app.models.studio import Studio
    from app.services.pdf_unificado import generar_pdf_unificado, _fecha_larga
    from app.services.storage import generate_download_url

    tenant_id = current_user["studio_id"]
    exp = _get_expediente(db, expediente_id, tenant_id)

    # Datos del estudio (tenant)
    studio = db.query(Studio).filter(Studio.id == tenant_id).first()
    studio_name     = studio.name if studio else "LexCore"
    studio_email    = studio.email_contacto if studio else None
    studio_telefono = studio.telefono if studio else None

    # Autor (usuario que genera)
    autor = db.query(User).filter(User.id == current_user["sub"]).first()
    autor_nombre = autor.full_name if autor else (current_user.get("email") or "—")

    # Responsable principal (primer abogado del expediente)
    responsable_nombre = None
    if exp.abogados:
        user = db.query(User).filter(User.id == exp.abogados[0].user_id).first()
        if user:
            responsable_nombre = user.full_name

    # Cliente
    cliente_nombre = None
    if exp.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == exp.cliente_id).first()
        if cliente:
            cliente_nombre = cliente.nombre

    fecha_apertura = _fecha_larga(exp.created_at) if exp.created_at else None

    exp_data = {
        "numero":            exp.numero,
        "caratula":          exp.caratula,
        "numero_judicial":   exp.numero_judicial,
        "fuero":             exp.fuero,
        "juzgado":           exp.juzgado,
        "localidad":         exp.localidad,
        "estado":            exp.estado.value if exp.estado else None,
        "cliente_nombre":    cliente_nombre,
        "responsable_nombre": responsable_nombre,
        "fecha_apertura":    fecha_apertura,
        "studio_name":       studio_name,
        "studio_email":      studio_email,
        "studio_telefono":   studio_telefono,
        "autor_nombre":      autor_nombre,
    }

    # Solo docs directamente del expediente, ordenados
    documentos = [
        {"id": d.id, "nombre": d.label or d.nombre, "content_type": d.content_type,
         "file_key": d.file_key, "orden": d.orden}
        for d in db.query(Documento).filter(
            Documento.tenant_id == tenant_id,
            Documento.expediente_id == expediente_id,
        ).order_by(Documento.orden).all()
    ]

    def get_url(file_key: str, nombre: str) -> str:
        try:
            return generate_download_url(file_key, nombre, force_attachment=False)
        except Exception:
            return ""

    pdf_bytes, _skipped = generar_pdf_unificado(exp_data, documentos, get_url)

    filename = f"{exp.numero.replace('/', '-')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
