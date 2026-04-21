from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.cliente import TipoCliente


class ClienteCreate(BaseModel):
    nombre: str
    tipo: TipoCliente
    cuit_dni: Optional[str] = None  # legacy
    dni: Optional[str] = None
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    domicilio: Optional[str] = None
    domicilio_lat: Optional[float] = None
    domicilio_lng: Optional[float] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoCliente] = None
    cuit_dni: Optional[str] = None  # legacy
    dni: Optional[str] = None
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    archivado: Optional[bool] = None
    domicilio: Optional[str] = None
    domicilio_lat: Optional[float] = None
    domicilio_lng: Optional[float] = None


class ClienteOut(BaseModel):
    id: str
    tenant_id: str
    nombre: str
    tipo: TipoCliente
    cuit_dni: Optional[str] = None  # legacy
    dni: Optional[str] = None
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    domicilio: Optional[str] = None
    domicilio_lat: Optional[float] = None
    domicilio_lng: Optional[float] = None
    archivado: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
