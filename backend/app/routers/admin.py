"""
Router de administración interna LexCore.
Protegido por API key (header X-Admin-Key), NO por JWT de usuario.

GET  /admin/studios              — listar todos los estudios
GET  /admin/studios/{id}         — detalle de un studio + usuarios
GET  /admin/users                — listar todos los usuarios
GET  /admin/users/pending        — usuarios atascados con tenant_id="pending"
POST /admin/users/{id}/new-studio — crear nuevo studio para un usuario y asignárselo
POST /admin/users/{id}/move-studio — mover usuario a un studio existente
DELETE /admin/users/{id}         — eliminar usuario (cuidado)
DELETE /admin/studios/{id}       — eliminar studio y todos sus datos
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import secrets

from app.core.config import settings
from app.core.deps import get_db
from app.models.studio import Studio
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin_key(x_admin_key: str = Header(...)):
    if not settings.ADMIN_API_KEY or not secrets.compare_digest(x_admin_key, settings.ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="API key inválida")


AdminAuth = Depends(_require_admin_key)


# ── Schemas ───────────────────────────────────────────────────────────────────

class NewStudioRequest(BaseModel):
    studio_name: str
    studio_slug: str


class MoveStudioRequest(BaseModel):
    studio_id: str


# ── Studios ───────────────────────────────────────────────────────────────────

@router.get("/studios", dependencies=[AdminAuth])
def listar_studios(db: Session = Depends(get_db)):
    studios = db.query(Studio).order_by(Studio.created_at.desc()).all()
    result = []
    for s in studios:
        users = db.query(User).filter(User.tenant_id == s.id).all()
        result.append({
            "id": s.id,
            "name": s.name,
            "slug": s.slug,
            "created_at": s.created_at.isoformat(),
            "user_count": len(users),
            "users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value, "auth_provider": u.auth_provider.value} for u in users],
        })
    return result


@router.get("/studios/{studio_id}", dependencies=[AdminAuth])
def detalle_studio(studio_id: str, db: Session = Depends(get_db)):
    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")
    users = db.query(User).filter(User.tenant_id == studio_id).all()
    return {
        "id": studio.id,
        "name": studio.name,
        "slug": studio.slug,
        "created_at": studio.created_at.isoformat(),
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value,
                "auth_provider": u.auth_provider.value,
                "google_id": u.google_id,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
    }


@router.delete("/studios/{studio_id}", dependencies=[AdminAuth])
def eliminar_studio(studio_id: str, db: Session = Depends(get_db)):
    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")
    user_count = db.query(User).filter(User.tenant_id == studio_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"El studio tiene {user_count} usuario(s). Movelos primero con /admin/users/{{id}}/move-studio."
        )
    db.delete(studio)
    db.commit()
    return {"deleted": studio_id}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", dependencies=[AdminAuth])
def listar_usuarios(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "tenant_id": u.tenant_id,
            "auth_provider": u.auth_provider.value,
            "google_id": u.google_id,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.get("/users/pending", dependencies=[AdminAuth])
def usuarios_pendientes(db: Session = Depends(get_db)):
    """Usuarios atascados con tenant_id='pending' (Google login sin completar setup)."""
    users = db.query(User).filter(User.tenant_id == "pending").all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "google_id": u.google_id,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.post("/users/{user_id}/new-studio", dependencies=[AdminAuth])
def crear_studio_para_usuario(user_id: str, body: NewStudioRequest, db: Session = Depends(get_db)):
    """Crea un nuevo studio y asigna el usuario a él. Útil para usuarios con tenant_id='pending'."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if db.query(Studio).filter(Studio.slug == body.studio_slug).first():
        raise HTTPException(status_code=400, detail="Slug ya en uso")
    studio = Studio(name=body.studio_name, slug=body.studio_slug)
    db.add(studio)
    db.flush()
    user.tenant_id = studio.id
    db.commit()
    db.refresh(studio)
    return {"studio_id": studio.id, "studio_name": studio.name, "user_id": user.id}


@router.post("/users/{user_id}/move-studio", dependencies=[AdminAuth])
def mover_usuario_a_studio(user_id: str, body: MoveStudioRequest, db: Session = Depends(get_db)):
    """Mueve un usuario a un studio existente."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    studio = db.query(Studio).filter(Studio.id == body.studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio destino no encontrado")
    old_tenant = user.tenant_id
    user.tenant_id = body.studio_id
    db.commit()
    return {"user_id": user.id, "from_studio": old_tenant, "to_studio": body.studio_id}


@router.delete("/users/{user_id}", dependencies=[AdminAuth])
def eliminar_usuario(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}
