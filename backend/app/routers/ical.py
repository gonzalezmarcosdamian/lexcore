"""
Exportación de vencimientos a formato iCal (.ics).
Compatible con Google Calendar, Apple Calendar, Outlook y cualquier cliente de calendario.

GET /ical/vencimiento/{id}   → descarga un evento
GET /ical/expediente/{id}    → descarga todos los vencimientos del expediente
GET /ical/proximos           → descarga los próximos 30 días
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.core.deps import CurrentUser, DbSession
from app.models.expediente import Expediente, Movimiento as Vencimiento

router = APIRouter(prefix="/ical", tags=["ical"])

TIPO_DISPLAY = {
    "vencimiento": "Vencimiento procesal",
    "audiencia": "Audiencia",
    "presentacion": "Presentación",
    "pericia": "Pericia",
    "otro": "Evento legal",
}


def _ical_date(iso_date: str) -> str:
    """Convierte YYYY-MM-DD a formato iCal YYYYMMDD."""
    return iso_date.replace("-", "")


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _make_vcalendar(events: list[str]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LexCore//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:LexCore — Vencimientos",
        "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
        *events,
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


def _make_vevent(v: Vencimiento, caratula: str) -> list[str]:
    tipo_label = TIPO_DISPLAY.get(v.tipo, "Evento legal")
    summary = f"[LEXCORE] {tipo_label}: {caratula[:60]}"
    description = f"Expediente: {caratula}\\nTipo: {tipo_label}\\nDescripción: {v.titulo}"
    fecha_ical = _ical_date(v.fecha)

    return [
        "BEGIN:VEVENT",
        f"UID:{v.id}@lexcore",
        f"DTSTAMP:{_now_utc()}",
        f"DTSTART;VALUE=DATE:{fecha_ical}",
        f"DTEND;VALUE=DATE:{fecha_ical}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Vencimiento LexCore — 7 días",
        "TRIGGER:-P7D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Vencimiento LexCore — 48hs",
        "TRIGGER:-P2D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Vencimiento LexCore — 2hs",
        "TRIGGER:-PT2H",
        "END:VALARM",
        "END:VEVENT",
    ]


def _ics_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/vencimiento/{vencimiento_id}")
def exportar_vencimiento(
    vencimiento_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Descarga un único vencimiento como .ics."""
    tenant_id = current_user["studio_id"]

    v = db.query(Vencimiento).filter(
        Vencimiento.id == vencimiento_id,
        Vencimiento.tenant_id == tenant_id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")

    exp = db.query(Expediente).filter(Expediente.id == v.expediente_id).first()
    caratula = exp.caratula if exp else "Expediente"

    event_lines = _make_vevent(v, caratula)
    ical = _make_vcalendar(event_lines)
    return _ics_response(ical, f"vencimiento-{vencimiento_id[:8]}.ics")


@router.get("/expediente/{expediente_id}")
def exportar_expediente(
    expediente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Descarga todos los vencimientos pendientes de un expediente como .ics."""
    tenant_id = current_user["studio_id"]

    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    vencimientos = (
        db.query(Vencimiento)
        .filter(
            Vencimiento.expediente_id == expediente_id,
            Vencimiento.tenant_id == tenant_id,
            Vencimiento.cumplido == False,
        )
        .all()
    )

    event_lines = []
    for v in vencimientos:
        event_lines.extend(_make_vevent(v, exp.caratula))

    ical = _make_vcalendar(event_lines)
    nombre = exp.numero.replace("/", "-").replace(" ", "_")
    return _ics_response(ical, f"vencimientos-{nombre}.ics")


@router.get("/proximos")
def exportar_proximos(
    db: DbSession,
    current_user: CurrentUser,
    dias: int = 30,
):
    """Descarga los vencimientos próximos del estudio como .ics."""
    from datetime import date, timedelta

    tenant_id = current_user["studio_id"]
    hoy = date.today().isoformat()
    limite = (date.today() + timedelta(days=dias)).isoformat()

    vencimientos = (
        db.query(Vencimiento)
        .filter(
            Vencimiento.tenant_id == tenant_id,
            Vencimiento.cumplido == False,
            Vencimiento.fecha >= hoy,
            Vencimiento.fecha <= limite,
        )
        .order_by(Vencimiento.fecha)
        .all()
    )

    exp_cache: dict[str, str] = {}
    event_lines = []
    for v in vencimientos:
        if v.expediente_id not in exp_cache:
            exp = db.query(Expediente).filter(Expediente.id == v.expediente_id).first()
            exp_cache[v.expediente_id] = exp.caratula if exp else "Expediente"
        event_lines.extend(_make_vevent(v, exp_cache[v.expediente_id]))

    ical = _make_vcalendar(event_lines)
    return _ics_response(ical, f"lexcore-vencimientos-{dias}dias.ics")
