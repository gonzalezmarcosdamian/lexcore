from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class VencimientoCreate(BaseModel):
    descripcion: str
    fecha: str  # YYYY-MM-DD
    hora: Optional[str] = None  # HH:MM optional
    tipo: str = "vencimiento"
    expediente_id: str


class VencimientoUpdate(BaseModel):
    descripcion: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo: Optional[str] = None
    cumplido: Optional[bool] = None


class VencimientoOut(BaseModel):
    id: str
    tenant_id: str
    expediente_id: str
    descripcion: str
    fecha: str
    hora: Optional[str] = None
    tipo: str
    cumplido: bool
    google_event_ids: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
