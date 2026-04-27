# LexCore — Backlog

> **Proceso obligatorio:** Ninguna historia pasa a un sprint sin estar en estado `refined`.
> Ninguna historia pasa a `done` sin que QA valide los criterios de aceptación.
> Después de cada feature implementada: actualizar `docs/producto/PRODUCTO.md`. Sin excepción.

---

## Estados de historia

| Estado | Significado |
|--------|-------------|
| `idea` | Capturada, sin refinar |
| `refined` | FA definió criterios de aceptación |
| `tech-approved` | TL aprobó el diseño técnico |
| `ready` | Lista para entrar a un sprint |
| `in-progress` | Dev trabajando |
| `in-review` | QA validando |
| `done` | Criterios cumplidos, PRODUCTO.md actualizado |
| `blocked` | Bloqueada — razón en comentario |

---

## Prioridades

- **P0** — Bloqueante para MVP. Sin esto no se puede usar el producto.
- **P1** — Importante para el valor del MVP.
- **P2** — Nice-to-have para MVP, entra si sobra tiempo.
- **backlog** — Post-MVP.

---

## COMPLETADAS ✓

### Auth
- **AUTH-001** · Registro de estudio y primer usuario admin — `done`
- **AUTH-002** · Login con email y contraseña — `done`
- **AUTH-003** · Middleware de protección de rutas frontend — `done`
- **AUTH-004** · Google OAuth (login con Google) — `done`
- **AUTH-005** · Google OAuth sin re-prompt de permisos de Calendar en cada sesión — `done` (Sprint 15)

### Clientes
- **CLT-001** · CRUD de clientes (física/jurídica, CUIT/DNI, búsqueda, soft delete) — `done`
- **CLT-002** · Cuenta corriente de cliente (honorarios + pagos + ingresos por expediente e ingresos directos) — `done`
- **CLT-003** · Detalle mobile-first con header, acciones y nav top-level — `done`

### Expedientes
- **EXP-001** · CRUD de expedientes (número autogenerado EXP-{año}-{NNNN}, carátula, fuero, juzgado, estado, cliente) — `done`
- **EXP-002** · Detalle con movimientos procesales (timeline cronológico) — `done`
- **EXP-003** · Múltiples abogados con roles (responsable/colaborador/supervisión) — `done`
- **EXP-NUM-001** · Número de expediente judicial manual (`numero_judicial`) + número interno autogenerado — `done`
- **EXP-LOC-001** · Campo `localidad` en expediente — `done`
- **EXP-CLI-MULTI-001** · Múltiples clientes por expediente (tabla `expediente_clientes`) — `done`
- **EXP-AUTO-001** · Número de expediente autogenerado + estado inicial activo — `done`
- **MOV-EDIT-001** · Editar y eliminar movimientos del expediente — `done`
- **US-10** · Creación de expediente en 2 pasos mobile-first — `done`
- **AGENDA-PAR-002** · `flag_paralizado` en expedientes con efecto visual congelado — `done`

### Vencimientos
- **VCT-001** · CRUD de vencimientos con alertas urgentes (<48hs) — `done`
- **VCT-002** · Lista de vencimientos próximos en dashboard — `done`
- **VCT-003** · iCal export (Apple Calendar, Outlook) — `done`
- **VCT-004** · Google Calendar sync — OAuth separado del login, selector de calendario, sync manual de vencimientos + tareas — `done`
- **VCT-HORA-001** · Hora opcional en vencimientos — `done`
- **GCAL-FIX-001** · Calendar: N° expediente + carátula en notas del evento (no UUID) — `done`
- **GCAL-FIX-002** · Calendar: dos alertas por evento (medianoche + 1h antes) — `done`
- **AUTH-GCAL-001** · Login Google no pide scope Calendar — flujos completamente separados — `done`

### Tareas
- **US-01** · Módulo de Tareas — CRUD completo, estados, filtros, vista global `/tareas` — `done`
- **US-06** · Tareas en detalle de expediente (sección colapsable) — `done`
- **AGENDA-PAR-001** · `flag_paralizado` en Tareas con efecto visual congelado — `done`

### Agenda
- **US-02** · Vista Agenda (vencimientos + tareas unificados) — vista diaria/semanal/mensual con feriados argentinos — `done`
- **AGENDA-001** · Kanban tablero drag-drop con columnas Pendiente / En curso / Hecho — `done`

