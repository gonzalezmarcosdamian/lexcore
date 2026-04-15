from decimal import Decimal
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, field_validator

from app.models.honorario import Moneda


# ── Pago ──────────────────────────────────────────────────────────────────────

class PagoCreate(BaseModel):
    importe: Decimal
    moneda: Moneda = Moneda.ARS
    fecha: str  # YYYY-MM-DD
    comprobante: Optional[str] = None

    @field_validator("importe")
    @classmethod
    def importe_positivo(cls, v):
        if v <= 0:
            raise ValueError("El importe debe ser mayor a cero")
        return v


class PagoOut(BaseModel):
    id: str
    honorario_id: str
    importe: Decimal
    moneda: Moneda
    fecha: str
    comprobante: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Honorario ─────────────────────────────────────────────────────────────────

class HonorarioCreate(BaseModel):
    expediente_id: str
    concepto: str
    monto_acordado: Decimal
    moneda: Moneda = Moneda.ARS
    fecha_acuerdo: str  # YYYY-MM-DD
    notas: Optional[str] = None

    @field_validator("monto_acordado")
    @classmethod
    def monto_positivo(cls, v):
        if v <= 0:
            raise ValueError("El monto acordado debe ser mayor a cero")
        return v


class HonorarioUpdate(BaseModel):
    concepto: Optional[str] = None
    monto_acordado: Optional[Decimal] = None
    moneda: Optional[Moneda] = None
    fecha_acuerdo: Optional[str] = None
    notas: Optional[str] = None


class HonorarioOut(BaseModel):
    id: str
    tenant_id: str
    expediente_id: str
    concepto: str
    monto_acordado: Decimal
    moneda: Moneda
    fecha_acuerdo: str
    notas: Optional[str] = None
    pagos: list[PagoOut] = []
    # Calculado
    total_pagado: Decimal = Decimal("0")
    saldo_pendiente: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_saldo(cls, obj) -> "HonorarioOut":
        pagos_misma_moneda = [p for p in obj.pagos if p.moneda == obj.moneda]
        total_pagado = sum((p.importe for p in pagos_misma_moneda), Decimal("0"))
        saldo = obj.monto_acordado - total_pagado
        data = cls.model_validate(obj)
        data.total_pagado = total_pagado
        data.saldo_pendiente = saldo
        return data


# ── Dashboard summary ─────────────────────────────────────────────────────────

class HonorarioResumen(BaseModel):
    """Resumen de honorarios para el dashboard."""
    total_acordado_ars: Decimal = Decimal("0")
    total_acordado_usd: Decimal = Decimal("0")
    total_cobrado_ars: Decimal = Decimal("0")
    total_cobrado_usd: Decimal = Decimal("0")
    saldo_pendiente_ars: Decimal = Decimal("0")
    saldo_pendiente_usd: Decimal = Decimal("0")
    expedientes_con_deuda: int = 0
