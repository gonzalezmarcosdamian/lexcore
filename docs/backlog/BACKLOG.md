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

### AUTH-001 · Registro de estudio y primer usuario admin — `done`
### AUTH-002 · Login con email y contraseña — `done`
### AUTH-003 · Middleware de protección de rutas frontend — `done`
### AUTH-004 · Google OAuth (login con Google) — `done`

---

## P0 — Bloqueante MVP

### CLT-001 · CRUD de clientes
- **Estado:** `idea`
- **Sprint target:** Sprint 02
- **Como** abogado, **quiero** registrar y gestionar mis clientes **para** asociarlos a expedientes y tener sus datos de contacto a mano.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo crear cliente con nombre, tipo (física/jurídica), CUIT/DNI, teléfono, email
  - [ ] CA2: Puedo buscar clientes por nombre o CUIT/DNI
  - [ ] CA3: Puedo editar y archivar clientes
  - [ ] CA4: Un cliente archivado no aparece en búsquedas por defecto
  - [ ] CA5: No puedo ver clientes de otro estudio (test de aislamiento tenant)
- **Casos borde:** CUIT duplicado en el mismo estudio, cliente con expedientes activos al archivar

### EXP-001 · CRUD de expedientes
- **Estado:** `idea`
- **Sprint target:** Sprint 02
- **Como** abogado, **quiero** crear y gestionar expedientes **para** llevar el registro central de mis casos.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo crear expediente con: número (juzgado), carátula, fuero, juzgado, estado, cliente, abogado responsable, fecha inicio
  - [ ] CA2: Puedo buscar por número de expediente o carátula
  - [ ] CA3: Estados: activo / archivado / cerrado
  - [ ] CA4: Un expediente siempre tiene al menos un abogado responsable
  - [ ] CA5: Puedo ver todos los expedientes de un cliente desde su ficha
  - [ ] CA6: Test de aislamiento tenant
- **Casos borde:** expediente sin cliente (asesoramiento general), cambio de estado con vencimientos pendientes

### EXP-002 · Detalle de expediente con timeline
- **Estado:** `idea`
- **Sprint target:** Sprint 02
- **Como** abogado, **quiero** ver el historial de movimientos de un expediente **para** entender el estado actual del caso de un vistazo.
- **Criterios de aceptación:**
  - [ ] CA1: Vista de detalle muestra datos del expediente + vencimientos próximos + últimos movimientos
  - [ ] CA2: Puedo agregar notas/movimientos al expediente (texto libre con fecha)
  - [ ] CA3: Los movimientos se muestran en orden cronológico inverso
- **Casos borde:** expediente nuevo sin movimientos

### VCT-004 · Sync directo con Google Calendar (agnóstico al método de login)
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** abogado (con cualquier método de login — email o Google), **quiero** conectar mi Google Calendar a LexCore y elegir en qué calendario sincronizar mis vencimientos **para** tener mi agenda judicial actualizada automáticamente sin cambiar cómo inicio sesión.
- **Criterios de aceptación:**
  - [ ] CA1: En `/perfil` o `/configuracion`, sección "Conectar Google Calendar" con botón "Conectar" — disponible para TODOS los usuarios (email o Google OAuth)
  - [ ] CA2: Al hacer click en "Conectar", se inicia un OAuth2 flow específico para Calendar (scope: `https://www.googleapis.com/auth/calendar.events`) — separado del login
  - [ ] CA3: Tras autorizar, el backend guarda el `google_refresh_token` en el usuario. La pantalla muestra "✓ Google Calendar conectado" con opción de desconectar
  - [ ] CA4: El usuario ve un selector "¿En qué calendario querés sincronizar?" con sus calendarios disponibles (Google Calendar API devuelve la lista). Default: "primary"
  - [ ] CA5: La elección de calendario se guarda en DB (`google_calendar_id` en el modelo `User`)
  - [ ] CA6: El botón "Sync Calendar" en Vencimientos activa el sync — todos los vencimientos pendientes se pushean al calendario elegido
  - [ ] CA7: Feedback: spinner + toast "X vencimientos sincronizados a [nombre del calendario]"
  - [ ] CA8: Vencimientos ya sincronizados se actualizan (no se duplican — usa `google_event_ids`)
  - [ ] CA9: Si el usuario desconecta Calendar, el botón "Sync Calendar" vuelve a mostrarse deshabilitado con "Conectar Calendar primero"
  - [ ] CA10: Al crear/editar/eliminar un vencimiento, si el usuario tiene Calendar conectado, el evento se actualiza automáticamente en background
