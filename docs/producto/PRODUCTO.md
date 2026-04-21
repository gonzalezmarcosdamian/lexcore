# LexCore — Estado del Producto

> **PROCESO RÍGIDO:** Este archivo se actualiza OBLIGATORIAMENTE al completar cada historia.
> Es la fuente de verdad del estado real del producto. Nunca debe quedar desactualizado.
> Si terminaste una feature y no actualizaste esto, la feature NO está done.

**Última actualización:** 2026-04-21
**Sprint activo:** Sprint 10 — en curso
**Versión:** 0.10.0

### Modelo de monetización (decisión 2026-04-15)
- **Trial 30 días sin tarjeta** → acceso completo
- Día 25: email de aviso con propuesta de precio
- Día 31: modo lectura (pueden ver todo, no crear) → incentivo a pagar sin perder datos
- Campo `trial_ends_at` en modelo `Studio`, middleware que evalúa el estado

---

## Resumen ejecutivo

LexCore es una plataforma multi-tenant de gestión para estudios de abogados.
Estado actual: **producto funcional completo — clientes, expedientes (número autogenerado), vencimientos, honorarios, documentos, equipo, gastos, ingresos, tareas e invitaciones operativos. UX pulida con notificaciones, módulo contable, conector Google Calendar, bitácora unificada con feed de actividad completo, documentos con label+reordenamiento+descarga concatenada, sistema de trial, y notificaciones automáticas diarias.**

---

## Features implementadas

### Infraestructura base ✓
- **Stack:** FastAPI + SQLAlchemy + PostgreSQL + Next.js 14 + Tailwind CSS
- **Docker Compose:** 3 servicios (db, backend, frontend) con hot-reload
- **ORM:** Alembic configurado, migraciones aplicadas
- **Modelos DB:** `studios`, `users` (con `tenant_id`, `created_at`, `updated_at`)
- **Auth core:** JWT propio (`core/auth.py`), `create_access_token`, `verify_password`
- **CORS:** configurado para `localhost:3001`
- **Health check:** `GET /health` responde `{"status": "ok", "version": "0.3.0"}`

### Auth ✓ (Sprint 01 — 2026-04-15)
- [x] AUTH-001: Registro de estudio y primer usuario admin → `POST /auth/register`
- [x] AUTH-002: Login con email y contraseña → `POST /auth/login`
- [x] AUTH-003: Middleware de protección de rutas frontend → `src/middleware.ts`
- [x] AUTH-004: Google OAuth → NextAuth.js + `POST /auth/google`

**Páginas:** `/login`, `/register`
**Migración:** `b4278af0ab0b`

### Clientes ✓ (Sprint 02 — 2026-04-15)
- [x] CLT-001: CRUD completo de clientes (personas físicas y jurídicas)
- Soft delete (archivado), búsqueda por nombre/CUIT

**Endpoints:** `GET/POST /clientes`, `GET/PATCH/DELETE /clientes/{id}`
**Páginas:** `/clientes`, `/clientes/nuevo`, `/clientes/{id}`

### Expedientes ✓ (Sprint 02 — 2026-04-15)
- [x] EXP-001: CRUD de expedientes (número, carátula, fuero, juzgado, estado, cliente)
- [x] EXP-002: Movimientos procesales por expediente (log de novedades)
- [x] EXP-003: Asignación de múltiples abogados con roles (responsable/colaborador/supervisión)

**Endpoints:** `GET/POST /expedientes`, `GET/PATCH /expedientes/{id}`, `/movimientos`, `/abogados`
**Páginas:** `/expedientes`, `/expedientes/nuevo`, `/expedientes/{id}` (tabs: info + movimientos)

### Vencimientos ✓ (Sprint 03–10)
- [x] VCT-001: CRUD de vencimientos con filtros (próximos N días, cumplido/pendiente)
- [x] Alertas de urgencia: vencimientos a menos de 48hs se marcan como "Urgente"
- [x] VCT-004: Google Calendar sync — conectar desde /perfil, elegir calendario, sync vencimientos + tareas. Deduplicación via `extendedProperties.private.lexcore_sync=1`. Funciona para usuarios Google y email (2026-04-20)
- [x] Editar y eliminar vencimientos directamente desde agenda e inicio (modal + confirmación inline) (2026-04-20)
- [x] Rows muestran expediente número + cliente (link clickable) (2026-04-20)

