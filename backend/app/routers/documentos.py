import urllib.parse
from typing import List

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, DbSession
from app.models.documento import Documento
from app.models.expediente import Expediente
from app.schemas.documento import DocumentoOut, DownloadUrlResponse
from app.services.storage import StorageNotConfigured, generate_download_url, delete_object, upload_file

router = APIRouter(prefix="/documentos", tags=["documentos"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_expediente(expediente_id: str, tenant_id: str, db) -> Expediente:
    exp = db.query(Expediente).filter(
        Expediente.id == expediente_id,
        Expediente.tenant_id == tenant_id,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return exp


@router.post("/upload", response_model=DocumentoOut, status_code=status.HTTP_201_CREATED)
async def upload_documento(
    db: DbSession,
    current_user: CurrentUser,
    expediente_id: str = Form(...),
    descripcion: str = Form(""),
    file: UploadFile = File(...),
):
    tenant_id = current_user["studio_id"]
    _get_expediente(expediente_id, tenant_id, db)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 50 MB")

    try:
        _, file_key = upload_file(
            file_bytes=file_bytes,
            tenant_id=tenant_id,
            expediente_id=expediente_id,
            filename=file.filename or "archivo",
            content_type=file.content_type or "application/octet-stream",
        )
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    doc = Documento(
        tenant_id=tenant_id,
        expediente_id=expediente_id,
        nombre=file.filename or "archivo",
        descripcion=descripcion,
        file_key=file_key,
        size_bytes=len(file_bytes),
        content_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user["sub"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=List[DocumentoOut])
def listar_documentos(expediente_id: str, db: DbSession, current_user: CurrentUser):
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
def get_download_url(documento_id: str, db: DbSession, current_user: CurrentUser, attachment: bool = True):
    tenant_id = current_user["studio_id"]
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    try:
        url = generate_download_url(file_key=doc.file_key, filename=doc.nombre, force_attachment=attachment)
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    return DownloadUrlResponse(download_url=url)


@router.get("/{documento_id}/content")
async def stream_documento(documento_id: str, db: DbSession, current_user: CurrentUser, inline: bool = True):
    """Proxy endpoint: fetches from Cloudinary server-side, streams back to browser.
    Avoids CORS and X-Frame-Options issues. inline=True for preview, False for download."""
    tenant_id = current_user["studio_id"]
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == tenant_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    try:
        signed_url = generate_download_url(file_key=doc.file_key, filename=doc.nombre, force_attachment=False)
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))

    async def _stream():
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", signed_url) as resp:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk

    disposition = "inline" if inline else f"attachment; filename*=UTF-8''{urllib.parse.quote(doc.nombre)}"
    return StreamingResponse(
        _stream(),
        media_type=doc.content_type,
        headers={"Content-Disposition": disposition},
    )


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_documento(documento_id: str, db: DbSession, current_user: CurrentUser):
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
