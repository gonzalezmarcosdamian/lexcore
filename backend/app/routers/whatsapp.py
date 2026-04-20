"""
WhatsApp Business webhook — Fase 1 (solo lectura para clientes).

Endpoints:
  GET  /whatsapp/webhook/{studio_slug}  — verificación Meta (challenge)
  POST /whatsapp/webhook/{studio_slug}  — recepción de mensajes entrantes

Flujo cliente:
  Cliente escribe al número del estudio → Meta llama al webhook →
  bot identifica cliente por teléfono → responde con estado de expedientes.

Prerequisito externo:
  - Cuenta Meta Business verificada
  - Número WhatsApp Business activo
  - URL pública con HTTPS registrada en Meta Developers

La lógica de negocio no depende de las credenciales de Meta para ser testeada.
"""
import httpx
import logging
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.models.cliente import Cliente
from app.models.expediente import Expediente, EstadoExpediente, Vencimiento
from app.models.studio import Studio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

# ── Helpers de texto ──────────────────────────────────────────────────────────

def _normalizar_telefono(tel: str) -> str:
    """Normaliza a solo dígitos para comparar."""
    return "".join(c for c in tel if c.isdigit())


def _format_fecha(iso: str) -> str:
    try:
        d = date.fromisoformat(iso[:10])
        return d.strftime("%-d de %B").replace(
            "January", "enero").replace("February", "febrero").replace(
            "March", "marzo").replace("April", "abril").replace(
            "May", "mayo").replace("June", "junio").replace(
            "July", "julio").replace("August", "agosto").replace(
            "September", "septiembre").replace("October", "octubre").replace(
            "November", "noviembre").replace("December", "diciembre")
    except Exception:
        return iso[:10]


# ── Lógica de negocio ─────────────────────────────────────────────────────────

def _buscar_cliente_por_telefono(db: Session, studio_id: str, telefono_entrante: str) -> Cliente | None:
    tel_norm = _normalizar_telefono(telefono_entrante)
    clientes = db.query(Cliente).filter(Cliente.tenant_id == studio_id).all()
    for c in clientes:
        if c.telefono and _normalizar_telefono(c.telefono).endswith(tel_norm[-9:]):
            return c
    return None


def _estado_expedientes(db: Session, studio_id: str, cliente_id: str) -> str:
    expedientes = db.query(Expediente).filter(
        Expediente.tenant_id == studio_id,
        Expediente.cliente_id == cliente_id,
        Expediente.estado == EstadoExpediente.activo,
    ).order_by(Expediente.created_at.desc()).limit(3).all()

    if not expedientes:
        return "No encontré expedientes activos asociados a tu número."

    hoy = date.today()
    proximos_dias = hoy + timedelta(days=30)

    lines = []
    for exp in expedientes:
        lines.append(f"📂 *{exp.caratula}* ({exp.numero})")
        if exp.fuero:
            lines.append(f"   Fuero: {exp.fuero}")

        # Próximos vencimientos
        vencimientos = db.query(Vencimiento).filter(
            Vencimiento.tenant_id == studio_id,
            Vencimiento.expediente_id == exp.id,
            Vencimiento.cumplido == False,
            Vencimiento.fecha >= str(hoy),
            Vencimiento.fecha <= str(proximos_dias),
        ).order_by(Vencimiento.fecha).limit(2).all()

        if vencimientos:
            for v in vencimientos:
                urgente = date.fromisoformat(v.fecha[:10]) <= hoy + timedelta(days=2)
                prefix = "🔴" if urgente else "📅"
                lines.append(f"   {prefix} {_format_fecha(v.fecha)}: {v.descripcion}")
        else:
            lines.append("   Sin vencimientos próximos en los próximos 30 días.")

        lines.append("")

    return "\n".join(lines).strip()


