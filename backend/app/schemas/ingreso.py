from datetime import date as _date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models.gasto import IngresoCategoria
from app.models.honorario import Moneda


class IngresoCreate(BaseModel):
    descripcion: str
    categoria: IngresoCategoria
    monto: Decimal
    moneda: Moneda = Moneda.ARS
    fecha: str  # ISO YYYY-MM-DD
    expediente_id: Optional[str] = None
    cliente_id: Optional[str] = None
    notas: Optional[str] = None


class IngresoUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[IngresoCategoria] = None
    monto: Optional[Decimal] = None
    moneda: Optional[Moneda] = None
    fecha: Optional[str] = None
    expediente_id: Optional[str] = None
    cliente_id: Optional[str] = None
    notas: Optional[str] = None


class IngresoOut(BaseModel):
    id: str
    descripcion: str
    categoria: IngresoCategoria
    monto: Decimal
    moneda: Moneda
    fecha: str
    mes: int
    anio: int
    expediente_id: Optional[str] = None
    cliente_id: Optional[str] = None
    notas: Optional[str] = None
    tenant_id: str

    model_config = {"from_attributes": True}


class IngresoResumen(BaseModel):
    total_ars: Decimal = Decimal("0")
    total_usd: Decimal = Decimal("0")
    cantidad: int = 0
