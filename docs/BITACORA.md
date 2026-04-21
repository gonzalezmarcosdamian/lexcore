# LexCore — Bitácora de Sesiones

> Una entrada por sesión de trabajo. Describe qué se hizo, qué decisiones se tomaron, qué quedó pendiente.

---

## Sesión 008 — 2026-04-21

**Sprint:** Sprint 13

### Qué se hizo

**Fix: SM hook mostraba contexto del proyecto equivocado (buildfuture)**
- El hook global `~/.claude/settings.json` tenía paths hardcodeados a `c:/Users/gonza/.../buildfuture/`
- Fix: reemplazado con detección dinámica via `os.getcwd()` + `git rev-parse --show-toplevel`
- El hook ahora lee el proyecto activo desde el CWD — funciona para cualquier repo

**Fix: Deploy Railway no linkado desde raíz**
- `railway status` desde raíz devolvía "No linked project found"
- Causa: el link está en `backend/` (proyecto `friendly-healing`, servicio `lexcore`)
- Fix: siempre correr `railway up --detach` desde `backend/`
- Documentado en LEARNINGS con secuencia estándar de deploy

**Feat: Agenda — picker Tarea/Vencimiento al clickear día**
- Click en celda del calendario abría modal de tarea directamente
- Fix: ahora muestra picker intermedio "¿Qué querés crear?" con botones Tarea / Vencimiento
- Fecha pre-cargada en cualquier opción del picker
- Estado `diaPickerFecha` + modal picker en `agenda/page.tsx`

**Feat: AgendaWidget en dashboard (reemplaza CalendarioMensual)**
- Dashboard tenía un CalendarioMensual completo — pesado e incoherente visualmente
- Reemplazado con widget compacto: mini-semana 7 días + panel de día seleccionado
- Flechas prev/next para navegar semanas con label contextual ("Esta semana", etc.)
- Click en día → lista de eventos abajo (no navega a /agenda)
- Día seleccionado resaltado con `bg-brand-600`; por defecto = hoy

**Feat: Vencimientos editables/eliminables desde detalle de expediente**
- No había botones de edición/eliminación en los vencimientos del detalle
- `VencimientoCardExpediente`: modo inline edit con campos descripcion/fecha/tipo
- Eliminar con confirmación inline
- "↩ Deshacer" para reabrir vencimiento cumplido

**Feat: Bitácora registra todos los cambios de estado**
- PATCH de vencimiento (cumplido/reabierto, edición) → Movimiento automático con emoji
- PATCH de tarea (estado, edición) → Movimiento automático
- Hora del vencimiento visible en entradas de bitácora (`meta.hora`)
- `onCreated` callback llamado en edición además de creación

**Feat: Columnas expediente drag-and-drop**
- Picker de columnas rediseñado: activas con handle arrastrable, inactivas como checklist
- Columnas nuevas: N° judicial (independiente), Juzgado, Localidad
- Orden de columnas persiste en localStorage; tabla respeta el orden del usuario
- Header de tabla usa `visibleCols.map(...)` en lugar de `ALL_COLS.filter(...)` para respetar orden

### Decisiones tomadas
- Deploy Railway: siempre desde `backend/`. Deploy Vercel: siempre desde raíz. Documentado en LEARNINGS.
- Drag-and-drop con HTML5 Drag API nativa (sin dependencias) — suficiente para columnas
- `findLastIndex` para insertar columna en posición correcta al activarla

### Pendiente
- Verificar deploy Railway y Vercel en producción

---

## Sesión 007 — 2026-04-21

**Sprint:** Sprint 10

### Qué se hizo

**Fix: Timezone en calendario — "hoy a las 11 PM" mostraba UTC**
- `toLocaleTimeString` en `calendar-sync-button.tsx` no recibía timezone → usaba UTC del servidor
- Fix: `timeZone: "America/Argentina/Buenos_Aires"` en todas las llamadas a `toLocaleString`/`toLocaleTimeString`

