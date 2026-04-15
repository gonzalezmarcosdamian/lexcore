"""
Búsqueda global: expedientes + clientes en una sola query.
GET /search?q={query}  — mín 3 caracteres, máx 5 resultados por tipo.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_

from app.core.deps import CurrentUser, DbSession
from app.models.cliente import Cliente
from app.models.expediente import Expediente

router = APIRouter(prefix="/search", tags=["search"])


class SearchCliente(BaseModel):
    id: str
    nombre: str
    tipo: str
    cuit_dni: Optional[str] = None

    model_config = {"from_attributes": True}


class SearchExpediente(BaseModel):
    id: str
    numero: str
    caratula: str
    estado: str
    fuero: Optional[str] = None

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    expedientes: List[SearchExpediente]
    clientes: List[SearchCliente]


@router.get("", response_model=SearchResult)
def buscar(
    q: str = Query(..., min_length=3, description="Texto a buscar (mín 3 caracteres)"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    tenant_id = current_user["studio_id"]
    term = f"%{q}%"

    expedientes = (
        db.query(Expediente)
        .filter(
            Expediente.tenant_id == tenant_id,
            or_(
                Expediente.numero.ilike(term),
                Expediente.caratula.ilike(term),
            ),
        )
        .limit(5)
        .all()
    )

    clientes = (
        db.query(Cliente)
        .filter(
            Cliente.tenant_id == tenant_id,
            Cliente.archivado == False,
            or_(
                Cliente.nombre.ilike(term),
                Cliente.cuit_dni.ilike(term),
            ),
        )
        .limit(5)
        .all()
    )

    return SearchResult(
        expedientes=[SearchExpediente.model_validate(e) for e in expedientes],
        clientes=[SearchCliente.model_validate(c) for c in clientes],
    )
