from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession, RequireFullAccess
from app.models.expediente import Expediente, Vencimiento
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.services.calendar_push import push_vencimiento, delete_vencimiento
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


@router.post("", response_model=VencimientoOut, status_code=status.HTTP_201_CREATED, dependencies=[RequireFullAccess])
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
    invalidar_resumen(db, body.expediente_id, tenant_id)
    db.commit()
    db.refresh(venc)
    push_vencimiento(db, venc, current_user["sub"])
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
    cambios = body.model_dump(exclude_unset=True)
    for field, value in cambios.items():
        setattr(venc, field, value)
    venc.updated_at = utcnow()
    db.commit()
    db.refresh(venc)
    push_vencimiento(db, venc, current_user["sub"])
    return venc


@router.post("/notificar-urgentes", status_code=status.HTTP_200_OK)
def notificar_vencimientos_urgentes(
    db: DbSession,
    current_user: CurrentUser,
):
    """
    Envía emails a todos los miembros del estudio sobre vencimientos
    pendientes con menos de 48 horas. Falla silenciosamente si Resend
    no está configurado.
    """
    from datetime import date, timedelta
    from app.models.user import User
    from app.models.expediente import Expediente
    from app.services.email import send_vencimiento_urgente_email

    tenant_id = current_user["studio_id"]
    hoy = date.today().isoformat()
    limite = (date.today() + timedelta(hours=48)).strftime("%Y-%m-%d")

    urgentes = db.query(Vencimiento).filter(
        Vencimiento.tenant_id == tenant_id,
        Vencimiento.cumplido == False,  # noqa: E712
        Vencimiento.fecha >= hoy,
        Vencimiento.fecha <= limite,
    ).all()

    if not urgentes:
        return {"notificados": 0, "vencimientos": 0}

    # Emails de todos los miembros activos del estudio
    miembros = db.query(User).filter(User.tenant_id == tenant_id).all()
    emails = [u.email for u in miembros if u.email]

    enviados = 0
    for v in urgentes:
        exp = db.query(Expediente).filter(Expediente.id == v.expediente_id).first()
        caratula = exp.caratula if exp else "Expediente"
        ok = send_vencimiento_urgente_email(
            to_emails=emails,
            descripcion=v.descripcion,
            fecha=v.fecha,
            tipo=v.tipo or "vencimiento",
            caratula=caratula,
            expediente_id=v.expediente_id,
        )
        if ok:
            enviados += 1

    return {"notificados": len(emails), "vencimientos": enviados}


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
    venc_id = venc.id
    tenant_id = venc.tenant_id
    db.delete(venc)
    db.commit()
    delete_vencimiento(db, venc_id, tenant_id)
