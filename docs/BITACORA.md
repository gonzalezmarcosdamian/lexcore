# LexCore — Bitácora de Sesiones

> Una entrada por sesión de trabajo. Describe qué se hizo, qué decisiones se tomaron, qué quedó pendiente.

---

## Sesión 014 — 2026-04-28

**Sprint:** Sprint 17/18 (transición)
**Versión al cierre:** v0.21.0

### Qué se hizo

**Módulo Contable:**
- Hero financiero con gráfico de barras agrupadas (recharts), chips 3M/6M/12M
- Endpoint `GET /gastos/historico?meses=N` — evolución mensual en una sola query
- Feed unificado de movimientos (egresos + ingresos mezclados por fecha), 5 items + "Ver todos"
- Expediente y cliente navegables desde el feed
- Cards de totales en grilla 3×2, layout mobile 2 filas, rows de 2 líneas

**Honorarios:**
- `HonorarioResumen` ampliado: `saldo_vencido_ars`, `saldo_por_vencer_ars`, `count_*`
- Dashboard: 5 cards con escala K/M, separación vencidos vs por cobrar
- Alerta "Hoy tenés que cobrar" en dashboard
- Google Calendar sync incluye honorarios pendientes (`💰 Cobrar: concepto`)
- Cards individuales colapsables: saldado=cerrado, pendiente=abierto por default

**Clientes:**
- `DELETE /clientes/{id}/eliminar` — eliminación permanente con SET NULL en expedientes
- Validación DNI/CUIT/email únicos por tenant (crear y editar)
- Endpoint `GET /clientes/check-duplicado` — validación en `onBlur` antes del submit
- Errores mapeados al campo específico en el formulario

**Superadmin:**
- `list_studios` enriquecido: `ultima_actividad`, `exp_esta_semana`, `total_expedientes`, `total_usuarios`
- Card "Trials por vencer" al tope cuando hay estudios en últimos 10 días
- Botón "+15d" inline en tabla y card de trials
- `POST /superadmin/studios/{id}/extend-trial`
- Fix: `User.studio_id` → `User.tenant_id` (500 resuelto)

**Auth y sesión:**
- Refresh automático del Google `access_token` en NextAuth jwt callback
- Sesión efectiva: 30 días sin re-login

**Agenda:**
- Panel día al clickear en calendario: modal centrado con eventos + CTAs
- Chevron en hover de filas

**UX:**
- Bitácora colapsable (todo el expediente) con resumen en header cerrado
- Separadores de mes como marcas visuales (no colapsables por mes)
- Honorarios sección colapsable con totales en header cerrado
- Modales de ayuda actualizados + fix overflow mobile
- `useBodyScrollLock` hook en sheets y modales

**Google Analytics:**
- `@next/third-parties` instalado, `GoogleAnalytics` en root layout
- 8 eventos custom: `begin_registration`, `sign_up`, `login`, `first_cliente`, `first_expediente`, `first_movimiento`, `calendar_connected`, `calendar_sync`, `begin_checkout`
- GA4 activo: `G-BXJ8Y780BY`

**Tests:**
- +20 tests backend: duplicados cliente, eliminar permanente, histórico contable, honorarios resumen desglose
- Total: 197 tests, todos ✅

**Bugs resueltos:**
- `useState` dentro de IIFE en JSX → crash (ocurrió 2 veces, aprendizaje documentado)
- `DatatypeMismatch` en `order_by` de `actos-bitacora` (CASE date vs varchar)
- `User.studio_id` → `User.tenant_id` en superadmin
- `date` no importado en `honorarios.py` → 500 en resumen
- `hoy` no definido en scope de `resumen_honorarios` → 500

### Decisiones tomadas
- Bitácora: colapsable por expediente completo, marcas de mes solo visuales (no clickeables)
- Honorarios: saldado=colapsado, pendiente=expandido como default semántico
- Validación duplicados: onBlur con endpoint liviano, no solo en submit
- Google Analytics: carga condicional con `NEXT_PUBLIC_GA_ID`

