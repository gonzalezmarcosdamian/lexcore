"""
Router de tareas.
Tareas siempre vinculadas a un expediente. Decisión PO 2026-04-15.
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from pydantic import BaseModel
from app.core.deps import CurrentUser, DbSession
from app.models.cliente import Cliente
from app.models.expediente import Expediente
from app.models.tarea import Tarea, TareaEstado
from app.models.user import User
from app.models.nota import Nota
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
    cliente_id: Optional[str] = Query(None),
    estado: Optional[TareaEstado] = Query(None),
    responsable_id: Optional[str] = Query(None),
):
    tenant_id = current_user["studio_id"]
    q = db.query(Tarea).filter(Tarea.tenant_id == tenant_id)
    if expediente_id:
        q = q.filter(Tarea.expediente_id == expediente_id)
    if cliente_id:
        q = q.filter(Tarea.cliente_id == cliente_id, Tarea.expediente_id.is_(None))
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
    cambios = body.model_dump(exclude_none=True)
    for field, value in cambios.items():
        setattr(tarea, field, value)
    tarea.updated_at = utcnow()
    db.commit()
    db.refresh(tarea)
    push_tarea(db, tarea, current_user["sub"])
    return _enriquecer(db, tarea)


@router.get("/{tarea_id}", response_model=TareaOut)
def obtener_tarea(tarea_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    tarea = _get_tarea_or_404(db, tarea_id, tenant_id)
    return _enriquecer(db, tarea)


@router.delete("/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tarea(tarea_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    tarea = _get_tarea_or_404(db, tarea_id, tenant_id)
    tarea_id_backup = tarea.id
    db.delete(tarea)
    db.commit()
    delete_tarea(db, tarea_id_backup, tenant_id)


# ── Notas (bitácora) ──────────────────────────────────────────────────────────

class NotaCreate(BaseModel):
    texto: str


class NotaOut(BaseModel):
    id: str
    texto: str
    autor_nombre: str | None = None
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_nota(cls, n: Nota) -> "NotaOut":
        return cls(id=n.id, texto=n.texto, autor_nombre=n.autor_nombre, created_at=n.created_at.isoformat())


@router.get("/{tarea_id}/notas", response_model=List[NotaOut])
def listar_notas_tarea(tarea_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    _get_tarea_or_404(db, tarea_id, tenant_id)
    notas = db.query(Nota).filter(Nota.tarea_id == tarea_id, Nota.tenant_id == tenant_id).order_by(Nota.created_at.asc()).all()
    return [NotaOut.from_nota(n) for n in notas]


@router.post("/{tarea_id}/notas", response_model=NotaOut, status_code=201)
def crear_nota_tarea(tarea_id: str, body: NotaCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    _get_tarea_or_404(db, tarea_id, tenant_id)
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    nota = Nota(
        tenant_id=tenant_id,
        tarea_id=tarea_id,
        autor_id=current_user["sub"],
        autor_nombre=user.full_name if user else None,
        texto=body.texto.strip(),
    )
    db.add(nota)
    db.commit()
    db.refresh(nota)
    return NotaOut.from_nota(nota)


@router.delete("/{tarea_id}/notas/{nota_id}", status_code=204)
def eliminar_nota_tarea(tarea_id: str, nota_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    nota = db.query(Nota).filter(Nota.id == nota_id, Nota.tarea_id == tarea_id, Nota.tenant_id == tenant_id).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    db.delete(nota)
    db.commit()
