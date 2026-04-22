"""
POC — Suscripción con MercadoPago Subscriptions API (preapproval recurrente).
Valida integración básica antes de construir la experiencia completa.
"""
import hashlib
import hmac
import logging
from typing import Literal

import mercadopago
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/suscripcion", tags=["suscripcion"])

# ── Planes ────────────────────────────────────────────────────────────────────

PLANES = {
    "starter": {
        "label": "Starter",
        "monthly": 22000.0,
        "annual_monthly": round(22000 * 11 / 12, 2),  # cobro mensual equivalente
        "max_users": 2,
    },
    "pro": {
        "label": "Pro",
        "monthly": 38000.0,
        "annual_monthly": round(38000 * 11 / 12, 2),
        "max_users": 6,
    },
    "estudio": {
        "label": "Estudio",
        "monthly": 65000.0,
        "annual_monthly": round(65000 * 11 / 12, 2),
        "max_users": None,
    },
}

PlanKey = Literal["starter", "pro", "estudio"]
BillingCycle = Literal["monthly", "annual"]


def _mp_sdk() -> mercadopago.SDK:
    if not settings.MERCADOPAGO_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="MercadoPago no configurado")
    return mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)


# ── Schemas ───────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: PlanKey
    billing_cycle: BillingCycle


class CheckoutResponse(BaseModel):
    checkout_url: str
    preapproval_id: str
    plan: str
    amount: float
    billing_cycle: str


class PlanesResponse(BaseModel):
    planes: dict
    public_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/planes", response_model=PlanesResponse)
def listar_planes(current_user: CurrentUser):
    """Devuelve los planes disponibles y la public key de MP para el frontend."""
    return {
        "planes": PLANES,
        "public_key": settings.MERCADOPAGO_PUBLIC_KEY,
    }


@router.post("/checkout", response_model=CheckoutResponse)
def crear_checkout(
    body: CheckoutRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Crea un preapproval recurrente en MercadoPago y devuelve la URL de checkout.
    Solo accesible para admin del estudio.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede gestionar la suscripción")

    from app.models.user import User
    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user or not user.email:
        raise HTTPException(status_code=400, detail="El usuario no tiene email registrado")

    plan = PLANES.get(body.plan)
    if not plan:
        raise HTTPException(status_code=400, detail="Plan inválido")

    amount = plan["monthly"] if body.billing_cycle == "monthly" else plan["annual_monthly"]
    # Para ciclo anual: 12 cobros mensuales a precio reducido (11 meses / 12)
    frequency = 1
    frequency_type = "months"

    # MP exige URL pública — localhost no es válido ni en sandbox
    base = settings.BASE_URL if settings.BASE_URL.startswith("https://") else "https://lexcore-kappa.vercel.app"
    back_url = f"{base}/perfil?subs=ok"

    preapproval_data = {
        "reason": f"LexCore {plan['label']} — {'Mensual' if body.billing_cycle == 'monthly' else 'Anual'}",
        "auto_recurring": {
            "frequency": frequency,
            "frequency_type": frequency_type,
            "transaction_amount": amount,
            "currency_id": "ARS",
        },
        "back_url": back_url,
        "payer_email": user.email,
        "status": "pending",
    }

    sdk = _mp_sdk()
    result = sdk.preapproval().create(preapproval_data)

    if result["status"] not in (200, 201):
        logger.error("MP preapproval error: %s", result)
        raise HTTPException(
            status_code=502,
            detail=f"Error al crear suscripción en MercadoPago: {result.get('response', {})}",
        )

    response_data = result["response"]
    logger.info(
        "Preapproval creado: id=%s plan=%s cycle=%s amount=%s",
        response_data.get("id"),
        body.plan,
        body.billing_cycle,
        amount,
    )

    return CheckoutResponse(
        checkout_url=response_data["init_point"],
        preapproval_id=response_data["id"],
        plan=body.plan,
        amount=amount,
        billing_cycle=body.billing_cycle,
    )


@router.get("/preapproval/{preapproval_id}")
def consultar_preapproval(preapproval_id: str, current_user: CurrentUser):
    """
    Consulta el estado actual de un preapproval en MP.
    Útil para verificar manualmente durante la POC.
    """
    sdk = _mp_sdk()
    result = sdk.preapproval().get(preapproval_id)
    if result["status"] != 200:
        raise HTTPException(status_code=404, detail="Preapproval no encontrado")
    r = result["response"]
    return {
        "id": r.get("id"),
        "status": r.get("status"),
        "reason": r.get("reason"),
        "payer_email": r.get("payer_email"),
        "next_payment_date": r.get("next_payment_date"),
        "last_modified": r.get("last_modified"),
        "auto_recurring": r.get("auto_recurring"),
        "summarized": r.get("summarized"),
    }


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request):
    """
    Recibe notificaciones IPN de MercadoPago.
    Responde siempre 200 — MP reintenta si no recibe 200.
    Valida firma x-signature si MERCADOPAGO_WEBHOOK_SECRET está configurado.
    """
    body_bytes = await request.body()

    # Validar firma si el secret está configurado
    if settings.MERCADOPAGO_WEBHOOK_SECRET:
        sig_header = request.headers.get("x-signature", "")
        ts = ""
        received_hash = ""
        for part in sig_header.split(","):
            part = part.strip()
            if part.startswith("ts="):
                ts = part[3:]
            elif part.startswith("v1="):
                received_hash = part[3:]

        manifest = f"id={request.query_params.get('data.id', '')};request-id={request.headers.get('x-request-id', '')};ts={ts};"
        expected = hmac.new(
            settings.MERCADOPAGO_WEBHOOK_SECRET.encode(),
            manifest.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, received_hash):
            logger.warning("Webhook MP: firma inválida")
            return {"ok": False, "detail": "invalid signature"}

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    event_type = payload.get("type", "unknown")
    event_id = payload.get("data", {}).get("id", "")

    logger.info("MP Webhook recibido: type=%s id=%s payload=%s", event_type, event_id, payload)

    # POC: solo loguear y devolver 200
    # En la implementación completa: procesar preapproval authorized/paused/cancelled
    if event_type == "preapproval":
        logger.info("Preapproval event — id=%s (procesamiento pendiente en impl. completa)", event_id)

    return {"ok": True, "received": event_type}