- **Flujo técnico:**
  ```
  Usuario (email auth)
      → click "Conectar Google Calendar" en /perfil
      → backend genera URL OAuth2 (solo scope Calendar, no login)
          GET /auth/google-calendar/connect → redirect a Google
      → Google pide permiso para Calendar
      → callback: GET /auth/google-calendar/callback?code=...
          → intercambia code por tokens
          → guarda refresh_token en User.google_refresh_token
          → guarda calendar_id elegido en User.google_calendar_id
      → frontend redirige a /perfil con "✓ conectado"
  
  Sync:
      POST /vencimientos/sync-calendar
          → toma User.google_refresh_token
          → lista vencimientos pendientes del tenant
          → crea/actualiza eventos en User.google_calendar_id
          → guarda event_id en Vencimiento.google_event_ids
  ```
- **Notas técnicas:**
  - Columna `google_refresh_token` ya existe en `User` — se popula aquí también para usuarios email
  - Agregar columna `google_calendar_id: str | None` al modelo `User` (nueva migración)
  - Endpoint nuevo: `GET /auth/google-calendar/connect` + `GET /auth/google-calendar/callback`
  - No hay prerequisito de login con Google — cualquier usuario puede conectar Calendar independientemente
- **UX clave:** el selector de calendario muestra el nombre amigable (ej: "Agenda personal", "Trabajo", "LexCore Vencimientos") — no el ID técnico

### VCT-001 · Vencimientos con push a Google Calendar
- **Estado:** `idea`
- **Sprint target:** Sprint 03
- **Blocker parcial:** Requiere que el usuario haya iniciado sesión con Google (refresh token en DB)
- **Como** abogado, **quiero** registrar vencimientos en LexCore y que aparezcan en Google Calendar **para** no perder ningún plazo.
- **Criterios de aceptación:**
  - [ ] CA1: Al crear vencimiento, se pushea evento a Google Calendar de cada usuario vinculado al expediente
  - [ ] CA2: Wording del evento varía según rol (admin/socio: supervisión, asociado: acción requerida, pasante: info)
  - [ ] CA3: El evento tiene recordatorios: 7 días, 48hs, 2hs
  - [ ] CA4: Al editar fecha → el evento en Calendar se actualiza
  - [ ] CA5: Al eliminar vencimiento → el evento se elimina de Calendar
  - [ ] CA6: Si el usuario no tiene Google token, el vencimiento se guarda igual (sin push)
- **Wording por rol:**
  - `admin/socio`: `[VCTO] {carátula} — {tipo}` + "Vencimiento crítico bajo su supervisión."
  - `asociado`: `[VCTO - ACCIÓN REQUERIDA] {carátula} — {tipo}` + "Debés gestionar este vencimiento."
  - `pasante`: `[VCTO - INFO] {carátula} — {tipo}` + "Vencimiento en expediente donde colaborás."

### VCT-002 · Lista de vencimientos próximos (dashboard)
- **Estado:** `idea`
- **Sprint target:** Sprint 03
- **Como** abogado, **quiero** ver mis vencimientos de los próximos 30 días ordenados por urgencia **para** priorizar mi trabajo del día.
- **Criterios de aceptación:**
  - [ ] CA1: Dashboard muestra vencimientos ordenados por fecha
  - [ ] CA2: Vencimientos < 48hs marcados como urgentes (rojo)
  - [ ] CA3: Vencimientos 2-7 días marcados como próximos (amarillo)
  - [ ] CA4: Puedo marcar un vencimiento como cumplido desde esta vista
  - [ ] CA5: Filtro por abogado responsable (para admins)

---

## P1 — Importantes para MVP

### USR-001 · Invitar usuarios al estudio
- **Estado:** `idea`
- **Sprint target:** Sprint 03
- **Como** admin, **quiero** invitar a abogados a mi estudio **para** que puedan ver y gestionar expedientes.
- **Criterios de aceptación:**
  - [ ] CA1: Admin puede crear usuarios con email, nombre y rol (socio/asociado/pasante)
  - [ ] CA2: El usuario invitado recibe email con link de activación (o contraseña temporal)
  - [ ] CA3: Admin puede cambiar el rol de un usuario
  - [ ] CA4: Admin puede desactivar un usuario (no puede loguearse más)
  - [ ] CA5: Un usuario desactivado no aparece como responsable en expedientes nuevos

### EXP-003 · Asignar múltiples abogados a un expediente con roles
- **Estado:** `idea`
- **Sprint target:** Sprint 03
- **Como** abogado, **quiero** asignar varios abogados a un expediente con roles específicos **para** que cada uno sepa su responsabilidad y reciba los vencimientos correctos.
- **Criterios de aceptación:**
  - [ ] CA1: Un expediente puede tener N abogados, cada uno con un rol en el expediente (responsable principal, colaborador, supervisión)
  - [ ] CA2: El rol en el expediente determina el wording del Calendar push (VCT-001)
  - [ ] CA3: Al cambiar el equipo del expediente, los Calendar events existentes se actualizan

