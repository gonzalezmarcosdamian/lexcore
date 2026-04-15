# LexCore — Decisiones Técnicas y Aprendizajes

> Cada decisión técnica no obvia se registra acá con su razón.
> Esto permite entender "por qué" cuando el código no lo hace obvio.

---

## 2026-04-15

### JWT propio en lugar de Supabase en dev
**Decisión:** Usar PyJWT con HS256 en dev. Supabase en prod cuando llegue el MVP.
**Razón:** Supabase consume cuota aunque no se use. El contrato del JWT (claims `studio_id`, `role`, `sub`) es idéntico — el swap es cambiar issuer y clave pública, sin tocar endpoints ni frontend.
**Archivo clave:** `backend/app/core/auth.py`

### Puerto frontend en 3001
**Decisión:** Mapear `3001:3000` en Docker Compose.
**Razón:** Puerto 3000 ocupado por otro proyecto en la misma máquina.
**Impacto:** `NEXT_PUBLIC_API_URL` y CORS apuntan a `localhost:8000`. Sin cambios requeridos en lógica.

### Google OAuth — NextAuth.js, no Supabase
**Decisión:** Usar NextAuth.js con Google Provider para auth social. No Supabase.
**Razón:** Corre 100% local sin cuota externa. Genera JWT compatible con backend FastAPI. Permite pedir scope `calendar.events` en el mismo login para Calendar push.
**Prerequisito bloqueante:** Proyecto en Google Cloud Console con OAuth 2.0 Client ID + Secret.
**Impacto en modelo:** agregar `auth_provider` (enum: email/google) y `google_refresh_token` (nullable) en tabla `users` desde el inicio.
**Historia:** AUTH-004 (bloqueada hasta tener credenciales).

### Google Calendar push para vencimientos
**Decisión:** Cuando se crea/edita/elimina un vencimiento, el backend pushea a Google Calendar de cada usuario vinculado al expediente.
**Razón:** Elimina la necesidad de un sistema de notificaciones propio. Usa infraestructura que el abogado ya usa.
**Wording diferenciado por rol:** admin/socio (supervisión), asociado (acción requerida), pasante (informativo).
**Recordatorios:** 7 días, 48hs, 2hs.
**Dependencia:** Requiere AUTH-004 (token OAuth de Google guardado en DB).
**Historia:** VCT-001.

### pydantic[email] obligatorio
**Decisión:** Usar `pydantic[email]` en requirements.txt, no `pydantic` solo.
**Razón:** `EmailStr` de Pydantic requiere `email-validator` instalado. Sin el extra, el backend falla al arrancar.