**Fix: PDF preview en blanco + descarga con nombre UUID raro**
- Causa raíz: Cloudinary sirve `fl_attachment` + `X-Frame-Options: DENY` → iframe vacío, y el nombre del archivo era la UUID de Cloudinary
- Fix: endpoint proxy en backend (`GET /documentos/{id}/content?inline=true/false`) — FastAPI hace el fetch server-side con httpx y devuelve `StreamingResponse` con el `Content-Disposition` correcto
- Frontend: `fetch() → blob() → URL.createObjectURL()` para preview en iframe y descarga con `a.download = doc.nombre`
- Dependencia nueva: `httpx` en `requirements.txt`

**Feat: Bitácora unificada en detalle de expediente**
- Endpoint nuevo: `GET /expedientes/{id}/actividad` — agrega movimientos, honorarios, pagos, vencimientos, tareas y documentos ordenados por `created_at DESC`
- La bitácora reemplaza los movimientos manuales como protagonista de la columna derecha — muestra todo el historial del expediente
- Entrada manual (textarea) con Enter para guardar; botón ↻ para refrescar
- Callback `onCreated` en `HonorariosTab`, `TareasSection` y `DocumentosTab` → refresca bitácora automáticamente al crear cualquier ítem

**Feat: Documentos con label y reordenamiento**
- Campos nuevos en `Documento`: `label` (String(200), nullable) y `orden` (Integer, default 0)
- Migración `f5e21ed7929a` — `server_default='0'` para filas existentes
- Edición de label inline: click → input → Enter/Esc/botón guarda via `PATCH /documentos/{id}`
- Reordenamiento ↑↓: botones que intercambian `orden` entre dos docs y patchean ambos
- Endpoint `GET /documentos/merged-pdf?expediente_id=...` — concatena PDFs en orden con `pypdf`
- Botón "Descargar todo" visible cuando hay 2+ PDFs

**Feat: Secciones colapsables con badges de resumen**
- Honorarios: muestra `$XXk ARS · $Xk pendiente`
- Vencimientos: `N pendientes · próximo DD-mes`
- Tareas: `N pendientes`
- Documentos: `N PDFs`

**Feat: APScheduler — notificaciones diarias automáticas**
- `BackgroundScheduler` con `CronTrigger(hour=9)` en `lifespan` de FastAPI
- Job `_job_notificar_urgentes()` recorre todos los tenants y envía email de vencimientos urgentes
- `apscheduler==3.10.4` y `pypdf==4.3.1` en `requirements.txt`

**Feat: Sistema de trial**
- Campo `trial_ends_at` en modelo `Studio` (default `now() + 30 días`)
- Migración `2ceee8661236`
- Banner de aviso en layout cuando quedan ≤5 días
- `StudioMe` type en frontend incluye `trial_ends_at`

**Feat: Resumen IA movido al tope**
- `SectionCollapsible` "Resumen IA · Beta" movido como primer elemento de la columna derecha, grisado con "Próximamente"

**Fixes producción (Railway/Vercel)**
- `ModuleNotFoundError: No module named 'app.models.vencimiento'` — `Vencimiento` vive en `app.models.expediente`, no en archivo propio. Corregido import en `actividad_expediente`
- `honorarios-tab.tsx` con `onCreated` prop no estaba commiteado → Vercel build fallaba con TypeScript error
- Enums de SQLAlchemy serializados con `.value` en lugar de `str()` (que daba `"Moneda.ARS"` en lugar de `"ARS"`)
- `Decimal` de SQLAlchemy convertido a `float()` para JSON

**Fix: "0 días" en tiempo de vida del expediente**
- `tiempoVida()` usaba milisegundos exactos → expediente creado ayer = 0 días si pasaron <24hs
- Fix: comparar fechas calendario en ART usando `toLocaleDateString("en-CA", { timeZone: TZ })`