### CLT-002 · Historial de expedientes por cliente
- **Estado:** `idea`
- **Sprint target:** Sprint 03
- **Como** abogado, **quiero** ver todos los expedientes de un cliente desde su ficha **para** entender la relación completa con ese cliente.
- **Criterios de aceptación:**
  - [ ] CA1: Ficha de cliente muestra expedientes activos y cerrados
  - [ ] CA2: Desde la ficha puedo crear un nuevo expediente pre-asociado al cliente

### HON-001 · Registro básico de honorarios por expediente
- **Estado:** `idea`
- **Sprint target:** Sprint 04
- **Como** abogado, **quiero** registrar los honorarios acordados y pagos recibidos por expediente **para** saber qué me deben.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo registrar monto acordado, forma de pago y cuotas
  - [ ] CA2: Puedo registrar pagos recibidos con fecha
  - [ ] CA3: El sistema muestra el saldo pendiente
  - [ ] CA4: Resumen de honorarios pendientes en el dashboard

---

## P2 — Nice-to-have MVP

### UX-006 · Pre-selección de expediente en formularios de creación
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** abogado, **quiero** que al crear un vencimiento, honorario o movimiento desde el detalle de un expediente, ese expediente ya esté seleccionado en el formulario **para** no tener que buscarlo manualmente y evitar errores de asignación.
- **Criterios de aceptación:**
  - [ ] CA1: Al ir a "Nuevo vencimiento" desde el detalle de un expediente (`/expedientes/{id}`), el campo expediente viene pre-seleccionado y bloqueado (no editable)
  - [ ] CA2: Al crear un honorario desde la pestaña Honorarios del expediente, el `expediente_id` se pasa automáticamente — sin selector visible
  - [ ] CA3: Al agregar un movimiento desde la pestaña Movimientos, el `expediente_id` viene implícito — igual que hoy pero verificar que nunca se pida al usuario
  - [ ] CA4: Si el formulario se accede desde `/vencimientos/nuevo` (flujo global, sin contexto de expediente), el selector aparece vacío y editable como siempre
  - [ ] CA5: El breadcrumb o un banner informativo muestra "Creando para: EXP-2026-XXX — Carátula" cuando viene pre-seleccionado
- **Mecanismo técnico:** pasar `?expediente_id=xxx` como query param en la navegación. El form lee el param y pre-llena + deshabilita el campo.
- **Alcance:** vencimientos, honorarios. Movimientos y documentos ya funcionan en contexto — verificar.
- **Casos borde:** si el `expediente_id` del query param no existe o no pertenece al tenant → ignorar y mostrar selector vacío.

### UX-003 · Centrado de formularios ABM
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** usuario, **quiero** que los formularios de creación/edición (clientes, expedientes, vencimientos) estén centrados y con ancho máximo controlado **para** que sean más cómodos de leer y completar en pantallas grandes.
- **Criterios de aceptación:**
  - [ ] CA1: Todos los forms de nuevo/edición tienen `max-w-2xl mx-auto` o similar
  - [ ] CA2: El layout es coherente entre `/clientes/nuevo`, `/expedientes/nuevo`, `/vencimientos/nuevo`
  - [ ] CA3: En mobile (375px) ocupan el 100% del ancho disponible
  - [ ] CA4: Los campos usan un grid de 1 col en mobile y 2 col en desktop donde tiene sentido

### UX-004 · Efecto de expansión en barras de búsqueda
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** usuario, **quiero** que las barras de búsqueda se expandan visualmente al enfocarlas **para** tener más espacio para escribir y percibir que están activas.
- **Criterios de aceptación:**
  - [ ] CA1: Al hacer focus, la barra crece con una transición suave (`transition-all duration-200 ease-in-out`)
  - [ ] CA2: El borde cambia de `border-ink-200` a `ring-2 ring-brand-400` al enfocar (ya tiene focus ring — sumar el width expansion)
  - [ ] CA3: Aplica en: búsqueda de clientes, búsqueda de expedientes, búsqueda de vencimientos
  - [ ] CA4: En mobile el efecto es más sutil (solo cambio de borde, no expansión de ancho)

### UX-005 · Atajo de búsqueda agnóstico (⌘K / Ctrl+K)
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** usuario en Windows/Linux, **quiero** ver `Ctrl+K` en lugar de `⌘K` **para** que el atajo del modal de búsqueda sea claro para mi sistema operativo.
- **Criterios de aceptación:**
  - [ ] CA1: El badge del botón "Buscar" en el topbar detecta el OS y muestra `⌘K` (Mac) o `Ctrl+K` (Windows/Linux)
  - [ ] CA2: El atajo funciona igual en todos los sistemas (ya funciona — solo es visual)
  - [ ] CA3: Detección via `navigator.platform` o `navigator.userAgentData.platform`
- **Notas:** El shortcut ya es funcional con `e.metaKey || e.ctrlKey`. Solo falta el label dinámico.