**Endpoints:** `GET/POST /vencimientos`, `GET/PATCH/DELETE /vencimientos/{id}`
**Páginas:** `/vencimientos`, `/vencimientos/nuevo`
**Dashboard:** muestra vencimientos próximos 30 días + alertas urgentes

### Invitaciones ✓ (Sprint 03 — 2026-04-15)
- [x] USR-001: Invitar usuarios al estudio con rol asignado
- Token seguro con expiración (7 días), lógica de aceptación preparada
- [ ] Envío de email pendiente (Sprint 04)

**Endpoints:** `GET/POST /invitaciones`, `DELETE /invitaciones/{id}`, `POST /invitaciones/aceptar/{token}`

### Migración DB ✓
- `91e6d398e2a5` — clientes, expedientes, expediente_abogados, movimientos, vencimientos, invitaciones

---

### Documentos en expedientes ✓ (Sprint 04/05 — 2026-04-15)
- [x] DOC-001: Upload de archivos via presigned URL (MinIO local / Cloudflare R2 en prod)
- [x] Listado de documentos por expediente con ícono por tipo MIME y tamaño
- [x] Descarga via presigned GET URL (expira 15 min)
- [x] Eliminación (borra de storage + DB)
- [x] Drag & drop + click para subir. Límite 50MB por archivo.
- [x] Seed de 14 PDFs de ejemplo con contenido jurídico lorem ipsum

**Endpoints:** `POST /documentos/upload-url`, `POST /documentos`, `GET /documentos?expediente_id=`, `GET /documentos/{id}/download-url`, `DELETE /documentos/{id}`
**Páginas:** Tab "Documentos" en `/expedientes/{id}`
**Infra:** MinIO en Docker Compose (S3-compatible). S3_ENDPOINT_URL / S3_PUBLIC_URL configurables.
**Migración:** `a991068fd9dd`

### Gestión del equipo ✓ (Sprint 05 — 2026-04-15)
- [x] Listar miembros reales del estudio ordenados por rol
- [x] Cambiar rol de un miembro (admin/socio pueden hacerlo)
- [x] Eliminar miembro del estudio (solo admin)
- [x] Indicador "Vos" en el usuario actual, no puede modificarse a sí mismo
- [x] Sección "Invitaciones pendientes" integrada en la misma pantalla

**Endpoints:** `GET /users`, `PATCH /users/{id}/role`, `DELETE /users/{id}`
**Páginas:** `/equipo` — dos secciones: Miembros activos + Invitaciones pendientes

### UX — Ayuda contextual ✓ (Sprint 05 — 2026-04-15)
- [x] Componente `PageHelp` reutilizable — botón `?` con popover explicativo por pantalla
- [x] Integrado en: Dashboard, Expedientes, Clientes, Vencimientos, Equipo
- [x] Cada pantalla tiene ítems específicos + tip al pie

**Componente:** `src/components/ui/page-help.tsx`

### UX — Dashboard mejorado ✓ (Sprint 05 — 2026-04-15)
- [x] Filtros de temporalidad: Hoy (1d) / Esta semana (7d) / Este mes (30d) / Trimestre (90d)
- [x] Vencimientos y métricas se actualizan al cambiar el período
- [x] Stats reales del dashboard (antes hardcodeadas): expedientes activos y clientes desde API
- [x] Botón "Sync Calendar" reemplaza dropdown iCal (próximamente funcional — VCT-004)

### UX — Sidebar limpiado ✓ (Sprint 05 — 2026-04-15)
- [x] Búsqueda global removida del sidebar (será modal Cmd+K — BUS-001 Sprint 05)
- [x] Sidebar queda limpio: solo logo + navegación + usuario

---

### Honorarios ✓ (Sprint 04 — 2026-04-15)
- [x] HON-001: CRUD de honorarios por expediente (monto acordado + pagos + saldo calculado)
- [x] Soporte ARS y USD en el mismo expediente
- [x] Resumen de honorarios para dashboard

