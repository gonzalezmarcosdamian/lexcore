"""
Router de soporte — tickets de ayuda y reporte de problemas.

POST /soporte/tickets          — crear ticket (usuario autenticado)
GET  /soporte/tickets          — listar tickets del tenant (admin/socio)
GET  /soporte/tickets/all      — todos los tickets (superadmin LexCore)
PATCH /soporte/tickets/{id}    — actualizar estado + nota interna (admin/socio o superadmin)
"""
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.models.soporte import EstadoTicket, ModuloTicket, SoporteTicket

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/soporte", tags=["soporte"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    modulo: ModuloTicket
    descripcion: str
    captura_url: Optional[str] = None
    urgente: bool = False
    url_origen: Optional[str] = None
    browser_info: Optional[str] = None


class TicketUpdate(BaseModel):
    estado: Optional[EstadoTicket] = None
    nota_interna: Optional[str] = None


class TicketOut(BaseModel):
    id: str
    numero: int
    tenant_id: str
    user_id: str
    modulo: ModuloTicket
    descripcion: str
    captura_url: Optional[str] = None
    urgente: bool
    estado: EstadoTicket
    url_origen: Optional[str] = None
    browser_info: Optional[str] = None
    nota_interna: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}

    def model_post_init(self, __context):
        # Serializar datetime a string ISO
        pass


class TicketOutFull(TicketOut):
    pass


# ── Upload captura ───────────────────────────────────────────────────────────

@router.post("/upload-captura", response_model=dict)
def upload_captura(db: DbSession, current_user: CurrentUser):
    """
    Genera una presigned PUT URL para subir una captura de pantalla a R2/MinIO.
    Si el storage no está configurado devuelve nulls — el ticket se crea sin captura.
    """
    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
        from app.core.config import settings
        if not settings.R2_ACCESS_KEY_ID or not settings.R2_BUCKET_NAME:
            return {"upload_url": None, "file_key": None, "public_url": None}
        file_key = f"soporte/{current_user['studio_id']}/{uuid.uuid4()}.png"
        endpoint = settings.S3_ENDPOINT_URL or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.R2_BUCKET_NAME, "Key": file_key, "ContentType": "image/png"},
            ExpiresIn=300,
        )
        public_base = settings.S3_PUBLIC_URL or endpoint
        public_url = f"{public_base.rstrip('/')}/{settings.R2_BUCKET_NAME}/{file_key}"
        return {"upload_url": upload_url, "file_key": file_key, "public_url": public_url}
    except Exception:
        return {"upload_url": None, "file_key": None, "public_url": None}


# ── Notificación email al equipo LexCore ─────────────────────────────────────

def _notificar_soporte(ticket: SoporteTicket) -> None:
    try:
        from app.core.config import settings as cfg
        api_key = getattr(cfg, "RESEND_API_KEY", None)
        if not api_key:
            return
        import resend
        resend.api_key = api_key
        urgente_label = " 🔴 URGENTE" if ticket.urgente else ""
        resend.Emails.send({
            "from": "LexCore <noreply@lexcore.app>",
            "to": ["soporte@lexcore.app"],
            "subject": f"[Soporte#{ticket.numero:03d}]{urgente_label} {ticket.modulo.value} — nuevo ticket",
            "html": f"""
                <h2>Nuevo ticket #{ticket.numero:03d}{urgente_label}</h2>
                <p><strong>Módulo:</strong> {ticket.modulo.value}</p>
                <p><strong>Descripción:</strong> {ticket.descripcion}</p>
                <p><strong>Tenant:</strong> {ticket.tenant_id}</p>
                <p><strong>URL origen:</strong> {ticket.url_origen or '—'}</p>
                <p><strong>Browser:</strong> {ticket.browser_info or '—'}</p>
                {"<p><strong>Captura:</strong> <a href='" + ticket.captura_url + "'>ver imagen</a></p>" if ticket.captura_url else ""}
            """,
        })
    except Exception as e:
        logger.warning("Email soporte no enviado: %s", e)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/tickets", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_ticket(body: TicketCreate, db: DbSession, current_user: CurrentUser):
    ticket = SoporteTicket(
        tenant_id=current_user["studio_id"],
        user_id=current_user["sub"],
        modulo=body.modulo,
        descripcion=body.descripcion,
        captura_url=body.captura_url,
        urgente=body.urgente,
        url_origen=body.url_origen,
        browser_info=body.browser_info,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    _notificar_soporte(ticket)
    return {"id": ticket.id, "numero": ticket.numero}


@router.get("/tickets", response_model=List[dict])
def listar_tickets_tenant(
    db: DbSession,
    current_user: CurrentUser,
    estado: Optional[EstadoTicket] = Query(None),
):
    """Tickets del propio estudio — para que el admin vea sus reportes."""
    if current_user.get("role") not in ("admin", "socio"):
        raise HTTPException(status_code=403, detail="Solo admin o socio")
    q = db.query(SoporteTicket).filter(SoporteTicket.tenant_id == current_user["studio_id"])
    if estado:
        q = q.filter(SoporteTicket.estado == estado)
    tickets = q.order_by(SoporteTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "numero": t.numero,
            "modulo": t.modulo.value,
            "descripcion": t.descripcion[:120] + ("…" if len(t.descripcion) > 120 else ""),
            "urgente": t.urgente,
            "estado": t.estado.value,
            "created_at": t.created_at.isoformat(),
        }
        for t in tickets
    ]


@router.get("/admin/tickets", response_model=List[dict])
def listar_todos_tickets(
    db: DbSession,
    current_user: CurrentUser,
    estado: Optional[EstadoTicket] = Query(None),
    modulo: Optional[ModuloTicket] = Query(None),
    urgente: Optional[bool] = Query(None),
):
    """Panel superadmin LexCore — todos los tickets de todos los tenants."""
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso restringido")
    q = db.query(SoporteTicket)
    if estado:
        q = q.filter(SoporteTicket.estado == estado)
    if modulo:
        q = q.filter(SoporteTicket.modulo == modulo)
    if urgente is not None:
        q = q.filter(SoporteTicket.urgente == urgente)
    tickets = q.order_by(SoporteTicket.urgente.desc(), SoporteTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "numero": t.numero,
            "tenant_id": t.tenant_id,
            "user_id": t.user_id,
            "modulo": t.modulo.value,
            "descripcion": t.descripcion,
            "captura_url": t.captura_url,
            "urgente": t.urgente,
            "estado": t.estado.value,
            "url_origen": t.url_origen,
            "browser_info": t.browser_info,
            "nota_interna": t.nota_interna,
            "created_at": t.created_at.isoformat(),
        }
        for t in tickets
    ]


@router.patch("/tickets/{ticket_id}", response_model=dict)
def actualizar_ticket(
    ticket_id: str,
    body: TicketUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Admin del estudio puede ver/comentar sus tickets. Superadmin puede gestionar todos."""
    role = current_user.get("role")
    ticket = db.query(SoporteTicket).filter(SoporteTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    # Admin del estudio solo puede ver sus propios tickets
    if role != "superadmin" and ticket.tenant_id != current_user["studio_id"]:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if role not in ("admin", "socio", "superadmin"):
        raise HTTPException(status_code=403, detail="Sin permisos")

    if body.estado is not None:
        ticket.estado = body.estado
    if body.nota_interna is not None:
        ticket.nota_interna = body.nota_interna
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "estado": ticket.estado.value}
