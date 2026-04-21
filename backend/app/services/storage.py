"""
Servicio de object storage via Cloudinary.
Archivos almacenados como "authenticated" — requieren URL firmada para acceder.
"""
import logging
import time
import uuid

logger = logging.getLogger(__name__)
SIGNED_URL_EXPIRY = 15 * 60  # 15 minutos


class StorageNotConfigured(Exception):
    pass


def _configure():
    from app.core.config import settings
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise StorageNotConfigured(
            "Cloudinary no configurado. Definí CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET."
        )
    import cloudinary
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_file(file_bytes: bytes, tenant_id: str, expediente_id: str, filename: str, content_type: str) -> tuple[str, str]:
    _configure()
    import cloudinary.uploader
    public_id = f"lexcore/{tenant_id}/{expediente_id}/{uuid.uuid4()}"
    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=public_id,
        resource_type="raw",
        type="authenticated",
    )
    return result["secure_url"], result["public_id"]


def generate_download_url(file_key: str, filename: str, force_attachment: bool = True) -> str:
    _configure()
    import cloudinary.utils
    kwargs: dict = dict(
        resource_type="raw",
        type="authenticated",
        sign_url=True,
        expires_at=int(time.time()) + SIGNED_URL_EXPIRY,
    )
    if force_attachment:
        kwargs["attachment"] = filename
    url, _ = cloudinary.utils.cloudinary_url(file_key, **kwargs)
    return url


def delete_object(file_key: str) -> None:
    try:
        _configure()
        import cloudinary.uploader
        cloudinary.uploader.destroy(file_key, resource_type="raw", type="authenticated")
    except Exception as e:
        logger.warning(f"Error eliminando {file_key} de Cloudinary: {e}")