**Endpoints:** `GET/POST /honorarios`, `PATCH/DELETE /honorarios/{id}`, `POST /honorarios/{id}/pagos`, `GET /honorarios/resumen`
**Páginas:** Tab "Honorarios" en `/expedientes/{id}`

### Búsqueda global ✓ (Sprint 04 — 2026-04-15)
- [x] BUS-001: Búsqueda por número/carátula de expediente y nombre/CUIT de cliente
- [x] Panel de búsqueda en sidebar con debounce 300ms

**Endpoint:** `GET /search?q=`

### Notificaciones in-app ✓ (Sprint 04 — 2026-04-15)
- [x] NOT-001: Badge rojo de urgentes en sidebar y header (vencimientos < 48hs)

### Exportación calendario ✓ (Sprint 04 — 2026-04-15)
- [x] VCT-003: iCal export (Apple Calendar, Outlook, cualquier cliente)
- [x] Opción Google Calendar (suscribir URL)

**Endpoints:** `GET /ical/vencimiento/{id}`, `GET /ical/expediente/{id}`, `GET /ical/proximos`

### Email de invitación ✓ (Sprint 04 — 2026-04-15)
- [x] USR-002: Email HTML via Resend al crear invitación
- [x] Falla silenciosa si `RESEND_API_KEY` no configurada
- [x] USR-003: Página `/aceptar-invitacion/[token]` — registro desde email
- [x] Backend `POST /auth/register-invited` — crea usuario desde token de invitación

---

### Sprint 07 — UX Expedientes + Honorarios + Ingresos + Dashboard ✓ (2026-04-15)
- [x] EXP-UX-001: Detalle de expediente — layout 2 columnas (sidebar datos/equipo + secciones colapsables)
- [x] EXP-UX-002: Secciones colapsables en orden de importancia: Honorarios > Vencimientos > Movimientos > Documentos
- [x] EXP-UX-003: Tiempo de vida del expediente en el header (ej: "8 meses")
- [x] EXP-UX-004: Equipo colapsable con nombre completo, rol badge y eliminar al hover
- [x] HON-002: Pagos parciales con tipo Capital / Intereses — campo `tipo` en `pagos_honorarios`
- [x] HON-003: Hero summary de honorarios (acordado total, cobrado, saldo, barra de progreso) — por moneda
- [x] HON-004: Botón "Completar saldo" en form de pago para completar automáticamente el importe
- [x] HON-005: Auto-creación de Ingreso contable al registrar pago de capital en honorarios
- [x] CONT-003: Módulo Ingresos — modelo, migración, router CRUD (`/ingresos`)
- [x] CONT-004: Ingresos vinculados a expediente — selector en ABM, badge de expediente en listado
- [x] CONT-005: KPIs contables en dashboard (Ingresos ARS, Egresos ARS, Resultado, Honorarios pendientes)
- [x] DASH-001: Gráfico de barras de expedientes por estado (Activos / Archivados / Cerrados) con recharts
- [x] EXP-LIST-001: Listado de expedientes rediseñado — sidebar stats + tabla con ordenamiento
- [x] EXP-LIST-002: SortModal reutilizable (popover desktop / fullscreen mobile)
- [x] UX-007: Nuevo vencimiento pre-cargado con contexto de expediente (banner + botones tipo visual)
- [x] HOOK-001: Hook PostToolUse auto-restart Docker al editar frontend/backend

**Migraciones:** `544abacdc514` (ingresos), `cc1fd28b83fc` (pagos_honorarios.tipo)
**Nuevos endpoints:** `GET/POST /ingresos`, `PATCH/DELETE /ingresos/{id}`, `GET /ingresos/resumen`
**Nuevas páginas:** `recharts` instalado, gráfico en `/dashboard`

