"""
Módulo superadmin — solo accesible para usuarios con is_superadmin=True.
Provee: lista de studios, override de plan/trial, gestión de precios, métricas.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
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
    studios = db.query(Studio).order_by(Studio.created_at.desc()).all()
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
        )
        for s in studios
    ]


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
    from app.models.expediente import Expediente, Vencimiento
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
    from app.models.expediente import Expediente, Vencimiento
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