### NOT-002 · Panel de notificaciones desplegable con navegación
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** abogado, **quiero** hacer click en el badge de urgentes y ver un panel con todas mis notificaciones pendientes **para** navegar directamente al expediente o vencimiento sin pasar por pantallas intermedias.
- **Criterios de aceptación:**
  - [ ] CA1: Click en el pill/badge de urgentes abre un panel desplegable (dropdown) anclado al header
  - [ ] CA2: El panel muestra notificaciones agrupadas: urgentes (< 48hs), esta semana, informativas
  - [ ] CA3: Cada notificación muestra: tipo (audiencia/presentación/etc), descripción, fecha, expediente vinculado
  - [ ] CA4: Click en una notificación navega directamente al expediente correspondiente y cierra el panel
  - [ ] CA5: Botón "Marcar todas como vistas" que baja el badge a cero (persiste en localStorage o backend)
  - [ ] CA6: Click fuera del panel lo cierra
  - [ ] CA7: El panel es responsive — en mobile ocupa ancho completo desde abajo (bottom sheet)
- **Notas UX:** Las notificaciones son actualmente los vencimientos urgentes del usuario. En el futuro se extiende a movimientos en expedientes asignados, mensajes, etc.

### NOT-003 · Notificaciones personalizadas por perfil
- **Estado:** `idea`
- **Sprint target:** Sprint 07
- **Como** abogado, **quiero** recibir notificaciones solo de los expedientes y vencimientos que me están asignados **para** no ver ruido de lo que no me corresponde.
- **Criterios de aceptación:**
  - [ ] CA1: Las notificaciones urgentes filtran por `user_id` en `expediente_abogados` — solo vencimientos de mis expedientes
  - [ ] CA2: Al agregar un abogado a un expediente, ese abogado empieza a recibir sus vencimientos en el badge
  - [ ] CA3: Admins y socios ven todas las notificaciones del estudio (sin filtro de asignación)
  - [ ] CA4: Configuración por usuario: "Notificarme de todos los expedientes" o "Solo los míos"
- **Dependencias:** NOT-002

### DASH-001 · Filtros de temporalidad avanzados en dashboard
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** abogado, **quiero** filtrar el dashboard por período personalizado **para** ver el estado del estudio en rangos de tiempo específicos, no solo los presets fijos.
- **Criterios de aceptación:**
  - [ ] CA1: Además de los pills Hoy / Esta semana / Este mes / Trimestre, hay opción "Personalizado" que abre un date picker de rango
  - [ ] CA2: El filtro afecta vencimientos, métricas de expedientes nuevos en el período y honorarios cobrados en el período
  - [ ] CA3: El período seleccionado persiste en localStorage al navegar entre secciones
  - [ ] CA4: Badge visual en el header que muestra el período activo cuando no es el default (Este mes)
- **Notas:** Los pills base (Hoy, Semana, Mes, Trimestre) ya están implementados en Sprint 05. Esta historia agrega el rango personalizado y persistencia.

### UX-001 · Splash screen de value props (primera visita)
- **Estado:** `done`
- **Sprint target:** Sprint 05
- **Como** nuevo usuario, **quiero** ver en qué me ayuda LexCore al abrir el sistema por primera vez **para** entender el valor de la plataforma antes de usar el dashboard.
- **Criterios de aceptación:**
  - [ ] CA1: La pantalla aparece una sola vez, la primera vez que el usuario accede al dashboard (marcado en localStorage)
  - [ ] CA2: Muestra 3-4 value props clave con ícono, título y descripción breve (ej: "Tus expedientes, siempre a mano", "Nunca más perdas un vencimiento", "Tu equipo sincronizado")
  - [ ] CA3: Botón "Comenzar" que cierra el splash y lleva al dashboard
  - [ ] CA4: Animación de entrada suave (fade + slide), diseño mobile-first
  - [ ] CA5: Si el usuario recarga o cierra sesión, el splash NO vuelve a aparecer
  - [ ] CA6: El splash NO aparece en cuentas que ya tienen expedientes/datos (solo usuarios realmente nuevos)
- **Casos borde:** usuario que borra localStorage → vuelve a ver el splash (aceptable); usuario que usa incógnito → ve splash siempre (aceptable)
- **Notas UX:** Mobile-first 375px. Fondo oscuro/brand con texto blanco. Skip opcional en corner superior derecho.

### UX-002 · Skeletons de carga globales
- **Estado:** `done`
- **Sprint target:** Sprint 05
- **Como** usuario, **quiero** ver placeholders animados mientras se carga el contenido **para** percibir que el sistema responde y no pensar que está roto.
- **Criterios de aceptación:**
  - [ ] CA1: Todas las listas de entidades (expedientes, clientes, vencimientos, honorarios, documentos) muestran skeleton rows durante la carga inicial
  - [ ] CA2: Las métricas del dashboard muestran skeleton en lugar de "—" o espacios vacíos
  - [ ] CA3: Los tabs del detalle de expediente muestran skeleton mientras cargan su contenido
  - [ ] CA4: El sidebar/navbar muestra el nombre del usuario y rol con skeleton hasta que la sesión carga
  - [ ] CA5: Los skeletons tienen animación `animate-pulse` coherente con el design system (bg-ink-100)
  - [ ] CA6: Transición suave del skeleton al contenido real (sin parpadeo brusco)
