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

## 2026-04-20 (despliegue)

### Vercel buildea desde el repo de GitHub, no desde el CLI local
**Decisión:** `vercel.json` en la raíz con `{"rootDirectory": "frontend"}` es obligatorio.
**Razón:** Sin él, Vercel busca `pages/` o `app/` en la raíz del repo y falla con "Couldn't find any pages or app directory". El CLI local funciona porque lo corrés desde `frontend/`, pero el webhook de GitHub usa la raíz.
**Fix aplicado:** `vercel.json` commiteado en raíz + `rootDirectory` seteado via API.

### Archivos sin committear rompen el build de Vercel
**Decisión:** Todo archivo en `frontend/src/` o `backend/app/` que sea importado por otro archivo **debe estar en git**.
**Razón:** El CLI local tiene acceso al filesystem completo. Vercel buildea solo desde el contenido del repo en GitHub — si un import apunta a un archivo no trackeado, falla con "Module not found".
**Regla:** Antes de cada push, verificar `git status` — si hay `??` en `frontend/src/` o `backend/app/`, commitear o confirmar que no son importados.
**Automatización:** Hook `pre-push` instalado en `.git/hooks/pre-push` — avisa si hay untracked en esas carpetas.

### Vercel no auto-deploya sin GitHub integration configurada
**Decisión:** Los deploys se disparan via API REST de Vercel (no webhook automático ni CLI).
**Razón:** El repo de GitHub no tenía webhooks configurados. El CLI de Vercel se colgaba en el upload por timeout de red.
**Workaround actual:** `POST /v13/deployments` con `gitSource.type=github` + token personal.
**Fix permanente pendiente:** Configurar Git Integration desde vercel.com/settings/git para auto-deploy en push a master.

## 2026-04-20

### Multi-tenant con usuarios compartidos entre estudios
**Decisión:** Un usuario puede pertenecer a múltiples tenants — cada fila en `users` está vinculada a un `tenant_id`. El mismo email puede tener N filas en la tabla.
**Razón:** Un abogado puede trabajar en varios estudios simultáneamente. Las invitaciones crean filas nuevas por tenant.
**Implicación:** Al aceptar la segunda invitación, no se crea contraseña nueva — el backend copia el `hashed_password` de la fila existente vía `POST /auth/join-studio`.
**Limitación conocida:** Un usuario no puede "migrar" su email a un estudio propio sin soporte CX (queda para roadmap).

### Railway — forzar redeploy cuando GitHub auto-deploy no triggered
**Decisión:** Usar `railway up --detach` desde el directorio del servicio.
**Razón:** El webhook de GitHub a Railway a veces no dispara (rate limit, timeout, branch filter). `railway up` sube el build directamente sin depender del webhook.
**Prerequisito:** `railway service link <nombre>` antes de correr el comando.

### Admin API protegida por API Key (no JWT)
**Decisión:** Endpoints `/admin/*` usan `X-Admin-Key` header con `secrets.compare_digest`.
**Razón:** El admin no tiene un usuario en el sistema — es soporte externo que necesita corregir datos. JWT requeriría un usuario con rol especial en cada tenant. La API key se setea como variable de entorno y se comparte solo entre devs.
**Archivo clave:** `backend/app/routers/admin.py`

### Filtros de período en cliente, no en servidor
**Decisión:** Dashboard y Agenda fetchean datos amplios (365 días) y filtran en el cliente con `inRange()`.
**Razón:** Evita round-trips al cambiar el período — la UX es instantánea. Aceptable para volumen de un estudio (cientos, no millones de registros).
**Límite:** Si un estudio tiene miles de vencimientos históricos, habría que paginar en servidor. Queda para escalar.

### Número de expediente autogenerado por el sistema
**Decisión:** El campo `numero` en `Expediente` no lo ingresa el usuario — lo genera el backend con formato `EXP-{año}-{correlativo 4 dígitos por tenant}`.
**Razón:** Reducir fricción en creación (el abogado no sabe el correlativo), garantizar formato consistente entre estudios, y evitar duplicados por error humano.
**Implementación:** `_generar_numero(db, tenant_id)` cuenta los expedientes del tenant y genera el siguiente. Si en el futuro se quiere permitir el número judicial real, se puede agregar un campo `numero_judicial` opcional separado.
**Archivo clave:** `backend/app/routers/expedientes.py`

### Vencimientos y Tareas son entidades ortogonales
**Decisión:** No hay FK entre `Vencimiento` y `Tarea`. Son modelos independientes que comparten `expediente_id`.
**Razón:** Conceptualmente distintos: un vencimiento es un plazo procesal del expediente (audiencia, plazo, notificación) — existe independientemente del equipo. Una tarea es trabajo interno del estudio (redactar un escrito, llamar al cliente) — existe independientemente del proceso judicial. Forzar una FK sería modelar mal el dominio.
**Futuro:** Si se quiere relacionar "esta tarea nació de este vencimiento", se agrega `vencimiento_id: Optional[str]` en `Tarea` como FK nullable — no requiere cambios en la lógica existente.

### Estado inicial de expediente siempre "activo"
**Decisión:** `ExpedienteCreate` no acepta `estado`. El router lo fija en `activo` al crear.
**Razón:** Un expediente que recién nace siempre está activo. Elegir el estado al crear era ruido innecesario en el formulario.
**Impacto:** `ExpedienteUpdate` sí permite cambiar el estado (para archivar o cerrar más adelante).

### pydantic[email] obligatorio
**Decisión:** Usar `pydantic[email]` en requirements.txt, no `pydantic` solo.
**Razón:** `EmailStr` de Pydantic requiere `email-validator` instalado. Sin el extra, el backend falla al arrancar.
