"""
SUBS-002 — Suscripción con MercadoPago Subscriptions API (preapproval recurrente).
Checkout guarda estado en DB. Webhook procesa eventos y actualiza studio.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Literal

import mercadopago
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/suscripcion", tags=["suscripcion"])

# ── Planes (fuente de verdad mientras no hay plan_prices en DB) ───────────────

PLANES: dict = {
    "starter": {
        "label": "Starter",
        "monthly": 22000.0,
        "annual_monthly": round(22000 * 11 / 12, 2),
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

PLAN_LABELS = {
    "trial": "Trial",
    "starter": "Starter",
    "pro": "Pro",
    "estudio": "Estudio",
    "read_only": "Solo lectura",
}

PlanKey = Literal["starter", "pro", "estudio"]
BillingCycle = Literal["monthly", "annual"]


def _mp_sdk() -> mercadopago.SDK:
    if not settings.MERCADOPAGO_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="MercadoPago no configurado")
    return mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)


def _get_precio(plan_key: str, billing_cycle: str, db) -> float:
    """Busca el precio vigente en plan_prices. Si no hay datos, usa PLANES hardcodeado."""
    from app.models.plan_price import PlanPrice
    price_row = db.query(PlanPrice).filter(
        PlanPrice.plan == plan_key,
        PlanPrice.billing_cycle == billing_cycle,
        PlanPrice.valid_to.is_(None),
    ).first()
    if price_row:
        return float(price_row.amount)
    plan = PLANES.get(plan_key)
    if not plan:
        raise HTTPException(status_code=400, detail="Plan inválido")
    return plan["monthly"] if billing_cycle == "monthly" else plan["annual_monthly"]


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


class StatusResponse(BaseModel):
    plan: str
    plan_label: str
    billing_cycle: str | None
    subscription_status: str | None
    next_billing_date: str | None
    next_billing_amount: float | None
    trial_ends_at: str | None
    dias_restantes_trial: int | None
    studio_access_level: str
    eventos: list


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/planes", response_model=PlanesResponse)
def listar_planes(current_user: CurrentUser, db: DbSession):
    """Devuelve planes vigentes (desde plan_prices si existen, sino hardcoded) + public key."""
    from app.models.plan_price import PlanPrice
    planes_out = {}
    for plan_key, defaults in PLANES.items():
        m = db.query(PlanPrice).filter(
            PlanPrice.plan == plan_key,
            PlanPrice.billing_cycle == "monthly",
            PlanPrice.valid_to.is_(None),
        ).first()
        a = db.query(PlanPrice).filter(
            PlanPrice.plan == plan_key,
            PlanPrice.billing_cycle == "annual",
            PlanPrice.valid_to.is_(None),
        ).first()
        planes_out[plan_key] = {
            **defaults,
            "monthly": float(m.amount) if m else defaults["monthly"],
            "annual_monthly": float(a.amount) if a else defaults["annual_monthly"],
        }
    return {"planes": planes_out, "public_key": settings.MERCADOPAGO_PUBLIC_KEY}


@router.post("/checkout", response_model=CheckoutResponse)
def crear_checkout(body: CheckoutRequest, current_user: CurrentUser, db: DbSession):
    """
    Crea preapproval en MercadoPago, guarda estado en DB y devuelve la URL de checkout.
    Solo admin.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede gestionar la suscripción")

    from app.models.user import User
    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    user = db.query(User).filter(User.id == current_user["sub"]).first()
    if not user or not user.email:
        raise HTTPException(status_code=400, detail="El usuario no tiene email registrado")

    studio = db.query(Studio).filter(Studio.id == current_user["studio_id"]).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    amount = _get_precio(body.plan, body.billing_cycle, db)
    plan_data = PLANES.get(body.plan, {})
    plan_label = plan_data.get("label", body.plan)

    base = settings.BASE_URL if settings.BASE_URL.startswith("https://") else "https://lexcore-kappa.vercel.app"
    back_url = f"{base}/perfil?subs=ok"

    preapproval_data = {
        "reason": f"LexCore {plan_label} — {'Mensual' if body.billing_cycle == 'monthly' else 'Anual'}",
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
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
    preapproval_id = response_data["id"]

    # Guardar en DB inmediatamente — el webhook actualizará el estado después
    studio.subscription_id = preapproval_id
    studio.plan = body.plan
    studio.billing_cycle = body.billing_cycle
    studio.subscription_status = "pending"
    studio.subscription_updated_at = datetime.now(timezone.utc)

    evt = SubscriptionEvent(
        tenant_id=studio.id,
        event_type="created",
        plan=body.plan,
        billing_cycle=body.billing_cycle,
        amount=amount,
        mp_preapproval_id=preapproval_id,
    )
    db.add(evt)
    db.commit()

    logger.info(
        "Checkout creado: studio=%s preapproval=%s plan=%s cycle=%s amount=%s",
        studio.id, preapproval_id, body.plan, body.billing_cycle, amount,
    )

    return CheckoutResponse(
        checkout_url=response_data["init_point"],
        preapproval_id=preapproval_id,
        plan=body.plan,
        amount=amount,
        billing_cycle=body.billing_cycle,
    )


@router.get("/status", response_model=StatusResponse)
def get_status(current_user: CurrentUser, db: DbSession):
    """Estado actual de suscripción del estudio. Solo admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede ver el estado de suscripción")

    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent
    from app.services.subscription_service import get_studio_access_level

    studio = db.query(Studio).filter(Studio.id == current_user["studio_id"]).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")

    # Días restantes de trial
    dias_restantes = None
    trial_ends_at_str = None
    if studio.trial_ends_at:
        trial_dt = studio.trial_ends_at
        if trial_dt.tzinfo is None:
            trial_dt = trial_dt.replace(tzinfo=timezone.utc)
        trial_ends_at_str = trial_dt.isoformat()
        delta = trial_dt - datetime.now(timezone.utc)
        dias_restantes = max(0, delta.days)

    # Monto próximo cobro
    next_amount = None
    if studio.plan in PLANES and studio.billing_cycle:
        next_amount = _get_precio(studio.plan, studio.billing_cycle, db)

    # Historial de eventos (últimos 12)
    eventos = db.query(SubscriptionEvent).filter(
        SubscriptionEvent.tenant_id == studio.id,
    ).order_by(SubscriptionEvent.created_at.desc()).limit(12).all()

    return StatusResponse(
        plan=studio.plan,
        plan_label=PLAN_LABELS.get(studio.plan, studio.plan),
        billing_cycle=studio.billing_cycle,
        subscription_status=studio.subscription_status,
        next_billing_date=studio.next_billing_date,
        next_billing_amount=next_amount,
        trial_ends_at=trial_ends_at_str,
        dias_restantes_trial=dias_restantes,
        studio_access_level=get_studio_access_level(studio),
        eventos=[
            {
                "event_type": e.event_type,
                "plan": e.plan,
                "billing_cycle": e.billing_cycle,
                "amount": float(e.amount) if e.amount else None,
                "mp_payment_id": e.mp_payment_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in eventos
        ],
    )


@router.patch("/cancel", status_code=200)
def cancelar_suscripcion(current_user: CurrentUser, db: DbSession):
    """Cancela el preapproval activo en MercadoPago. Solo admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede cancelar la suscripción")

    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    studio = db.query(Studio).filter(Studio.id == current_user["studio_id"]).first()
    if not studio or not studio.subscription_id:
        raise HTTPException(status_code=400, detail="No hay suscripción activa para cancelar")

    sdk = _mp_sdk()
    result = sdk.preapproval().update(studio.subscription_id, {"status": "cancelled"})

    if result["status"] not in (200, 201):
        logger.error("MP cancel error: %s", result)
        raise HTTPException(status_code=502, detail="Error al cancelar en MercadoPago")

    studio.subscription_status = "cancelled"
    studio.plan = "read_only"
    studio.subscription_updated_at = datetime.now(timezone.utc)

    evt = SubscriptionEvent(
        tenant_id=studio.id,
        event_type="cancelled",
        plan=studio.plan,
        billing_cycle=studio.billing_cycle,
        mp_preapproval_id=studio.subscription_id,
    )
    db.add(evt)
    db.commit()

    logger.info("Suscripción cancelada: studio=%s preapproval=%s", studio.id, studio.subscription_id)
    return {"ok": True, "status": "cancelled"}


@router.get("/preapproval/{preapproval_id}")
def consultar_preapproval(preapproval_id: str, current_user: CurrentUser):
    """Consulta estado actual en MP. Útil para verificar o como fallback tras redirect."""
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


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request):
    """
    Recibe notificaciones IPN de MercadoPago.
    Siempre responde 200 — MP reintenta si recibe otro código.
    Valida firma x-signature si MERCADOPAGO_WEBHOOK_SECRET está configurado.
    """
    body_bytes = await request.body()

    # Validar firma HMAC-SHA256 si el secret está configurado
    if settings.MERCADOPAGO_WEBHOOK_SECRET:
        sig_header = request.headers.get("x-signature", "")
        ts = received_hash = ""
        for part in sig_header.split(","):
            part = part.strip()
            if part.startswith("ts="):
                ts = part[3:]
            elif part.startswith("v1="):
                received_hash = part[3:]

        manifest = (
            f"id={request.query_params.get('data.id', '')};"
            f"request-id={request.headers.get('x-request-id', '')};"
            f"ts={ts};"
        )
        expected = hmac.new(
            settings.MERCADOPAGO_WEBHOOK_SECRET.encode(),
            manifest.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, received_hash):
            logger.warning("Webhook MP: firma inválida — manifest=%s", manifest)
            return {"ok": False, "detail": "invalid signature"}

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    event_type = payload.get("type", "unknown")
    event_id = payload.get("data", {}).get("id", "")

    logger.info("MP Webhook: type=%s id=%s", event_type, event_id)

    if event_type == "preapproval" and event_id:
        try:
            await _procesar_preapproval(event_id)
        except Exception:
            logger.exception("Error procesando webhook preapproval id=%s", event_id)
            # Igual devolvemos 200 para que MP no reintente infinitamente

    elif event_type == "subscription_authorized_payment" and event_id:
        try:
            await _procesar_pago(event_id)
        except Exception:
            logger.exception("Error procesando webhook pago id=%s", event_id)

    return {"ok": True, "received": event_type}