- **Notas UX:** Usar el patrón SkeletonRow ya existente en expedientes/clientes como referencia. Crear componentes reutilizables `SkeletonCard`, `SkeletonRow`, `SkeletonStat`.

### DOC-001 · Adjuntar documentos a expedientes
- **Estado:** `idea`
- **Sprint target:** Sprint 04
- **Como** abogado, **quiero** adjuntar archivos a un expediente **para** tener la documentación centralizada.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo subir PDF, Word, imágenes (máx 10MB por archivo)
  - [ ] CA2: Los archivos se listan en el detalle del expediente
  - [ ] CA3: Puedo eliminar archivos que subí yo

### NOT-001 · Notificaciones in-app de vencimientos urgentes
- **Estado:** `idea`
- **Sprint target:** Sprint 04
- **Como** abogado, **quiero** recibir un aviso dentro de LexCore cuando tengo un vencimiento urgente **para** no depender solo de Google Calendar.
- **Criterios de aceptación:**
  - [ ] CA1: Badge en el navbar con cantidad de vencimientos urgentes (< 48hs)
  - [ ] CA2: Lista de notificaciones al hacer click en el badge
  - [ ] CA3: Puedo marcar notificaciones como leídas

### BUS-001 · Búsqueda global (modal Cmd+K)
- **Estado:** `done`
- **Sprint target:** Sprint 05
- **Como** abogado, **quiero** buscar desde cualquier pantalla con un atajo de teclado o botón en el topbar **para** encontrar expedientes y clientes rápido sin que la búsqueda ocupe espacio fijo en la UI.
- **Criterios de aceptación:**
  - [ ] CA1: Atajo `Cmd+K` (Mac) / `Ctrl+K` (Windows) abre un modal de búsqueda centrado
  - [ ] CA2: También hay un ícono de lupa en el topbar (header) para abrirlo con click
  - [ ] CA3: La búsqueda NO está en el sidebar — el sidebar queda limpio solo con navegación
  - [ ] CA4: Resultados agrupados: expedientes, clientes — mínimo 3 caracteres para disparar
  - [ ] CA5: Click en resultado navega al detalle y cierra el modal
  - [ ] CA6: `Escape` cierra el modal
  - [ ] CA7: Overlay oscuro detrás del modal (click fuera cierra)
- **Notas UX:** El input del modal tiene foco automático al abrir. Diseño similar a Spotlight / Linear / Vercel — modal grande y centrado, no un panel lateral.

---

## P1 — Módulo Contable (próximo foco)

### CONT-001 · Gastos y costos del estudio
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** admin/socio, **quiero** registrar los gastos operativos del estudio (alquiler, sueldos, servicios, costos judiciales) **para** tener visibilidad del costo real del negocio.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo registrar un gasto con: categoría, descripción, monto, moneda (ARS/USD), fecha, y si es recurrente
  - [ ] CA2: Categorías: Alquiler, Sueldos, Servicios (luz/internet/etc), Costos judiciales (sellados, tasas), Honorarios a terceros, Otros
  - [ ] CA3: Gasto puede vincularse opcionalmente a un expediente (costo del caso)
  - [ ] CA4: Lista de gastos con filtros por período, categoría y expediente
  - [ ] CA5: Test de aislamiento tenant obligatorio
- **Casos borde:** gasto en USD con tipo de cambio, gasto recurrente mensual

### CONT-002 · Dashboard financiero del estudio
- **Estado:** `idea`
- **Sprint target:** Sprint 06
- **Como** admin/socio, **quiero** ver en un solo lugar honorarios cobrados, gastos del período y resultado neto del estudio **para** tomar decisiones financieras informadas.
- **Criterios de aceptación:**
  - [ ] CA1: Widget "Resultado del período" = honorarios cobrados − gastos del período
  - [ ] CA2: Gráfico de barras mensual: ingresos (honorarios cobrados) vs egresos (gastos)
  - [ ] CA3: Filtros de temporalidad: Este mes / Trimestre / Año / Personalizado
  - [ ] CA4: Desglose de gastos por categoría (pie chart o barras apiladas)
  - [ ] CA5: Exportar a CSV: honorarios + gastos del período seleccionado
  - [ ] CA6: Solo visible para roles admin y socio
- **Notas UX:** Esta pantalla es el "estado de resultados" simplificado del estudio.

