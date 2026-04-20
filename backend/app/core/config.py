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

    # Storage — Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Endpoints de desarrollo — desactivar en producción
    ALLOW_DEV_ENDPOINTS: bool = False

    # OpenAI — para resúmenes IA de expedientes
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Google Calendar OAuth2 (separado del login)
    GOOGLE_CALENDAR_CLIENT_ID: str = ""
    GOOGLE_CALENDAR_CLIENT_SECRET: str = ""
    GOOGLE_CALENDAR_REDIRECT_URI: str = "http://localhost:3001/api/auth/google-calendar/callback"

    model_config = {"env_file": ".env"}


settings = Settings()
