from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_

from app.core.deps import CurrentUser, DbSession
from app.models.cliente import Cliente
from app.models.expediente import Expediente
from app.models.honorario import Honorario, Moneda
from app.models.gasto import Ingreso
from app.models.base import utcnow
from app.schemas.cliente import ClienteCreate, ClienteOut, ClienteUpdate
from app.schemas.honorario import HonorarioOut
from app.schemas.ingreso import IngresoOut


# ── Schemas cuenta corriente ──────────────────────────────────────────────────

class TotalesMoneda(BaseModel):
    acordado: Decimal = Decimal("0")
    cobrado: Decimal = Decimal("0")
    saldo: Decimal = Decimal("0")

class TotalesBimoneda(BaseModel):
    ARS: TotalesMoneda = TotalesMoneda()
    USD: TotalesMoneda = TotalesMoneda()

class ExpedienteCuentaOut(BaseModel):
    id: str
    numero: str
    caratula: str
    estado: str
    honorarios: List[HonorarioOut]
    ingresos: List[IngresoOut]
    totales: TotalesBimoneda

class CuentaCorrienteOut(BaseModel):
    expedientes: List[ExpedienteCuentaOut]
    ingresos_directos: List[IngresoOut]
    totales_globales: TotalesBimoneda

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=List[ClienteOut])
def listar_clientes(
    db: DbSession,
    current_user: CurrentUser,
    q: Optional[str] = Query(None, description="Buscar por nombre o cuit_dni"),
    archivado: bool = Query(False),
):
    tenant_id = current_user["studio_id"]
    query = db.query(Cliente).filter(
        Cliente.tenant_id == tenant_id,
        Cliente.archivado == archivado,
    )
    if q:
        query = query.filter(
            or_(
                Cliente.nombre.ilike(f"%{q}%"),
                Cliente.cuit_dni.ilike(f"%{q}%"),
                Cliente.dni.ilike(f"%{q}%"),
                Cliente.cuit.ilike(f"%{q}%"),
            )
        )
    return query.order_by(Cliente.nombre).all()