### Sprint 06 — UX + Notificaciones + Contabilidad + Google Calendar ✓ (2026-04-15)
- [x] UX-006: Pre-selección de expediente en formularios vía `?expediente_id=xxx` — banner + campo bloqueado
- [x] UX-003: Centrado de formularios ABM con `max-w-2xl mx-auto`
- [x] UX-004: Efecto de expansión en search bars (`transition-all w-52 focus:w-80`)
- [x] UX-005: Atajo Cmd+K/Ctrl+K agnóstico — detecta OS vía `navigator.platform`
- [x] NOT-002: Panel desplegable de notificaciones urgentes — click navega al expediente
- [x] CONT-001: Módulo de gastos completo — modelo `Gasto`, migración, router CRUD, tests TDD (10/10), página `/gastos`
- [x] CONT-002: Widget financiero en dashboard — ingresos vs gastos vs resultado neto ARS
- [x] VCT-004: Google Calendar connect — OAuth2 separado del login, `/perfil`, selector de calendarios, sync de vencimientos
- [x] `/perfil`: página de configuración personal con estado de Calendar

**Endpoints nuevos:** `GET/POST/PATCH/DELETE /gastos`, `GET /gastos/resumen`, `GET /auth/google-calendar/connect`, `GET /auth/google-calendar/callback`, `GET /auth/google-calendar/calendars`, `POST /auth/google-calendar/select-calendar`, `DELETE /auth/google-calendar/disconnect`, `POST /vencimientos/sync-calendar`, `GET /users/me`
**Páginas nuevas:** `/gastos`, `/perfil`
**Migraciones:** `743b87a56c88` (gastos), `255ad9d19349` (google_calendar_id)

### Sprint 09 — COMPLETADO (2026-04-16)

#### US-AI-01 · Resumen IA del expediente ✓ (2026-04-16)
- [x] Modelo `ExpedienteResumen` con `UNIQUE(tenant_id, expediente_id)`, `version_contexto`, `version_resumen`
- [x] Tabla `expediente_resumenes` — migración `7be62acadaaf`
- [x] `openai==1.51.0` en requirements, `OPENAI_API_KEY` + `OPENAI_MODEL` en config y .env
- [x] Router `GET /expedientes/{id}/resumen`, `GET /expedientes/{id}/resumen/status`, `POST /expedientes/{id}/resumen/generar`
- [x] Límite 5 regeneraciones manuales/día — 429 si excede
- [x] Fallo silencioso: si OpenAI falla y hay resumen previo, lo conserva
- [x] Badge "Desactualizado" cuando `version_contexto > version_resumen`
- [x] Invalidación automática al crear: movimiento, vencimiento, tarea, pago de honorario
- [x] Sección "Resumen IA" en detalle de expediente — badge Beta, botón Generar/Actualizar/Regenerar
- [x] Componente `ResumenIASection` en `expedientes/[id]/resumen-ia-section.tsx`

**Endpoints:** `GET/POST /expedientes/{id}/resumen`, `GET /expedientes/{id}/resumen/status`, `POST /expedientes/{id}/resumen/generar`
**Migración:** `7be62acadaaf`
**Nota:** Requiere `OPENAI_API_KEY` en `.env`. Sin key → placeholder "Próximamente" en UI (503 silencioso).

#### US-10 · Creación de expediente en 2 pasos mobile-first ✓ (2026-04-16)
- [x] Wizard de 2 pasos en `/expedientes/nuevo`
- [x] Paso 1: Carátula + selector visual de fuero (chips clickeables) + opción "Otro" con input libre
- [x] Paso 2: Juzgado + Cliente — con resumen del paso anterior visible
- [x] Stepper visual con check al completar paso 1, estado activo/inactivo por paso
- [x] Validación en paso 1 antes de avanzar (carátula obligatoria)
- [x] Diseñado en 375px, botones full-width, tipado grande

#### US-15 · Full-text search PostgreSQL ✓ (2026-04-16)
- [x] Índices GIN en `expedientes` (numero + caratula) y `clientes` (nombre + cuit_dni)
- [x] Router `/search` actualizado para usar `to_tsquery('spanish', ...)` con prefix search (`:*`)
- [x] Fallback automático a `ilike` para queries con solo números o caracteres especiales
- [x] Migración `cb965ddbf355` — reversible con downgrade

**Migración:** `cb965ddbf355`