### Decisiones tomadas
- Backend proxy para documentos (vs presigned URL directo): elimina todos los problemas CORS/X-Frame-Options sin cambiar el storage
- `onCreated` callback pattern en sub-componentes: mínimo acoplamiento, la bitácora se refresca sola
- Enums en `meta` de `ActividadItem`: siempre serializar con `.value` explícito, nunca `str()`

### Pendiente
- Verificar que `trial_ends_at` se setea correctamente en `auth.py` al crear estudio nuevo
- Tests para endpoints de documentos (proxy, merged-pdf, PATCH label/orden)
- Verificar APScheduler en Railway (necesita `--build` para que `apscheduler` esté instalado)

---

## Sesión 006 — 2026-04-20

**Sprint:** Sprint 10

### Qué se hizo

**Fix: Google OAuth `OAuthCallback` en producción**
- Causa raíz: `GOOGLE_CLIENT_SECRET` y `NEXTAUTH_URL` en Vercel tenían `\n` al final por haber sido seteadas con `echo` en lugar de `printf`
- Fix: `vercel env rm` + re-add con `printf 'valor' | vercel env add KEY production`
- Configuración final: `checks: ["state"]` (sin PKCE), cookies `sameSite: "none"`, logger v2 para diagnóstico

**Fix: Google Calendar — scope insuficiente**
- Error `403 insufficientPermissions` al listar calendarios
- Causa: scope `calendar.events` no alcanza para `calendarList().list()` — se necesita `calendar` (full scope)
- Fix: cambiar `SCOPES` en `backend/app/routers/google_calendar.py` a `["https://www.googleapis.com/auth/calendar"]`
- Fix adicional: revocar token existente en `connect_google_calendar` via `POST oauth2.googleapis.com/revoke` para forzar nuevo refresh_token con el scope correcto

**Fix: Google Calendar — eventos duplicados en sync repetido**
- Causa: sync insertaba eventos sin borrar los anteriores
- Fix: tag `extendedProperties.private.lexcore_sync=1` en todos los eventos insertados; antes de cada sync se borran los eventos con ese tag via `privateExtendedProperty` filter
- Aclaración: eventos viejos sin el tag persisten — requiere limpieza manual la primera vez

**Fix: `BASE_URL` incorrecto en Railway**
- `BASE_URL` apuntaba a `https://lexcore.vercel.app` → corregido a `https://lexcore-kappa.vercel.app`
- Fix: `railway variables set BASE_URL=https://lexcore-kappa.vercel.app`

**UX: Botón cerrar sesión en /perfil**
- Agregado botón "Cerrar sesión" en la página de perfil, sobre la sección WhatsApp

**UX: Editar/eliminar tareas y vencimientos**
- VencimientoRow: botones ✏️ y 🗑️ visibles al hover → editar abre modal con descripción/fecha/tipo; eliminar pide confirmación inline
- TareaRow: mismo patrón → modal edita título/fecha_límite/estado
- Rows muestran expediente número + cliente nombre (link clickable a `/expedientes/:id`)
- Dashboard y Agenda (/vencimientos) actualizados con esta UI

### Decisiones tomadas
- Variables de entorno en Vercel deben setearse con `printf` (no `echo`) para evitar `\n` al final
- Google Calendar scope debe ser `calendar` (no `calendar.events`) para acceder a `calendarList`
- Primer sync post-fix requiere limpieza manual de eventos viejos en Google Calendar

### Pendiente
- Tests para los nuevos endpoints de edición/eliminación
- Verificar que Railway deployment incluye el scope fix del backend

---

## Sesión 005 — 2026-04-20

**Sprint:** Sprint 10

### Qué se hizo

**Fix: Tarea sin expediente obligatorio**
- `expediente_id` pasó a ser opcional en schema, modelo y router
- Guard `if body.expediente_id:` en validación y en `invalidar_resumen()`
- Migración: `make_tarea_expediente_id_nullable`

