"""
Módulo superadmin — solo accesible para usuarios con is_superadmin=True.
Provee: lista de studios, override de plan/trial, gestión de precios, métricas.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession, SuperAdminRequired

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/superadmin",
    tags=["superadmin"],
    dependencies=[SuperAdminRequired],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class StudioListItem(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    billing_cycle: Optional[str]
    subscription_status: Optional[str]
    trial_ends_at: Optional[str]
    created_at: str
    # Actividad
    ultima_actividad: Optional[str] = None
    exp_esta_semana: int = 0
    total_expedientes: int = 0
    total_usuarios: int = 0


class OverrideRequest(BaseModel):
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    subscription_status: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    reset_trial: bool = False  # shortcut: setea trial_ends_at a now+30d


class PlanPriceCreate(BaseModel):
    plan: str
    billing_cycle: str
    amount: float


# ── Studios ───────────────────────────────────────────────────────────────────

@router.get("/studios", response_model=list[StudioListItem])
def list_studios(db: DbSession, current_user: CurrentUser):
    from app.models.studio import Studio
    from app.models.expediente import Expediente, Movimiento
    from app.models.user import User
    from sqlalchemy import func

    studios = db.query(Studio).order_by(Studio.created_at.desc()).all()
    studio_ids = [s.id for s in studios]

    hace_7_dias = datetime.now(timezone.utc) - timedelta(days=7)

    # Última actividad (MAX created_at de movimientos por tenant)
    ultima_act = dict(
        db.query(Movimiento.tenant_id, func.max(Movimiento.created_at))
        .filter(Movimiento.tenant_id.in_(studio_ids))
        .group_by(Movimiento.tenant_id)
        .all()
    )

    # Expedientes creados esta semana
    exp_semana = dict(
        db.query(Expediente.tenant_id, func.count(Expediente.id))
        .filter(Expediente.tenant_id.in_(studio_ids), Expediente.created_at >= hace_7_dias)
        .group_by(Expediente.tenant_id)
        .all()
    )

    # Total expedientes por tenant
    total_exp = dict(
        db.query(Expediente.tenant_id, func.count(Expediente.id))
        .filter(Expediente.tenant_id.in_(studio_ids))
        .group_by(Expediente.tenant_id)
        .all()
    )

    # Total usuarios por tenant
    total_users = dict(
        db.query(User.tenant_id, func.count(User.id))
        .filter(User.tenant_id.in_(studio_ids))
        .group_by(User.tenant_id)
        .all()
    )

    return [
        StudioListItem(
            id=s.id,
            name=s.name,
            slug=s.slug,
            plan=s.plan,
            billing_cycle=s.billing_cycle,
            subscription_status=s.subscription_status,
            trial_ends_at=s.trial_ends_at.isoformat() if s.trial_ends_at else None,
            created_at=s.created_at.isoformat(),
            ultima_actividad=ultima_act[s.id].isoformat() if s.id in ultima_act else None,
            exp_esta_semana=exp_semana.get(s.id, 0),
            total_expedientes=total_exp.get(s.id, 0),
            total_usuarios=total_users.get(s.id, 0),
        )
        for s in studios
    ]


@router.post("/studios/{studio_id}/extend-trial", status_code=200)
def extend_trial(studio_id: str, db: DbSession, current_user: CurrentUser, dias: int = 15):
    """Extiende el trial de un estudio N días desde hoy."""
    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent
    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")
    base = max(studio.trial_ends_at or datetime.now(timezone.utc), datetime.now(timezone.utc))
    studio.trial_ends_at = base + timedelta(days=dias)
    studio.subscription_updated_at = datetime.now(timezone.utc)
    evt = SubscriptionEvent(
        tenant_id=studio.id,
        event_type="manual_override",
        plan=studio.plan,
        billing_cycle=studio.billing_cycle,
        metadata_json=json.dumps({"by": current_user.get("sub"), "extend_days": dias}),
    )
    db.add(evt)
    db.commit()
    return {"trial_ends_at": studio.trial_ends_at.isoformat()}


@router.patch("/studios/{studio_id}/override")
def override_studio(
    studio_id: str,
    body: OverrideRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    Permite al superadmin cambiar plan, estado de suscripción o extender trial
    de cualquier studio. Crea un subscription_event de auditoría.
    """
    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")

    changes: dict = {}

    if body.reset_trial:
        studio.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=30)
        changes["reset_trial"] = True

    if body.trial_ends_at is not None:
        studio.trial_ends_at = body.trial_ends_at
        changes["trial_ends_at"] = body.trial_ends_at.isoformat()

    if body.plan is not None:
        changes["plan_prev"] = studio.plan
        studio.plan = body.plan
        changes["plan"] = body.plan

    if body.billing_cycle is not None:
        studio.billing_cycle = body.billing_cycle
        changes["billing_cycle"] = body.billing_cycle

    if body.subscription_status is not None:
        changes["subscription_status_prev"] = studio.subscription_status
        studio.subscription_status = body.subscription_status
        changes["subscription_status"] = body.subscription_status

    studio.subscription_updated_at = datetime.now(timezone.utc)

    evt = SubscriptionEvent(
        tenant_id=studio.id,
        event_type="manual_override",
        plan=studio.plan,
        billing_cycle=studio.billing_cycle,
        metadata_json=json.dumps({
            "by": current_user.get("sub"),
            **changes,
        }),
    )
    db.add(evt)
    db.commit()
    db.refresh(studio)

    logger.info(
        "Superadmin override studio=%s by=%s changes=%s",
        studio_id, current_user.get("sub"), changes,
    )

    return {
        "id": studio.id,
        "plan": studio.plan,
        "billing_cycle": studio.billing_cycle,
        "subscription_status": studio.subscription_status,
        "trial_ends_at": studio.trial_ends_at.isoformat() if studio.trial_ends_at else None,
        "subscription_updated_at": studio.subscription_updated_at.isoformat(),
    }