#### TECH-001 · Fix setup-studio inseguro ✓ (2026-04-16)
- [x] Campo `ALLOW_DEV_ENDPOINTS: bool = False` en `Settings`
- [x] Router `dev_seed` solo se monta si `ALLOW_DEV_ENDPOINTS=true` o `ENVIRONMENT=development`
- [x] `.env` local: `ALLOW_DEV_ENDPOINTS=true` (dev). En prod: omitir o `false`
- [x] En producción (Railway): la variable no existe → endpoints `/dev/*` no existen

#### US-11 · Observabilidad Sentry — `blocked`
- **🚫 BLOQUEADO:** Activar al incorporar el primer cliente real en producción.

## Features pendientes

### Sprint 08 — COMPLETADO

#### US-01 · Módulo de Tareas ✓ (2026-04-15)
- [x] Modelo `Tarea` con `expediente_id`, `responsable_id`, `fecha_limite`, `estado` (pendiente/en_curso/hecha)
- [x] CRUD completo: `GET/POST /tareas`, `PATCH/DELETE /tareas/{id}` con filtros por expediente, estado, responsable
- [x] `_enriquecer()` inyecta `responsable_nombre` (User.full_name) en respuesta
- [x] Orden: fecha_limite ASC nulls last, created_at DESC
- [x] Sección "Tareas" colapsable en detalle de expediente (entre Vencimientos y Movimientos, open por defecto)
- [x] Página global `/tareas` — listado con filtros por estado y responsable, link a cada expediente
- [x] Sidebar: ítem "Tareas" agregado (entre Expedientes y Vencimientos)
- [x] Tareas vencidas resaltadas en rojo, indicador de días restantes
- [x] Toggle de estado circular (pendiente → en_curso → hecha) con un clic
- [x] Hechas colapsadas en `<details>` con strikethrough y check verde
- [x] Migración: `ab7c536d2464`
- [x] Editar y eliminar tareas desde Dashboard (modal + confirmación inline) (2026-04-20)
- [x] Rows de tareas en Dashboard muestran expediente número + cliente (link clickable) (2026-04-20)

#### US-02 · Vista Agenda Diaria/Semanal ✓ (2026-04-15)
- [x] Página `/agenda` con selector Hoy / Esta semana / Este mes
- [x] Vencimientos + Tareas unificados ordenados por fecha, agrupados por día
- [x] Toggle de estado directamente desde la agenda (cumplir vencimiento, cambiar estado tarea)
- [x] Ítem "Agenda" en sidebar y nav mobile
- [x] Vencimientos urgentes (<48hs) resaltados en ámbar, vencidos en rojo

#### US-03 · Notificaciones email vencimientos urgentes ✓ (2026-04-15)
- [x] `send_vencimiento_urgente_email()` en `services/email.py` — template HTML rojo
- [x] Endpoint `POST /vencimientos/notificar-urgentes` — filtra vencimientos <48hs del tenant y envía a todos los miembros
- [x] Falla silenciosa si `RESEND_API_KEY` no está configurada

#### US-04 · Tests aislamiento tenant ✓ (2026-04-15)
- [x] `test_tareas.py` — 16 tests: CRUD completo + 5 tests de aislamiento entre tenants
- [x] Tests de expedientes actualizados al nuevo schema (sin `numero`/`estado` en POST)
- [x] 117/117 tests pasan en suite completo
- [x] Cobertura: clientes, expedientes, vencimientos, honorarios, gastos, tareas, documentos, búsqueda

#### US-09 · StatusBadge reutilizable ✓ (2026-04-15)
- [x] Componente `StatusBadge` en `components/ui/status-badge.tsx`
- [x] Variantes: urgente, pendiente, en_curso, hecha, activo, archivado, cerrado, cumplido, confirmado
- [x] Paleta unificada: urgente=rojo, pendiente=amarillo, ok=verde, archivado=gris, en_curso=azul

#### US-18 · Toasts globales ✓ (2026-04-15)
- [x] `ToastProvider` + `useToast()` hook en `components/ui/toast.tsx`
- [x] Tipos: success (verde), error (rojo), info (oscuro)
- [x] Auto-dismiss 3.5s, máximo 4 toasts simultáneos
- [x] Integrado en `StudioLayout` — disponible en toda la app

