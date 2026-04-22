from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.auth import decode_token
from app.core.database import SessionLocal

bearer = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return payload


def require_full_access(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Dependency para endpoints de escritura (POST/PATCH/DELETE).
    Lanza HTTP 402 si el studio está en modo lectura (trial vencido o pago fallido).
    """
    from app.models.studio import Studio
    from app.services.subscription_service import get_studio_access_level

    studio_id = current_user.get("studio_id")
    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if studio and get_studio_access_level(studio) == "read_only":
        raise HTTPException(
            status_code=402,
            detail={
                "code": "read_only",
                "message": "Tu plan venció. Suscribite para seguir creando.",
            },
        )


def require_superadmin(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Dependency para rutas /superadmin — solo usuarios con is_superadmin=True en JWT."""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Acceso denegado")


# Shortcuts tipados para inyección
CurrentUser = Annotated[dict, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
RequireFullAccess = Depends(require_full_access)
SuperAdminRequired = Depends(require_superadmin)
