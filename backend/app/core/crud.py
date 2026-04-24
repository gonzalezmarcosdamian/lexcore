"""
Helpers CRUD centralizados.
Eliminan la repetición de tenant_id validation + 404 handling en los routers.
"""
from typing import Type, TypeVar
from fastapi import HTTPException
from sqlalchemy.orm import Session

T = TypeVar("T")


def get_or_404(db: Session, model: Type[T], id: str, tenant_id: str, detail: str | None = None) -> T:
    """Busca una entidad por id + tenant_id, lanza 404 si no existe."""
    obj = db.query(model).filter(
        model.id == id,  # type: ignore[attr-defined]
        model.tenant_id == tenant_id,  # type: ignore[attr-defined]
    ).first()
    if not obj:
        name = detail or model.__name__  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"{name} no encontrado")
    return obj  # type: ignore[return-value]


def list_by_tenant(db: Session, model: Type[T], tenant_id: str, **filters) -> list[T]:
    """Lista entidades filtradas por tenant_id + filtros adicionales."""
    q = db.query(model).filter(model.tenant_id == tenant_id)  # type: ignore[attr-defined]
    for field, value in filters.items():
        if value is not None:
            q = q.filter(getattr(model, field) == value)
    return q.all()