#### US-08 · Empty states con onboarding ✓ (2026-04-15)
- [x] Componente `EmptyState` + íconos SVG en `components/ui/empty-state.tsx`
- [x] Aplicado en `/tareas` con CTA contextual (con/sin filtros)
- [x] Expedientes y Clientes ya tenían CTAs, ahora con componente unificado

#### US-17 · Rate limiting login ✓ (2026-04-15)
- [x] Rate limiting in-memory en `POST /auth/login`: 5 intentos fallidos → bloqueo 15min
- [x] Respuesta 429 con header `Retry-After` en segundos
- [x] Los intentos exitosos limpian el contador del IP
- [x] Sin dependencia de Redis — suficiente para MVP (se pierde al reiniciar el proceso)

#### EXP-AUTO-001 · Número de expediente autogenerado ✓ (2026-04-15)
- [x] Backend genera `EXP-{año}-{correlativo 4 dígitos por tenant}` al crear expediente
- [x] `ExpedienteCreate` ya no recibe `numero` ni `estado` — ambos los asigna el sistema
- [x] `estado` siempre arranca en `activo` al crear
- [x] Formulario de creación simplificado: solo Carátula, Fuero, Juzgado, Cliente
- [x] Decisión funcional: vencimientos y tareas son entidades ortogonales (sin FK entre ellas)

**Migraciones:** `ab7c536d2464` (tareas), `3bacddf28e63` (create tareas table — fix __init__.py)
**Nuevos endpoints:** `GET/POST /tareas`, `PATCH/DELETE /tareas/{id}`, `POST /dev/seed-tareas`, `POST /vencimientos/notificar-urgentes`
**Nuevas páginas:** `/tareas`, `/agenda`

#### Hotfixes sesión 2026-04-16 ✓
- [x] **Bug: token undefined en /tareas y /agenda** — ambas páginas usaban `(session as any)?.accessToken` en lugar de `session?.user?.backendToken`. Todas las páginas ahora usan `session?.user?.backendToken` consistentemente.
- [x] **Bug: agenda no cargaba vencimientos** — parámetro `dias` corregido a `proximos` (nombre real del query param en el backend)
- [x] **Bug: estado visible al crear tarea** — el botón "+ Nueva tarea" no reseteaba `editingId`. Corregido con reset explícito en el onClick.
- [x] **Bug: tareas/agenda no refrescaban al volver** — agregado listener `visibilitychange` para re-fetch al volver al tab.
- [x] **Vista /tareas rediseñada** — stats pills, cards con checkbox visual por estado, empty state prominente, completadas colapsadas, skeleton loader.
- [x] **Seed de datos demo** — endpoint `POST /dev/seed-tareas` crea 7 tareas dummy sobre el primer expediente del tenant.
- [x] **Bug: modelo Tarea no en __init__.py** — migración generada vacía. Fix: agregado `from app.models.tarea import Tarea` a `models/__init__.py`. Migración real `3bacddf28e63` aplicada.
- [x] **Regla rígida nuevo modelo** — CLAUDE.md actualizado con checklist obligatorio de 5 pasos al crear modelos. Hook actualizado para mostrar el checklist completo.
- [x] **Rate limiter** — reseteado (restart backend) tras acumulación de intentos fallidos durante debug.
- [x] **Password dev** — actualizada a `lexcore2026` para usuario `ingonzalezdamian@gmail.com`.

### Post-MVP
- RPT-001: Reportes de actividad exportables
- INT-001: Integración PJN
- MOB-001: PWA mobile
- AI-001: Redacción asistida con IA

---

## Invariantes del sistema (nunca romper)

1. **Aislamiento tenant:** Ningún endpoint devuelve datos sin validar `resource.tenant_id == current_user.studio_id`
2. **Tests de aislamiento:** Toda entidad nueva debe tener test que verifica aislamiento entre tenants
3. **Migración explícita:** Todo cambio de schema va por Alembic, nunca auto-migrate
4. **Mobile-first:** Toda UI se diseña primero en 375px

---

## Decisiones técnicas vigentes

