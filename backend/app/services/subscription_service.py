from datetime import datetime, timezone


def _as_aware(dt: datetime) -> datetime:
    """Convierte datetime naive a UTC-aware (SQLite no guarda timezone info)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_studio_access_level(studio) -> str:
    """
    Devuelve "full" o "read_only" según el estado del studio.
    Orden de evaluación: suscripción activa > trial vigente > todo lo demás.
    """
    if studio.subscription_status == "active":
        return "full"
    if studio.trial_ends_at:
        trial_end = _as_aware(studio.trial_ends_at)
        if trial_end > datetime.now(timezone.utc):
            return "full"
    return "read_only"
