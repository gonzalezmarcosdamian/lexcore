from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.models.expediente import EstadoExpediente, RolEnExpediente


class ClienteMin(BaseModel):
    id: str
    nombre: str
    tipo: str

    model_config = {"from_attributes": True}


class AbogadoEnExpedienteOut(BaseModel):
    id: str
    user_id: str
    rol: RolEnExpediente
    full_name: Optional[str] = None   # enriquecido en el router

    model_config = {"from_attributes": True}


# ── ActoBitacora (legacy — era Movimiento de bitácora libre) ─────────────────

class ActoBitacoraCreate(BaseModel):
    texto: str
    fecha_manual: Optional[str] = None
    hora_acto: Optional[str] = None
    documento_id: Optional[str] = None


class ActoBitacoraUpdate(BaseModel):
    texto: Optional[str] = None
    fecha_manual: Optional[str] = None
    hora_acto: Optional[str] = None
    documento_id: Optional[str] = None


class ActoBitacoraOut(BaseModel):
    id: str
    expediente_id: str
    user_id: str
    texto: str
    fecha_manual: Optional[str] = None
    hora_acto: Optional[str] = None
    documento_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Movimiento (era Vencimiento) ──────────────────────────────────────────────

class MovimientoCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    tipo: str = "vencimiento"
    fecha: str          # YYYY-MM-DD
    hora: Optional[str] = None       # HH:MM
    expediente_id: str
    estado: str = "pendiente"


class MovimientoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    estado: Optional[str] = None


class MovimientoOut(BaseModel):
    id: str
    tenant_id: str
    expediente_id: str
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    fecha: str
    hora: Optional[str] = None
    estado: str
    google_event_ids: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Alias backward compat para routers que aún usen VencimientoCreate/Out
VencimientoCreate = MovimientoCreate
VencimientoOut = MovimientoOut


class ExpedienteCreate(BaseModel):
    caratula: str
    numero_judicial: Optional[str] = None
    fuero: Optional[str] = None
    juzgado: Optional[str] = None
    localidad: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_ids: List[str] = []  # múltiples clientes
    abogado_ids: List[str] = []  # user_ids adicionales (el creador siempre es responsable)


class ExpedienteUpdate(BaseModel):
    numero: Optional[str] = None
    numero_judicial: Optional[str] = None
    caratula: Optional[str] = None
    fuero: Optional[str] = None
    juzgado: Optional[str] = None
    localidad: Optional[str] = None
    estado: Optional[EstadoExpediente] = None
    flag_paralizado: Optional[bool] = None
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
    flag_paralizado: bool = False
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None   # enriquecido en el router
    created_at: datetime
    updated_at: datetime
    abogados: List[AbogadoEnExpedienteOut] = []
    clientes_extra: List[ClienteMin] = []

    model_config = {"from_attributes": True}


class AsignarAbogadoRequest(BaseModel):
    user_id: str
    rol: RolEnExpediente = RolEnExpediente.colaborador