| Decisión | Razón |
|----------|-------|
| JWT propio en dev | Evitar dependencia de Supabase hasta MVP. Swap planificado. |
| Puerto frontend: 3001 | Puerto 3000 ocupado por otro proyecto local |
| `PgEnum` con `create_type=False` | Evitar DuplicateObject en migraciones al usar `postgresql.ENUM` |
| Soft delete en clientes | Historial de expedientes vinculados se mantiene |

---

## Changelog

### v0.10.0 — 2026-04-21

**Sprint 10 — Bitácora unificada + Documentos avanzados + Trial + APScheduler**

#### Bitácora unificada (feed de actividad)
- `GET /expedientes/{id}/actividad` — agrega movimientos, honorarios, pagos, vencimientos, tareas y documentos, ordenados por `created_at DESC`
- La bitácora es el protagonista del detalle de expediente — muestra todo el historial retrocompatible
- Callback `onCreated` en sub-componentes → refresca bitácora automáticamente al crear cualquier ítem
- Botón ↻ para refrescar manualmente; textarea con Enter para guardar movimiento manual

#### Documentos avanzados
- Campo `label` editable inline (click → input → Enter/Esc guarda via PATCH)
- Campo `orden` — botones ↑↓ para reordenar el listado
- Endpoint `GET /documentos/merged-pdf?expediente_id=...` — concatena PDFs en orden con `pypdf`
- Botón "Descargar todo" visible cuando hay 2+ PDFs
- Migración `f5e21ed7929a` (`label` nullable + `orden` integer con `server_default=0`)

#### Backend proxy para documentos (fix PDF preview + descarga)
- `GET /documentos/{id}/content?inline=bool` — FastAPI fetchea Cloudinary server-side con `httpx` y devuelve `StreamingResponse`
- Elimina problemas de `X-Frame-Options` en iframe y nombres UUID en descarga
- Frontend usa patrón `fetch → blob → URL.createObjectURL()` con `a.download = doc.nombre`

#### Sistema de trial
- Campo `trial_ends_at` en modelo `Studio` (default `now() + 30 días`)
- Migración `2ceee8661236`
- Banner de aviso en layout cuando quedan ≤5 días
- `StudioMe` type en frontend incluye `trial_ends_at`

#### Notificaciones automáticas diarias (APScheduler)
- `BackgroundScheduler` con `CronTrigger(hour=9)` montado en el `lifespan` de FastAPI
- Job `_job_notificar_urgentes()` recorre todos los tenants y envía emails de vencimientos urgentes
- `apscheduler==3.10.4` en `requirements.txt`

#### UX — Detalle de expediente
- Secciones colapsables muestran badges de resumen (honorarios pendientes, próximo vencimiento, tareas pendientes, cantidad de PDFs)
- "Resumen IA · Beta" movido al tope de la columna derecha, grisado con "Próximamente"
- Tiempo de vida del expediente calculado por días calendario en ART (no milisegundos exactos)

**Nuevas dependencias:** `apscheduler==3.10.4`, `pypdf==4.3.1`, `httpx` (ya era transitiva)
**Migraciones:** `2ceee8661236` (trial_ends_at), `f5e21ed7929a` (label+orden en documentos)
**Endpoints nuevos:** `GET /expedientes/{id}/actividad`, `GET /documentos/{id}/content`, `GET /documentos/merged-pdf`, `PATCH /documentos/{id}`

### v0.9.4 — 2026-04-16
- Sprint 10: US-21 — Perfil del estudio y del usuario
  - Avatar con iniciales + color derivado del nombre en sidebar y /perfil
  - Datos del estudio editables (nombre, logo URL, dirección+Maps, teléfono, email)
  - Datos personales editables (nombre, contraseña)
  - Sección Mi plan (placeholder Trial)
  - Router `GET/PATCH /studios/me`, `PATCH /users/me`
  - Migración `b01ebbc38c50` (studio: logo_url, direccion, telefono, email_contacto)

### v0.9.3 — 2026-04-16
- Sprint 09 COMPLETO
- US-15: GIN indexes full-text en expedientes + clientes, to_tsquery con prefix search
- TECH-001: Endpoints `/dev/*` protegidos con `ALLOW_DEV_ENDPOINTS` — no expuestos en prod
- US-11: Bloqueado hasta primer cliente real en producción