async def _procesar_preapproval(preapproval_id: str):
    """Consulta el preapproval en MP y actualiza el studio correspondiente."""
    from app.core.database import SessionLocal
    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    sdk = _mp_sdk()
    result = sdk.preapproval().get(preapproval_id)
    if result["status"] != 200:
        logger.warning("Preapproval %s no encontrado en MP", preapproval_id)
        return

    r = result["response"]
    mp_status = r.get("status")  # authorized | paused | cancelled | pending

    db = SessionLocal()
    try:
        studio = db.query(Studio).filter(Studio.subscription_id == preapproval_id).first()
        if not studio:
            logger.warning("Webhook: no hay studio con subscription_id=%s", preapproval_id)
            return

        # Idempotencia: si ya registramos este estado, skip
        event_map = {
            "authorized": "charge_success",
            "paused": "charge_failed",
            "cancelled": "cancelled",
        }
        event_type_key = event_map.get(mp_status)
        if event_type_key:
            ya_existe = db.query(SubscriptionEvent).filter(
                SubscriptionEvent.tenant_id == studio.id,
                SubscriptionEvent.mp_preapproval_id == preapproval_id,
                SubscriptionEvent.event_type == event_type_key,
            ).first()
            if ya_existe:
                logger.info("Webhook idempotente: %s ya procesado para studio=%s", event_type_key, studio.id)
                return

        now = datetime.now(timezone.utc)

        if mp_status == "authorized":
            studio.subscription_status = "active"
            next_date = r.get("next_payment_date", "")
            if next_date:
                studio.next_billing_date = next_date[:10]  # solo YYYY-MM-DD
            studio.subscription_updated_at = now
            evt = SubscriptionEvent(
                tenant_id=studio.id,
                event_type="charge_success",
                plan=studio.plan,
                billing_cycle=studio.billing_cycle,
                mp_preapproval_id=preapproval_id,
            )

        elif mp_status == "paused":
            studio.subscription_status = "paused"
            studio.subscription_updated_at = now
            evt = SubscriptionEvent(
                tenant_id=studio.id,
                event_type="charge_failed",
                plan=studio.plan,
                billing_cycle=studio.billing_cycle,
                mp_preapproval_id=preapproval_id,
            )

        elif mp_status == "cancelled":
            studio.subscription_status = "cancelled"
            studio.plan = "read_only"
            studio.subscription_updated_at = now
            evt = SubscriptionEvent(
                tenant_id=studio.id,
                event_type="cancelled",
                plan="read_only",
                billing_cycle=studio.billing_cycle,
                mp_preapproval_id=preapproval_id,
            )

        else:
            logger.info("Webhook preapproval: status=%s no requiere acción", mp_status)
            return

        db.add(evt)
        db.commit()
        logger.info(
            "Webhook procesado: studio=%s preapproval=%s mp_status=%s",
            studio.id, preapproval_id, mp_status,
        )

    finally:
        db.close()


