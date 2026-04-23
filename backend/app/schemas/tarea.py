from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.tarea import TareaEstado, TareaTipo


class TareaCreate(BaseModel):
    expediente_id: Optional[str] = None
    cliente_id: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    responsable_id: Optional[str] = None
    tipo: TareaTipo = TareaTipo.judicial
    fecha_limite: Optional[str] = None  # YYYY-MM-DD
    hora: Optional[str] = None  # HH:MM
    estado: TareaEstado = TareaEstado.pendiente
    flag_paralizado: bool = False

    @field_validator("titulo")
    @classmethod
    def titulo_no_vacio(cls, v):
        if not v.strip():
            raise ValueError("El título no puede estar vacío")
        return v.strip()


class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    cliente_id: Optional[str] = None
    descripcion: Optional[str] = None
    responsable_id: Optional[str] = None
    tipo: Optional[TareaTipo] = None
    fecha_limite: Optional[str] = None
    hora: Optional[str] = None
    estado: Optional[TareaEstado] = None
    flag_paralizado: Optional[bool] = None


class TareaOut(BaseModel):
    id: str
    tenant_id: str
    expediente_id: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    responsable_id: Optional[str] = None
    responsable_nombre: Optional[str] = None  # enriquecido en router
    tipo: TareaTipo = TareaTipo.judicial
    fecha_limite: Optional[str] = None
    hora: Optional[str] = None
    estado: TareaEstado
    flag_paralizado: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
