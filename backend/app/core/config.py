from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas

    # Email (Resend) — vacío en dev, falla silenciosa
    RESEND_API_KEY: str = ""
    BASE_URL: str = "http://localhost:3001"

    # Storage — MinIO (dev local) o Cloudflare R2 (prod)
    # Dev: S3_ENDPOINT_URL=http://minio:9000 (nombre del servicio Docker)
    # Prod: dejar S3_ENDPOINT_URL vacío y completar R2_*
    S3_ENDPOINT_URL: str = ""          # vacío = usar R2 en prod (interno Docker)
    S3_PUBLIC_URL: str = ""            # URL accesible desde el browser (ej: http://localhost:9000)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""         # en dev: user de MinIO (minioadmin)
    R2_SECRET_ACCESS_KEY: str = ""     # en dev: pass de MinIO (minioadmin)
    R2_BUCKET_NAME: str = "lexcore-docs"

    # Google Calendar OAuth2 (separado del login)
    GOOGLE_CALENDAR_CLIENT_ID: str = ""
    GOOGLE_CALENDAR_CLIENT_SECRET: str = ""
    GOOGLE_CALENDAR_REDIRECT_URI: str = "http://localhost:3001/api/auth/google-calendar/callback"

    model_config = {"env_file": ".env"}


settings = Settings()
