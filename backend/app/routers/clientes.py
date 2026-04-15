from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_

from app.core.deps import CurrentUser, DbSession
from app.models.cliente import Cliente
from app.models.base import utcnow
from app.schemas.cliente import ClienteCreate, ClienteOut, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=List[ClienteOut])
def listar_clientes(
    db: DbSession,
    current_user: CurrentUser,
    q: Optional[str] = Query(None, description="Buscar por nombre o cuit_dni"),
    archivado: bool = Query(False),
):
    tenant_id = current_user["studio_id"]
    query = db.query(Cliente).filter(
        Cliente.tenant_id == tenant_id,
        Cliente.archivado == archivado,
    )
    if q:
        query = query.filter(
            or_(
                Cliente.nombre.ilike(f"%{q}%"),
                Cliente.cuit_dni.ilike(f"%{q}%"),
            )
        )
    return query.order_by(Cliente.nombre).all()


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    body: ClienteCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    cliente = Cliente(
        tenant_id=tenant_id,
        **body.model_dump(),
        archivado=False,
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}", response_model=ClienteOut)
def obtener_cliente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.patch("/{cliente_id}", response_model=ClienteOut)
def actualizar_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cliente, field, value)
    cliente.updated_at = utcnow()
    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def archivar_cliente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Archiva el cliente (soft delete)."""
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cliente.archivado = True
    cliente.updated_at = utcnow()
    db.commit()
