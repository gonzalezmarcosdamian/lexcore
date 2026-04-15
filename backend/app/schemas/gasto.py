from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models.gasto import GastoCategoria, GastoEstado
from app.models.honorario import Moneda


class GastoCreate(BaseModel):
    descripcion: str
    categoria: GastoCategoria
    monto: Decimal
    moneda: Moneda = Moneda.ARS
    fecha: str  # ISO date YYYY-MM-DD
    expediente_id: Optional[str] = None
    notas: Optional[str] = None


class GastoUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[GastoCategoria] = None
    monto: Optional[Decimal] = None
    moneda: Optional[Moneda] = None
    fecha: Optional[str] = None
    expediente_id: Optional[str] = None
    notas: Optional[str] = None


class GastoOut(BaseModel):
    id: str
    descripcion: str
    categoria: GastoCategoria
    monto: Decimal
    moneda: Moneda
    fecha: str
    mes: int
    anio: int
    estado: GastoEstado
    expediente_id: Optional[str] = None
    plantilla_id: Optional[str] = None
    notas: Optional[str] = None
    tenant_id: str

    model_config = {"from_attributes": True}


class GastoResumen(BaseModel):
    total_ars: Decimal = Decimal("0")
    total_usd: Decimal = Decimal("0")
    cantidad: int = 0
