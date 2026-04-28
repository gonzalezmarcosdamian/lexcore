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

## PENDIENTES ACTIVAS

### Superadmin — Mejoras planificadas

> El superadmin actual tiene: lista de estudios, override plan/trial, gestión de precios (tabla `plan_prices`), metrics_snapshots.
> Analytics de funnels/conversión → Google Analytics 4 (ya integrado).
> Lo que sigue es lo que GA no puede darte: visibilidad interna de negocio y operaciones.

#### P0 — Sin esto operás a ciegas en prod

- **SADM-010** · Gestión de precios de planes desde UI — `idea`
  - Hoy los precios están en `plan_prices` en DB pero no hay UI para editarlos — hay que hacer SQL directo
  - CRUD de precios: plan (starter/pro/estudio), ciclo (mensual/anual), monto, moneda, vigente_desde
  - Historial completo: ver qué precio pagó cada estudio en cada período
  - **Ya existe:** tabla `plan_prices` + endpoint `GET/POST /superadmin/plan-prices`
  - **Falta:** UI en `/superadmin` para listar, crear y marcar precio activo

- **SADM-011** · Trials a punto de vencer — lista de contacto proactivo — `idea`
  - Lista de estudios en día 20-30 del trial, ordenados por `trial_ends_at ASC`
  - Muestra: nombre estudio, email admin, días restantes, actividad (expedientes, últimos 7 días)
  - CTA: "Extender trial" (ya existe el override) + "Copiar email" para contacto directo
  - **Valor:** permite contactar antes de que venza y mejora conversión trial → pago

- **SADM-012** · Consumo de storage en MB por tenant — `idea`
  - Sumar el peso de todos los documentos en R2/MinIO por `studio_id`
  - Mostrar en la tabla de estudios: columna "Storage" con MB usados
  - Endpoint: `GET /superadmin/studios/{id}/storage` que consulta la metadata de objetos en R2
  - **Valor:** saber qué estudio consume más y estimar costos de infraestructura

#### P1 — Visibilidad de uso y salud

- **SADM-013** · Actividad reciente por tenant — `idea`
  - Para cada estudio: último login, expedientes creados esta semana, movimientos esta semana, DAU/WAU
  - Permite identificar estudios activos vs dormidos vs que nunca arrancaron
  - Backend: queries sobre `expedientes.created_at`, `movimientos.created_at`, session logs (si existen)

- **SADM-014** · Adopción por feature — `idea`
  - ¿Qué % de estudios usa Google Calendar? ¿Módulo contable? ¿Resumen IA? ¿Documentos?
  - Métricas simples: `estudios_con_google_calendar / total_estudios`, etc.
  - Backend: queries a `users.google_calendar_id IS NOT NULL`, `gastos COUNT > 0`, etc.

- **SADM-015** · Métricas de retención semanal — `idea`
  - Estudios activos esta semana vs semana pasada vs hace 30 días
  - Gráfico de estudios que crearon al menos 1 acción en los últimos N días
  - Permite detectar churn temprano antes de que cancelen

- **SADM-016** · Exportar CSV de estudios/leads — `idea`
  - Exportar lista de estudios con: nombre, email admin, plan, trial_ends_at, created_at, última actividad
  - Para campañas de email, seguimiento comercial o análisis externo
  - Endpoint: `GET /superadmin/studios/export.csv`

#### P2 — Operaciones

- **SADM-017** · Log de errores recientes por tenant — `idea`
  - Ver si un estudio reportó errores en las últimas 24h (500s en los endpoints)
  - Útil para soporte: antes de responder a un usuario, ver si hubo errores del sistema
  - Implementación simple: tabla `error_logs` append-only en el middleware FastAPI

- **SADM-018** · Override de plan desde UI (ya existe el endpoint) — `idea`
  - El endpoint `PATCH /superadmin/studios/{id}/override` existe pero la UI es mínima
  - Mejorar: dropdown de plan, selector de fecha de vencimiento, campo de razón del cambio
  - Audit trail: mostrar historial de overrides anteriores para ese estudio

### Deuda técnica — Residuo "vencimientos" (migración conceptual a "movimientos")

> Contexto: El modelo DB ya se llama `Movimiento`/`movimientos`. El sidebar no tiene ítem "Vencimientos".
> `/vencimientos/[id]` ya redirige a `/movimientos/[id]`. Lo que sigue es limpieza progresiva post-MVP.

- **DT-VCT-001** · Breadcrumb y links de notificaciones urgentes — `done` (2026-04-28)
  - Breadcrumb `"Vencimientos"` → `"Agenda"` cuando pathname empieza con `/vencimientos`
  - `"Ver todos los vencimientos →"` → `"Ver en Agenda →"` apuntando a `/agenda`
  - Fallback sin expediente en notif urgentes → `/agenda` (antes `/vencimientos`)

- **DT-VCT-002** · Eliminar `/vencimientos/page.tsx` como lista independiente — `idea`
  - La página existe con filtros avanzados (tipo, estado, mes). Antes de eliminar, asegurar que la Agenda tenga esos mismos filtros
  - Agregar redirect `GET /vencimientos → /agenda` en Next.js middleware o page.tsx
  - **Precondición:** validar que ningún usuario tiene `/vencimientos` bookmarkeado en prod