### CONT-003 · Costos por expediente (rentabilidad del caso)
- **Estado:** `idea`
- **Sprint target:** Sprint 07
- **Como** abogado, **quiero** ver cuánto costó llevar un expediente (horas, gastos directos) vs lo que se cobró **para** saber si el caso fue rentable.
- **Criterios de aceptación:**
  - [ ] CA1: En el detalle de expediente, tab "Finanzas" que muestra: honorarios acordados, cobrado, pendiente, gastos imputados al caso
  - [ ] CA2: Rentabilidad calculada = honorarios cobrados − gastos del expediente
  - [ ] CA3: Registro de horas trabajadas por abogado (simple: abogado + horas + descripción)
  - [ ] CA4: Costo hora calculado si el rol tiene tarifa configurada
- **Dependencias:** CONT-001

### CONT-004 · Facturación y comprobantes
- **Estado:** `idea`
- **Sprint target:** Sprint 07
- **Como** admin/socio, **quiero** generar un recibo o nota de honorarios en PDF para enviarle al cliente **para** tener un comprobante formal del cobro.
- **Criterios de aceptación:**
  - [ ] CA1: Desde un pago de honorarios, puedo generar un PDF de recibo con: datos del estudio, datos del cliente, expediente, concepto, monto, fecha
  - [ ] CA2: El PDF se descarga o se puede enviar por email al cliente directamente desde LexCore
  - [ ] CA3: Los recibos generados quedan guardados como documentos del expediente
- **Notas:** Etapa inicial sin integración AFIP. Integración con factura electrónica es post-MVP.

## Backlog (post-MVP)

> **Fuente:** Research sobre dolores de LexDoctor (líder del mercado) — 2026-04-15.
> LexDoctor tiene 36 años en el mercado y base instalada masiva, pero:
> - Solo funciona en Windows. Sin Mac, sin Linux, sin mobile real.
> - Interface anticuada (estilo Windows 98). Curva de aprendizaje alta.
> - No es cloud-native: acceso remoto cuesta ~$185,000 ARS/año adicional.
> - Licencia base ~$463,000 ARS. Sin IA. Sin colaboración real.
> - 69% de abogados argentinos sigue usando desktop/carpetas físicas.
> - Pierden 5-10 horas semanales buscando información dispersa.
> Competidores cloud emergentes: Veredicta, LITIS ($17k-44k ARS/mes), IUSNET (freemium).
> **Oportunidad:** SaaS mobile-first, simple, asequible, con IA — exactamente lo que LexCore apunta a ser.

---

### RPT-001 · Reporte de actividad del estudio
- Dashboard con métricas: expedientes activos, vencimientos cumplidos, honorarios cobrados.
- **Dolor LexDoctor:** No tiene dashboards dinámicos. Todo es exportación manual.

### RPT-002 · Exportar expedientes a PDF
- Ficha completa del expediente exportable para compartir con el cliente.
- **Dolor LexDoctor:** Exportación limitada. Abogados hacen capturas de pantalla.

### INT-001 · Integración con PJN (Poder Judicial de la Nación)
- Consulta automática de estado del expediente (notificaciones electrónicas).
- **Dolor LexDoctor:** LexDoctor sí lo tiene. Es bloqueante para usuarios power. Sin esto perdemos al segmento PJN.
- **Competidores que lo tienen:** MetaJurídico, Veredicta, LITIS.

### INT-002 · Seguimiento automático de expedientes (scraping/API PJN)
- Cuando hay movimiento en un expediente, LexCore lo detecta y crea un movimiento automático.
- **Dolor LexDoctor:** Hay que entrar a consultar manualmente. Riesgo de perder notificaciones.

### MOB-001 · PWA mobile
- Instalar LexCore como app en el celular. Notificaciones push nativas.
- **Dolor LexDoctor:** Solo tiene app mobile básica (LEXMovil) para consulta. Sin edición ni vencimientos.
- **Ventaja competitiva:** LexCore es web-first, esta feature es un paso natural.

### AI-001 · Redacción asistida de escritos con IA
- En el detalle de expediente, el abogado describe lo que necesita y LexCore genera el borrador del escrito.
- **Dolor LexDoctor:** Cero IA. Los abogados usan ChatGPT externo, fuera del contexto del expediente.
- **Diferenciador clave vs Veredicta:** Integración con el contexto real del expediente (carátula, partes, movimientos).

### AI-002 · Resumen automático de expediente con IA
- Al entrar al detalle, un panel muestra "Estado del expediente" generado por IA basado en los movimientos.
- **Dolor LexDoctor:** Para entender el estado de un expediente hay que leer todos los movimientos.

### AI-003 · Alertas inteligentes de vencimientos críticos
- IA detecta patrones en los movimientos y sugiere vencimientos que podrían haberse omitido.
- Ej: "Detecté una notificación de traslado del 10/04. ¿Registraste el plazo de contestación (10 días hábiles)?"

