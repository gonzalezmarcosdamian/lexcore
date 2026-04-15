"""
Servicio de object storage via Cloudflare R2 (API compatible con S3).
Si las credenciales no están configuradas, las operaciones fallan con StorageNotConfigured.
"""
import logging
import uuid

logger = logging.getLogger(__name__)

PRESIGNED_EXPIRY = 15 * 60      # 15 minutos para upload y download
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class StorageNotConfigured(Exception):
    pass


def _client():
    """
    Crea un cliente boto3.
    - Dev local: apunta a MinIO (S3_ENDPOINT_URL configurado)
    - Prod: apunta a Cloudflare R2
    """
    from app.core.config import settings

    # MinIO local — tiene prioridad si S3_ENDPOINT_URL está definido
    if settings.S3_ENDPOINT_URL:
        import boto3
        return boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID or "minioadmin",
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY or "minioadmin",
            region_name="us-east-1",
        )

    # Cloudflare R2 — requiere credenciales reales
    if not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY or not settings.R2_ACCOUNT_ID:
        raise StorageNotConfigured(
            "Storage no configurado. En dev: definí S3_ENDPOINT_URL=http://minio:9000. "
            "En prod: definí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY."
        )

    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _public_url(url: str) -> str:
    """
    Reescribe la URL interna de Docker (minio:9000) por la URL pública accesible
    desde el browser (localhost:9000 en dev, vacío en prod = ya es pública).
    """
    from app.core.config import settings
    if settings.S3_PUBLIC_URL and settings.S3_ENDPOINT_URL:
        return url.replace(settings.S3_ENDPOINT_URL, settings.S3_PUBLIC_URL, 1)
    return url


def generate_upload_url(tenant_id: str, expediente_id: str, filename: str, content_type: str) -> tuple[str, str]:
    """
    Genera una presigned URL para subir un archivo directamente a R2/MinIO.
    Retorna (upload_url_publica, file_key).
    """
    from app.core.config import settings
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    file_key = f"{tenant_id}/{expediente_id}/{uuid.uuid4()}.{ext}"

    client = _client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGNED_EXPIRY,
    )
    return _public_url(url), file_key


def generate_download_url(file_key: str, filename: str) -> str:
    """
    Genera una presigned URL de descarga (expira 15 min).
    """
    from app.core.config import settings
    client = _client()
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": file_key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=PRESIGNED_EXPIRY,
    )
    return _public_url(url)


def delete_object(file_key: str) -> None:
    """Elimina un archivo de R2. No lanza excepción si el archivo no existe."""
    from app.core.config import settings
    try:
        client = _client()
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=file_key)
    except Exception as e:
        logger.warning(f"Error eliminando {file_key} de R2: {e}")