- **DT-VCT-003** · Eliminar `/vencimientos/nuevo/page.tsx` — `idea`
  - El formulario de creación existe standalone. Crear desde la Agenda es suficiente
  - Redirigir a `/movimientos/nuevo?tipo=vencimiento` o al modal inline de agenda

- **DT-VCT-004** · Renombrar endpoint backend `/vencimientos/sync-calendar` → `/movimientos/sync-calendar` — `idea`
  - El prefijo `/vencimientos` en el router de sync es legacy. El endpoint sincroniza movimientos + tareas
  - **Impacto:** cambiar el router prefix, actualizar `perfil/page.tsx` y `calendar-sync-button.tsx`
  - **Riesgo:** bajo — es una URL interna, no pública

- **DT-VCT-005** · `tipo: default="vencimiento"` en modelo `Movimiento` → `"otro"` — `idea`
  - El default actual crea movimientos nuevos con tipo "vencimiento" aunque no lo sean
  - Fix: cambiar default a `"otro"` en el modelo + migración Alembic
  - **Riesgo:** bajo — solo afecta movimientos creados sin tipo explícito

- **DT-VCT-006** · Interface TypeScript `Vencimiento` en `api.ts` — `idea`
  - Existe como alias de `Movimiento` con campos heredados. Evaluar si merece un tipo unificado
  - **No urgente** — el tipado funciona, es deuda de naming

### P1 — Feedback usuarios (idea, sin iniciar)

- **UX-SHEET-001** · Bottom sheets mobile: swipe down mueve la pantalla de fondo en lugar de cerrar el sheet — `idea`
  - **Causa:** falta `overscroll-behavior: contain` + bloqueo de scroll del body cuando el sheet está abierto
  - **Fix:** agregar `document.body.style.overflow = 'hidden'` al abrir y restaurar al cerrar; `touch-action: pan-y` en el handle de arrastre
  - **Afecta:** todos los modales bottom-sheet de la app (agenda, contable, detalle tarea/vencimiento, etc.)

- **AUTH-SESSION-001** · Sesión Google OAuth vence muy seguido — usuario debe re-loguearse cada día — `idea`
  - **Causa probable:** `maxAge` de la sesión NextAuth está en el default (30 días) pero el `access_token` de Google vence en 1h y el refresh no está configurado
  - **Fix:** en NextAuth config, agregar `session: { maxAge: 30 * 24 * 60 * 60 }` y manejar el refresh del Google access_token en el callback `jwt`
  - **Prioridad alta:** es fricción diaria para usuarios con login Google

- **MOV-LOCALIDAD-001** · Movimiento procesal detalle: tribunal y localidad siempre visibles (con `—` si vacíos) — `done` (2026-04-28)
  - El detalle de un movimiento (`/movimientos/{id}`) no muestra en qué tribunal/localidad está radicado el expediente
  - **Fix:** en el endpoint `GET /movimientos/{id}` (o el componente frontend), incluir `expediente.juzgado` y `expediente.localidad` en la respuesta y mostrarlos en el header del detalle
  - **Ya existe:** el detalle de tarea y vencimiento ya muestran tribunal/localidad — aplicar el mismo patrón

---

## COMPLETADAS ✓

### Sprint 17 — 2026-04-27 (sesión actual)
- **CONT-HERO-001** · Hero financiero con gráfico de barras y chips 3M/6M/12M en módulo contable — `done`
- **CONT-FEED-001** · Feed unificado de movimientos (egresos + ingresos mezclados por fecha) con 5 items + ver todos — `done`
- **CONT-HON-001** · Card honorarios pendientes en contable + desglose vencidos/por cobrar en dashboard — `done`
- **CONT-MOBILE-001** · Layout mobile del módulo contable: barra de control 2 filas, rows de 2 líneas — `done`
- **GCAL-HON-001** · Honorarios con fecha_vencimiento y saldo pendiente incluidos en sync de Google Calendar — `done`
- **HON-COBRO-HOY-001** · Alerta "hoy tenés que cobrar" en dashboard cuando hay honorarios con fecha_vencimiento === hoy — `done`
- **CLT-ELIMINAR-001** · Eliminar cliente permanentemente (desvincula expedientes, no cascade) — `done`
- **CLT-DUPLICADO-001** · Validación DNI/CUIT único por tenant al crear y editar cliente — `done`
- **AGENDA-DIA-001** · Panel día en calendario: slide-over/modal centrado con todos los eventos + CTAs — `done`
- **UX-HELP-002** · Modales de ayuda actualizados a estado real de la app + fix overflow mobile — `done`
- **LANDING-001** · Landing page actualizada: features reales, alertas correctas, precio en ARS, FAQ Google Calendar — `done`
- **TEST-001** · +20 tests backend: duplicados cliente, eliminar permanente, histórico contable, honorarios resumen desglose — `done`

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
