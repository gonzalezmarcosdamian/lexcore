from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    expediente_id: Optional[str] = None
    tarea_id: Optional[str] = None
    vencimiento_id: Optional[str] = None
    nombre: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., min_length=1)
    size_bytes: int = Field(..., gt=0, le=50 * 1024 * 1024)  # máx 50MB
    descripcion: Optional[str] = None


class UploadUrlResponse(BaseModel):
    upload_url: str
    file_key: str


class DocumentoCreate(BaseModel):
    expediente_id: Optional[str] = None
    tarea_id: Optional[str] = None
    vencimiento_id: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    file_key: str
    size_bytes: int
    content_type: str


class DocumentoOut(BaseModel):
    id: str
    expediente_id: Optional[str] = None
    tarea_id: Optional[str] = None
    vencimiento_id: Optional[str] = None
    nombre: str
    label: Optional[str] = None
    descripcion: Optional[str]
    file_key: str
    size_bytes: int
    content_type: str
    uploaded_by: str
    orden: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentoUpdate(BaseModel):
    label: Optional[str] = None
    orden: Optional[int] = None


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in_seconds: int = 900  # 15 minutos
