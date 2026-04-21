"""
Búsqueda global: expedientes + clientes en una sola query.
GET /search?q={query}  — mín 3 caracteres, máx 5 resultados por tipo.
Usa GIN full-text search en PostgreSQL con fallback a ilike para queries cortas.
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, text

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
    numero_judicial: Optional[str] = None
    caratula: str
    estado: str
    fuero: Optional[str] = None

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    expedientes: List[SearchExpediente]
    clientes: List[SearchCliente]


def _tsquery_safe(q: str) -> Optional[str]:
    """
    Convierte una query de usuario en un tsquery válido.
    Retorna None si la query no es apta para full-text (ej: solo números, caracteres especiales).
    """
    # Eliminar caracteres que rompen tsquery
    clean = "".join(c for c in q if c.isalnum() or c.isspace() or c in "áéíóúüñÁÉÍÓÚÜÑ")
    words = clean.split()
    if not words:
        return None
    # prefix search: cada palabra con :*
    return " & ".join(f"{w}:*" for w in words)


@router.get("", response_model=SearchResult)
def buscar(
    q: str = Query(..., min_length=3, description="Texto a buscar (mín 3 caracteres)"),
    db: DbSession = None,
    current_user: CurrentUser = None,
):
    tenant_id = current_user["studio_id"]
    tsq = _tsquery_safe(q)
    term = f"%{q}%"

    use_fts = tsq and db.bind.dialect.name == "postgresql"

    if use_fts:
        # Full-text search — usa los índices GIN (solo PostgreSQL)
        expedientes = (
            db.query(Expediente)
            .filter(
                Expediente.tenant_id == tenant_id,
                func.to_tsvector("spanish", func.coalesce(Expediente.numero, "") + " " + func.coalesce(Expediente.caratula, "")).op("@@")(func.to_tsquery("spanish", tsq)),
            )
            .limit(5)
            .all()
        )
        clientes = (
            db.query(Cliente)
            .filter(
                Cliente.tenant_id == tenant_id,
                Cliente.archivado == False,  # noqa: E712
                func.to_tsvector("spanish", func.coalesce(Cliente.nombre, "") + " " + func.coalesce(Cliente.cuit_dni, "")).op("@@")(func.to_tsquery("spanish", tsq)),
            )
            .limit(5)
            .all()
        )
    else:
        # Fallback ilike para queries con solo números o caracteres especiales
        expedientes = (
            db.query(Expediente)
            .filter(
                Expediente.tenant_id == tenant_id,
                or_(
                    Expediente.numero.ilike(term),
                    Expediente.numero_judicial.ilike(term),
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
                Cliente.archivado == False,  # noqa: E712
                or_(
                    Cliente.nombre.ilike(term),
                    Cliente.cuit_dni.ilike(term),
                    Cliente.dni.ilike(term),
                    Cliente.cuit.ilike(term),
                ),
            )
            .limit(5)
            .all()
        )

    return SearchResult(
        expedientes=[SearchExpediente.model_validate(e) for e in expedientes],
        clientes=[SearchCliente.model_validate(c) for c in clientes],
    )
