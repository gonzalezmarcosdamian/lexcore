"""
Router de gastos del estudio — módulo Contable.

Dos conceptos:
  GastoPlantilla — definición de un gasto recurrente (se crea una vez)
  Gasto          — instancia concreta de un período (puntual o desde plantilla)

Auto-generación: al listar gastos de un período, si hay plantillas activas
sin instancia en ese mes/año, se crean automáticamente en estado 'pendiente'.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.gasto import Gasto, GastoCategoria, GastoEstado, GastoPlantilla
from app.models.honorario import Moneda
from app.schemas.gasto import GastoCreate, GastoOut, GastoResumen, GastoUpdate

router = APIRouter(prefix="/gastos", tags=["gastos"])


# ── Schemas de plantilla ──────────────────────────────────────────────────────

class PlantillaCreate(BaseModel):
    descripcion: str
    categoria: GastoCategoria
    monto_esperado: Decimal
    moneda: Moneda = Moneda.ARS
    dia_del_mes: int = 1
    notas: Optional[str] = None


class PlantillaUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[GastoCategoria] = None
    monto_esperado: Optional[Decimal] = None
    moneda: Optional[Moneda] = None
    dia_del_mes: Optional[int] = None
    activa: Optional[bool] = None
    notas: Optional[str] = None


class PlantillaOut(BaseModel):
    id: str
    descripcion: str
    categoria: GastoCategoria
    monto_esperado: Decimal
    moneda: Moneda
    dia_del_mes: int
    activa: bool
    notas: Optional[str] = None

    model_config = {"from_attributes": True}


class ConfirmarGastoBody(BaseModel):
    monto_real: Optional[Decimal] = None   # si difiere del esperado
    fecha_pago: Optional[str] = None       # ISO date, default hoy


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_gasto_or_404(db, gasto_id: str, tenant_id: str) -> Gasto:
    g = db.query(Gasto).filter(Gasto.id == gasto_id, Gasto.tenant_id == tenant_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return g


def _get_plantilla_or_404(db, plantilla_id: str, tenant_id: str) -> GastoPlantilla:
    p = db.query(GastoPlantilla).filter(
        GastoPlantilla.id == plantilla_id, GastoPlantilla.tenant_id == tenant_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return p


def _auto_generar_recurrentes(db, tenant_id: str, mes: int, anio: int):
    """
    Para cada plantilla activa del tenant sin instancia en el período,
    crea un Gasto en estado 'pendiente'.
    """
    plantillas = db.query(GastoPlantilla).filter(
        GastoPlantilla.tenant_id == tenant_id,
        GastoPlantilla.activa == True,  # noqa: E712
    ).all()

    for p in plantillas:
        existe = db.query(Gasto).filter(
            Gasto.tenant_id == tenant_id,
            Gasto.plantilla_id == p.id,
            Gasto.mes == mes,
            Gasto.anio == anio,
        ).first()
        if not existe:
            dia = min(p.dia_del_mes, 28)  # evitar días inválidos
            fecha_str = f"{anio:04d}-{mes:02d}-{dia:02d}"
            gasto = Gasto(
                tenant_id=tenant_id,
                descripcion=p.descripcion,
                categoria=p.categoria,
                monto=p.monto_esperado,
                moneda=p.moneda,
                fecha=fecha_str,
                mes=mes,
                anio=anio,
                estado=GastoEstado.pendiente,
                plantilla_id=p.id,
            )
            db.add(gasto)
    db.commit()


# ── Plantillas ────────────────────────────────────────────────────────────────

@router.get("/plantillas", response_model=List[PlantillaOut])
def listar_plantillas(db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    return db.query(GastoPlantilla).filter(
        GastoPlantilla.tenant_id == tenant_id
    ).order_by(GastoPlantilla.descripcion).all()


@router.post("/plantillas", response_model=PlantillaOut, status_code=201)
def crear_plantilla(data: PlantillaCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    plantilla = GastoPlantilla(tenant_id=tenant_id, **data.model_dump())
    db.add(plantilla)
    db.commit()
    db.refresh(plantilla)
    return plantilla


@router.patch("/plantillas/{plantilla_id}", response_model=PlantillaOut)
def actualizar_plantilla(
    plantilla_id: str, data: PlantillaUpdate, db: DbSession, current_user: CurrentUser
):
    plantilla = _get_plantilla_or_404(db, plantilla_id, current_user["studio_id"])
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plantilla, field, value)
    db.commit()
    db.refresh(plantilla)
    return plantilla


@router.delete("/plantillas/{plantilla_id}", status_code=204)
def eliminar_plantilla(plantilla_id: str, db: DbSession, current_user: CurrentUser):
    plantilla = _get_plantilla_or_404(db, plantilla_id, current_user["studio_id"])
    db.delete(plantilla)
    db.commit()


# ── Gastos ────────────────────────────────────────────────────────────────────

@router.get("/resumen", response_model=GastoResumen)
def resumen_gastos(
    db: DbSession,
    current_user: CurrentUser,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
):
    tenant_id = current_user["studio_id"]
    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    gastos = db.query(Gasto).filter(
        Gasto.tenant_id == tenant_id,
        Gasto.mes == mes_ref,
        Gasto.anio == anio_ref,
        Gasto.estado == GastoEstado.confirmado,
    ).all()

    total_ars = sum(g.monto for g in gastos if g.moneda == Moneda.ARS)
    total_usd = sum(g.monto for g in gastos if g.moneda == Moneda.USD)

    return GastoResumen(total_ars=total_ars, total_usd=total_usd, cantidad=len(gastos))


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
    hoy = date.today()
    mes_ref = mes or hoy.month
    anio_ref = anio or hoy.year

    # Auto-generar recurrentes si no existen aún para este período
    _auto_generar_recurrentes(db, tenant_id, mes_ref, anio_ref)

    query = db.query(Gasto).filter(
        Gasto.tenant_id == tenant_id,
        Gasto.mes == mes_ref,
        Gasto.anio == anio_ref,
    )
    if categoria:
        query = query.filter(Gasto.categoria == categoria)
    if expediente_id:
        query = query.filter(Gasto.expediente_id == expediente_id)

    return query.order_by(Gasto.fecha).all()


@router.post("", response_model=GastoOut, status_code=201)
def crear_gasto(data: GastoCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    # Calcular mes/anio desde fecha
    try:
        d = date.fromisoformat(data.fecha)
        mes, anio = d.month, d.year
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida")

    payload = data.model_dump()
    payload.pop("expediente_id", None)
    gasto = Gasto(
        tenant_id=tenant_id,
        mes=mes,
        anio=anio,
        estado=GastoEstado.confirmado,
        expediente_id=data.expediente_id,
        **payload,
    )
    db.add(gasto)
    db.commit()
    db.refresh(gasto)
    return gasto


@router.post("/{gasto_id}/confirmar", response_model=GastoOut)
def confirmar_gasto(
    gasto_id: str,
    body: ConfirmarGastoBody,
    db: DbSession,
    current_user: CurrentUser,
):
    """Confirma un gasto pendiente. Opcionalmente ajusta el monto y fecha real."""
    gasto = _get_gasto_or_404(db, gasto_id, current_user["studio_id"])
    if gasto.estado == GastoEstado.confirmado:
        raise HTTPException(status_code=400, detail="El gasto ya está confirmado")

    gasto.estado = GastoEstado.confirmado
    if body.monto_real is not None:
        gasto.monto = body.monto_real
    if body.fecha_pago:
        gasto.fecha = body.fecha_pago

    db.commit()
    db.refresh(gasto)
    return gasto


@router.patch("/{gasto_id}", response_model=GastoOut)
def actualizar_gasto(
    gasto_id: str, data: GastoUpdate, db: DbSession, current_user: CurrentUser
):
    gasto = _get_gasto_or_404(db, gasto_id, current_user["studio_id"])
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(gasto, field, value)
    # Recalcular mes/anio si cambió la fecha
    if "fecha" in data.model_dump(exclude_unset=True) and data.fecha:
        try:
            d = date.fromisoformat(data.fecha)
            gasto.mes = d.month
            gasto.anio = d.year
        except ValueError:
            pass
    db.commit()
    db.refresh(gasto)
    return gasto


@router.delete("/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: str, db: DbSession, current_user: CurrentUser):
    gasto = _get_gasto_or_404(db, gasto_id, current_user["studio_id"])
    db.delete(gasto)
    db.commit()
