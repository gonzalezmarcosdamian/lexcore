"""
Router de usuarios del estudio.
Lista y gestiona los miembros del tenant.
"""
from typing import List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.user import User, UserRole

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    auth_provider: str
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, u: User) -> "UserOut":
        return cls(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            auth_provider=u.auth_provider.value if hasattr(u.auth_provider, "value") else str(u.auth_provider),
            created_at=u.created_at.isoformat(),
        )


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    auth_provider: str
    google_refresh_token: str | None = None  # True/None — no exponemos el token real
    google_calendar_id: str | None = None
    studio_access_level: str = "full"
    is_superadmin: bool = False

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None


@router.get("/me", response_model=UserProfile)
def get_my_profile(db: DbSession, current_user: CurrentUser):
    """Devuelve el perfil del usuario autenticado con estado de Calendar y access level."""
    from app.models.studio import Studio
    from app.services.subscription_service import get_studio_access_level

    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    studio = db.query(Studio).filter(Studio.id == current_user["studio_id"]).first()
    access_level = get_studio_access_level(studio) if studio else "full"

    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        auth_provider=user.auth_provider.value if hasattr(user.auth_provider, "value") else str(user.auth_provider),
        google_refresh_token="***" if user.google_refresh_token else None,
        google_calendar_id=user.google_calendar_id,
        studio_access_level=access_level,
        is_superadmin=user.is_superadmin,
    )


@router.patch("/me", response_model=UserProfile)
def update_my_profile(body: UserProfileUpdate, db: DbSession, current_user: CurrentUser):
    """Actualiza nombre y/o contraseña del usuario autenticado."""
    from app.core.auth import get_password_hash
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.password is not None:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
        user.hashed_password = get_password_hash(body.password)
    db.commit()
    db.refresh(user)
    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        auth_provider=user.auth_provider.value if hasattr(user.auth_provider, "value") else str(user.auth_provider),
        google_refresh_token="***" if user.google_refresh_token else None,
        google_calendar_id=user.google_calendar_id,
    )


@router.get("", response_model=List[UserOut])
def listar_usuarios(db: DbSession, current_user: CurrentUser):
    """Lista todos los usuarios del estudio ordenados por rol y nombre."""
    users = (
        db.query(User)
        .filter(User.tenant_id == current_user["studio_id"])
        .order_by(User.role, User.full_name)
        .all()
    )
    return [UserOut.from_user(u) for u in users]


@router.patch("/{user_id}/role", response_model=UserOut)
def cambiar_rol(user_id: str, body: UserRoleUpdate, db: DbSession, current_user: CurrentUser):
    """Cambia el rol de un miembro. Solo admin puede hacerlo."""
    if current_user.get("role") not in ("admin", "socio"):
        raise HTTPException(status_code=403, detail="Solo admin o socio puede cambiar roles")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user["studio_id"],
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # No puede cambiar su propio rol
    if user.id == current_user["sub"]:
        raise HTTPException(status_code=400, detail="No podés cambiar tu propio rol")

    user.role = body.role
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(user_id: str, db: DbSession, current_user: CurrentUser):
    """Elimina un miembro del estudio. Solo admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede eliminar miembros")

    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user["studio_id"],
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == current_user["sub"]:
        raise HTTPException(status_code=400, detail="No podés eliminarte a vos mismo")

    db.delete(user)
    db.commit()
