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

## 2026-04-20 (sesión 006 — Google Calendar + UX)

### Variables de entorno en Vercel: usar `printf`, nunca `echo`
**Decisión:** Toda variable seteada via CLI de Vercel debe usar `printf 'valor' | vercel env add KEY env`.
**Razón:** `echo 'valor' | vercel env add ...` agrega `\n` al final del valor. Esto rompe silenciosamente cosas como `GOOGLE_CLIENT_SECRET` (error `invalid_client` al validar token OAuth) y `NEXTAUTH_URL` (redirección incorrecta).
**Diagnóstico:** `vercel pull && cat .vercel/.env.production.local | cat -A` — los valores afectados terminan con `$` extra (=`\n`).
**Fix:** `vercel env rm KEY production && printf 'valor' | vercel env add KEY production`

### Google Calendar: scope `calendar` vs `calendar.events`
**Decisión:** El scope de Google Calendar en el backend debe ser `https://www.googleapis.com/auth/calendar` (full), no `calendar.events`.
**Razón:** El scope `calendar.events` solo permite CRUD de eventos en un calendario conocido. Para llamar `calendarList().list()` (listar todos los calendarios del usuario) se necesita el scope `calendar` completo.
**Error observado:** `403 insufficientPermissions` al listar calendarios aunque el token era válido y el scope `events` había sido concedido.
**Archivo clave:** `backend/app/routers/google_calendar.py` → `SCOPES`

### Google Calendar: revocar token antes de pedir nuevo scope
**Decisión:** Antes de iniciar el flujo OAuth para agregar un scope nuevo, revocar el refresh_token existente via `POST https://oauth2.googleapis.com/revoke`.
**Razón:** Google no emite un nuevo refresh_token si ya existe uno vigente para el mismo `(client_id, user)`, incluso con `prompt=consent`. El token viejo conserva solo el scope original.
**Implementación:** `_delete_existing_lexcore_events` + `user.google_refresh_token = None` → `db.commit()` antes de generar la URL OAuth.
**Edge case:** Si la revocación falla silenciosamente, el usuario puede quedar sin token — pero el scope connect + `prompt=consent` fuerza que Google emita uno nuevo.

### Google Calendar: deduplicación de eventos con extendedProperties
**Decisión:** Todos los eventos creados por LexCore llevan `extendedProperties.private.lexcore_sync = "1"`. Antes de cada sync, se borran los eventos que tengan esa propiedad.
**Razón:** Sin dedup, cada sync agrega eventos nuevos encima de los anteriores.
**Limitación:** Eventos creados antes de implementar el tag no son detectados por el filtro. Requiere limpieza manual la primera vez.
**API Google:** `service.events().list(calendarId=id, privateExtendedProperty="lexcore_sync=1")`

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

## 2026-04-21

### Backend proxy para documentos Cloudinary
**Decisión:** `GET /documentos/{id}/content?inline=bool` fetchea Cloudinary server-side con httpx y devuelve `StreamingResponse`.
**Razón:** Cloudinary sirve recursos "authenticated" con `X-Frame-Options: DENY` y `fl_attachment` — el browser no puede hacer iframe ni fetch cross-origin. El proxy elimina todas estas restricciones sin cambiar el storage.
**Patrón frontend:** `fetch(proxy_url, {headers: {Authorization}}) → blob() → URL.createObjectURL()` — garantiza nombre correcto en descarga y compatibilidad con iframe.
**Dependencia:** `httpx` en requirements.txt (async HTTP client para Python).
**Archivo clave:** `backend/app/routers/documentos.py` → `stream_documento`

### Enums SQLAlchemy en Dict[str, Any]: usar `.value`, nunca `str()`
**Decisión:** Al meter un enum de SQLAlchemy (`Moneda.ARS`, `TareaEstado.pendiente`) en un dict genérico, usar siempre `.value`.
**Razón:** `str(Moneda.ARS)` devuelve `"Moneda.ARS"`, no `"ARS"`. Pydantic serializa el dict como está — si el valor es `"Moneda.ARS"`, eso es lo que llega al cliente.
**Síntoma:** Frontend recibe `"moneda": "Moneda.ARS"` en lugar de `"ARS"` — rompe la UI silenciosamente.
**Regla:** En schemas Pydantic tipados, los enums se serializan solos. En `Dict[str, Any]`, la serialización es manual.

