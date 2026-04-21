"""
Router de feriados y días inhábiles.
- GET /feriados?desde=&hasta=  → feriados nacionales + días inhábiles del estudio
- POST /feriados/inhabiles      → crear día inhábil del estudio
- DELETE /feriados/inhabiles/{id}
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.feriado import DiaInhabil, FeriadoCache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feriados", tags=["feriados"])

ARGENTINADATOS_URL = "https://api.argentinadatos.com/v1/feriados/{anio}"


def _fetch_y_cachear_feriados(db, anio: int):
    """Descarga feriados del año desde argentinadatos.com y los persiste."""
    try:
        resp = httpx.get(ARGENTINADATOS_URL.format(anio=anio), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for item in data:
            fecha = item.get("fecha") or item.get("date")
            if not fecha:
                continue
            nombre = item.get("nombre") or item.get("name") or ""
            tipo = item.get("tipo") or item.get("type")
            db.add(FeriadoCache(fecha=fecha, nombre=nombre, tipo=tipo, anio=anio))
        db.commit()
    except Exception:
        logger.exception("Error al fetchear feriados de argentinadatos para año %s", anio)
        db.rollback()


def _asegurar_feriados(db, anio: int):
    """Si no hay feriados cacheados para el año, los descarga."""
    existing = db.query(FeriadoCache).filter(FeriadoCache.anio == anio).first()
    if not existing:
        _fetch_y_cachear_feriados(db, anio)


@router.get("")
def listar_feriados(
    db: DbSession,
    current_user: CurrentUser,
    desde: str = Query(..., description="YYYY-MM-DD"),
    hasta: str = Query(..., description="YYYY-MM-DD"),
):
    """Devuelve feriados nacionales + días inhábiles del estudio para el rango dado."""
    tenant_id = current_user["studio_id"]

    # Asegurar caché para los años del rango
    anio_desde = int(desde[:4])
    anio_hasta = int(hasta[:4])
    for anio in range(anio_desde, anio_hasta + 1):
        _asegurar_feriados(db, anio)

    nacionales = db.query(FeriadoCache).filter(
        FeriadoCache.fecha >= desde,
        FeriadoCache.fecha <= hasta,
    ).all()

    propios = db.query(DiaInhabil).filter(
        DiaInhabil.tenant_id == tenant_id,
        DiaInhabil.fecha >= desde,
        DiaInhabil.fecha <= hasta,
    ).all()

    resultado = [
        {"fecha": f.fecha, "nombre": f.nombre, "tipo": f.tipo or "nacional", "origen": "nacional"}
        for f in nacionales
    ] + [
        {"fecha": d.fecha, "nombre": d.descripcion or "Día inhábil", "tipo": "judicial", "origen": "estudio", "id": d.id}
        for d in propios
    ]

    return sorted(resultado, key=lambda x: x["fecha"])


class DiaInhabilCreate(BaseModel):
    fecha: str
    descripcion: Optional[str] = None


@router.post("/inhabiles", status_code=201)
def crear_dia_inhabil(body: DiaInhabilCreate, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    dia = DiaInhabil(tenant_id=tenant_id, fecha=body.fecha, descripcion=body.descripcion)
    db.add(dia)
    db.commit()
    db.refresh(dia)
    return {"id": dia.id, "fecha": dia.fecha, "descripcion": dia.descripcion}


@router.delete("/inhabiles/{dia_id}", status_code=204)
def eliminar_dia_inhabil(dia_id: str, db: DbSession, current_user: CurrentUser):
    tenant_id = current_user["studio_id"]
    dia = db.query(DiaInhabil).filter(DiaInhabil.id == dia_id, DiaInhabil.tenant_id == tenant_id).first()
    if not dia:
        raise HTTPException(status_code=404, detail="Día inhábil no encontrado")
    db.delete(dia)
    db.commit()
