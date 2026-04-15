"""
Router de documentos.
Los binarios viven en Cloudflare R2; este router gestiona metadatos y URLs firmadas.

Flujo de upload:
  1. POST /documentos/upload-url  → presigned PUT URL + file_key
  2. Cliente sube el archivo directamente a R2
  3. POST /documentos             → guarda metadata en DB

Flujo de descarga:
  GET /documentos/{id}/download-url → presigned GET URL (expira 15 min)
"""
from typing import List

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DbSession
from app.models.documento import Documento
from app.models.expediente import Expediente
from app.schemas.documento import (
    DocumentoCreate, DocumentoOut, DownloadUrlResponse,
    UploadUrlRequest, UploadUrlResponse,
)
from app.services.storage import StorageNotConfigured, generate_download_url, generate_upload_url, delete_object

router = APIRouter(prefix="/documentos", tags=["documentos"])


def _get_expediente(expediente_id: str, tenant_id: str, db) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


@router.post("/upload-url", response_model=UploadUrlResponse)
def get_upload_url(body: UploadUrlRequest, db: DbSession, current_user: CurrentUser):
    """Genera una presigned URL para subir un archivo directamente a R2."""
    tenant_id = current_user["studio_id"]
    _get_expediente(body.expediente_id, tenant_id, db)

    try:
        upload_url, file_key = generate_upload_url(
            tenant_id=tenant_id,
            expediente_id=body.expediente_id,
            filename=body.nombre,
            content_type=body.content_type,
        )
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    return UploadUrlResponse(upload_url=upload_url, file_key=file_key)


@router.post("", response_model=DocumentoOut, status_code=status.HTTP_201_CREATED)
def crear_documento(body: DocumentoCreate, db: DbSession, current_user: CurrentUser):
    """Guarda los metadatos del documento una vez completado el upload a R2."""
    tenant_id = current_user["studio_id"]
    _get_expediente(body.expediente_id, tenant_id, db)

    doc = Documento(
        tenant_id=tenant_id,
        expediente_id=body.expediente_id,
        nombre=body.nombre,
        descripcion=body.descripcion,
        file_key=body.file_key,
        size_bytes=body.size_bytes,
        content_type=body.content_type,
        uploaded_by=current_user["sub"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=List[DocumentoOut])
def listar_documentos(expediente_id: str, db: DbSession, current_user: CurrentUser):
    """Lista los documentos de un expediente."""
    tenant_id = current_user["studio_id"]
    _get_expediente(expediente_id, tenant_id, db)

    return (
        db.query(Documento)
        .filter(
            Documento.expediente_id == expediente_id,
            Documento.tenant_id == tenant_id,
        )
        .order_by(Documento.created_at.desc())
        .all()
    )


@router.get("/{documento_id}/download-url", response_model=DownloadUrlResponse)
def get_download_url(documento_id: str, db: DbSession, current_user: CurrentUser):
    """Genera una presigned URL de descarga (expira en 15 minutos)."""
    tenant_id = current_user["studio_id"]
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    try:
        url = generate_download_url(file_key=doc.file_key, filename=doc.nombre)
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    return DownloadUrlResponse(download_url=url)


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_documento(documento_id: str, db: DbSession, current_user: CurrentUser):
    """Elimina el documento de R2 y su metadata de la DB."""
    tenant_id = current_user["studio_id"]
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    delete_object(doc.file_key)
    db.delete(doc)
    db.commit()