**Fix: Google Sign-In — studio isolation**
- Middleware redirigía a `/register` (error "email ya registrado") → ahora redirige a `/setup-studio`
- Nueva página `/setup-studio` para completar onboarding de usuarios Google
- Admin APIs (`/admin/*`) protegidas por `X-Admin-Key` para inspeccionar y corregir users/studios manualmente
- Variable `ADMIN_API_KEY` en Railway → usado para corregir los dos usuarios con `tenant_id="pending"`

**Fix: Segunda invitación no pide contraseña**
- `POST /invitaciones/aceptar/{token}` ahora devuelve `user_exists: bool`
- Nuevo endpoint `POST /auth/join-studio` — une usuario existente a nuevo tenant sin contraseña (copia hashed_password)
- Frontend muestra "Unirme al estudio" en lugar del formulario de contraseña si el usuario ya existe

**UX: Filtros de período en Dashboard y Agenda**
- Dashboard: selector Hoy / Esta semana / Este mes / Este año / Personalizado (default: este año)
- Agenda: mismo selector + opción Personalizado con inputs desde/hasta
- Dashboard filtra tareas y vencimientos en cliente; stats cards reflejan el período elegido
- Tareas sin fecha límite siempre visibles independientemente del filtro

**UX: Dashboard redesign**
- Tareas + Vencimientos como bloque principal (lg:grid-cols-2)
- Agrupación por urgencia: vencidas/hoy (rojo) → próximas → sin fecha
- KPIs financieros y gráfico de expedientes como contenido secundario

**UX: Agenda — período default**
- Cambiado de "Esta semana" a "Este año"

**UX: Mobile polish (P0–P3)**
- Modales: `items-end sm:items-center`, `rounded-t-2xl`, `max-h-[92vh] overflow-y-auto`
- Inputs: `py-3` en todos los formularios de modales
- Grids: `grid-cols-1 sm:grid-cols-X` en todos los formularios
- Expedientes: sidebar como drawer en mobile con overlay
- Layout: `pb-[env(safe-area-inset-bottom)]` en bottom tab bar

### Decisiones tomadas
- Un abogado puede ser invitado por múltiples estudios (cada invitación crea fila en tenant distinto)
- Para crear un estudio propio → nueva cuenta con otro email (o pedirlo a CX en el futuro)
- La invitación a un segundo estudio no pide contraseña si el email ya tiene cuenta

### Pendiente Sprint 11
- US-AI-01: Resumen IA de expediente
- US-12: Generador de escritos con IA
- Trial 30 días + modo lectura
- Notificaciones push / email para vencimientos urgentes

---

## Sesión 004 — 2026-04-16

**Sprint:** Sprint 08 hotfixes + cierre

### Qué se hizo

**Rediseño vista /tareas**
- Stats pills por estado (pendiente/en_curso/hecha/vencida)
- Cards rediseñadas: checkbox visual por estado, badge con dot, días restantes con ícono
- Empty state prominente con CTA a expedientes
- Skeleton loader, completadas colapsadas en `<details>`
- Endpoint `POST /dev/seed-tareas` — 7 tareas dummy para testing

**Bugs corregidos**
- Token `undefined` en /tareas y /agenda — usaban `session?.accessToken` en lugar de `session?.user?.backendToken`
- Agenda no cargaba vencimientos — param `dias` → `proximos`
- Estado visible al crear tarea — `editingId` no se reseteaba al abrir "+ Nueva tarea"
- Tareas/Agenda no refrescaban al volver — agregado listener `visibilitychange`
- Modelo Tarea no estaba en `models/__init__.py` → migraciones salían vacías

**Proceso mejorado**
- CLAUDE.md: sección "REGLA RÍGIDA — NUEVO MODELO SQLALCHEMY" con checklist 5 pasos
- Flujo /dev actualizado: `model → __init__.py → migration → service → router → test → frontend`
- Hook de modelos actualizado con checklist completo y warning de migración vacía

