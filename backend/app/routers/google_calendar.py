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
import os
import requests as http_requests
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

# google-auth-oauthlib valida que los scopes coincidan exactamente,
# pero Google devuelve scopes extra (openid, email, profile). Relajamos la check.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente, Vencimiento
from app.models.tarea import Tarea, TareaEstado
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/google-calendar", tags=["google-calendar"])

SCOPES = ["https://www.googleapis.com/auth/calendar"]


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
def connect_google_calendar(current_user: CurrentUser, db: DbSession):
    """Genera la URL de autorización OAuth2 para conectar Google Calendar."""
    if not settings.google_cal_client_id:
        raise HTTPException(status_code=501, detail="Google Calendar no configurado en este entorno")

    # Revocar token existente para forzar que Google emita uno nuevo con calendar scope
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if user and user.google_refresh_token:
        try:
            http_requests.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": user.google_refresh_token},
                timeout=5,
            )
        except Exception:
            pass
        user.google_refresh_token = None
        db.commit()

    flow = _build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="false",
        prompt="consent",
        state=current_user["sub"],
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

    logger.info("Calendar callback - refresh_token present: %s, scopes: %s", bool(credentials.refresh_token), credentials.scopes)
    if credentials.refresh_token:
        user.google_refresh_token = credentials.refresh_token
    elif not user.google_refresh_token:
        logger.error("Calendar callback - NO refresh_token y usuario sin token previo")
        raise HTTPException(status_code=400, detail="Google no devolvió refresh_token. Intentá revocar acceso desde myaccount.google.com/permissions y reconectar.")
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
        logger.error("HttpError listando calendarios: %s", e)
        raise HTTPException(status_code=400, detail=f"Error al listar calendarios: {e}")
    except Exception as e:
        logger.error("Error inesperado listando calendarios: %s", e, exc_info=True)
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


LEXCORE_TAG = "lexcore_sync"


def _delete_existing_lexcore_events(service, calendar_id: str):
    """Elimina todos los eventos previos creados por LexCore para evitar duplicados."""
    try:
        page_token = None
        while True:
            events = service.events().list(
                calendarId=calendar_id,
                privateExtendedProperty=f"{LEXCORE_TAG}=1",
                pageToken=page_token,
            ).execute()
            for e in events.get("items", []):
                try:
                    service.events().delete(calendarId=calendar_id, eventId=e["id"]).execute()
                except HttpError:
                    pass
            page_token = events.get("nextPageToken")
            if not page_token:
                break
    except HttpError:
        pass


def _insert_event(service, calendar_id: str, event: dict) -> bool:
    event.setdefault("extendedProperties", {})
    event["extendedProperties"]["private"] = {LEXCORE_TAG: "1"}
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
    _delete_existing_lexcore_events(service, cal_id)
    synced = 0
    errors = 0

    # Pre-cargar expedientes del tenant para resolver numero+caratula sin N+1
    expedientes_map: dict = {
        e.id: e for e in db.query(Expediente).filter(Expediente.tenant_id == tenant_id).all()
    }

    def _exp_label(expediente_id: str | None) -> str:
        if not expediente_id:
            return "Sin expediente"
        exp = expedientes_map.get(expediente_id)
        if not exp:
            return "Sin expediente"
        return f"{exp.numero} — {exp.caratula}"

    def _reminders(fecha: str, hora: str | None) -> dict:
        """Dos alertas: medianoche del día del evento + 1h antes de la hora (o 1h antes de 09:00)."""
        from datetime import datetime, timezone, timedelta
        # Minutos desde medianoche del día del evento hasta 00:00 de ese día
        # Google Calendar: minutes = minutos ANTES del inicio del evento
        # Si el evento es "all day" (date, no dateTime), Google considera inicio = 00:00
        # → alerta "a medianoche del día" = 0 min antes del evento (mínimo 0)
        # → alerta "1h antes de las 09:00" = 9*60 - 60 = 480 min antes del inicio (00:00)
        if hora:
            h, m = int(hora[:2]), int(hora[3:5])
            mins_from_midnight = h * 60 + m  # minutos desde 00:00 hasta la hora del evento
            alerta_medianoche = mins_from_midnight   # popup justo a las 00:00 del día
            alerta_1h_antes = 60                      # 60 min antes del evento
        else:
            # Sin hora: evento todo el día, base 09:00
            alerta_medianoche = 9 * 60   # 540 min antes de 09:00 = 00:00 del día
            alerta_1h_antes = 8 * 60     # 480 min antes de 09:00 = 01:00 del día... ajustamos a 60 min antes de 09:00
            alerta_1h_antes = 60         # 60 min antes del tiempo por defecto del evento todo-el-día

        return {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": alerta_medianoche},
                {"method": "popup", "minutes": alerta_1h_antes},
            ],
        }

    # Vencimientos pendientes
    vencimientos = (
        db.query(Vencimiento)
        .filter(Vencimiento.tenant_id == tenant_id, Vencimiento.cumplido == False)  # noqa: E712
        .all()
    )
    for v in vencimientos:
        hora = getattr(v, "hora", None)
        exp_label = _exp_label(v.expediente_id)
        event = {
            "summary": f"📅 {v.descripcion}",
            "description": f"Tipo: {v.tipo}\nExpediente: {exp_label}\nGenerado por LexCore",
            "start": {"date": v.fecha},
            "end": {"date": v.fecha},
            "reminders": _reminders(v.fecha, hora),
        }
        if _insert_event(service, cal_id, event):
            synced += 1
        else:
            errors += 1

    # Tareas pendientes con fecha límite
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
        hora = getattr(t, "hora", None)
        exp_label = _exp_label(t.expediente_id)
        event = {
            "summary": f"✅ {t.titulo}",
            "description": f"Tarea\nExpediente: {exp_label}\nGenerado por LexCore",
            "start": {"date": t.fecha_limite},
            "end": {"date": t.fecha_limite},
            "reminders": _reminders(t.fecha_limite, hora),
        }
        if _insert_event(service, cal_id, event):
            synced += 1
        else:
            errors += 1

    total = len(vencimientos) + len(tareas)
    return {"synced": synced, "errors": errors, "total": total}
