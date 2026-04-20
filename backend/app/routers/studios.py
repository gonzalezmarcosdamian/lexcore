"""
Router del estudio (tenant).
GET  /studios/me               — datos del estudio actual
PATCH /studios/me              — actualizar perfil del estudio
POST  /studios/me/whatsapp     — configurar WhatsApp Business
DELETE /studios/me/whatsapp    — desconectar WhatsApp
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.studio import Studio

router = APIRouter(prefix="/studios", tags=["studios"])


class StudioOut(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email_contacto: str | None = None
    whatsapp_phone_id: str | None = None
    whatsapp_active: bool = False

    model_config = {"from_attributes": True}


class StudioUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email_contacto: str | None = None


class WhatsAppConfig(BaseModel):
    phone_id: str
    token: str
    verify_token: str


def _get_studio_or_404(db, studio_id: str) -> Studio:
    studio = db.query(Studio).filter(Studio.id == studio_id).first()
    if not studio:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return studio


@router.get("/me", response_model=StudioOut)
def get_studio(db: DbSession, current_user: CurrentUser):
    return _get_studio_or_404(db, current_user["studio_id"])


@router.patch("/me", response_model=StudioOut)
def update_studio(body: StudioUpdate, db: DbSession, current_user: CurrentUser):
    if current_user.get("role") not in ("admin", "socio"):
        raise HTTPException(status_code=403, detail="Solo admin o socio puede editar el estudio")
    studio = _get_studio_or_404(db, current_user["studio_id"])
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(studio, field, value)
    db.commit()
    db.refresh(studio)
    return studio


@router.post("/me/whatsapp", response_model=StudioOut)
def configure_whatsapp(body: WhatsAppConfig, db: DbSession, current_user: CurrentUser):
    """Guarda las credenciales de WhatsApp Business y activa el bot."""
    if current_user.get("role") not in ("admin", "socio"):
        raise HTTPException(status_code=403, detail="Solo admin o socio puede configurar WhatsApp")
    studio = _get_studio_or_404(db, current_user["studio_id"])
    studio.whatsapp_phone_id = body.phone_id
    studio.whatsapp_token = body.token
    studio.whatsapp_verify_token = body.verify_token
    studio.whatsapp_active = True
    db.commit()
    db.refresh(studio)
    return studio


@router.delete("/me/whatsapp", status_code=204)
def disconnect_whatsapp(db: DbSession, current_user: CurrentUser):
    """Desconecta WhatsApp y borra las credenciales."""
    if current_user.get("role") not in ("admin", "socio"):
        raise HTTPException(status_code=403, detail="Solo admin o socio puede desconectar WhatsApp")
    studio = _get_studio_or_404(db, current_user["studio_id"])
    studio.whatsapp_phone_id = None
    studio.whatsapp_token = None
    studio.whatsapp_verify_token = None
    studio.whatsapp_active = False
    db.commit()
