from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.models.expediente import EstadoExpediente, RolEnExpediente


class AbogadoEnExpedienteOut(BaseModel):
    id: str
    user_id: str
    rol: RolEnExpediente
    full_name: Optional[str] = None   # enriquecido en el router

    model_config = {"from_attributes": True}


class MovimientoCreate(BaseModel):
    texto: str
    fecha_manual: Optional[str] = None  # YYYY-MM-DD override


class MovimientoUpdate(BaseModel):
    texto: Optional[str] = None
    fecha_manual: Optional[str] = None  # YYYY-MM-DD


class MovimientoOut(BaseModel):
    id: str
    expediente_id: str
    user_id: str
    texto: str
    fecha_manual: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpedienteCreate(BaseModel):
    caratula: str
    numero_judicial: Optional[str] = None
    fuero: Optional[str] = None
    juzgado: Optional[str] = None
    localidad: Optional[str] = None
    cliente_id: Optional[str] = None
    abogado_ids: List[str] = []  # user_ids adicionales (el creador siempre es responsable)


class ExpedienteUpdate(BaseModel):
    numero: Optional[str] = None
    numero_judicial: Optional[str] = None
    caratula: Optional[str] = None
    fuero: Optional[str] = None
    juzgado: Optional[str] = None
    localidad: Optional[str] = None
    estado: Optional[EstadoExpediente] = None
    cliente_id: Optional[str] = None


class ExpedienteOut(BaseModel):
    id: str
    tenant_id: str
    numero: str
    numero_judicial: Optional[str] = None
    caratula: str
    fuero: Optional[str] = None
    juzgado: Optional[str] = None
    localidad: Optional[str] = None
    estado: EstadoExpediente
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None   # enriquecido en el router
    created_at: datetime
    updated_at: datetime
    abogados: List[AbogadoEnExpedienteOut] = []

    model_config = {"from_attributes": True}


class AsignarAbogadoRequest(BaseModel):
    user_id: str
    rol: RolEnExpediente = RolEnExpediente.colaborador
