# Backward compat — importar desde expediente.py
from app.schemas.expediente import MovimientoCreate as VencimientoCreate, MovimientoOut as VencimientoOut, MovimientoUpdate as VencimientoUpdate

__all__ = ["VencimientoCreate", "VencimientoOut", "VencimientoUpdate"]
