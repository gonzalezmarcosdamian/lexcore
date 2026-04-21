from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 días

    # Email (Resend) — vacío en dev, falla silenciosa
    RESEND_API_KEY: str = ""
    BASE_URL: str = "http://localhost:3001"

    # Storage — Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Endpoints de desarrollo — desactivar en producción
    ALLOW_DEV_ENDPOINTS: bool = False

    # API key para endpoints de admin/soporte (LexCore internos)
    ADMIN_API_KEY: str = ""

    # OpenAI — para resúmenes IA de expedientes
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Google OAuth — login y Calendar usan el mismo app (las mismas credenciales)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    # Alias para compatibilidad — si no están seteados, caen al GOOGLE_CLIENT_ID/SECRET
    GOOGLE_CALENDAR_CLIENT_ID: str = ""
    GOOGLE_CALENDAR_CLIENT_SECRET: str = ""
    GOOGLE_CALENDAR_REDIRECT_URI: str = "http://localhost:8000/auth/google-calendar/callback"

    @property
    def google_cal_client_id(self) -> str:
        return self.GOOGLE_CALENDAR_CLIENT_ID or self.GOOGLE_CLIENT_ID

    @property
    def google_cal_client_secret(self) -> str:
        return self.GOOGLE_CALENDAR_CLIENT_SECRET or self.GOOGLE_CLIENT_SECRET

    model_config = {"env_file": ".env"}


settings = Settings()
