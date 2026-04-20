"""
Router Google Calendar — conexión independiente del método de login.
Cualquier usuario puede conectar su Google Calendar desde /perfil.

Endpoints:
  GET  /auth/google-calendar/connect      → genera URL OAuth2
  GET  /auth/google-calendar/callback     → recibe code, guarda refresh_token
  GET  /auth/google-calendar/calendars    → lista calendarios del usuario
  DELETE /auth/google-calendar/disconnect → limpia tokens
  POST /vencimientos/sync-calendar        → pushea vencimientos al calendar elegido
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Vencimiento
from app.models.tarea import Tarea, TareaEstado
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/google-calendar", tags=["google-calendar"])

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _build_flow(state: Optional[str] = None) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_cal_client_id,
            "client_secret": settings.google_cal_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_CALENDAR_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_CALENDAR_REDIRECT_URI,
    )
    if state:
        flow.state = state
    return flow


def _get_credentials(user: User) -> Credentials:
    if not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="No hay Calendar conectado. Cerrá sesión y volvé a entrar con Google para autorizar.")
    return Credentials(
        token=None,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_cal_client_id,
        client_secret=settings.google_cal_client_secret,
        scopes=SCOPES,
    )


@router.get("/connect")
def connect_google_calendar(current_user: CurrentUser):
    """Genera la URL de autorización OAuth2 para conectar Google Calendar."""
    if not settings.google_cal_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar no configurado en este entorno")

    flow = _build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=current_user["sub"],  # guardamos user_id como state para recuperarlo en callback
    )
    return {"url": auth_url, "state": state}


@router.get("/callback")
def google_calendar_callback(
    code: str = Query(...),
    state: str = Query(...),  # user_id pasado en el flow
    db: DbSession = None,
):
    """Recibe el code OAuth2, obtiene refresh_token y lo guarda en el usuario."""
    if not settings.google_cal_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar no configurado")

    flow = _build_flow(state=state)
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        logger.error("Error fetching Google token: %s", e)
        raise HTTPException(status_code=400, detail="Error al obtener token de Google")

    credentials = flow.credentials

    # Recuperar user por state (user_id) — el callback viene del browser sin auth header
    user = db.query(User).filter(User.id == state).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.google_refresh_token = credentials.refresh_token or user.google_refresh_token
    db.commit()

    # Redirigir al frontend con flag de éxito
    return RedirectResponse(url=f"{settings.BASE_URL}/perfil?calendar_connected=1")


@router.get("/calendars")
def listar_calendarios(db: DbSession, current_user: CurrentUser):
    """Lista los calendarios disponibles del usuario conectado."""
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user or not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google Calendar no conectado")

    try:
        creds = _get_credentials(user)
        service = build("calendar", "v3", credentials=creds)
        calendar_list = service.calendarList().list().execute()
        return [
            {"id": c["id"], "summary": c.get("summary", c["id"]), "primary": c.get("primary", False)}
            for c in calendar_list.get("items", [])
        ]
    except HttpError as e:
        raise HTTPException(status_code=400, detail=f"Error al listar calendarios: {e}")


@router.delete("/disconnect", status_code=204)
def disconnect_google_calendar(db: DbSession, current_user: CurrentUser):
    """Elimina el refresh_token y el calendar_id del usuario."""
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.google_refresh_token = None
    user.google_calendar_id = None
    db.commit()


@router.post("/select-calendar", status_code=200)
def select_calendar(
    calendar_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Guarda el calendario elegido por el usuario."""
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.google_calendar_id = calendar_id
    db.commit()
    return {"calendar_id": calendar_id}


# ── Sync endpoint ─────────────────────────────────────────────────────────────

sync_router = APIRouter(prefix="/vencimientos", tags=["vencimientos"])


def _insert_event(service, calendar_id: str, event: dict) -> bool:
    try:
        service.events().insert(calendarId=calendar_id, body=event).execute()
        return True
    except HttpError:
        return False


@sync_router.post("/sync-calendar", status_code=200)
def sync_calendar(db: DbSession, current_user: CurrentUser):
    """Pushea vencimientos pendientes y tareas pendientes al Google Calendar del usuario."""
    tenant_id = current_user["studio_id"]
    user_id = current_user["sub"]
    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.google_refresh_token or not user.google_calendar_id:
        raise HTTPException(
            status_code=400,
            detail="Necesitás conectar Google Calendar y elegir un calendario desde tu perfil"
        )

    try:
        creds = _get_credentials(user)
        service = build("calendar", "v3", credentials=creds)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error conectando con Google: {e}")

    cal_id = user.google_calendar_id
    synced = 0
    errors = 0

    # Vencimientos pendientes
    vencimientos = (
        db.query(Vencimiento)
        .filter(Vencimiento.tenant_id == tenant_id, Vencimiento.cumplido == False)  # noqa: E712
        .all()
    )
    for v in vencimientos:
        event = {
            "summary": f"📅 {v.descripcion}",
            "description": f"Tipo: {v.tipo}\nExpediente: {v.expediente_id or 'Sin expediente'}\nGenerado por LexCore",
            "start": {"date": v.fecha},
            "end": {"date": v.fecha},
            "reminders": {"useDefault": False, "overrides": [
                {"method": "email", "minutes": 24 * 60},
                {"method": "popup", "minutes": 60},
            ]},
        }
        if _insert_event(service, cal_id, event):
            synced += 1
        else:
            errors += 1

    # Tareas pendientes con fecha límite (del usuario actual o del estudio)
    tareas = (
        db.query(Tarea)
        .filter(
            Tarea.tenant_id == tenant_id,
            Tarea.estado != TareaEstado.hecha,
            Tarea.fecha_limite.isnot(None),
        )
        .all()
    )
    for t in tareas:
        event = {
            "summary": f"✅ {t.titulo}",
            "description": f"Tarea\nExpediente: {t.expediente_id or 'Sin expediente'}\nGenerado por LexCore",
            "start": {"date": t.fecha_limite},
            "end": {"date": t.fecha_limite},
            "reminders": {"useDefault": False, "overrides": [
                {"method": "popup", "minutes": 60},
            ]},
        }
        if _insert_event(service, cal_id, event):
            synced += 1
        else:
            errors += 1

    total = len(vencimientos) + len(tareas)
    return {"synced": synced, "errors": errors, "total": total}