### Pendiente (Sprint 18)
- AUTH-SESSION-001: sesión Google extendida (deployado, validar duración real)
- SADM-010: UI gestión de precios de planes
- UX-COLOR-001: paleta uniforme tareas=azul/movimientos=naranja
- UX-AGENDA-ROWS-001: filas de agenda con expediente+cliente visibles
- UX-SHEET-001: swipe-down para cerrar bottom sheets

---

## Sesión 013 — 2026-04-23

**Sprint:** Sprint 16

### Qué se hizo

**Feat: flag_paralizado en Tareas (agenda)**
- Botón "Paralizar" toggle en cards de kanban
- Filtro "Paralizadas" en agenda mobile y desktop (oculta vencimientos cuando está activo)
- Efecto visual congelado: gradiente icy azul + footer con copo de nieve en TareaCard y AgendaItemMobile
- Kanban reducido a 2 columnas
- FilterGroup pasa a stack vertical (feedback usuario)

**Feat: flag_paralizado en Expedientes**
- Migración `5fa0ba36dbc4` — columna `flag_paralizado` con `server_default=false`
- Botón toggle en header del detalle del expediente
- Estado (Activo/Archivado/Cerrado) movido al header como button group, removido del modal de edición
- Listado: efecto congelado con inline styles (Tailwind JIT no compila clases condicionales con opacity modifiers)
- `React.Fragment` necesario para retornar múltiples `<tr>` en `.map()`

**Fix: Tribunal/Localidad en páginas de detalle**
- Añadidos en bottom sheets (TareaDetailSheet, VencimientoDetailSheet)
- Añadidos en páginas desktop `/tareas/[id]` y `/vencimientos/[id]`

**Fix: Navegación mobile desde dashboard**
- `onDetailV`/`onDetailT` en dashboard ahora abren bottom sheet en mobile (window.innerWidth < 1024) en vez de navegar a la página de detalle (que redirigía a /agenda)

### Decisiones técnicas
- Inline styles obligatorios para clases Tailwind con opacity (`/60`) o variantes complejas en expresiones condicionales — JIT no las genera
- `server_default=sa.text('false')` obligatorio al agregar columna NOT NULL bool a tabla existente

### Versión taggeada
`v0.19.0`

---

## Sesión 012 — 2026-04-22

**Sprint:** Sprint 15+

### Qué se hizo

**Fix: duplicado de calendario en Agenda desktop (resuelto definitivamente)**
- El calendario aparecía dos veces en desktop. Causa raíz: al refactorizar mobile/desktop, se dejó un `CalendarioMensual` fuera de ambos divs. Fix final: un componente por sección (`lg:hidden` y `hidden lg:block`), el CSS de visibilidad es el único control.

**Feat: juzgado + localidad en header de detalle de expediente**
- Feedback via WhatsApp: el subtítulo mostraba cliente, ahora muestra `juzgado · localidad · fuero`.

**Feat: localidades de Córdoba y Argentina completas**
- `LOCALIDADES_ARG` expandido a ~60+ entradas. Córdoba primero con ~37 localidades.
- Aplicado en `expedientes/[id]/page.tsx` y `expedientes/nuevo/page.tsx`.

**Feat: Dashboard — carátula + juzgado/localidad en eventos**
- `VencimientoRow` y `TareaRow` muestran carátula del expediente y juzgado/localidad en vez de número + cliente.
- Calendario semanal: auto-height, pills más grandes (`text-xs py-1.5 px-2`), sin `slice(0,4)`.

**Feat: Clientes en nav top-level**
- "Clientes" movido a sección TRABAJO al mismo nivel que Expedientes, fuera del sub-menú.

**Feat: Acciones en header de detalle de cliente**
- Botones Editar/Archivar movidos al header. Card ACCIONES eliminada. Homologado con el resto de la app.

**Feat: Cuenta Corriente del cliente**
- Nuevo endpoint `GET /clientes/{id}/cuenta-corriente` — honorarios + pagos por expediente + ingresos directos.
- Frontend: sección expandible debajo del grid principal. KPIs ARS/USD, progreso de cobro, pagos desglosados.
- Mobile-first: filas verticales, padding responsivo, `pb-28` para nav flotante.

