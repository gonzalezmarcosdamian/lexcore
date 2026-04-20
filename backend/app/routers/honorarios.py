"""
Router de honorarios.
Maneja honorarios acordados + pagos recibidos por expediente.
"""
from decimal import Decimal
from typing import List

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente
from app.models.honorario import Honorario, Moneda, PagoHonorario
from app.models.base import utcnow
from app.services.resumen_invalidar import invalidar_resumen
from app.schemas.honorario import (
    HonorarioCreate, HonorarioOut, HonorarioResumen, HonorarioUpdate,
    PagoCreate, PagoOut,
)

router = APIRouter(prefix="/honorarios", tags=["honorarios"])


def _get_honorario_or_404(db, honorario_id: str, tenant_id: str) -> Honorario:
    h = db.query(Honorario).filter(
        Honorario.id == honorario_id,
        Honorario.tenant_id == tenant_id,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Honorario no encontrado")
    return h


def _check_expediente(db, expediente_id: str, tenant_id: str):
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


# ── Honorarios ────────────────────────────────────────────────────────────────

@router.get("/resumen", response_model=HonorarioResumen)
def resumen_honorarios(db: DbSession, current_user: CurrentUser):
    """Resumen total de honorarios del estudio para el dashboard."""
    tenant_id = current_user["studio_id"]

    honorarios = (
        db.query(Honorario)
        .filter(Honorario.tenant_id == tenant_id)
        .all()
    )

    res = HonorarioResumen()
    exp_con_deuda = set()

    for h in honorarios:
        pagos_misma = [p for p in h.pagos if p.moneda == h.moneda]
        total_pago = sum((p.importe for p in pagos_misma), Decimal("0"))
        saldo = h.monto_acordado - total_pago

        if h.moneda == Moneda.ARS:
            res.total_acordado_ars += h.monto_acordado
            res.total_cobrado_ars += total_pago
            res.saldo_pendiente_ars += max(saldo, Decimal("0"))
        else:
            res.total_acordado_usd += h.monto_acordado
            res.total_cobrado_usd += total_pago
            res.saldo_pendiente_usd += max(saldo, Decimal("0"))

        if saldo > 0:
            exp_con_deuda.add(h.expediente_id)

    res.expedientes_con_deuda = len(exp_con_deuda)
    return res


@router.get("/expediente/{expediente_id}", response_model=List[HonorarioOut])
def listar_honorarios_expediente(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _check_expediente(db, expediente_id, tenant_id)

    honorarios = (
        db.query(Honorario)
        .filter(
            Honorario.expediente_id == expediente_id,
            Honorario.tenant_id == tenant_id,
        )
        .order_by(Honorario.fecha_acuerdo.desc())
        .all()
    )
    return [HonorarioOut.from_orm_with_saldo(h) for h in honorarios]


@router.post("", response_model=HonorarioOut, status_code=status.HTTP_201_CREATED)
def crear_honorario(
    body: HonorarioCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _check_expediente(db, body.expediente_id, tenant_id)

    h = Honorario(
        tenant_id=tenant_id,
        **body.model_dump(),
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return HonorarioOut.from_orm_with_saldo(h)


@router.patch("/{honorario_id}", response_model=HonorarioOut)
def actualizar_honorario(
    honorario_id: str,
    body: HonorarioUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    h = _get_honorario_or_404(db, honorario_id, tenant_id)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(h, field, value)
    h.updated_at = utcnow()
    db.commit()
    db.refresh(h)
    return HonorarioOut.from_orm_with_saldo(h)


@router.delete("/{honorario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_honorario(
    honorario_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    h = _get_honorario_or_404(db, honorario_id, tenant_id)
    db.delete(h)
    db.commit()


# ── Pagos ─────────────────────────────────────────────────────────────────────

@router.post("/{honorario_id}/pagos", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
def registrar_pago(
    honorario_id: str,
    body: PagoCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    h = _get_honorario_or_404(db, honorario_id, tenant_id)

    pago = PagoHonorario(
        tenant_id=tenant_id,
        honorario_id=h.id,
        **body.model_dump(),
    )
    db.add(pago)
    invalidar_resumen(db, h.expediente_id, tenant_id)
    db.commit()
    db.refresh(pago)
    return pago


@router.delete("/{honorario_id}/pagos/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_pago(
    honorario_id: str,
    pago_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _get_honorario_or_404(db, honorario_id, tenant_id)

    pago = db.query(PagoHonorario).filter(
        PagoHonorario.id == pago_id,
        PagoHonorario.tenant_id == tenant_id,
        PagoHonorario.honorario_id == honorario_id,
    ).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(pago)
    db.commit()
