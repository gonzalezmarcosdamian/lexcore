from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.cliente import TipoCliente


class ClienteCreate(BaseModel):
    nombre: str
    tipo: TipoCliente
    cuit_dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoCliente] = None
    cuit_dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    archivado: Optional[bool] = None


class ClienteOut(BaseModel):
    id: str
    tenant_id: str
    nombre: str
    tipo: TipoCliente
    cuit_dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    archivado: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
