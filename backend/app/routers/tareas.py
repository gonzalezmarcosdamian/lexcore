"""
Router de tareas.
Tareas siempre vinculadas a un expediente. Decisión PO 2026-04-15.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.models.cliente import Cliente
from app.models.expediente import Expediente
from app.models.tarea import Tarea, TareaEstado
from app.models.user import User
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.services.calendar_push import push_tarea, delete_tarea
from app.schemas.tarea import TareaCreate, TareaOut, TareaUpdate

router = APIRouter(prefix="/tareas", tags=["tareas"])


def _get_tarea_or_404(db, tarea_id: str, tenant_id: str) -> Tarea:
    t = db.query(Tarea).filter(
        Tarea.id == tarea_id,
        Tarea.tenant_id == tenant_id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return t


def _check_expediente(db, expediente_id: str, tenant_id: str):
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


def _enriquecer(db, tarea: Tarea) -> TareaOut:
    out = TareaOut.model_validate(tarea)
    if tarea.responsable_id:
        user = db.query(User).filter(User.id == tarea.responsable_id).first()
        out.responsable_nombre = user.full_name if user else None
    if tarea.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == tarea.cliente_id).first()
        out.cliente_nombre = cliente.nombre if cliente else None
    return out


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[TareaOut])
def listar_tareas(
    db: DbSession,
    current_user: CurrentUser,
    expediente_id: Optional[str] = Query(None),
    estado: Optional[TareaEstado] = Query(None),
    responsable_id: Optional[str] = Query(None),
):
    tenant_id = current_user["studio_id"]
    q = db.query(Tarea).filter(Tarea.tenant_id == tenant_id)
    if expediente_id:
        q = q.filter(Tarea.expediente_id == expediente_id)
    if estado:
        q = q.filter(Tarea.estado == estado)
    if responsable_id:
        q = q.filter(Tarea.responsable_id == responsable_id)
    tareas = q.order_by(Tarea.fecha_limite.asc().nulls_last(), Tarea.created_at.desc()).all()
    return [_enriquecer(db, t) for t in tareas]


@router.post("", response_model=TareaOut, status_code=status.HTTP_201_CREATED)
def crear_tarea(body: TareaCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    if body.expediente_id:
        _check_expediente(db, body.expediente_id, tenant_id)
    tarea = Tarea(tenant_id=tenant_id, **body.model_dump())
    db.add(tarea)
    if body.expediente_id:
        invalidar_resumen(db, body.expediente_id, tenant_id)
    db.commit()
    db.refresh(tarea)
    push_tarea(db, tarea, current_user["sub"])
    return _enriquecer(db, tarea)


@router.patch("/{tarea_id}", response_model=TareaOut)
def actualizar_tarea(
    tarea_id: str,
    body: TareaUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    tarea = _get_tarea_or_404(db, tarea_id, tenant_id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tarea, field, value)
    tarea.updated_at = utcnow()
    db.commit()
    db.refresh(tarea)
    push_tarea(db, tarea, current_user["sub"])
    return _enriquecer(db, tarea)


@router.delete("/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tarea(tarea_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    tarea = _get_tarea_or_404(db, tarea_id, tenant_id)
    tarea_id_backup = tarea.id
    db.delete(tarea)
    db.commit()
    delete_tarea(db, tarea_id_backup, current_user["sub"])