### v0.9.2 — 2026-04-16
- Sprint 09: US-AI-01 — Resumen IA de expedientes (OpenAI gpt-4o-mini, límite 5/día, badge desactualizado)
- Sprint 09: US-10 — Creación de expediente en wizard 2 pasos mobile-first (chips de fuero, stepper)
- Sprint 09: Invalidación automática del resumen al crear movimientos/vencimientos/tareas/pagos
- Sprint 08 planning doc actualizado con historias bloqueadas removidas

### v0.9.0 — 2026-04-15
- Sprint 08 COMPLETO — 117/117 tests pasan
- US-02: Vista Agenda unificada (vencimientos + tareas) con selector Hoy/Semana/Mes
- US-03: Email urgente de vencimientos via Resend (`POST /vencimientos/notificar-urgentes`)
- US-04: test_tareas.py — 16 tests, aislamiento tenant verificado en todas las entidades
- US-09: StatusBadge reutilizable — paleta unificada en toda la app
- US-18: ToastProvider global con useToast() hook
- US-08: EmptyState component con CTAs contextuales
- US-17: Rate limiting en login (5 intentos → 429 + Retry-After)

### v0.8.0 — 2026-04-15
- Sprint 08: US-01 — Módulo de Tareas completo (backend + frontend en expediente + página global)
- Sprint 08: EXP-AUTO-001 — Número de expediente autogenerado (EXP-{año}-{N}), estado siempre activo al crear
- Sprint 08: Sidebar con ítem Tareas
- Decisión funcional: vencimientos y tareas son entidades ortogonales (sin FK entre ellas)
- Decisión funcional: vencimientos = plazos procesales; tareas = trabajo interno del estudio

### v0.6.0 — 2026-04-15
- Sprint 06: Módulo de gastos completo (CONT-001) — modelo, CRUD, tests TDD
- Sprint 06: Widget financiero dashboard (CONT-002) — ingresos vs gastos, resultado neto
- Sprint 06: Google Calendar connect (VCT-004) — OAuth2 separado, selector, sync
- Sprint 06: Página `/perfil` — datos personales + sección Google Calendar
- Sprint 06: NOT-002 — panel dropdown de notificaciones urgentes con navegación
- Sprint 06: UX polish — pre-selección expediente, centrado forms, search expand, shortcut agnóstico
- Backend rebuilt con google-auth libraries

### v0.5.0 — 2026-04-15
- Sprint 04/05: Documentos en expedientes (MinIO + R2, presigned URLs, drag & drop)
- Sprint 05: Gestión del equipo completa (listar, cambiar rol, eliminar miembro)
- Sprint 05: UX — PageHelp en todas las pantallas principales
- Sprint 05: Dashboard con filtros de temporalidad (Hoy/Semana/Mes/Trimestre)
- Sprint 05: Sidebar limpiado — búsqueda movida a modal (próximamente)
- Backlog: módulo contable planificado (CONT-001 a CONT-004)
- Backlog: Sprint 05 planning documentado

### v0.4.0 — 2026-04-15
- Sprint 04: Honorarios + pagos + resumen dashboard
- Sprint 04: Búsqueda global, badge urgentes, iCal export
- Sprint 04: Email de invitación via Resend
- Sprint 04: Página aceptar-invitacion + register-invited endpoint

### v0.3.0 — 2026-04-15
- Sprint 02: Clientes CRUD + Expedientes CRUD + Movimientos
- Sprint 03: Vencimientos + Invitaciones + Dashboard con alertas
- Fix migración enums PostgreSQL con `postgresql.ENUM(create_type=False)`
- Layout con nav sticky + mobile nav

### v0.2.0 — 2026-04-15
- Auth completo: email+password + Google OAuth
- Google Cloud project: `lexcore-app`

### v0.1.0 — 2026-04-15
- Setup inicial: Docker Compose, FastAPI, Next.js 14, PostgreSQL
- Primera migración Alembic: tablas `studios` y `users`
