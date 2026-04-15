# LexCore — Estado del Producto

> **PROCESO RÍGIDO:** Este archivo se actualiza OBLIGATORIAMENTE al completar cada historia.
> Es la fuente de verdad del estado real del producto. Nunca debe quedar desactualizado.
> Si terminaste una feature y no actualizaste esto, la feature NO está done.

**Última actualización:** 2026-04-15
**Sprint activo:** Sprint 06 — cerrado ✓
**Versión:** 0.6.0

---

## Resumen ejecutivo

LexCore es una plataforma multi-tenant de gestión para estudios de abogados.
Estado actual: **producto funcional completo — clientes, expedientes, vencimientos, honorarios, documentos, equipo, gastos e invitaciones operativos. UX pulida con notificaciones con navegación, módulo contable con widget financiero y conector Google Calendar.**

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

### Vencimientos ✓ (Sprint 03 — 2026-04-15)
- [x] VCT-001: CRUD de vencimientos con filtros (próximos N días, cumplido/pendiente)
- [x] Alertas de urgencia: vencimientos a menos de 48hs se marcan como "Urgente"
- [ ] VCT-002: Push a Google Calendar — **pendiente** (base lista, falta service de Calendar)

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

## Features pendientes

### Sprint 07 — Planificado
- CONT-003: Costos por expediente (rentabilidad del caso)
- CONT-004: Facturación y comprobantes en PDF

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
