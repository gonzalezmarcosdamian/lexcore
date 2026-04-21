from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from datetime import datetime, timezone, timedelta
from collections import defaultdict
import time
import secrets

from app.core.auth import create_access_token, hash_password, verify_password, decode_token
from app.core.deps import DbSession
from app.models.invitacion import Invitacion
from app.models.studio import Studio
from app.models.user import AuthProvider, User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Rate limiting in-memory (MVP) ────────────────────────────────────────────
# {ip: [timestamp, ...]}  — solo intentos fallidos
_failed_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 15 * 60  # 15 minutos


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    # Limpiar intentos fuera de la ventana
    _failed_attempts[ip] = [t for t in _failed_attempts[ip] if now - t < _WINDOW_SECONDS]
    if len(_failed_attempts[ip]) >= _MAX_ATTEMPTS:
        retry_after = int(_WINDOW_SECONDS - (now - _failed_attempts[ip][0]))
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Intentá en {retry_after // 60} minutos.",
            headers={"Retry-After": str(retry_after)},
        )


def _register_failure(ip: str) -> None:
    _failed_attempts[ip].append(time.time())


def _clear_failures(ip: str) -> None:
    _failed_attempts.pop(ip, None)


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
    studio = Studio(
        name=body.studio_name,
        slug=body.studio_slug,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
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
def login(body: LoginRequest, db: DbSession, request: Request):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        _register_failure(ip)
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    _clear_failures(ip)

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

        # Si todavía no completó el setup de estudio, reiniciar ese flujo
        still_pending = user.tenant_id == "pending"
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
            needs_studio=still_pending,
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


class JoinStudioRequest(BaseModel):
    token: str


@router.post("/join-studio", response_model=TokenResponse, status_code=201)
def join_studio(body: JoinStudioRequest, db: DbSession):
    """Une a un usuario existente a un nuevo estudio sin necesitar contraseña."""
    now = datetime.now(timezone.utc)
    inv = db.query(Invitacion).filter(
        Invitacion.token == body.token,
        Invitacion.usado == False,
        Invitacion.expires_at > now,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación inválida o expirada")

    existing = db.query(User).filter(User.email == inv.email).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Usá el flujo de registro.")

    # Verificar que no esté ya en este tenant
    already_in = db.query(User).filter(
        User.email == inv.email,
        User.tenant_id == inv.tenant_id,
    ).first()
    if already_in:
        raise HTTPException(status_code=409, detail="Ya pertenecés a este estudio")

    user = User(
        tenant_id=inv.tenant_id,
        email=inv.email,
        full_name=inv.full_name,
        role=inv.rol,
        auth_provider=existing.auth_provider,
        hashed_password=existing.hashed_password,
        google_id=existing.google_id,
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


# ── Reset de contraseña ───────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/forgot-password", status_code=200)
def forgot_password(body: ForgotPasswordRequest, db: DbSession):
    """Genera token de reset y envía email. Siempre responde 200 (no revela si el email existe)."""
    from app.core.config import settings
    from app.services.email import send_reset_password_email

    user = db.query(User).filter(User.email == body.email, User.tenant_id != "pending").first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_password_token = token
        user.reset_password_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        send_reset_password_email(
            to_email=user.email,
            full_name=user.full_name,
            token=token,
            frontend_url=settings.BASE_URL,
        )
    return {"message": "Si el email existe, recibirás un link para restablecer tu contraseña."}


@router.post("/reset-password", status_code=200)
def reset_password(body: ResetPasswordRequest, db: DbSession):
    """Valida token y actualiza contraseña."""
    now = datetime.now(timezone.utc)
    user = db.query(User).filter(
        User.reset_password_token == body.token,
        User.reset_password_expires_at > now,
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres")

    user.hashed_password = hash_password(body.password)
    user.reset_password_token = None
    user.reset_password_expires_at = None
    user.auth_provider = AuthProvider.email
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


class SetupStudioRequest(BaseModel):
    studio_name: str
    studio_slug: str


@router.post("/setup-studio", response_model=TokenResponse)
def setup_studio(body: SetupStudioRequest, db: DbSession, request: Request):
    # Extraer user_id del JWT temporal emitido durante el registro
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id or payload.get("studio_id") != "pending":
        raise HTTPException(status_code=401, detail="Token inválido o ya fue utilizado")

    # Validar slug único
    if db.query(Studio).filter(Studio.slug == body.studio_slug).first():
        raise HTTPException(status_code=400, detail="El slug del estudio ya está en uso")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.tenant_id != "pending":
        raise HTTPException(status_code=409, detail="Este usuario ya tiene un estudio configurado")

    studio = Studio(
        name=body.studio_name,
        slug=body.studio_slug,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
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