### Honorarios
- **HON-001** · CRUD de honorarios por expediente (acordado + pagos + saldo) — `done`
- **HON-002** · Pagos parciales con tipo Capital / Intereses — `done`
- **HON-003** · Hero summary (acordado, cobrado, saldo, barra de progreso) por moneda — `done`
- **HON-004** · Botón "Completar saldo" en form de pago — `done`
- **HON-005** · Auto-creación de Ingreso contable al registrar pago de capital — `done`

### Documentos
- **DOC-001** · Upload de archivos a expediente (MinIO/R2, drag-drop, 50MB) — `done`
- **DOC-002** · Label editable, reordenamiento con ↑↓, merged PDF de expediente — `done`
- **DOC-003** · Backend proxy para documentos Cloudinary (preview + descarga) — `done`
- **UX-010** · Selector de expediente con búsqueda de texto (`ExpedienteSelect`) — `done`
- **UX-011** · `DocumentosSection` genérico para tarea/vencimiento (drag-drop, preview, reordenar) — `done`

### Contabilidad
- **CONT-001** · Módulo Gastos — CRUD, categorías, filtros — `done`
- **CONT-003** · Módulo Ingresos — CRUD — `done`
- **CONT-004** · Ingresos vinculados a expediente — `done`
- **CONT-005** · KPIs contables en dashboard (Ingresos, Egresos, Resultado, Honorarios pendientes) — `done`

### Notificaciones
- **NOT-001** · Badge de urgentes en sidebar/header (vencimientos < 48hs) — `done`
- **NOT-002** · Panel desplegable de notificaciones urgentes — `done`
- **US-03** · Email automático de vencimientos urgentes vía Resend — `done`
- **NOTIF-001** · APScheduler — job diario 9am, recorre todos los tenants — `done`

### Dashboard
- **DASH-001** · Gráfico de expedientes por estado con recharts — `done`
- **UX-007** · Nuevo vencimiento pre-cargado con contexto de expediente — `done`
- **FIX-NAV-001** · Navegación mobile desde dashboard abre bottom sheet (no redirige a /agenda) — `done`
- **FIX-008** · Orden cronológico en calendar semanal del dashboard — `done`

### UX / Ayuda contextual
- **UX-HELP-001** · Modales de ayuda actualizados al estado real de la app + fix overflow mobile — `done` (2026-04-27)

### UX / Páginas de detalle
- **UX-DETAIL-001** · Páginas de detalle `/tareas/{id}` y `/vencimientos/{id}` (read-only con edición inline, notas/minutas, documentos) — `done`
- **UX-DETAIL-002** · Tribunal y Localidad del expediente en detalles de tarea/vencimiento — `done`
- **US-09** · `StatusBadge` reutilizable con paleta unificada — `done`
- **US-18** · Skeleton loaders y toasts globales consistentes — `done`
- **US-08** · Empty states con onboarding guiado — `done`
- **UX-001** · Splash screen de value props (primera visita) — `done`
- **UX-002** · Skeletons de carga globales — `done`
- **UX-003** · Centrado de formularios ABM (`max-w-2xl mx-auto`) — `done`
- **UX-004** · Efecto de expansión en barras de búsqueda — `done`
- **UX-005** · Atajo ⌘K/Ctrl+K agnóstico de OS — `done`
- **UX-006** · Pre-selección de expediente en formularios — `done`
- **UX-014** · Dashboard navegación — click tarea/vencimiento navega, modal editar con todos los estados — `done`

### Búsqueda
- **BUS-001** · Búsqueda global modal Cmd+K (expedientes + clientes) — `done`
- **US-07** · Búsqueda funcional en mobile — `done`
- **US-15** · Índices full-text PostgreSQL (GIN) con fallback ilike — `done`

### Perfil y equipo
- **US-21** · Perfil del estudio y del usuario (logo, datos, Mi plan dinámico) — `done`
- **USR-001** · Invitar usuarios al estudio con email de activación — `done`
- **EXP-BIT-001** · Bitácora unificada con feed de actividad del expediente — `done`
- **BIT-003** · Bitácora limpia (sin entradas "editado" redundantes) — `done`

### AI
- **US-AI-01** · Resumen IA del expediente (OpenAI, badge Desactualizado, 5 regen/día) — `done`

### Seguridad
- **US-17** · Rate limiting login (5 intentos → bloqueo 15min) + política de contraseñas — `done`
- **US-04** · Tests de aislamiento tenant completos (117+ tests) — `done`
- **TECH-001** · Fix setup-studio inseguro (`ALLOW_DEV_ENDPOINTS`) — `done`