### PREC-001 · Modelo de precios freemium
- Plan gratuito: 1 usuario, hasta 10 expedientes activos, sin honorarios.
- Plan Pro: desde $X USD/mes por usuario — con todas las features.
- **Dolor LexDoctor:** $463,000 ARS de entrada. Barrera altísima para abogados jóvenes que recién se matriculan.
- **Objetivo:** Capturar abogados jóvenes gratis → convertirlos a Pro al crecer.

### ONB-001 · Onboarding guiado (wizard de primer uso)
- Al registrarse, el abogado sigue 4 pasos: crear primer cliente → crear primer expediente → agregar primer vencimiento → invitar colega.
- **Dolor LexDoctor:** Curva de aprendizaje muy alta. Cobran cursos de capacitación aparte.

### CONF-001 · Confidencialidad y datos en Argentina
- Hosting en región ar/sa-east. Certificación de que los datos nunca salen del país.
- **Dolor LexDoctor:** En foros, el 33% de abogados rechaza el cloud por preocupaciones de secreto profesional.
- **Solución:** Comunicar explícitamente dónde están los datos, quién puede acceder, sin logs de contenido.

### USR-002 · Multi-estudio
- Un usuario puede pertenecer a más de un estudio (abogados que trabajan en varios estudios).
- **Dolor LexDoctor:** Una licencia por instalación. Si trabajás en 2 estudios, comprás 2 licencias.

---

## Features de competidores a copiar/superar

> **Fuente:** Research sobre Veredicta, LITIS, IUSNET, MetaJurídico — 2026-04-15.
> Estas features están en el mercado pero ningún competidor las tiene TODAS juntas + buena UX.

### PJN-001 · Consulta de expedientes PJN en tiempo real
- **Quién lo tiene:** Veredicta, LITIS, MetaJurídico, IUSNET, LexDoctor.
- **Qué hace:** Conectar con el Portal Judicial Nacional y traer el estado actualizado del expediente.
- **Qué LexCore puede hacer mejor:** Caché automático cuando PJN está caído (Veredicta lo tiene, los demás no).
- **Criterios de aceptación:**
  - [ ] CA1: En el detalle de expediente, hay un botón "Sincronizar con PJN"
  - [ ] CA2: Se trae y guarda como movimiento automático cualquier novedad nueva
  - [ ] CA3: Si PJN está caído, muestra el último estado cacheado con timestamp
  - [ ] CA4: Badge de "Nuevo movimiento PJN" en la lista de expedientes

### PJN-002 · Sincronización automática con PJN (background)
- **Quién lo tiene:** Veredicta (diferenciador).
- **Qué hace:** Sin que el abogado haga nada, el sistema consulta PJN cada noche y notifica si hay novedades.
- **Criterios de aceptación:**
  - [ ] CA1: Tarea programada nocturna que consulta PJN para todos los expedientes activos
  - [ ] CA2: Si hay novedad: crea movimiento automático + badge de notificación in-app
  - [ ] CA3: Email diario resumen "Novedades del día" si hay movimientos nuevos

### WHATSAPP-001 · Bot de WhatsApp para clientes y abogados
- **Quién lo tiene:** Veredicta (único competidor con esto — diferenciador fuerte en el mercado AR).
- **Qué hace:** Canal bidireccional WhatsApp integrado al estudio: clientes consultan estado de sus causas, abogados cargan movimientos y vencimientos por mensaje.
- **Qué LexCore puede hacer mejor:** Veredicta lo tiene como módulo externo. LexCore lo integra directo al expediente — sin salir de la app, los datos quedan en el mismo sistema.
- **Stack recomendado:** WhatsApp Business API (Meta) + webhook FastAPI + parser de intenciones (simple regex primero, IA en v2)
- **Flujo cliente:**
  - Cliente escribe al número del estudio: "Estado de mi caso"
  - Bot consulta expedientes vinculados al número de teléfono del cliente en LexCore
  - Responde: últimos 3 movimientos + próximo vencimiento
- **Flujo abogado:**
  - Abogado escribe: "Nuevo movimiento EXP-2026-001: presenté escrito de contestación"
  - Bot crea el movimiento en el expediente correspondiente y confirma
- **Criterios de aceptación:**
  - [ ] CA1: El estudio configura su número WhatsApp Business desde `/configuracion`
  - [ ] CA2: Cliente escribe al número → bot identifica al cliente por teléfono → responde con estado del expediente (últimos movimientos + próximo vencimiento)
  - [ ] CA3: Si el cliente tiene múltiples expedientes, el bot pregunta por cuál
  - [ ] CA4: Abogado puede cargar un movimiento por WhatsApp con comando natural: "movimiento [expediente]: [texto]"
  - [ ] CA5: Abogado puede consultar vencimientos del día por WhatsApp: "vencimientos hoy"
  - [ ] CA6: Mensajes no reconocidos → bot responde "No entendí, escribí AYUDA para ver los comandos"
  - [ ] CA7: Historial de conversaciones por cliente visible en LexCore (log de interacciones)
  - [ ] CA8: Opción de desactivar el bot por estudio sin perder la configuración