### `Vencimiento` vive en `app.models.expediente`, no en módulo propio
**Decisión:** `Vencimiento` está definido en `backend/app/models/expediente.py` junto con `Movimiento` y `ExpedienteAbogado`.
**Razón:** Se modeló así en el sprint inicial. No tiene archivo propio.
**Impacto:** Cualquier import `from app.models.vencimiento import Vencimiento` falla con `ModuleNotFoundError`. Importar desde `app.models.expediente`.
**Regla:** Antes de hacer lazy imports en routers, verificar en qué archivo vive el modelo.

### `onCreated` callback para refrescar estado padre desde sub-componentes
**Decisión:** Pasar `onCreated?: () => void` a componentes hijo que crean items (`HonorariosTab`, `TareasSection`, `DocumentosTab`).
**Razón:** El feed de actividad (bitácora) vive en el componente padre. Los hijos no tienen acceso al estado padre. Sin el callback, crear un honorario no actualiza la bitácora.
**Alternativa descartada:** Context/Zustand — overhead innecesario para un feed local.
**Patrón:** `onCreated?.()` inmediatamente después del `await api.post(...)` exitoso.

### Tiempo de vida del expediente: comparar fechas calendario, no milisegundos
**Decisión:** `tiempoVida()` usa `toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })` para obtener `"YYYY-MM-DD"` en ART y compara fechas enteras.
**Razón:** Comparar milisegundos exactos hace que un expediente creado ayer a las 23:00 ART muestre "0 días" hasta pasadas las 23:00 de hoy. El usuario espera "1 día" desde el día siguiente calendario.

## 2026-04-21 (deploy)

### Deploy Railway: SIEMPRE desde `backend/`, nunca desde la raíz
**Decisión:** `railway up --detach` se corre desde `c:\...\lexcore\backend\`, no desde la raíz del repo.
**Razón:** Railway tiene el servicio `lexcore` linkeado al directorio `backend/`. Desde la raíz devuelve "No linked project found". Desde `backend/` muestra `Project: friendly-healing, Service: lexcore` y el deploy sube correctamente.
**Verificar antes de deployar:** `cd backend && railway status` — debe mostrar el nombre del proyecto y servicio.
**Nunca:** `railway up` desde la raíz. Siempre: `cd backend && railway up --detach`.

### Deploy Vercel: SIEMPRE desde la raíz del repo, nunca desde `frontend/`
**Decisión:** `vercel --prod --yes` se corre desde `c:\...\lexcore\`, no desde `frontend/`.
**Razón:** `vercel.json` en la raíz tiene `{"rootDirectory": "frontend"}`. Si corrés el CLI desde `frontend/`, Vercel construye el path como `frontend/frontend` y falla con "path does not exist".
**Verificar antes de deployar:** estar parado en la raíz del repo (`ls vercel.json` debe existir).
**Nunca:** `cd frontend && vercel --prod`. Siempre: desde raíz `vercel --prod --yes`.

### Secuencia de deploy estándar (ambos servicios)
```bash
# 1. Railway (backend) — desde backend/
cd backend
railway up --detach

# 2. Vercel (frontend) — desde raíz del repo
cd ..  # o directamente desde la raíz
vercel --prod --yes
```
**Orden:** primero Railway (puede tardar ~3 min en buildear), luego Vercel (más rápido). Si hay cambios solo en un servicio, deployar solo ese.
**Señal de éxito Railway:** URL de Build Logs en la salida. Verificar en Railway dashboard que el deploy llega a "Success".
**Señal de éxito Vercel:** URL de producción en la salida. Verificar que la URL termina en `.vercel.app`.

---

### pydantic[email] obligatorio
**Decisión:** Usar `pydantic[email]` en requirements.txt, no `pydantic` solo.
**Razón:** `EmailStr` de Pydantic requiere `email-validator` instalado. Sin el extra, el backend falla al arrancar.