def _check_documento_duplicado(db, tenant_id: str, dni: str | None, cuit: str | None, excluir_id: str | None = None):
    """Lanza 422 si ya existe un cliente activo con el mismo DNI o CUIT en el tenant."""
    if dni:
        q = db.query(Cliente).filter(
            Cliente.tenant_id == tenant_id,
            Cliente.archivado == False,  # noqa: E712
            Cliente.dni == dni,
        )
        if excluir_id:
            q = q.filter(Cliente.id != excluir_id)
        if q.first():
            raise HTTPException(status_code=422, detail=f"Ya existe un cliente activo con DNI {dni}")
    if cuit:
        q = db.query(Cliente).filter(
            Cliente.tenant_id == tenant_id,
            Cliente.archivado == False,  # noqa: E712
            Cliente.cuit == cuit,
        )
        if excluir_id:
            q = q.filter(Cliente.id != excluir_id)
        if q.first():
            raise HTTPException(status_code=422, detail=f"Ya existe un cliente activo con CUIT {cuit}")


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    body: ClienteCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    _check_documento_duplicado(db, tenant_id, body.dni, body.cuit)
    cliente = Cliente(
        tenant_id=tenant_id,
        **body.model_dump(),
        archivado=False,
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}", response_model=ClienteOut)
def obtener_cliente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.patch("/{cliente_id}", response_model=ClienteOut)
def actualizar_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    data = body.model_dump(exclude_unset=True)
    _check_documento_duplicado(
        db, tenant_id,
        dni=data.get("dni"),
        cuit=data.get("cuit"),
        excluir_id=cliente_id,
    )
    for field, value in data.items():
        setattr(cliente, field, value)
    cliente.updated_at = utcnow()
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}/cuenta-corriente", response_model=CuentaCorrienteOut)
def cuenta_corriente_cliente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Cuenta corriente del cliente: honorarios + pagos + ingresos por expediente e ingresos directos."""
    tenant_id = current_user["studio_id"]

    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id, Cliente.tenant_id == tenant_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Expedientes donde este cliente es principal o está en la junction
    from app.models.expediente import ExpedienteCliente
    ids_principal = [
        e.id for e in db.query(Expediente).filter(
            Expediente.cliente_id == cliente_id,
            Expediente.tenant_id == tenant_id,
        ).all()
    ]
    ids_junction = [
        ec.expediente_id for ec in db.query(ExpedienteCliente).filter(
            ExpedienteCliente.cliente_id == cliente_id,
        ).all()
    ]
    exp_ids = list(set(ids_principal + ids_junction))

    expedientes = db.query(Expediente).filter(
        Expediente.id.in_(exp_ids),
        Expediente.tenant_id == tenant_id,
    ).order_by(Expediente.created_at.desc()).all()

    totales_globales = TotalesBimoneda()
    exps_out = []

    for exp in expedientes:
        honorarios = db.query(Honorario).filter(
            Honorario.expediente_id == exp.id,
            Honorario.tenant_id == tenant_id,
        ).order_by(Honorario.fecha_acuerdo.desc()).all()

        ingresos_exp = db.query(Ingreso).filter(
            Ingreso.expediente_id == exp.id,
            Ingreso.tenant_id == tenant_id,
        ).order_by(Ingreso.fecha.desc()).all()

        totales = TotalesBimoneda()

        for h in honorarios:
            pagos_misma = [p for p in h.pagos if p.moneda == h.moneda]
            cobrado = sum((p.importe for p in pagos_misma), Decimal("0"))
            saldo = max(h.monto_acordado - cobrado, Decimal("0"))
            t = totales.ARS if h.moneda == Moneda.ARS else totales.USD
            t.acordado += h.monto_acordado
            t.cobrado += cobrado
            t.saldo += saldo

        for ing in ingresos_exp:
            t = totales.ARS if ing.moneda == Moneda.ARS else totales.USD
            t.cobrado += ing.monto

        # Acumular globales
        for moneda in ("ARS", "USD"):
            src = getattr(totales, moneda)
            dst = getattr(totales_globales, moneda)
            dst.acordado += src.acordado
            dst.cobrado += src.cobrado
            dst.saldo += src.saldo

        exps_out.append(ExpedienteCuentaOut(
            id=exp.id,
            numero=exp.numero,
            caratula=exp.caratula,
            estado=exp.estado,
            honorarios=[HonorarioOut.from_orm_with_saldo(h) for h in honorarios],
            ingresos=[IngresoOut.model_validate(i) for i in ingresos_exp],
            totales=totales,
        ))

    # Ingresos directos al cliente (sin expediente)
    ingresos_directos = db.query(Ingreso).filter(
        Ingreso.cliente_id == cliente_id,
        Ingreso.expediente_id.is_(None),
        Ingreso.tenant_id == tenant_id,
    ).order_by(Ingreso.fecha.desc()).all()

    for ing in ingresos_directos:
        t = totales_globales.ARS if ing.moneda == Moneda.ARS else totales_globales.USD
        t.cobrado += ing.monto

    return CuentaCorrienteOut(
        expedientes=exps_out,
        ingresos_directos=[IngresoOut.model_validate(i) for i in ingresos_directos],
        totales_globales=totales_globales,
    )


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def archivar_cliente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Archiva el cliente (soft delete)."""
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cliente.archivado = True
    cliente.updated_at = utcnow()
    db.commit()


@router.delete("/{cliente_id}/eliminar", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cliente_permanente(
    cliente_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Elimina el cliente permanentemente. Desvincula expedientes (cliente_id → NULL)."""
    tenant_id = current_user["studio_id"]
    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Desvincular expedientes: set cliente_id = NULL en lugar de cascade delete
    db.query(Expediente).filter(
        Expediente.tenant_id == tenant_id,
        Expediente.cliente_id == cliente_id,
    ).update({"cliente_id": None}, synchronize_session=False)

    db.delete(cliente)
    db.commit()