- **Casos borde:** número de teléfono no registrado en sistema → bot ofrece contactar al estudio directamente; expediente archivado → bot avisa que la causa está cerrada
- **Fases de implementación:**
  - **Fase 1 (MVP):** Solo lectura para clientes — consulta de estado
  - **Fase 2:** Abogados pueden cargar movimientos
  - **Fase 3:** IA para intenciones complejas y respuestas en lenguaje natural
- **Prerequisito:** Cuenta Meta Business verificada, número WhatsApp Business dedicado

### COLLAB-001 · Colaboración en tiempo real en expediente
- **Quién lo tiene:** Veredicta (parcialmente).
- **Qué hace:** Cuando dos abogados están en el mismo expediente, ven los cambios del otro en tiempo real.
- **Implementación LexCore:** WebSocket simple en el tab de movimientos.
- **Criterios de aceptación:**
  - [ ] CA1: Indicador "X personas viendo este expediente ahora"
  - [ ] CA2: Nuevo movimiento aparece en el timeline sin recargar la página

### CAL-001 · Calendario integrado de audiencias del estudio
- **Quién lo tiene:** LITIS (feature destacada).
- **Qué hace:** Vista de calendario con todos los vencimientos de todos los expedientes del estudio.
- **Criterios de aceptación:**
  - [ ] CA1: Vista mensual con todos los vencimientos del estudio (no solo los del usuario)
  - [ ] CA2: Filtros por abogado, fuero, tipo de vencimiento
  - [ ] CA3: Click en evento navega al expediente
  - [ ] CA4: Exportar a Google Calendar / iCal

### TASK-001 · Gestión de tareas internas del estudio
- **Quién lo tiene:** LITIS.
- **Qué hace:** Tareas internas (no procesales) asignadas entre miembros del equipo.
- **Criterios de aceptación:**
  - [ ] CA1: Puedo crear tarea con: descripción, responsable, fecha límite, expediente vinculado (opcional)
  - [ ] CA2: Panel "Mis tareas" en el dashboard
  - [ ] CA3: Notificación cuando me asignan una tarea

### JURI-001 · Búsqueda de jurisprudencia con IA
- **Quién lo tiene:** Veredicta (integrado), Juztina (especializada).
- **Qué hace:** El abogado escribe la situación legal y la IA busca precedentes relevantes en 500k+ sentencias.
- **Diferenciador LexCore:** La búsqueda está contextualizada con los datos del expediente abierto.
- **Criterios de aceptación:**
  - [ ] CA1: En el detalle de expediente, panel lateral "Jurisprudencia relacionada"
  - [ ] CA2: Basada en fuero, carátula y movimientos del expediente
  - [ ] CA3: Resultados con enlace a la sentencia original

### LICIT-001 · Dashboard de liquidaciones judiciales
- **Quién lo tiene:** MetaJurídico, LexDoctor (módulo aparte).
- **Qué hace:** Cálculo automático de intereses y actualización de montos según índices oficiales (CER, UVA, etc.).
- **Criterios de aceptación:**
  - [ ] CA1: En expediente, calculadora de intereses con: capital, fecha inicio, fecha fin, tasa
  - [ ] CA2: Tasas disponibles: activa BNA, pasiva BCRA, CER, UVA
  - [ ] CA3: Genera documento de liquidación imprimible

### MULTI-001 · Múltiples jurisdicciones (MEV, EJE, IOL, IURIX)
- **Quién lo tiene:** MetaJurídico (único diferenciador).
- **Qué hace:** Conectar con todos los sistemas judiciales provinciales, no solo PJN federal.
- **Prioridad:** Post-MVP. Requiere convenios con cada poder judicial provincial.

---

## Deuda técnica

- [ ] TECH-001: El endpoint `/auth/setup-studio` usa `tenant_id == "pending"` como lookup — inseguro. Cambiar a validar por JWT temporal. (Sprint 03)
- [ ] TECH-002: Tests de aislamiento tenant para `User` y `Studio` — aún no escritos. (Sprint 02)
- [ ] TECH-003: `next.config.ts` renombrado a `next.config.mjs` por incompatibilidad con Next.js 14.2 — documentar en LEARNINGS.

---

## Historial completadas

| ID | Historia | Sprint | Fecha |
|----|----------|--------|-------|
| AUTH-001 | Registro estudio + usuario admin | 01 | 2026-04-15 |
| AUTH-002 | Login email + password | 01 | 2026-04-15 |
| AUTH-003 | Middleware protección rutas | 01 | 2026-04-15 |
| AUTH-004 | Google OAuth (NextAuth.js) | 01 | 2026-04-15 |