### Decisiones tomadas
- Password dev: `lexcore2026` (alineada con credencial guardada en browser del usuario)
- `models/__init__.py` es OBLIGATORIO actualizar al crear modelo — sin esto Alembic no detecta la tabla
- El rate limiter in-memory se resetea con restart del backend (aceptable para MVP)

### Pendiente Sprint 09
- US-AI-01: Resumen IA de expediente (refinado por FA)
- US-12: Generador de escritos con IA
- US-10: Creación de expediente 2 pasos mobile-first
- US-14: Preview de documentos
- Trial 30 días + modo lectura (monetización)

---

## Sesión 003 — 2026-04-15 (tarde)

**Sprint:** Sprint 08

### Qué se hizo

**US-01 — Módulo de Tareas (completo)**
- Modelo `Tarea` (`backend/app/models/tarea.py`) con `TareaEstado` enum (pendiente/en_curso/hecha)
- Schemas `TareaCreate`, `TareaUpdate`, `TareaOut` con `responsable_nombre` enriquecido
- Router `/tareas` — CRUD completo con filtros, orden por `fecha_limite` ASC nulls last
- Migración `ab7c536d2464` aplicada
- Tipo `Tarea`/`TareaEstado` agregados a `api.ts`
- `TareasSection` componente React completo (`tareas-section.tsx`)
- Integrado en detalle de expediente como sección colapsable (open por defecto)
- Página global `/tareas` con filtros por estado y responsable
- Ítem "Tareas" agregado al sidebar

**EXP-AUTO-001 — Número autogenerado**
- `ExpedienteCreate` ya no acepta `numero` ni `estado`
- Router genera `EXP-{año}-{correlativo 4 dígitos}` con `_generar_numero()`
- Estado siempre arranca en `activo`
- Formulario de creación simplificado

**Decisiones funcionales aclaradas**
- Vencimientos ≠ Tareas: son entidades ortogonales. Vencimiento = plazo procesal del expediente. Tarea = trabajo interno del estudio. Sin FK entre ellas.

### Decisiones tomadas
- Número de expediente lo asigna el sistema, no el usuario — reduce fricción en creación y garantiza formato consistente
- Estado inicial siempre "activo" — un expediente nace activo, no tiene sentido elegirlo al crear
- Tareas y vencimientos sin FK entre sí por ahora — si en el futuro se quiere relacionar un plazo con una tarea interna, se agrega `vencimiento_id` opcional en `Tarea`

### Pendiente para próxima sesión
- US-01 test de aislamiento tenant (pytest)
- US-02: Vista Agenda Diaria/Semanal
- US-03: Notificaciones por email para vencimientos urgentes

---

## Sesión 001 — 2026-04-15

**Duración:** ~2h
**Sprint:** Sprint 01 (día 1)

### Qué se hizo
- Setup completo del stack: Docker Compose con PostgreSQL + FastAPI + Next.js 14
- Estructura de carpetas según CLAUDE.md
- Modelos base: `Studio`, `User` con `TenantModel`
- Auth core: JWT propio con PyJWT, `hash_password`, `verify_password`, `create_access_token`
- Deps: `get_current_user`, `get_db`, `CurrentUser`, `DbSession`
- Endpoint `/auth/login` y `/health`
- Alembic configurado + primera migración ejecutada (`studios`, `users`)
- Frontend: Next.js 14 App Router, Tailwind, `lib/api.ts`
- Sistema de documentación: agentes, backlog, sprints, PRODUCTO.md

### Decisiones tomadas
- JWT propio en dev (Supabase en prod)
- Frontend en puerto 3001 (3000 ocupado)
- `pydantic[email]` requerido para `EmailStr`

### Stack al final de la sesión
- Backend: `http://localhost:8000` ✓
- Frontend: `http://localhost:3001` ✓ (iniciando)
- DB: tablas `studios` y `users` migradas ✓

### Pendiente para próxima sesión
- Refinar AUTH-001/002/003 con /fa
- Implementar registro de estudio + usuario admin
- Implementar pantalla de login en frontend
- Middleware de protección de rutas en Next.js
