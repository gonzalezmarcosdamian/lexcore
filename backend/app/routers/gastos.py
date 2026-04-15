"""
Router de gastos del estudio.
CRUD completo + resumen para el widget financiero del dashboard.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from sqlalchemy import extract

from app.core.deps import CurrentUser, DbSession
from app.models.gasto import Gasto, GastoCategoria
from app.models.honorario import Moneda
from app.schemas.gasto import GastoCreate, GastoOut, GastoResumen, GastoUpdate

router = APIRouter(prefix="/gastos", tags=["gastos"])


def _get_or_404(db, gasto_id: str, tenant_id: str) -> Gasto:
    g = db.query(Gasto).filter(
        Gasto.id == gasto_id,
        Gasto.tenant_id == tenant_id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return g


@router.get("/resumen", response_model=GastoResumen)
def resumen_gastos(
    db: DbSession,
    current_user: CurrentUser,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
):
    """Resumen de gastos del período para el widget financiero."""
    tenant_id = current_user["studio_id"]
    query = db.query(Gasto).filter(Gasto.tenant_id == tenant_id)

    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    query = query.filter(
        extract("month", Gasto.fecha) == mes_ref,
        extract("year", Gasto.fecha) == anio_ref,
    )

    gastos = query.all()
    total_ars = sum(g.monto for g in gastos if g.moneda == Moneda.ARS)
    total_usd = sum(g.monto for g in gastos if g.moneda == Moneda.USD)

    return GastoResumen(
        total_ars=total_ars,
        total_usd=total_usd,
        cantidad=len(gastos),
    )


@router.get("", response_model=List[GastoOut])
def listar_gastos(
    db: DbSession,
    current_user: CurrentUser,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    categoria: Optional[GastoCategoria] = None,
    expediente_id: Optional[str] = None,
):
    tenant_id = current_user["studio_id"]
    query = db.query(Gasto).filter(Gasto.tenant_id == tenant_id)

    if mes:
        query = query.filter(extract("month", Gasto.fecha) == mes)
    if anio:
        query = query.filter(extract("year", Gasto.fecha) == anio)
    if categoria:
        query = query.filter(Gasto.categoria == categoria)
    if expediente_id:
        query = query.filter(Gasto.expediente_id == expediente_id)

    return query.order_by(Gasto.fecha.desc()).all()


@router.post("", response_model=GastoOut, status_code=201)
def crear_gasto(data: GastoCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    gasto = Gasto(tenant_id=tenant_id, **data.model_dump())
    db.add(gasto)
    db.commit()
    db.refresh(gasto)
    return gasto


@router.patch("/{gasto_id}", response_model=GastoOut)
def actualizar_gasto(
    gasto_id: str,
    data: GastoUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    gasto = _get_or_404(db, gasto_id, tenant_id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(gasto, field, value)

    db.commit()
    db.refresh(gasto)
    return gasto


@router.delete("/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    gasto = _get_or_404(db, gasto_id, tenant_id)
    db.delete(gasto)
    db.commit()