**Fix: Formato de domicilio**
- Domicilio almacenado desde geocoder era muy verboso ("Municipio de...", "Pedanía..."). `formatDomicilio()` filtra esos segmentos y deja solo calle, barrio, ciudad, provincia.

**Feat: Agenda mobile — rediseño unificado**
- Nuevo componente `AgendaItemMobile`: mismo componente para vencimientos y tareas.
- Dot de color identifica tipo (purple = vencimiento, blue = tarea).
- Tap en badge cicla el estado directamente (sin dropdown).
- Tap en fila navega al detalle. Sin botones inline de editar/eliminar.
- Colores semánticos unificados: amber = urgente, red = vencido, green = cumplido/hecho.

### Decisiones técnicas

- `AgendaItemMobile` es exclusivo de mobile. Desktop sigue con `VencimientoCard` / `TareaCard` + kanban drag-drop.
- `formatDomicilio()` vive en el componente de detalle de cliente (no en `api.ts`) porque es una transformación de display, no de datos.

### Pendiente

- Nada. Todo en producción.

---

## Sesión 011 — 2026-04-22

**Sprint:** Sprint 15+

### Qué se hizo

**Fix: no se podía borrar honorario — doble confirm**
- El botón tenía `confirm()` en el JSX y la función `eliminarHonorario` también tenía otro. Dos dialogs seguidos → el usuario cancela el segundo.
- Fix: eliminar confirm del `onClick`, mantenerlo solo en el handler.

**Fix: orden cronológico en calendar semanal del dashboard**
- El dashboard tenía su propio `eventosPorFecha` inline sin el sort por hora que sí tiene `calendar-mensual.tsx`.
- Eventos dentro de un día aparecían en orden de carga, no de hora.
- Fix: agregar el mismo bloque `sort()` al `useMemo` del dashboard.

**Feat: selector de expediente con búsqueda de texto — `ExpedienteSelect`**
- Nuevo componente `components/ui/expediente-select.tsx`
- Dropdown con input de búsqueda: filtra por número, carátula y cliente en tiempo real
- Reemplazó todos los `<select>` nativos de expediente en: `dashboard/page.tsx` (×3), `agenda/page.tsx` (×3), `vencimientos/nuevo/page.tsx`
- Prop `ringColor` para adaptar el color de foco al módulo

**Feat: documentos completos en detalle de tarea y vencimiento**
- Nuevo componente genérico `components/ui/documentos-section.tsx`
- Misma UX que `DocumentosTab` (drag-drop, preview, descarga, reordenar, label editable, eliminar)
- Acepta `tareaId`, `vencimientoId` o `expedienteId`
- Reemplazó `AdjuntosInline` en `/tareas/[id]` y `/vencimientos/[id]`

### Errores encontrados y cómo se resolvieron

| Error | Causa | Fix |
|-------|-------|-----|
| "No puedo borrar honorario" | Doble `confirm()` en botón y handler | Dejar confirm solo en el handler |
| Eventos del día desordenados | `eventosPorFecha` del dashboard sin sort | Agregar bloque sort al useMemo |
| `vercel deploy` falla con path `frontend/frontend` | CWD quedó en `frontend/` tras `cd frontend` en Bash tool | Usar rutas absolutas en todos los comandos de deploy |

### Decisiones tomadas
- `ExpedienteSelect` es el único componente válido para seleccionar expediente en cualquier modal/formulario. No crear `<select>` nuevos.
- `DocumentosSection` para tareas/vencimientos. `DocumentosTab` solo para expedientes.

### Pendiente (próxima sesión)
- **Cuenta corriente cliente (Opción B)**: campo `cliente_id` en `Ingreso`, sección en detalle del cliente con todos los ingresos asociados
- **Mejorar row de honorarios**: mostrar cantidad de pagos, fecha último pago, saldo más prominente
- Mejorar row de honorarios en expediente (estético)

---

## Sesión 010 — 2026-04-22

**Sprint:** Sprint 15 / Versión estable v0.16.0

### Qué se hizo