# ── Plan prices ───────────────────────────────────────────────────────────────

@router.get("/plan-prices")
def list_plan_prices(db: DbSession, current_user: CurrentUser):
    from app.models.plan_price import PlanPrice
    prices = db.query(PlanPrice).order_by(PlanPrice.valid_from.desc()).all()
    return [
        {
            "id": p.id,
            "plan": p.plan,
            "billing_cycle": p.billing_cycle,
            "amount": float(p.amount),
            "currency": p.currency,
            "valid_from": p.valid_from.isoformat(),
            "valid_to": p.valid_to.isoformat() if p.valid_to else None,
        }
        for p in prices
    ]


@router.post("/plan-prices", status_code=201)
def create_plan_price(
    body: PlanPriceCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Crea nuevo precio y cierra el anterior (valid_to = now) para ese plan+ciclo."""
    from app.models.plan_price import PlanPrice

    now = datetime.now(timezone.utc)

    # Cerrar precio anterior
    prev = db.query(PlanPrice).filter(
        PlanPrice.plan == body.plan,
        PlanPrice.billing_cycle == body.billing_cycle,
        PlanPrice.valid_to.is_(None),
    ).first()
    if prev:
        prev.valid_to = now

    new_price = PlanPrice(
        plan=body.plan,
        billing_cycle=body.billing_cycle,
        amount=body.amount,
        currency="ARS",
        valid_from=now,
        created_by=current_user.get("sub"),
    )
    db.add(new_price)
    db.commit()
    db.refresh(new_price)

    return {
        "id": new_price.id,
        "plan": new_price.plan,
        "billing_cycle": new_price.billing_cycle,
        "amount": float(new_price.amount),
        "valid_from": new_price.valid_from.isoformat(),
    }


# ── Métricas ──────────────────────────────────────────────────────────────────

@router.get("/metrics/latest")
def get_latest_metrics(db: DbSession, current_user: CurrentUser):
    from app.models.metrics_snapshot import MetricsSnapshot
    snap = db.query(MetricsSnapshot).order_by(MetricsSnapshot.snapshot_at.desc()).first()
    if not snap:
        return {"snapshot_at": None, "data": None}
    return {"snapshot_at": snap.snapshot_at.isoformat(), "data": json.loads(snap.data_json)}


@router.post("/metrics/sync", status_code=201)
def sync_metrics(db: DbSession, current_user: CurrentUser):
    """Genera un snapshot manual con queries a la DB."""
    from app.models.studio import Studio
    from app.models.user import User
    from app.models.expediente import Expediente, Movimiento as Vencimiento
    from app.models.documento import Documento
    from app.models.tarea import Tarea
    from app.models.metrics_snapshot import MetricsSnapshot
    from sqlalchemy import func

    total_studios = db.query(func.count(Studio.id)).scalar() or 0
    trial_studios = db.query(func.count(Studio.id)).filter(Studio.plan == "trial").scalar() or 0
    paying_studios = db.query(func.count(Studio.id)).filter(
        Studio.subscription_status == "active"
    ).scalar() or 0
    read_only_studios = db.query(func.count(Studio.id)).filter(
        Studio.plan == "read_only"
    ).scalar() or 0

    plans_raw = db.query(Studio.plan, func.count(Studio.id)).group_by(Studio.plan).all()
    studios_per_plan = {p: c for p, c in plans_raw}

    total_users = db.query(func.count(User.id)).scalar() or 0
    total_expedientes = db.query(func.count(Expediente.id)).scalar() or 0
    total_documentos = db.query(func.count(Documento.id)).scalar() or 0
    total_tareas = db.query(func.count(Tarea.id)).scalar() or 0
    total_vencimientos = db.query(func.count(Vencimiento.id)).scalar() or 0

    data = {
        "total_studios": total_studios,
        "trial_studios": trial_studios,
        "paying_studios": paying_studios,
        "read_only_studios": read_only_studios,
        "studios_per_plan": studios_per_plan,
        "total_users": total_users,
        "total_expedientes": total_expedientes,
        "total_documentos": total_documentos,
        "total_tareas": total_tareas,
        "total_vencimientos": total_vencimientos,
    }

    snap = MetricsSnapshot(
        data_json=json.dumps(data),
        created_by=current_user.get("sub"),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)

    return {"snapshot_at": snap.snapshot_at.isoformat(), "data": data}


@router.get("/studios/{studio_id}/detail")
def studio_detail(studio_id: str, db: DbSession, current_user: CurrentUser):
    """Detalle completo de un studio: usuarios, actividad, historial de suscripción."""
    from app.models.studio import Studio
    from app.models.user import User
    from app.models.expediente import Expediente, Movimiento as Vencimiento
    from app.models.documento import Documento
    from app.models.tarea import Tarea
    from app.models.subscription_event import SubscriptionEvent
    from sqlalchemy import func

    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")

    users = db.query(User).filter(User.tenant_id == studio_id).all()

    stats = {
        "expedientes": db.query(func.count(Expediente.id)).filter(Expediente.tenant_id == studio_id).scalar() or 0,
        "vencimientos": db.query(func.count(Vencimiento.id)).filter(Vencimiento.tenant_id == studio_id).scalar() or 0,
        "tareas": db.query(func.count(Tarea.id)).filter(Tarea.tenant_id == studio_id).scalar() or 0,
        "documentos": db.query(func.count(Documento.id)).filter(Documento.tenant_id == studio_id).scalar() or 0,
    }

    events = db.query(SubscriptionEvent).filter(
        SubscriptionEvent.tenant_id == studio_id
    ).order_by(SubscriptionEvent.created_at.desc()).limit(20).all()

    return {
        "studio": {
            "id": studio.id,
            "name": studio.name,
            "slug": studio.slug,
            "plan": studio.plan,
            "billing_cycle": studio.billing_cycle,
            "subscription_status": studio.subscription_status,
            "trial_ends_at": studio.trial_ends_at.isoformat() if studio.trial_ends_at else None,
            "created_at": studio.created_at.isoformat(),
            "email_contacto": studio.email_contacto,
        },
        "users": [
            {
                "id": u.id,
                "name": u.full_name,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
        "stats": stats,
        "subscription_events": [
            {
                "event_type": e.event_type,
                "plan": e.plan,
                "billing_cycle": e.billing_cycle,
                "created_at": e.created_at.isoformat(),
                "metadata": json.loads(e.metadata_json) if e.metadata_json else {},
            }
            for e in events
        ],
    }


@router.get("/metrics/history")
def get_metrics_history(db: DbSession, current_user: CurrentUser):
    from app.models.metrics_snapshot import MetricsSnapshot
    snaps = db.query(MetricsSnapshot).order_by(MetricsSnapshot.snapshot_at.desc()).limit(30).all()
    return [
        {"snapshot_at": s.snapshot_at.isoformat(), "data": json.loads(s.data_json)}
        for s in snaps
    ]


# ── Cron endpoints (protegidos por ADMIN_API_KEY, sin JWT) ────────────────────

cron_router = APIRouter(prefix="/cron", tags=["cron"])


def _require_admin_key(request: Request):
    from app.core.config import settings
    from fastapi import Request
    key = request.headers.get("x-admin-key", "")
    if not settings.ADMIN_API_KEY or key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="API key requerida")


@cron_router.post("/trial-warnings")
async def cron_trial_warnings(request: Request, db: DbSession):
    """
    Envía emails de aviso a estudios en día 25 del trial (5 días restantes).
    Llamar diariamente desde Railway Cron: POST /cron/trial-warnings
    Header requerido: x-admin-key: <ADMIN_API_KEY>
    """
    _require_admin_key(request)

    from app.models.studio import Studio
    from app.models.user import User
    from app.services.email import send_trial_warning_email

    now = datetime.now(timezone.utc)
    enviados = 0
    errores = 0

    # Buscar estudios en trial con 1-7 días restantes
    studios = db.query(Studio).filter(
        Studio.plan == "trial",
        Studio.trial_ends_at.isnot(None),
        Studio.trial_ends_at > now,
        Studio.trial_ends_at <= now + timedelta(days=7),
    ).all()

    frontend_url = "https://lexcore-kappa.vercel.app"
    try:
        from app.core.config import settings as cfg
        if cfg.BASE_URL.startswith("https://"):
            frontend_url = cfg.BASE_URL
    except Exception:
        pass

    for studio in studios:
        trial_dt = studio.trial_ends_at
        if trial_dt.tzinfo is None:
            trial_dt = trial_dt.replace(tzinfo=timezone.utc)
        dias = max(1, (trial_dt - now).days)

        admin = db.query(User).filter(
            User.tenant_id == studio.id,
            User.role == "admin",
        ).first()

        if not admin or not admin.email:
            continue

        ok = send_trial_warning_email(
            to_email=admin.email,
            studio_name=studio.name,
            dias_restantes=dias,
            frontend_url=frontend_url,
        )
        if ok:
            enviados += 1
        else:
            errores += 1

    logger.info("Cron trial-warnings: %d enviados, %d errores, %d estudios evaluados", enviados, errores, len(studios))
    return {"ok": True, "enviados": enviados, "errores": errores, "studios_evaluados": len(studios)}


@cron_router.post("/simulate-payment")
async def cron_simulate_payment(request: Request, db: DbSession):
    """
    Simula un pago aprobado en sandbox: activa el plan del estudio sin pasar por MP.
    Solo funciona en ENVIRONMENT != production.
    Header: x-admin-key + body: {"studio_id": "...", "plan": "starter", "billing_cycle": "monthly"}
    """
    _require_admin_key(request)

    from app.core.config import settings as cfg
    if cfg.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Solo disponible en sandbox")

    body = await request.json()
    studio_id = body.get("studio_id")
    plan = body.get("plan", "starter")
    billing_cycle = body.get("billing_cycle", "monthly")

    from app.models.studio import Studio
    from app.models.subscription_event import SubscriptionEvent

    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Studio no encontrado")

    fake_id = f"TEST-SIMULATED-{studio_id[:8]}"
    now = datetime.now(timezone.utc)

    studio.subscription_id = fake_id
    studio.plan = plan
    studio.billing_cycle = billing_cycle
    studio.subscription_status = "active"
    studio.next_billing_date = (now.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%Y-%m-%d")
    studio.subscription_updated_at = now

    evt = SubscriptionEvent(
        tenant_id=studio.id,
        event_type="charge_success",
        plan=plan,
        billing_cycle=billing_cycle,
        amount=17000.0,
        mp_preapproval_id=fake_id,
    )
    db.add(evt)
    db.commit()

    logger.info("Pago simulado: studio=%s plan=%s", studio_id, plan)
    return {"ok": True, "studio_id": studio_id, "plan": plan, "status": "active", "preapproval_id": fake_id}