### Legal y monetización
- **LEGAL-001** · Política de Privacidad `/privacidad` (Ley 25.326) — `done`
- **LEGAL-002** · Términos y Condiciones `/terminos` con checkbox en registro — `done`
- **TRIAL-001** · Sistema de trial 30 días (`trial_ends_at`, banner aviso, modo lectura día 31) — `done`
- **SUBS-001** · Modelo de suscripción en Studio y User (plan, billing, is_superadmin) — `done`
- **SUBS-002** · Checkout MercadoPago + webhook — `done`
- **SUBS-003** · Access level y modo lectura (RequireFullAccess dependency) — `done`
- **SUBS-004** · Límite de usuarios por plan — `done`
- **SUBS-006** · Portal de suscripción en /perfil — `done`
- **SADM-001** · Superadmin backend (studios, override plan, plan-prices) — `done`

### Landing
- **LAND-P0** · Landing page pública `/` — Nav, Hero, Dolor, Solución, Pricing, FAQ, Footer — `done`

---

## PENDIENTES ACTIVAS

### P1 — In progress
- **UX-DASH-001** · Rediseño dashboard — calendario semanal prominente — `in-progress`
  - Implementación parcial (commit d69df03): columnas 280px, pills de eventos, KPIs compactos
  - Pendiente de validación con el usuario: altura del calendario, legibilidad de pills, selector de período

---

## BLOQUEADAS (Post-MVP — no planificar)

- **US-11** · Observabilidad Sentry — activar al tener primer cliente real en producción
- **US-12** · Generador de cabecera de escrito — Post-MVP
- **US-13** · Portal de cliente (vista de solo lectura para clientes) — Post-MVP
- **US-16** · Registro de tiempo facturable (timesheets) — Post-MVP
- **US-20** · Swap Auth JWT → Supabase con MFA — Post-MVP
- **US-19** · Integración PJN — Descartada para MVP

---

## BACKLOG (Post-MVP)

> Research sobre dolores de LexDoctor (líder del mercado) — 2026-04-15.
> Oportunidad: SaaS mobile-first, simple, asequible, con IA — exactamente lo que LexCore apunta a ser.

### CX-001 · Centro de ayuda + Reporte de problemas
- **Prioridad:** P1 | **Esfuerzo:** 10pts (Fase 1: 5pts, Fase 2: 5pts)
- **Componente A:** Widget flotante `[?]` fijo bottom-right con FAQs por módulo + buscador
- **Componente B:** Formulario de reporte estructurado (módulo, descripción, captura) con contexto automático (URL, browser, tenant_id, user_id)
- **Componente C:** Panel interno admin `/admin/soporte` con lista de tickets, estados, respuesta al usuario
- **DB:** tabla `soporte_tickets` con campos: numero, tenant_id, user_id, modulo, descripcion, captura_url, urgente, estado, url_origen, browser_info, nota_interna

### CONT-002 · Dashboard financiero avanzado
- Gráfico barras mensual ingresos vs egresos, filtros personalizados, exportar CSV

### CONT-003 · Rentabilidad por expediente
- Tab "Finanzas" en detalle: honorarios vs gastos imputados, registro de horas

### CONT-004 · Facturación y comprobantes PDF
- Recibo de honorarios en PDF, envío por email, guardado como documento del expediente

### NOT-003 · Notificaciones personalizadas por perfil
- Filtrar por expedientes asignados, configuración por usuario

### DASH-001 · Filtros de temporalidad avanzados (rango personalizado)
- Date picker de rango personalizado con persistencia en localStorage

### RPT-001 · Reporte de actividad del estudio
- Dashboard con métricas exportables

### RPT-002 · Exportar expedientes a PDF
- Ficha completa del expediente exportable

### INT-001 · Integración con PJN
- Consulta automática de estado del expediente

### INT-002 · Seguimiento automático de expedientes (scraping/API PJN)
- Detectar movimientos automáticamente y crear movimientos en LexCore

### MOB-001 · PWA mobile
- Instalar LexCore como app, notificaciones push nativas

### AI-001 · Redacción asistida de escritos con IA
- Desde el expediente, generar borrador de escrito con contexto real del caso

### AI-002 · Resumen automático con IA (briefing semanal)
- Digest de vencimientos críticos, cron lunes 7am, agregado de toda la cartera