async def _procesar_pago(payment_id: str):
    """Registra un cobro exitoso en subscription_events."""
    from app.core.database import SessionLocal
    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    sdk = _mp_sdk()
    result = sdk.advanced_payment().get(payment_id)
    if result["status"] != 200:
        logger.warning("Pago %s no encontrado en MP", payment_id)
        return

    r = result["response"]
    # Buscar el studio por el preapproval_id asociado al pago
    preapproval_id = r.get("preapproval_id") or r.get("subscription_id", "")

    db = SessionLocal()
    try:
        studio = db.query(Studio).filter(Studio.subscription_id == preapproval_id).first() if preapproval_id else None

        # Idempotencia por payment_id
        ya_existe = db.query(SubscriptionEvent).filter(
            SubscriptionEvent.mp_payment_id == payment_id,
        ).first()
        if ya_existe:
            return

        evt = SubscriptionEvent(
            tenant_id=studio.id if studio else "unknown",
            event_type="charge_success",
            plan=studio.plan if studio else "unknown",
            billing_cycle=studio.billing_cycle if studio else None,
            amount=r.get("transaction_amount"),
            mp_payment_id=payment_id,
            mp_preapproval_id=preapproval_id or None,
        )
        db.add(evt)
        db.commit()
        logger.info("Pago registrado: payment_id=%s studio=%s", payment_id, studio.id if studio else "?")

    finally:
        db.close()
