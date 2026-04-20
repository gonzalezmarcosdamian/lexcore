import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DbSession
from app.models.invitacion import Invitacion
from app.models.user import User, UserRole
from app.schemas.invitacion import InvitacionCreate, InvitacionOut

router = APIRouter(prefix="/invitaciones", tags=["invitaciones"])

INVITE_EXPIRY_DAYS = 7


def _require_admin(current_user: dict):
    if current_user.get("role") not in (UserRole.admin, UserRole.socio):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo admin o socio puede invitar usuarios",
        )


@router.get("", response_model=List[InvitacionOut])
def listar_invitaciones(db: DbSession, current_user: CurrentUser):
    _require_admin(current_user)
    return (
        db.query(Invitacion)
        .filter(Invitacion.tenant_id == current_user["studio_id"])
        .order_by(Invitacion.created_at.desc())
        .all()
    )


@router.post("", response_model=InvitacionOut, status_code=status.HTTP_201_CREATED)
def crear_invitacion(
    body: InvitacionCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    _require_admin(current_user)
    tenant_id = current_user["studio_id"]

    # Verificar que el email no esté ya en el tenant
    existing_user = db.query(User).filter(
        User.email == body.email,
        User.tenant_id == tenant_id,
    ).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="El usuario ya pertenece al estudio")

    # Invalidar invitaciones previas pendientes para el mismo email
    db.query(Invitacion).filter(
        Invitacion.tenant_id == tenant_id,
        Invitacion.email == body.email,
        Invitacion.usado == False,
    ).update({"usado": True})

    invitacion = Invitacion(
        tenant_id=tenant_id,
        email=body.email,
        full_name=body.full_name,
        rol=body.rol,
        token=secrets.token_urlsafe(48)[:64],
        usado=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invitacion)
    db.commit()
    db.refresh(invitacion)

    # Email de invitación — falla silenciosa si no hay RESEND_API_KEY
    from app.services.email import send_invitation_email
    from app.core.config import settings
    from app.models.studio import Studio

    studio = db.query(Studio).filter(Studio.id == tenant_id).first()
    inviter = db.query(User).filter(User.id == current_user["sub"]).first()
    base_url = getattr(settings, "BASE_URL", "http://localhost:3001")
    accept_url = f"{base_url}/aceptar-invitacion/{invitacion.token}"

    send_invitation_email(
        to_email=invitacion.email,
        to_name=invitacion.full_name,
        studio_name=studio.name if studio else "el estudio",
        inviter_name=inviter.full_name if inviter else "Tu colega",
        rol=invitacion.rol,
        accept_url=accept_url,
    )

    return invitacion


@router.delete("/{invitacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def revocar_invitacion(
    invitacion_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    _require_admin(current_user)
    inv = db.query(Invitacion).filter(
        Invitacion.id == invitacion_id,
        Invitacion.tenant_id == current_user["studio_id"],
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    inv.usado = True
    db.commit()


@router.post("/aceptar/{token}", status_code=status.HTTP_200_OK)
def aceptar_invitacion(token: str, db: DbSession):
    """Valida el token y devuelve los datos de la invitación para que el frontend complete el registro."""
    now = datetime.now(timezone.utc)
    inv = db.query(Invitacion).filter(
        Invitacion.token == token,
        Invitacion.usado == False,
        Invitacion.expires_at > now,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación inválida o expirada")

    # El usuario ya tiene cuenta en otro estudio → no necesita crear contraseña
    user_exists = db.query(User).filter(User.email == inv.email).first() is not None

    return {
        "tenant_id": inv.tenant_id,
        "email": inv.email,
        "full_name": inv.full_name,
        "rol": inv.rol,
        "user_exists": user_exists,
    }
