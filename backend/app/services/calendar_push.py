"""
Servicio de push incremental a Google Calendar.

Cuando un usuario tiene google_refresh_token + google_calendar_id configurado,
cada creación / modificación / eliminación de vencimientos y tareas se refleja
automáticamente en su calendario sin necesidad de pulsar "Sync".

El sync manual (/vencimientos/sync-calendar) sigue funcionando como resync completo.
"""
import logging
import os
from typing import Optional

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
LEXCORE_TAG = "lexcore_sync"


def _get_service(user: User):
    """Construye el cliente de Google Calendar para el usuario. Retorna None si no tiene cal configurado."""
    if not user.google_refresh_token or not user.google_calendar_id:
        return None, None
    if not settings.google_cal_client_id:
        return None, None
    try:
        creds = Credentials(
            token=None,
            refresh_token=user.google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_cal_client_id,
            client_secret=settings.google_cal_client_secret,
            scopes=SCOPES,
        )
        service = build("calendar", "v3", credentials=creds)
        return service, user.google_calendar_id
    except Exception as e:
        logger.warning(f"calendar_push: no se pudo construir servicio para user {user.id}: {e}")
        return None, None


def _make_event_id(prefix: str, object_id: str) -> str:
    """Google Calendar exige IDs en [a-v0-9], max 1024 chars, min 5."""
    raw = f"{prefix}{object_id.replace('-', '')}"
    return raw[:1024].lower()


def _push_event_to_user(service, cal_id: str, event: dict, label: str) -> None:
    event_id = event["id"]
    try:
        service.events().update(calendarId=cal_id, eventId=event_id, body=event).execute()
    except HttpError as e:
        if e.status_code == 404:
            try:
                service.events().insert(calendarId=cal_id, body=event).execute()
            except HttpError as e2:
                logger.warning(f"calendar_push {label} insert error: {e2}")
        else:
            logger.warning(f"calendar_push {label} update error: {e}")


def _usuarios_con_cal(db, tenant_id: str):
    return db.query(User).filter(
        User.tenant_id == tenant_id,
        User.google_refresh_token.isnot(None),
        User.google_calendar_id.isnot(None),
    ).all()


def _caratula_expediente(db, expediente_id: str | None) -> str | None:
    if not expediente_id:
        return None
    from app.models.expediente import Expediente
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        return None
    return f"{exp.numero}{' · ' + exp.caratula if exp.caratula else ''}"


def push_vencimiento(db, vencimiento, user_id: str) -> bool:
    """Crea o actualiza el evento de un vencimiento en el calendario de todos los usuarios del tenant."""
    event_id = _make_event_id("vcto", vencimiento.id)
    fecha = vencimiento.fecha

    exp_label = _caratula_expediente(db, vencimiento.expediente_id)
    desc_parts = [f"Tipo: {vencimiento.tipo or 'vencimiento'}"]
    if exp_label:
        desc_parts.append(f"Expediente: {exp_label}")
    desc_parts.append("Generado por LexCore")

    event: dict = {
        "id": event_id,
        "summary": f"📅 {vencimiento.descripcion}",
        "description": "\n".join(desc_parts),
        "start": {"date": fecha},
        "end": {"date": fecha},
        "reminders": {"useDefault": False, "overrides": [
            {"method": "email", "minutes": 24 * 60},
            {"method": "popup", "minutes": 60},
        ]},
        "extendedProperties": {"private": {LEXCORE_TAG: "1"}},
    }
    if vencimiento.hora:
        tz = "America/Argentina/Buenos_Aires"
        dt = f"{fecha}T{vencimiento.hora}:00"
        event["start"] = {"dateTime": dt, "timeZone": tz}
        event["end"] = {"dateTime": dt, "timeZone": tz}

    for user in _usuarios_con_cal(db, vencimiento.tenant_id):
        service, cal_id = _get_service(user)
        if service:
            _push_event_to_user(service, cal_id, event, "vencimiento")
    return True


def delete_vencimiento(db, vencimiento_id: str, tenant_id: str) -> None:
    """Elimina el evento del vencimiento del calendario de todos los usuarios del tenant."""
    usuarios = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.google_refresh_token.isnot(None),
        User.google_calendar_id.isnot(None),
    ).all()
    event_id = _make_event_id("vcto", vencimiento_id)
    for user in usuarios:
        service, cal_id = _get_service(user)
        if not service:
            continue
        try:
            service.events().delete(calendarId=cal_id, eventId=event_id).execute()
        except HttpError as e:
            if e.status_code != 404:
                logger.warning(f"calendar_push delete vencimiento user={user.id}: {e}")


def push_tarea(db, tarea, user_id: str) -> bool:
    """Crea o actualiza el evento de una tarea en el calendario de todos los usuarios del tenant."""
    if not tarea.fecha_limite:
        return False
    event_id = _make_event_id("tarea", tarea.id)
    fecha = tarea.fecha_limite

    exp_label = _caratula_expediente(db, tarea.expediente_id)
    desc_parts = [f"Tipo: {tarea.tipo or 'tarea'}"]
    if tarea.descripcion:
        desc_parts.append(tarea.descripcion)
    if exp_label:
        desc_parts.append(f"Expediente: {exp_label}")
    desc_parts.append("Generado por LexCore")

    event: dict = {
        "id": event_id,
        "summary": f"✅ {tarea.titulo}",
        "description": "\n".join(desc_parts),
        "start": {"date": fecha},
        "end": {"date": fecha},
        "reminders": {"useDefault": False, "overrides": [
            {"method": "popup", "minutes": 60},
        ]},
        "extendedProperties": {"private": {LEXCORE_TAG: "1"}},
    }
    if tarea.hora:
        tz = "America/Argentina/Buenos_Aires"
        dt = f"{fecha}T{tarea.hora}:00"
        event["start"] = {"dateTime": dt, "timeZone": tz}
        event["end"] = {"dateTime": dt, "timeZone": tz}

    for user in _usuarios_con_cal(db, tarea.tenant_id):
        service, cal_id = _get_service(user)
        if service:
            _push_event_to_user(service, cal_id, event, "tarea")
    return True


def delete_tarea(db, tarea_id: str, tenant_id: str) -> None:
    """Elimina el evento de la tarea del calendario de todos los usuarios del tenant."""
    usuarios = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.google_refresh_token.isnot(None),
        User.google_calendar_id.isnot(None),
    ).all()
    event_id = _make_event_id("tarea", tarea_id)
    for user in usuarios:
        service, cal_id = _get_service(user)
        if not service:
            continue
        try:
            service.events().delete(calendarId=cal_id, eventId=event_id).execute()
        except HttpError as e:
            if e.status_code != 404:
                logger.warning(f"calendar_push delete tarea user={user.id}: {e}")


def push_all_for_studio(db, tenant_id: str, user_id: str):
    """Resync completo — equivalente al botón manual. Lo llama google_calendar.py."""
    from app.models.expediente import Vencimiento
    from app.models.tarea import Tarea, TareaEstado

    vencimientos = db.query(Vencimiento).filter(
        Vencimiento.tenant_id == tenant_id,
        Vencimiento.cumplido == False,  # noqa: E712
    ).all()
    tareas = db.query(Tarea).filter(
        Tarea.tenant_id == tenant_id,
        Tarea.estado != TareaEstado.hecha,
        Tarea.fecha_limite.isnot(None),
    ).all()

    synced = sum(push_vencimiento(db, v, user_id) for v in vencimientos)
    synced += sum(push_tarea(db, t, user_id) for t in tareas)
    return synced, len(vencimientos) + len(tareas)