def _respuesta_bot(db: Session, studio: Studio, telefono_remitente: str, mensaje: str) -> str:
    """Genera el texto de respuesta dado un mensaje entrante."""
    msg = mensaje.strip().lower()

    cliente = _buscar_cliente_por_telefono(db, studio.id, telefono_remitente)
    if not cliente:
        return (
            f"Hola 👋 Soy el asistente de *{studio.name}*.\n\n"
            "No encontré un cliente registrado con tu número en nuestro sistema. "
            "Para consultas podés contactar directamente al estudio."
        )

    saludos = {"hola", "buenos dias", "buenos días", "buenas tardes", "buenas noches", "hola!", "hi"}
    ayuda = {"ayuda", "help", "comandos", "?"}
    estado_keys = {"estado", "expediente", "causa", "caso", "mis causas", "mis expedientes"}

    if msg in saludos:
        return (
            f"Hola {cliente.nombre.split()[0]} 👋 Soy el asistente de *{studio.name}*.\n\n"
            "Podés escribirme:\n"
            "• *estado* — ver el estado de tus expedientes\n"
            "• *ayuda* — ver todos los comandos\n\n"
            "¿En qué te puedo ayudar?"
        )

    if msg in ayuda:
        return (
            f"📋 *Comandos disponibles en {studio.name}:*\n\n"
            "• *estado* — ver tus expedientes activos y próximos vencimientos\n"
            "• *hola* — saludo inicial\n\n"
            "Para hablar con una persona del estudio, contactanos directamente."
        )

    if any(k in msg for k in estado_keys):
        resumen = _estado_expedientes(db, studio.id, cliente.id)
        return (
            f"📋 *Estado de tus expedientes en {studio.name}:*\n\n"
            f"{resumen}\n\n"
            "_Para más información contactá directamente al estudio._"
        )

    return (
        "No entendí tu mensaje 🤔\n\n"
        "Escribí *ayuda* para ver qué podés consultar, o contactá al estudio directamente."
    )


# ── Envío de mensaje via WhatsApp API ─────────────────────────────────────────

async def _enviar_whatsapp(phone_id: str, token: str, destinatario: str, texto: str) -> None:
    url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": destinatario,
        "type": "text",
        "text": {"body": texto},
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.error("WhatsApp send error %s: %s", resp.status_code, resp.text)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/webhook/{studio_slug}")
def verificar_webhook(
    studio_slug: str,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta llama a este endpoint para verificar que el webhook está activo."""
    db = next(get_db())
    try:
        studio = db.query(Studio).filter(Studio.slug == studio_slug).first()
        if not studio or not studio.whatsapp_active:
            raise HTTPException(status_code=404, detail="Studio no encontrado o WhatsApp inactivo")
        if hub_mode == "subscribe" and hub_verify_token == studio.whatsapp_verify_token:
            return Response(content=hub_challenge, media_type="text/plain")
        raise HTTPException(status_code=403, detail="Token de verificación inválido")
    finally:
        db.close()


@router.post("/webhook/{studio_slug}", status_code=200)
async def recibir_mensaje(studio_slug: str, request: Request):
    """Recibe mensajes entrantes de WhatsApp Business API."""
    db = next(get_db())
    try:
        studio = db.query(Studio).filter(Studio.slug == studio_slug).first()
        if not studio or not studio.whatsapp_active:
            # Meta requiere 200 siempre; si no está configurado, ignoramos silenciosamente
            return {"status": "ignored"}

        body: dict[str, Any] = await request.json()

        # Extraer mensaje del payload de Meta
        try:
            entry = body["entry"][0]
            change = entry["changes"][0]["value"]
            message = change["messages"][0]
            telefono_remitente = message["from"]
            texto_msg = message.get("text", {}).get("body", "")
        except (KeyError, IndexError):
            # Evento de estado (delivery, read) — ignorar
            return {"status": "ok"}

        if not texto_msg:
            return {"status": "ok"}

        respuesta = _respuesta_bot(db, studio, telefono_remitente, texto_msg)

        # Enviar respuesta (fire-and-forget en background)
        if studio.whatsapp_phone_id and studio.whatsapp_token:
            await _enviar_whatsapp(
                studio.whatsapp_phone_id,
                studio.whatsapp_token,
                telefono_remitente,
                respuesta,
            )

        return {"status": "ok"}
    except Exception as e:
        logger.exception("WhatsApp webhook error: %s", e)
        return {"status": "error"}
    finally:
        db.close()
