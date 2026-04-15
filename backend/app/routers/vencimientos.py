from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente, Vencimiento
from app.models.base import utcnow
from app.schemas.vencimiento import VencimientoCreate, VencimientoOut, VencimientoUpdate

router = APIRouter(prefix="/vencimientos", tags=["vencimientos"])


def _get_expediente(db, expediente_id: str, tenant_id: str) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


@router.get("", response_model=List[VencimientoOut])
def listar_vencimientos(
    db: DbSession,
    current_user: CurrentUser,
    expediente_id: Optional[str] = Query(None),
    cumplido: Optional[bool] = Query(None),
    proximos: Optional[int] = Query(None, description="Próximos N días"),
):
    tenant_id = current_user["studio_id"]
    query = db.query(Vencimiento).filter(Vencimiento.tenant_id == tenant_id)
    if expediente_id:
        query = query.filter(Vencimiento.expediente_id == expediente_id)
    if cumplido is not None:
        query = query.filter(Vencimiento.cumplido == cumplido)
    if proximos is not None:
        from datetime import date, timedelta
        hoy = date.today().isoformat()
        limite = (date.today() + timedelta(days=proximos)).isoformat()
        query = query.filter(Vencimiento.fecha >= hoy, Vencimiento.fecha <= limite)
    return query.order_by(Vencimiento.fecha).all()


@router.post("", response_model=VencimientoOut, status_code=status.HTTP_201_CREATED)
def crear_vencimiento(
    body: VencimientoCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_expediente(db, body.expediente_id, tenant_id)

    venc = Vencimiento(
        tenant_id=tenant_id,
        **body.model_dump(),
        cumplido=False,
    )
    db.add(venc)
    db.commit()
    db.refresh(venc)

    # TODO: Sprint 03 — push Google Calendar events aquí
    return venc


@router.get("/{vencimiento_id}", response_model=VencimientoOut)
def obtener_vencimiento(
    vencimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    venc = db.query(Vencimiento).filter(
        Vencimiento.id == vencimiento_id,
        Vencimiento.tenant_id == current_user["studio_id"],
    ).first()
    if not venc:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")
    return venc


@router.patch("/{vencimiento_id}", response_model=VencimientoOut)
def actualizar_vencimiento(
    vencimiento_id: str,
    body: VencimientoUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    venc = db.query(Vencimiento).filter(
        Vencimiento.id == vencimiento_id,
        Vencimiento.tenant_id == current_user["studio_id"],
    ).first()
    if not venc:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(venc, field, value)
    venc.updated_at = utcnow()
    db.commit()
    db.refresh(venc)
    return venc


@router.delete("/{vencimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_vencimiento(
    vencimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    venc = db.query(Vencimiento).filter(
        Vencimiento.id == vencimiento_id,
        Vencimiento.tenant_id == current_user["studio_id"],
    ).first()
    if not venc:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")
    db.delete(venc)
    db.commit()
