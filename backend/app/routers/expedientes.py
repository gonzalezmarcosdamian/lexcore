from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import (
    Expediente, ExpedienteAbogado, Movimiento, RolEnExpediente
)
from app.models.user import User
from app.models.cliente import Cliente
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.schemas.expediente import (
    AbogadoEnExpedienteOut,
    AsignarAbogadoRequest,
    ExpedienteCreate, ExpedienteOut, ExpedienteUpdate,
    MovimientoCreate, MovimientoOut,
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
    """Construye ExpedienteOut enriqueciendo abogados con full_name y cliente con nombre."""
    out = ExpedienteOut.model_validate(exp)
    for i, a in enumerate(exp.abogados):
        user = db.query(User).filter(User.id == a.user_id).first()
        out.abogados[i] = AbogadoEnExpedienteOut(
            id=a.id,
            user_id=a.user_id,
            rol=a.rol,
            full_name=user.full_name if user else None,
        )
    if exp.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == exp.cliente_id).first()
        out.cliente_nombre = cliente.nombre if cliente else None
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


@router.post("", response_model=ExpedienteOut, status_code=status.HTTP_201_CREATED)
def crear_expediente(
    body: ExpedienteCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    data = body.model_dump(exclude={"abogado_ids"})
    numero = _generar_numero(db, tenant_id)
    expediente = Expediente(
        tenant_id=tenant_id,
        numero=numero,
        estado="activo",
        **data,
    )
    db.add(expediente)
    db.flush()  # get ID before adding abogados

    # El creador siempre es responsable
    db.add(ExpedienteAbogado(
        tenant_id=tenant_id,
        expediente_id=expediente.id,
        user_id=current_user["sub"],
        rol=RolEnExpediente.responsable,
    ))
    # Abogados adicionales como colaboradores
    for uid in body.abogado_ids:
        if uid != current_user["sub"]:
            db.add(ExpedienteAbogado(
                tenant_id=tenant_id,
                expediente_id=expediente.id,
                user_id=uid,
                rol=RolEnExpediente.colaborador,
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
    )
    db.add(mov)
    invalidar_resumen(db, expediente_id, current_user["studio_id"])
    db.commit()
    db.refresh(mov)
    return mov


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
    from app.models.vencimiento import Vencimiento
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
            meta={"monto": float(h.monto_acordado), "moneda": str(h.moneda)},
            created_at=h.created_at,
        ))
        for p in h.pagos:
            items.append(ActividadItem(
                id=p.id, tipo="pago", subtipo=str(p.tipo),
                descripcion=f"Pago registrado — {p.tipo}: {p.moneda} {p.importe:,.0f}",
                meta={"importe": float(p.importe), "moneda": str(p.moneda), "tipo": str(p.tipo)},
                created_at=p.created_at,
            ))

    # Vencimientos
    for v in db.query(Vencimiento).filter(Vencimiento.expediente_id == expediente_id, Vencimiento.tenant_id == tenant_id).all():
        items.append(ActividadItem(
            id=v.id, tipo="vencimiento", subtipo="creado",
            descripcion=f"Vencimiento: {v.descripcion}",
            meta={"fecha": str(v.fecha), "tipo": str(v.tipo), "cumplido": bool(v.cumplido)},
            created_at=v.created_at,
        ))

    # Tareas
    for t in db.query(Tarea).filter(Tarea.expediente_id == expediente_id, Tarea.tenant_id == tenant_id).all():
        items.append(ActividadItem(
            id=t.id, tipo="tarea", subtipo="creada",
            descripcion=f"Tarea: {t.titulo}",
            meta={"estado": str(t.estado), "fecha_limite": str(t.fecha_limite) if t.fecha_limite else None},
            created_at=t.created_at,
        ))

    # Documentos
    for d in db.query(Documento).filter(Documento.expediente_id == expediente_id, Documento.tenant_id == tenant_id).all():
        nombre_display = d.label or d.nombre
        items.append(ActividadItem(
            id=d.id, tipo="documento", subtipo="subido",
            descripcion=f"Documento: {nombre_display}",
            meta={"nombre": d.nombre, "label": d.label, "size_bytes": d.size_bytes, "content_type": d.content_type},
            created_at=d.created_at,
        ))

    items.sort(key=lambda x: x.created_at, reverse=True)
    return items
