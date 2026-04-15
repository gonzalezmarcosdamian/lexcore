from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.core.auth import create_access_token, hash_password, verify_password
from app.core.deps import DbSession
from app.models.invitacion import Invitacion
from app.models.studio import Studio
from app.models.user import AuthProvider, User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    studio_id: str
    role: str


# ── Email + Password ─────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    studio_name: str
    studio_slug: str
    email: EmailStr
    password: str
    full_name: str


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: DbSession):
    # Validar slug único
    if db.query(Studio).filter(Studio.slug == body.studio_slug).first():
        raise HTTPException(status_code=400, detail="El slug del estudio ya está en uso")

    # Validar email único
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Crear estudio
    studio = Studio(name=body.studio_name, slug=body.studio_slug)
    db.add(studio)
    db.flush()  # obtener studio.id sin commitear

    # Crear primer usuario admin
    user = User(
        tenant_id=studio.id,
        email=body.email,
        full_name=body.full_name,
        role=UserRole.admin,
        auth_provider=AuthProvider.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        studio_id=studio.id, user_id=user.id, role=user.role.value
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        studio_id=studio.id,
        role=user.role.value,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbSession):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    token = create_access_token(
        studio_id=user.tenant_id, user_id=user.id, role=user.role.value
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        studio_id=user.tenant_id,
        role=user.role.value,
    )


# ── Google OAuth ──────────────────────────────────────────────────────────────

class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    google_id: str
    google_refresh_token: str | None = None


class GoogleAuthResponse(TokenResponse):
    needs_studio: bool = False


@router.post("/google", response_model=GoogleAuthResponse)
def google_auth(body: GoogleAuthRequest, db: DbSession):
    user = (
        db.query(User)
        .filter(
            (User.google_id == body.google_id) | (User.email == body.email)
        )
        .first()
    )

    if user:
        # Usuario existente — actualizar refresh token si llegó uno nuevo
        if body.google_refresh_token:
            user.google_refresh_token = body.google_refresh_token
        if not user.google_id:
            user.google_id = body.google_id
            user.auth_provider = AuthProvider.google
        db.commit()

        token = create_access_token(
            studio_id=user.tenant_id, user_id=user.id, role=user.role.value
        )
        return GoogleAuthResponse(
            access_token=token,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            studio_id=user.tenant_id,
            role=user.role.value,
            needs_studio=False,
        )

    # Usuario nuevo — necesita crear su estudio
    # Creamos el user sin studio_id todavía (flujo de onboarding)
    user = User(
        tenant_id="pending",  # se actualiza en /auth/setup-studio
        email=body.email,
        full_name=body.name,
        role=UserRole.admin,
        auth_provider=AuthProvider.google,
        google_id=body.google_id,
        google_refresh_token=body.google_refresh_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Token temporal para el flujo de setup
    token = create_access_token(
        studio_id="pending", user_id=user.id, role=user.role.value
    )
    return GoogleAuthResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        studio_id="pending",
        role=user.role.value,
        needs_studio=True,
    )


class RegisterInvitedRequest(BaseModel):
    token: str
    password: str


@router.post("/register-invited", response_model=TokenResponse, status_code=201)
def register_invited(body: RegisterInvitedRequest, db: DbSession):
    """Completa el registro de un usuario invitado usando su token de invitación."""
    now = datetime.now(timezone.utc)
    inv = db.query(Invitacion).filter(
        Invitacion.token == body.token,
        Invitacion.usado == False,
        Invitacion.expires_at > now,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación inválida o expirada")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres")

    # Verificar que no exista ya ese email en el tenant
    existing = db.query(User).filter(
        User.email == inv.email,
        User.tenant_id == inv.tenant_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="El usuario ya existe en el estudio")

    user = User(
        tenant_id=inv.tenant_id,
        email=inv.email,
        full_name=inv.full_name,
        role=inv.rol,
        auth_provider=AuthProvider.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)

    inv.usado = True
    db.commit()
    db.refresh(user)

    token = create_access_token(
        studio_id=user.tenant_id, user_id=user.id, role=user.role.value
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        studio_id=user.tenant_id,
        role=user.role.value,
    )


class SetupStudioRequest(BaseModel):
    studio_name: str
    studio_slug: str


@router.post("/setup-studio", response_model=TokenResponse)
def setup_studio(body: SetupStudioRequest, db: DbSession):
    # Validar slug único
    if db.query(Studio).filter(Studio.slug == body.studio_slug).first():
        raise HTTPException(status_code=400, detail="El slug del estudio ya está en uso")

    # Buscar usuario pending (simplificado — en prod validar con token)
    user = db.query(User).filter(User.tenant_id == "pending").first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    studio = Studio(name=body.studio_name, slug=body.studio_slug)
    db.add(studio)
    db.flush()

    user.tenant_id = studio.id
    db.commit()
    db.refresh(user)

    token = create_access_token(
        studio_id=studio.id, user_id=user.id, role=user.role.value
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        studio_id=studio.id,
        role=user.role.value,
    )
