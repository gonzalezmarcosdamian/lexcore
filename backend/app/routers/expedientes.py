from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import (
    Expediente, ExpedienteAbogado, Movimiento, RolEnExpediente
)
from app.models.user import User
from app.models.base import utcnow
from app.schemas.expediente import (
    AbogadoEnExpedienteOut,
    AsignarAbogadoRequest,
    ExpedienteCreate, ExpedienteOut, ExpedienteUpdate,
    MovimientoCreate, MovimientoOut,
)

router = APIRouter(prefix="/expedientes", tags=["expedientes"])


def _enriquecer_abogados(db, exp: Expediente) -> ExpedienteOut:
    """Construye ExpedienteOut enriqueciendo cada abogado con full_name."""
    out = ExpedienteOut.model_validate(exp)
    for i, a in enumerate(exp.abogados):
        user = db.query(User).filter(User.id == a.user_id).first()
        out.abogados[i] = AbogadoEnExpedienteOut(
            id=a.id,
            user_id=a.user_id,
            rol=a.rol,
            full_name=user.full_name if user else None,
        )
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


@router.post("", response_model=ExpedienteOut, status_code=status.HTTP_201_CREATED)
def crear_expediente(
    body: ExpedienteCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    data = body.model_dump(exclude={"abogado_ids"})
    expediente = Expediente(tenant_id=tenant_id, **data)
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
