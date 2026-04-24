import re
import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import auth, clientes, expedientes, vencimientos, invitaciones, honorarios, search, ical, documentos, users, gastos, ingresos, tareas, dev_seed, resumenes, studios, whatsapp, soporte, admin, feriados, suscripcion, superadmin
from app.routers.google_calendar import router as google_calendar_router, sync_router as calendar_sync_router

logger = logging.getLogger(__name__)


def _job_notificar_urgentes():
    """Runs daily at 9am — sends urgency emails for all tenants."""
    from app.models.vencimiento import Vencimiento
    from app.models.user import User
    from app.models.expediente import Expediente
    from app.services.email import send_vencimiento_urgente_email

    db = SessionLocal()
    try:
        hoy = date.today().isoformat()
        limite = (date.today() + timedelta(hours=48)).strftime("%Y-%m-%d")

        urgentes = db.query(Vencimiento).filter(
            Vencimiento.cumplido == False,  # noqa: E712
            Vencimiento.fecha >= hoy,
            Vencimiento.fecha <= limite,
        ).all()

        if not urgentes:
            return

        tenant_ids = list({v.tenant_id for v in urgentes})
        for tenant_id in tenant_ids:
            tenant_urgentes = [v for v in urgentes if v.tenant_id == tenant_id]
            miembros = db.query(User).filter(User.tenant_id == tenant_id).all()
            emails = [u.email for u in miembros if u.email]
            if not emails:
                continue
            for v in tenant_urgentes:
                exp = db.query(Expediente).filter(Expediente.id == v.expediente_id).first()
                caratula = exp.caratula if exp else "Expediente"
                send_vencimiento_urgente_email(
                    to_emails=emails,
                    descripcion=v.descripcion,
                    fecha=v.fecha,
                    tipo=v.tipo or "vencimiento",
                    caratula=caratula,
                    expediente_id=v.expediente_id,
                )
        # Honorarios con vencimiento hoy o mañana y saldo pendiente
        from app.models.honorario import Honorario, PagoHonorario
        from decimal import Decimal
        from sqlalchemy import func as sqlfunc
        hon_urgentes = db.query(Honorario).filter(
            Honorario.fecha_vencimiento.isnot(None),
            Honorario.fecha_vencimiento >= hoy,
            Honorario.fecha_vencimiento <= limite,
        ).all()
        for h in hon_urgentes:
            total_capital = db.query(sqlfunc.sum(PagoHonorario.importe)).filter(
                PagoHonorario.honorario_id == h.id,
                PagoHonorario.tipo == "capital",
            ).scalar() or Decimal("0")
            saldo = h.monto_acordado - total_capital
            if saldo <= 0:
                continue
            miembros = db.query(User).filter(User.tenant_id == h.tenant_id).all()
            emails = [u.email for u in miembros if u.email]
            if not emails:
                continue
            exp = db.query(Expediente).filter(Expediente.id == h.expediente_id).first()
            caratula = exp.caratula if exp else "Expediente"
            send_vencimiento_urgente_email(
                to_emails=emails,
                descripcion=f"Cobro pendiente: {h.concepto} — Saldo: {h.moneda} {saldo:,.0f}",
                fecha=h.fecha_vencimiento,
                tipo="honorario",
                caratula=caratula,
                expediente_id=h.expediente_id,
            )
    except Exception:
        logger.exception("Error en job notificar_urgentes")
    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(_job_notificar_urgentes, CronTrigger(hour=9, minute=0))


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

_ALLOWED_ORIGINS = re.compile(
    r"^(http://localhost:(3000|3001)|https://[a-z0-9\-]+\.vercel\.app)$"
)

app = FastAPI(
    title="LexCore API",
    version="0.4.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan,
)


def _cors_headers(origin: str) -> dict:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        "Access-Control-Max-Age": "600",
    }


@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin", "")
    allowed = bool(origin and _ALLOWED_ORIGINS.match(origin))

    if request.method == "OPTIONS":
        headers = _cors_headers(origin) if allowed else {}
        return Response(status_code=204, headers=headers)

    response = await call_next(request)
    if allowed:
        for k, v in _cors_headers(origin).items():
            response.headers[k] = v
    return response

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(expedientes.router)
app.include_router(vencimientos.router)
app.include_router(invitaciones.router)
app.include_router(honorarios.router)
app.include_router(search.router)
app.include_router(ical.router)
app.include_router(documentos.router)
app.include_router(users.router)
app.include_router(gastos.router)
app.include_router(ingresos.router)
app.include_router(tareas.router)
if settings.ALLOW_DEV_ENDPOINTS or settings.ENVIRONMENT == "development":
    app.include_router(dev_seed.router)
app.include_router(resumenes.router)
app.include_router(studios.router)
app.include_router(google_calendar_router)
app.include_router(calendar_sync_router)
app.include_router(whatsapp.router)
app.include_router(soporte.router)
app.include_router(admin.router)
app.include_router(feriados.router)
app.include_router(suscripcion.router)
app.include_router(superadmin.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.ENVIRONMENT, "version": "0.4.0"}
