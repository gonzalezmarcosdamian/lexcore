"""
Router de ingresos del estudio — módulo Contable.
Ingresos concretos (honorarios cobrados, reintegros, consultas, otros).
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.gasto import Ingreso, IngresoCategoria
from app.models.honorario import Moneda
from app.schemas.ingreso import IngresoCreate, IngresoOut, IngresoResumen, IngresoUpdate

router = APIRouter(prefix="/ingresos", tags=["ingresos"])


def _get_or_404(db, ingreso_id: str, tenant_id: str) -> Ingreso:
    ing = db.query(Ingreso).filter(
        Ingreso.id == ingreso_id, Ingreso.tenant_id == tenant_id
    ).first()
    if not ing:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return ing


@router.get("/resumen", response_model=IngresoResumen)
def resumen_ingresos(
    db: DbSession,
    current_user: CurrentUser,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
):
    tenant_id = current_user["studio_id"]
    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    ingresos = db.query(Ingreso).filter(
        Ingreso.tenant_id == tenant_id,
        Ingreso.mes == mes_ref,
        Ingreso.anio == anio_ref,
    ).all()

    total_ars = sum(i.monto for i in ingresos if i.moneda == Moneda.ARS)
    total_usd = sum(i.monto for i in ingresos if i.moneda == Moneda.USD)
    return IngresoResumen(total_ars=total_ars, total_usd=total_usd, cantidad=len(ingresos))


@router.get("", response_model=List[IngresoOut])
def listar_ingresos(
    db: DbSession,
    current_user: CurrentUser,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    categoria: Optional[IngresoCategoria] = None,
    expediente_id: Optional[str] = None,
):
    tenant_id = current_user["studio_id"]
    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    query = db.query(Ingreso).filter(
        Ingreso.tenant_id == tenant_id,
        Ingreso.mes == mes_ref,
        Ingreso.anio == anio_ref,
    )
    if categoria:
        query = query.filter(Ingreso.categoria == categoria)
    if expediente_id:
        query = query.filter(Ingreso.expediente_id == expediente_id)

    return query.order_by(Ingreso.fecha.desc()).all()


@router.post("", response_model=IngresoOut, status_code=201)
def crear_ingreso(data: IngresoCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    try:
        d = date.fromisoformat(data.fecha)
        mes, anio = d.month, d.year
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida")

    payload = data.model_dump()
    payload.pop("expediente_id", None)
    ingreso = Ingreso(
        tenant_id=tenant_id,
        mes=mes,
        anio=anio,
        expediente_id=data.expediente_id,
        **payload,
    )
    db.add(ingreso)
    db.commit()
    db.refresh(ingreso)
    return ingreso


@router.patch("/{ingreso_id}", response_model=IngresoOut)
def actualizar_ingreso(
    ingreso_id: str, data: IngresoUpdate, db: DbSession, current_user: CurrentUser
):
    ingreso = _get_or_404(db, ingreso_id, current_user["studio_id"])
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ingreso, field, value)
    if "fecha" in data.model_dump(exclude_unset=True) and data.fecha:
        try:
            d = date.fromisoformat(data.fecha)
            ingreso.mes = d.month
            ingreso.anio = d.year
        except ValueError:
            pass
    db.commit()
    db.refresh(ingreso)
    return ingreso


@router.delete("/{ingreso_id}", status_code=204)
def eliminar_ingreso(ingreso_id: str, db: DbSession, current_user: CurrentUser):
    ingreso = _get_or_404(db, ingreso_id, current_user["studio_id"])
    db.delete(ingreso)
    db.commit()
