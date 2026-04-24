from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession, RequireFullAccess
from app.models.expediente import Expediente, Movimiento
from app.models.nota import Nota
from app.models.user import User
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.services.calendar_push import push_vencimiento, delete_vencimiento
from app.schemas.expediente import MovimientoCreate, MovimientoOut, MovimientoUpdate

router = APIRouter(prefix="/movimientos", tags=["movimientos"])


def _get_expediente(db, expediente_id: str, tenant_id: str) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


def _get_movimiento(db, movimiento_id: str, tenant_id: str) -> Movimiento:
    mov = db.query(Movimiento).filter(
        Movimiento.id == movimiento_id,
        Movimiento.tenant_id == tenant_id,
    ).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    return mov


@router.get("", response_model=List[MovimientoOut])
def listar_movimientos(
    db: DbSession,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    expediente_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    proximos: Optional[int] = Query(None, description="Próximos N días"),
):
    tenant_id = current_user["studio_id"]
    query = db.query(Movimiento).filter(Movimiento.tenant_id == tenant_id)
    if expediente_id:
        query = query.filter(Movimiento.expediente_id == expediente_id)
    if estado is not None:
        query = query.filter(Movimiento.estado == estado)
    if proximos is not None:
        from datetime import date, timedelta
        hoy = date.today().isoformat()
        limite = (date.today() + timedelta(days=proximos)).isoformat()
        query = query.filter(Movimiento.fecha >= hoy, Movimiento.fecha <= limite)
    return query.order_by(Movimiento.fecha, Movimiento.hora).offset(skip).limit(limit).all()


@router.post("", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED, dependencies=[RequireFullAccess])
def crear_movimiento(
    body: MovimientoCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, body.expediente_id, tenant_id)
    mov = Movimiento(
        tenant_id=tenant_id,
        **body.model_dump(),
    )
    db.add(mov)
    invalidar_resumen(db, body.expediente_id, tenant_id)
    db.commit()
    db.refresh(mov)
    # Push a Google Calendar (reusa lógica existente de vencimientos)
    try:
        push_vencimiento(db, mov, current_user["sub"])
    except Exception:
        pass
    return mov


@router.get("/{movimiento_id}", response_model=MovimientoOut)
def obtener_movimiento(
    movimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    return _get_movimiento(db, movimiento_id, current_user["studio_id"])


@router.patch("/{movimiento_id}", response_model=MovimientoOut)
def actualizar_movimiento(
    movimiento_id: str,
    body: MovimientoUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    mov = _get_movimiento(db, movimiento_id, current_user["studio_id"])
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(mov, field, value)
    mov.updated_at = utcnow()
    db.commit()
    db.refresh(mov)
    try:
        push_vencimiento(db, mov, current_user["sub"])
    except Exception:
        pass
    return mov


@router.delete("/{movimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_movimiento(
    movimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    mov = _get_movimiento(db, movimiento_id, current_user["studio_id"])
    mov_id = mov.id
    tenant_id = mov.tenant_id
    db.delete(mov)
    db.commit()
    try:
        delete_vencimiento(db, mov_id, tenant_id)
    except Exception:
        pass


# ── Notas ─────────────────────────────────────────────────────────────────────

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


@router.get("/{movimiento_id}/notas", response_model=List[NotaOut])
def listar_notas(movimiento_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    _get_movimiento(db, movimiento_id, tenant_id)
    notas = db.query(Nota).filter(
        Nota.movimiento_id == movimiento_id,
        Nota.tenant_id == tenant_id,
    ).order_by(Nota.created_at.asc()).all()
    return [NotaOut.from_nota(n) for n in notas]


@router.post("/{movimiento_id}/notas", response_model=NotaOut, status_code=201)
def crear_nota(movimiento_id: str, body: NotaCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    _get_movimiento(db, movimiento_id, tenant_id)
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    nota = Nota(
        tenant_id=tenant_id,
        movimiento_id=movimiento_id,
        autor_id=current_user["sub"],
        autor_nombre=user.full_name if user else None,
        texto=body.texto.strip(),
    )
    db.add(nota)
    db.commit()
    db.refresh(nota)
    return NotaOut.from_nota(nota)


@router.delete("/{movimiento_id}/notas/{nota_id}", status_code=204)
def eliminar_nota(movimiento_id: str, nota_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    nota = db.query(Nota).filter(
        Nota.id == nota_id,
        Nota.movimiento_id == movimiento_id,
        Nota.tenant_id == tenant_id,
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    db.delete(nota)
    db.commit()