**Feat: Landing page pública completa**
- Reemplaza el redirect `/` → `/login` por una landing real de marketing
- Estructura UX Kid: hero con beneficio directo → dolor → solución → cómo funciona → precios → FAQ → CTA final
- Mockup del dashboard renderizado en código (sin imágenes externas)
- Nav sticky responsive, hamburger mobile, trust pills, accordion FAQ
- Copy en español orientado a abogados: sin jerga tech, con dolor real

**Docs: CHANGELOG.md creado**
- Historial completo desde v0.11.0 hasta v0.16.0
- Cada versión con Added/Fixed, migraciones y endpoints nuevos

**Versión v0.16.0 taggeada como estable**
- `git tag v0.16.0` sobre el commit de la landing
- PRODUCTO.md actualizado a v0.16.0 ESTABLE

### Decisiones tomadas
- Landing en Next.js (no Framer) para mantener un solo repo y un solo deploy
- Precio base sugerido en la landing: USD 39/mes por estudio (ajustable)
- El `/` público no requiere auth — el middleware de Next.js lo permite por whitelist

### Pendiente
- Reemplazar precio placeholder `USD 39` con precio real al definir modelo de pricing
- Agregar screenshots/capturas reales cuando haya estudios en prod
- Testimonios reales (backlog LAND-011/012)

---

## Sesión 009 — 2026-04-22

**Sprint:** Sprint 14

### Qué se hizo

**Feat: Páginas de detalle `/tareas/{id}` y `/vencimientos/{id}`**
- Reemplazados los modales read-only por páginas completas con URL propia
- Cada página incluye: todos los campos, estado toggleable, badges de tipo/urgencia, link al expediente, documentos adjuntos, sección de notas (bitácora propia)
- Las notas se guardan con autor y timestamp; soportan Ctrl+Enter para enviar
- Navegación de vuelta al expediente o a la lista según contexto

**Feat: Modelo `Nota` — bitácora de tareas y vencimientos**
- Nuevo modelo `backend/app/models/nota.py` con FK nullable a `tareas` y `vencimientos`, cascade delete
- Migración `dd8a608d6ac3_add_notas_table`
- Endpoints CRUD: `GET/POST /{tarea_id}/notas`, `DELETE /{tarea_id}/notas/{nota_id}` (igual para vencimientos)

**Fix: `GET /tareas/{id}` faltaba en el router**
- La página de detalle necesitaba obtener una tarea individual — endpoint inexistente
- Agregado en `backend/app/routers/tareas.py` usando helpers existentes

**Feat: Navegación desde todos los puntos de entrada**
- Dashboard (widget agenda, calendar, rows de tareas/vencimientos): `router.push`
- Agenda (tablero kanban, calendario mensual): `router.push`
- Lista `/tareas` y `/vencimientos`: `router.push`
- Detalle de cliente: vencimientos y tareas navegan al detalle
- Bitácora de expediente: rows de tipo "tarea" y "vencimiento" son clickeables (card completa con onClick)

**Fix: CalendarioMensual hardcodeaba navegación al expediente**
- El click en evento navegaba a `/expedientes/{id}` incondicionalmente
- Fix: nuevo prop `onClickEvento?: (ev: CalEvent) => void` — la agenda pasa `router.push`

**Feat: Chevron en cards del tablero kanban**
- Botón `›` siempre visible en cada card — señal visual de que hay un detalle navegable
- Botones editar/eliminar se muestran solo en hover (sin cambios)

**Fix: Google Calendar — scope sin forzar consent en cada sesión**
- El login de Google pedía scope de Calendar en cada autenticación
- Removido `calendar` scope del Google Provider en NextAuth + eliminado `prompt: "consent"` forzado
- El scope de Calendar solo se pide en el flujo explícito de `/perfil`

### Decisiones tomadas
- Entidades con vida propia (tarea, vencimiento) → página, nunca modal
- `Nota` denormaliza `autor_nombre` para evitar joins al listar
- `CalendarioMensual` recibe callback de navegación — no hardcodea destino

### Pendiente
- Migración `dd8a608d6ac3` debe aplicarse en Railway prod (`alembic upgrade head`)
- Páginas de edición `/tareas/{id}/editar` y `/vencimientos/{id}/editar` (referenciadas en detalle pero aún no creadas — hoy redirigen al modal desde el botón Editar)

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
