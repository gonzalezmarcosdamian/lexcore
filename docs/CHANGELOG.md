# LexCore — Changelog

> Formato: [Semantic Versioning](https://semver.org/). Cada versión estable se tagea en git.
> `MAJOR.MINOR.PATCH` — mientras estamos en `0.x`, cada feature es MINOR, cada fix es PATCH.

---

## [0.16.0] — 2026-04-22 · **ESTABLE** `v0.16.0`

### Added
- **Landing page pública** (`/`) — reemplaza el redirect directo a `/login`
  - Hero con headline orientado a beneficio, mockup del dashboard, 4 trust pills
  - Sección Dolor (3 pain points reales del abogado)
  - Sección Solución (6 features con beneficio, íconos, hover effects)
  - Sección Cómo funciona (3 pasos, fondo dark)
  - Pricing card con checklist completo, garantía 30 días
  - FAQ con accordion interactivo (6 preguntas/objeciones)
  - CTA final + footer con links legales
  - Nav sticky responsive con hamburger mobile
  - 100% Next.js + Tailwind, sin dependencias adicionales

### Added (Sprint 14)
- **Páginas de detalle** `/tareas/[id]` y `/vencimientos/[id]`
  - Todos los campos, estado toggleable, bitácora de notas, documentos adjuntos
- **Modelo `Nota`** — bitácora propia por tarea/vencimiento, cascade delete
  - Migración: `dd8a608d6ac3_add_notas_table`
  - Endpoints: `GET/POST/DELETE /tareas/{id}/notas`, ídem vencimientos
- **`GET /tareas/{id}`** — endpoint individual que faltaba
- **Navegación unificada** — todos los puntos de entrada usan `router.push` al detalle
  - Dashboard (widget agenda + rows), Agenda (tablero + calendario mensual)
  - Lista `/tareas`, `/vencimientos`, detalle de cliente, bitácora de expediente
- **Chevron `›`** en cards del tablero kanban (affordance visual de navegación)
- **`CalendarioMensual`** — nuevo prop `onClickEvento` (antes hardcodeaba `/expedientes`)
- **`?cliente_id=`** en `GET /tareas` — filtra tareas directas del cliente (sin expediente)
- **Documento `LANDING.md`** — especificación funcional + backlog P0/P1/P2 de la landing

### Fixed
- Google login no pide scope Calendar en cada sesión (solo en flujo explícito de `/perfil`)
- Eventos del calendario mensual navegaban al expediente en lugar de al detalle

---

## [0.15.0] — 2026-04-22

### Added (Sprint 13 / Sesión 008)
- AgendaWidget en dashboard (mini-semana navegable + panel día seleccionado)
- Picker Tarea/Vencimiento al clickear día en agenda
- Vencimientos editables/eliminables desde detalle de expediente con "↩ Deshacer"
- Bitácora registra todos los cambios de estado (vencimientos + tareas)
- Columnas de expediente con drag-and-drop y persistencia en localStorage
- Nuevas columnas: N° judicial, Juzgado, Localidad

### Fixed
- Timezone en calendario (usaba UTC en vez de ART)
- PDF preview en blanco — proxy backend via httpx con StreamingResponse
- SM hook mostraba contexto de proyecto equivocado

---

## [0.14.0] — 2026-04-21

### Added (Sprint 12)
- Detalle de expediente rediseñado — layout desktop 2 columnas
- Nombres de equipo en expedientes
- Módulo Ingresos completo (`/ingresos`, `GET/POST/PATCH/DELETE`)
- KPIs contables en dashboard (Ingresos, Egresos, Resultado, Hon. pendiente)
- SortModal reutilizable (popover desktop / fullscreen mobile)
- Nuevo vencimiento pre-cargado con contexto de expediente

---

## [0.13.0] — 2026-04-20

### Added (Sprint 11)
- Google Calendar sync desde `/perfil` (conectar, elegir calendario, sincronizar)
- Deduplicación via `extendedProperties.private.lexcore_sync=1`
- Módulo Gastos completo con recurrentes y puntuales
- Auto-creación de Ingreso contable al registrar pago de capital
- Vista tablero kanban en Agenda (drag-and-drop entre columnas)
- Vista calendario mensual con feriados argentinos automáticos (API externa)

### Fixed
- Variables de entorno Vercel con `\n` al final (usar `printf` no `echo`)
- Google Calendar scope `calendar` vs `calendar.events` (403 insufficientPermissions)

---

## [0.12.0] — 2026-04-16

### Added (Sprint 09–10)
- Resumen IA del expediente (OpenAI, badge "Desactualizado", 5 regen/día)
- Full-text search PostgreSQL con índices GIN, fallback a `ilike`
- Wizard 2 pasos mobile-first para crear expediente
- Rate limiting login (5 intentos → bloqueo 15 min, in-memory)
- Fix setup-studio inseguro (`ALLOW_DEV_ENDPOINTS` en Settings)
- Backend proxy para documentos Cloudinary (httpx + StreamingResponse)

---

## [0.11.0] — 2026-04-15

### Added (Sprints 01–08)
- Auth: registro, login, Google OAuth (NextAuth.js)
- Clientes CRUD (personas físicas y jurídicas, soft delete)
- Expedientes CRUD (número autogenerado `EXP-{año}-{NNNN}`, equipo con roles)
- Movimientos procesales (bitácora del expediente)
- Vencimientos CRUD con alertas urgencia (<48hs)
- Honorarios con pagos parciales ARS/USD, saldo calculado
- Documentos adjuntos (Cloudinary, drag & drop, 50MB)
- Tareas (CRUD, estados, responsable, vencidas en rojo)
- Agenda unificada (vencimientos + tareas, toggles inline)
- Módulo Gastos básico
- Búsqueda global (Cmd+K, debounce 300ms)
- Email invitaciones via Resend
- Equipo del estudio (roles, invitar, eliminar)
- Notificaciones urgentes in-app + email diario
- Dashboard con KPIs, widget agenda, gráfico expedientes
- iCal export + Google Calendar suscripción
- StatusBadge, ToastProvider, EmptyState, PageHelp — componentes UI reutilizables
- Tests: 117 tests, aislamiento multi-tenant validado

---

## Notas de versioning

- **`0.x.y`** — producto en desarrollo activo, sin contrato de API estable
- **`1.0.0`** — se tagea cuando el primer cliente pague y esté en producción estable
- Los tags de git corresponden a versiones estables deployadas en Railway + Vercel
