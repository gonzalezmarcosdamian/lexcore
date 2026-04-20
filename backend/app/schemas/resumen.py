from datetime import datetime
from pydantic import BaseModel


class ResumenOut(BaseModel):
    id: str
    expediente_id: str
    contenido: str
    generado_en: datetime
    desactualizado: bool  # version_contexto > version_resumen
    regeneraciones_hoy: int

    model_config = {"from_attributes": True}


class ResumenStatus(BaseModel):
    tiene_resumen: bool
    desactualizado: bool
    regeneraciones_hoy: int
    limite_diario: int = 5
