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
- **Estado:** `done` — 2026-04-20
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

## Sprint 08 — Backlog refinado (deepdive 2026-04-15)

> Historias surgidas del análisis multi-perspectiva (abogado, UX, UI, negocio, técnica).

### US-01 · Módulo de Tareas — CRUD completo — `done`
- **Prioridad:** P0 | **Esfuerzo:** M (5pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **QA Audit (2026-04-15):** ✓ CA1 CA2 CA3 implementados. CA4 deuda técnica confirmada.
- **Decisión PO (2026-04-15):** Tareas siempre vinculadas a un expediente.
- **Como** abogado, **quiero** crear y gestionar tareas con responsable y fecha límite **para** hacer seguimiento del trabajo del estudio sin salir de LexCore.
- **Criterios de aceptación:**
  - [x] CA1: Crear tarea con título, responsable (miembro del estudio), fecha límite, estado (pendiente/en_curso/hecha), expediente_id requerido
  - [x] CA2: Lista de tareas con filtro por responsable, estado y expediente — global en `/tareas` + embebida en expediente
  - [x] CA3: Tareas vencidas se marcan visualmente como urgentes (fondo rojo, texto "Vencida")
  - [ ] CA4: Test de aislamiento tenant — **DEUDA TÉCNICA**: falta `test_tareas.py`. Confirmado por QA.

### US-AI-01 · Resumen IA de expediente — `refined`
- **Prioridad:** P1 | **Esfuerzo:** M (5pts) | **Sprint target:** 09
- **Refinado por:** FA Agent (2026-04-15)
- **Decisión técnica:** generar una vez, guardar en DB, regenerar solo cuando hay cambios relevantes. Costo de tokens mínimo y predecible.
- **Como** abogado, **quiero** ver un resumen del estado actual del expediente generado por IA **para** entender el contexto del caso en segundos sin leer todos los movimientos.
- **Criterios de aceptación:**
  - [ ] CA1: El resumen NO existe al crear el expediente. Se genera la primera vez que el usuario hace clic en "Generar resumen" — no automático en page load.
  - [ ] CA2: El resumen se guarda en DB (`expediente_resumenes`) con `generado_at`, `input_hash` y `modelo_usado`. Page loads posteriores lo leen desde DB sin llamar al LLM.
  - [ ] CA3: Badge "Desactualizado" cuando alguno de los triggers lo invalida (nuevo movimiento, vencimiento editado, tarea nueva, pago registrado). El resumen anterior se mantiene visible.
  - [ ] CA4: Botón "Regenerar" en el detalle del expediente. Máximo 5 regeneraciones manuales por expediente por día (429 si se supera).
  - [ ] CA5: El resumen incluye: situación actual del caso, próximos vencimientos no cumplidos, tareas pendientes con responsable, estado de honorarios si hay deuda. Máx 300 palabras.
  - [ ] CA6: Si el LLM falla (timeout, 5xx), retorna 502 y el resumen anterior queda intacto en DB.
  - [ ] CA7: Aislamiento tenant: `expediente_resumenes` filtra siempre por `tenant_id`.
- **Input al prompt (mínimo):** cabecera del expediente, nombre+tipo cliente, equipo (nombre+rol), últimos 10 movimientos, vencimientos pendientes, tareas pendientes/en_curso, honorarios con deuda.
- **Triggers de invalidación:** nuevo movimiento, PATCH expediente (caratula/fuero/juzgado/estado), CRUD vencimientos, CRUD tareas no-hecha, POST pago honorario, cambio de equipo.
- **Schema DB:** tabla `expediente_resumenes` con `UNIQUE(tenant_id, expediente_id)` + `desactualizado bool`. Historial en tabla separada `expediente_resumenes_historial`.
- **Otros lugares para resúmenes IA (futuro):**
  - Ficha de cliente: situación global de todas sus causas antes de una reunión
  - Briefing semanal del estudio: cron lunes 7am, agregado de toda la cartera
  - Digest de vencimientos críticos: listado priorizado, base para email diario

### US-02 · Vista Agenda Diaria/Semanal — `done`
- **Prioridad:** P0 | **Esfuerzo:** M (5pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** abogado, **quiero** ver en un solo lugar todos mis vencimientos y tareas del día/semana **para** no necesitar revisar múltiples pantallas.
- **Criterios de aceptación:**
  - [ ] CA1: Vista unificada de vencimientos + tareas del período seleccionado, ordenados cronológicamente
  - [ ] CA2: Accesible desde dashboard con un clic / navegación principal
  - [ ] CA3: Funciona en mobile 375px sin scroll horizontal
  - [ ] CA4: Permite marcar cumplidos/hechos sin salir de la vista

### US-03 · Notificaciones por email — vencimientos urgentes — `done`
- **Prioridad:** P0 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** abogado, **quiero** recibir un email cuando un vencimiento pase a estado urgente (<48hs) **para** no perder plazos críticos aunque no esté en la plataforma.
- **Criterios de aceptación:**
  - [ ] CA1: Email automático cuando `fecha - now() < 48hs` y `cumplido = false`
  - [ ] CA2: Email incluye: descripción, fecha, tipo, link directo al vencimiento
  - [ ] CA3: El estudio puede configurar qué miembros reciben alertas (default: todos)
  - [ ] CA4: Falla silenciosa si Resend no configurado (igual que emails de invitación)

### US-04 · Tests de aislamiento multi-tenant — cobertura completa — `done`
- **Prioridad:** P0 | **Esfuerzo:** M (5pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** Tech Lead, **quiero** tests automatizados que verifiquen el aislamiento de datos entre tenants **para** garantizar que un estudio nunca vea datos de otro.
- **Criterios de aceptación:**
  - [ ] CA1: Test de tenant isolation para cada entidad: expedientes, clientes, documentos, honorarios, pagos_honorarios, gastos, ingresos, tareas, vencimientos
  - [ ] CA2: Los tests corren en CI (pytest)
  - [ ] CA3: Un usuario de estudio A que intenta acceder a recursos de estudio B recibe 404 (no 403 — no revelar existencia)
  - [ ] CA4: Documentado en LEARNINGS.md con qué se verificó

### US-06 · Tareas en detalle de expediente — `done`
- **Prioridad:** P1 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **QA Audit (2026-04-15):** ✓ CA1 CA2 CA3 todos implementados. `tareas-section.tsx` integrado en `expedientes/[id]/page.tsx`.
- **Como** abogado, **quiero** ver y gestionar tareas dentro del detalle del expediente **para** tener todo el contexto del caso en un lugar.
- **Criterios de aceptación:**
  - [x] CA1: Sección "Tareas" colapsable en el detalle del expediente (misma UI que Movimientos/Vencimientos)
  - [x] CA2: Crear/completar tarea sin salir del expediente
  - [x] CA3: Tareas vencidas resaltadas en rojo, pendientes en amarillo, hechas tachadas

### US-07 · Búsqueda global funcional en mobile — `done`
- **Prioridad:** P1 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **QA Audit (2026-04-15):** ✓ CA1-CA4 implementados. SearchModal con debounce 300ms, deep link, responsive.
- **Como** abogado en tribunales, **quiero** buscar expedientes y clientes desde mi celular **para** no depender de un teclado físico con Cmd+K.
- **Criterios de aceptación:**
  - [x] CA1: Ícono de búsqueda visible en navbar mobile
  - [x] CA2: Al tocar, abre modal de búsqueda con campo de texto enfocado
  - [x] CA3: Resultados muestran expedientes y clientes, navegables con tap
  - [x] CA4: Deep link al resultado seleccionado

### US-08 · Empty states con onboarding guiado — `done`
- **Prioridad:** P1 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** usuario nuevo, **quiero** ver guía clara cuando una sección está vacía **para** entender qué tengo que hacer para empezar a usar el sistema.
- **Criterios de aceptación:**
  - [ ] CA1: Expedientes vacíos → CTA "Crear primer expediente" con descripción breve
  - [ ] CA2: Clientes vacíos → CTA "Agregar primer cliente"
  - [ ] CA3: Dashboard sin datos → checklist de setup (qué falta completar)
  - [ ] CA4: Vencimientos vacíos → CTA "Agregar vencimiento" con link a nuevo

### US-09 · Sistema de estados visuales unificado — `in-progress`
- **QA Audit (2026-04-15):** CA1 colores existen pero no unificados. CA2/CA3 falta componente `StatusBadge` reutilizable — cada vista define sus propios estilos (copy-paste). Deuda técnica.

### US-09 · Sistema de estados visuales unificado — `done`
- **Prioridad:** P1 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Prioridad:** P1 | **Esfuerzo:** S (2pts) | **Sprint target:** 08
- **Como** usuario, **quiero** que los estados (urgente, pendiente, cumplido, archivado) tengan el mismo color y badge en toda la app **para** leer el estado de un vistazo sin aprender distintos sistemas.
- **Criterios de aceptación:**
  - [ ] CA1: Paleta definida: urgente=rojo, pendiente=amarillo, ok/cumplido=verde, archivado=gris, en proceso=azul
  - [ ] CA2: Mismos badges aplicados en expedientes, vencimientos, tareas y honorarios
  - [ ] CA3: Componente `StatusBadge` reutilizable en `components/ui/`

### US-10 · Creación de expediente en 2 pasos (mobile-first) — `refined`
- **Prioridad:** P1 | **Esfuerzo:** M (5pts) | **Sprint target:** 09
- **Como** abogado en tribunales, **quiero** crear un expediente rápido desde el celular **para** no perder el número de causa mientras estoy en sala.
- **Criterios de aceptación:**
  - [ ] CA1: Paso 1 (datos mínimos): carátula, cliente, fuero → guardar en <60s desde mobile
  - [ ] CA2: Paso 2 (datos secundarios): juzgado, número PJN, equipo, descripción — editable después
  - [ ] CA3: Flujo completo funciona en 375px sin errores de scroll o campos ocultos

### US-11 · Observabilidad básica — Sentry + logs estructurados — `blocked`
- **Prioridad:** P1 | **Esfuerzo:** M (5pts) | **Sprint target:** indefinido
- **🚫 BLOQUEADO (2026-04-16):** Activar cuando haya primer cliente real en producción. Free tier de Sentry suficiente para el volumen actual. No tiene urgencia pre-MVP.
- **Sprint target original:** 08
- **Como** Tech Lead, **quiero** capturar errores en producción con contexto **para** poder diagnosticar y corregir bugs que los usuarios no reportan.
- **Criterios de aceptación:**
  - [ ] CA1: Sentry integrado en Next.js frontend — errores capturados con user, tenant y URL
  - [ ] CA2: Backend logea en JSON estructurado: `{level, timestamp, tenant_id, user_id, endpoint, status, duration_ms}`
  - [ ] CA3: Alert configurado en Sentry si error rate > 1% en cualquier endpoint

### US-12 · Generador de cabecera de escrito — `blocked`
- **Prioridad:** P1 | **Esfuerzo:** M (5pts) | **Sprint target:** indefinido
- **🚫 BLOQUEADO (2026-04-16):** Decisión PO pendiente sobre formato de salida (Word DOCX vs PDF). No planificar hasta resolución.
- **Como** abogado, **quiero** generar la cabecera de un escrito automáticamente desde el expediente **para** ahorrar 5 minutos en cada presentación.
- **Criterios de aceptación:**
  - [ ] CA1: Desde el expediente, botón "Generar escrito" abre modal con cabecera precompletada (carátula, número, juzgado, secretaría, fecha, abogado responsable)
  - [ ] CA2: Campo textarea para el cuerpo del escrito
  - [ ] CA3: Descarga en formato decidido por PO

### US-13 · Portal de cliente — vista de solo lectura — `blocked`
- **Prioridad:** P1 | **Esfuerzo:** L (8pts) | **Sprint target:** indefinido
- **🚫 BLOQUEADO (2026-04-16):** Reemplazado por canal WhatsApp (WHATSAPP-001/002). El cliente consulta estado por WhatsApp, no por portal web. Revisar post-MVP si hay demanda de portal separado.
- **Como** cliente de un estudio, **quiero** ver el estado de mi expediente y los próximos vencimientos **para** no tener que llamar al abogado para saber en qué va el caso.
- **Criterios de aceptación:**
  - [ ] CA1: Invitación por email al cliente con acceso exclusivo a sus expedientes
  - [ ] CA2: El cliente ve: estado, vencimientos próximos, documentos marcados como "compartidos" por el abogado
  - [ ] CA3: Sin acceso a honorarios, gastos, ni expedientes de otros clientes
  - [ ] CA4: Test de aislamiento: cliente no puede acceder a nada fuera de sus expedientes

### US-14 · Preview de documentos in-app — `idea`
- **Prioridad:** P2 | **Esfuerzo:** M (5pts) | **Sprint target:** 09
- **Como** abogado, **quiero** ver un PDF sin descargarlo **para** revisar rápido un documento sin salir de LexCore.
- **Criterios de aceptación:**
  - [ ] CA1: PDFs abren en modal usando `<iframe>` o librería de PDF (pdf.js)
  - [ ] CA2: Imágenes (JPG/PNG) en preview con zoom
  - [ ] CA3: Botón de descarga disponible desde el preview

### US-15 · Índices full-text PostgreSQL para búsqueda — `ready`
- **Prioridad:** P2 | **Esfuerzo:** S (2pts) | **Sprint target:** 08
- **Como** Tech Lead, **quiero** que la búsqueda global use índices full-text en PostgreSQL **para** que sea rápida con miles de expedientes.
- **Criterios de aceptación:**
  - [ ] CA1: Columnas de búsqueda (numero, caratula, nombre cliente) indexadas con `tsvector`
  - [ ] CA2: Búsqueda retorna en <200ms para datasets de 10.000+ registros
  - [ ] CA3: Migración Alembic limpia y reversible

### US-16 · Registro de tiempo facturable (timesheets) — `idea`
- **Prioridad:** P2 | **Esfuerzo:** L (8pts) | **Sprint target:** backlog
- **Como** abogado que factura por hora, **quiero** registrar horas trabajadas por expediente **para** tener base real para la facturación de honorarios.
- **Criterios de aceptación:**
  - [ ] CA1: Registrar entrada de tiempo: expediente, abogado, fecha, horas, descripción
  - [ ] CA2: Resumen de horas por expediente y por abogado en el período
  - [ ] CA3: Exportable como base para factura

### US-17 · Rate limiting y política de contraseñas — `done`
- **Prioridad:** P2 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** Admin de seguridad, **quiero** que el sistema bloquee ataques de fuerza bruta y exija contraseñas seguras **para** proteger los datos del estudio.
- **Criterios de aceptación:**
  - [ ] CA1: Bloqueo de IP después de 5 intentos de login fallidos por 15 minutos
  - [ ] CA2: Contraseña mínima: 8 caracteres, 1 número, 1 mayúscula
  - [ ] CA3: Endpoint de login retorna 429 con `retry_after` en segundos

### US-18 · Skeleton loaders y toasts consistentes — `done`
- **Prioridad:** P2 | **Esfuerzo:** S (2pts) | **Sprint target:** 08 | **Completada:** 2026-04-15
- **Como** usuario, **quiero** feedback visual inmediato en todas las acciones **para** saber que el sistema está respondiendo.
- **Criterios de aceptación:**
  - [ ] CA1: Todas las listas principales muestran skeleton loader mientras cargan (no spinner de página)
  - [ ] CA2: Todas las acciones CRUD muestran toast de éxito/error con el mismo componente
  - [ ] CA3: Sin spinners genéricos de página completa en el flujo normal

### US-19 · Consulta de estado en PJN — `descartada`
- **Decisión PO (2026-04-15):** Sin integración PJN en MVP. El abogado actualiza el estado manualmente. Revisión post-MVP si surge demanda de usuarios.
- **Como** abogado, **quiero** sincronizar el estado del expediente desde el PJN **para** no tener que actualizarlo manualmente.
- **Criterios de aceptación:** pendientes de decisión de PO + spike técnico

### US-21 · Perfil del estudio y del usuario — `refined`
- **Prioridad:** P1 | **Esfuerzo:** M (5pts) | **Sprint target:** Sprint 10
- **Como** admin del estudio, **quiero** configurar los datos del estudio y mi perfil personal **para** que el sistema refleje mi identidad profesional.
- **Criterios de aceptación:**
  - [ ] CA1: Avatar generado con las iniciales del nombre del usuario (ej: "MD" para Marcos Damián), con fondo de color derivado del nombre
  - [ ] CA2: Sección "Mi estudio" — nombre del estudio, logo (upload), dirección con link a Google Maps, teléfono, email de contacto
  - [ ] CA3: Sección "Mi plan" — muestra el plan activo (Free/Trial/Pro/Estudio), fecha de vencimiento del trial si aplica, CTA "Cambiar plan"
  - [ ] CA4: Sección "Mis datos" — nombre, apellido, email (read-only), rol en el estudio, cambio de contraseña
  - [ ] CA5: Logo del estudio visible en el sidebar (reemplaza placeholder)
  - [ ] CA6: Datos del estudio accesibles en `/perfil` (ya existe la página, expandirla)
- **Casos borde:** Upload de logo — validar tipo (PNG/JPG) y peso (<2MB). Avatar de iniciales como fallback si no hay logo.
- **Notas UX:** Avatar con iniciales siempre visible en el header. Menú de usuario abre `/perfil`. Logo en sidebar top-left.

### US-20 · Swap Auth JWT → Supabase con MFA — `idea`
- **Prioridad:** P2 | **Esfuerzo:** XL (13pts) | **Sprint target:** backlog
- **Como** usuario, **quiero** MFA y auth gestionado por Supabase **para** tener seguridad enterprise sin gestión propia de tokens.
- **Nota técnica:** El swap está diseñado para ser transparente (mismo contrato de JWT). No urgente hasta salida a producción real.

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

---

## CX-001 · Centro de ayuda + Reporte de problemas — `idea`

- **Prioridad:** P1 | **Esfuerzo:** L (8pts) | **Sprint target:** Sprint 11
- **Patrón de industria:** Linear, Intercom, Notion, Vercel — todos tienen help center embebido + widget de reporte accesible desde cualquier pantalla (no solo desde configuración).

### Contexto de diseño (CX industry standard)

El modelo que usan los mejores SaaS B2B:

1. **Widget flotante o entrada en sidebar** — siempre visible, nunca intrusivo. Iconito "?" en esquina inferior derecha o ítem fijo al final del sidebar.
2. **Dos modos diferenciados:** "Buscar ayuda" (FAQ, docs) y "Reportar un problema" (formulario estructurado).
3. **Reporte estructurado:** el usuario elige módulo → describe el error → sube captura opcional. El sistema agrega automáticamente contexto del entorno (navegador, página actual, rol, tenant_id) que el usuario no tiene que completar.
4. **Panel de soporte interno:** vista privada solo para admin de LexCore con todos los tickets ordenados, filtro por urgencia/módulo, opción de pasar a backlog con un clic.

---

### Componente A — Centro de ayuda (in-app)
- **Como** usuario, **quiero** encontrar respuestas sin salir de LexCore **para** resolver dudas rápido sin abrir un ticket.
- **Criterios de aceptación:**
  - [ ] CA1: Botón "?" fijo en esquina inferior derecha de todas las pantallas del studio — abre panel lateral (slide-over) o modal
  - [ ] CA2: El panel tiene dos tabs: "Ayuda" y "Reportar problema"
  - [ ] CA3: Tab "Ayuda" muestra acordeón de preguntas frecuentes agrupadas por módulo (Expedientes, Vencimientos, Honorarios, Tareas, Equipo, Contable, General)
  - [ ] CA4: FAQs son estáticas en v1 (hardcoded en frontend) — sin CMS. Editable por el dev con un array de objetos `{ pregunta, respuesta, modulo }`.
  - [ ] CA5: Buscador de texto simple dentro del panel (filtra FAQs por término)
  - [ ] CA6: Al final del panel "Ayuda": link "¿No encontraste lo que buscabas? Reportar un problema" → cambia a tab "Reportar"
  - [ ] CA7: El widget NO aparece en pantallas de login, registro ni setup-studio

**FAQs iniciales sugeridas:**
- ¿Cómo agrego un expediente? → link a `/expedientes/nuevo`
- ¿Cómo invito a otro abogado al estudio? → link a `/equipo`
- ¿Cómo funciona el resumen IA? → explicación inline
- ¿Cómo conecto Google Calendar? → link a `/perfil`
- ¿Qué diferencia hay entre un Vencimiento y una Tarea?
- ¿Cómo registro un pago de honorarios?
- ¿Cómo exporto información del sistema? (respuesta: próximamente)

---

### Componente B — Formulario de reporte de problema
- **Como** usuario, **quiero** reportar un bug o problema de forma rápida y estructurada **para** que el equipo de soporte tenga el contexto necesario para reproducirlo.
- **Criterios de aceptación:**
  - [ ] CA1: El formulario tiene tres campos: (1) Módulo — selector con opciones: Expedientes / Vencimientos / Tareas / Honorarios / Contable / Equipo / Búsqueda / Perfil / Otro; (2) Descripción del problema — textarea libre (máx 1000 chars); (3) Captura de pantalla — upload opcional (PNG/JPG, máx 5MB)
  - [ ] CA2: El sistema agrega automáticamente (sin que el usuario lo vea ni complete): URL actual, navegador + OS, tenant_id, user_id, rol, timestamp
  - [ ] CA3: Al enviar → feedback inmediato "Reporte enviado. Lo revisaremos pronto." con número de ticket (ej: #047)
  - [ ] CA4: El reporte se guarda en tabla `soporte_tickets` en DB con todos los campos + estado `abierto`
  - [ ] CA5: Si hay captura, se guarda en R2 (mismo bucket que documentos, carpeta `/soporte/`)
  - [ ] CA6: Notificación por email a `soporte@lexcore.app` (o el email configurado) con el resumen del ticket
  - [ ] CA7: Opción de marcar "urgente" con un checkbox — destaca el ticket en el panel de soporte

---

### Componente C — Panel de soporte interno (admin LexCore)
- **Como** admin de LexCore, **quiero** ver todos los tickets reportados, gestionar su estado y convertirlos en historias del backlog **para** dar soporte eficiente y convertir bugs en mejoras del producto.
- **Acceso:** solo para usuarios con un rol interno especial (ej: `superadmin`) — ruta separada `/admin/soporte` o subdominio `admin.lexcore.app`
- **Criterios de aceptación:**
  - [ ] CA1: Lista de tickets con: número, estudio, módulo, descripción (preview), fecha, estado (abierto / en revisión / resuelto / descartado), urgente flag
  - [ ] CA2: Filtros: por estado, por módulo, por estudio, por urgencia
  - [ ] CA3: Vista de detalle del ticket: todos los campos + captura de pantalla si existe + contexto técnico (URL, browser, rol)
  - [ ] CA4: Acciones sobre el ticket: cambiar estado, agregar nota interna, marcar como resuelto
  - [ ] CA5: Botón "Pasar a backlog" → genera un issue pre-formateado en GitHub Issues (o lo agrega a `BACKLOG.md` vía API) con el contexto del ticket
  - [ ] CA6: Respuesta al usuario — campo de respuesta que envía email al usuario que reportó con la explicación o resolución

---

### Modelo de datos — tabla `soporte_tickets`

```
soporte_tickets
├── id (uuid, PK)
├── numero (int, autoincremental — formato #001)
├── tenant_id (FK studios)
├── user_id (FK users)
├── modulo (enum: expedientes, vencimientos, tareas, honorarios, contable, equipo, busqueda, perfil, otro)
├── descripcion (text)
├── captura_url (varchar, nullable — URL en R2)
├── urgente (bool, default false)
├── estado (enum: abierto, en_revision, resuelto, descartado)
├── url_origen (varchar — página donde se originó el reporte)
├── browser_info (varchar — user agent)
├── nota_interna (text, nullable — respuesta del equipo LexCore)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---

### UX — Posición del widget

```
┌─────────────────────────────────┐
│  sidebar │    contenido          │
│          │                       │
│  [Inicio]│                       │
│  [Exped] │                       │
│  [Venct] │                       │
│  ...     │                       │
│          │              [?]  ←── widget flotante, siempre visible
└─────────────────────────────────┘
```

El `[?]` es un botón circular fijo `fixed bottom-6 right-6 z-50` con tooltip "Ayuda y soporte". Al hacer click abre un slide-over desde la derecha (ancho 400px desktop, fullscreen mobile).

**Colores:** fondo blanco, borde suave, tab activo con `border-b-2 border-brand-600`. Sin colores llamativos — el widget debe sentirse parte del sistema, no un chat de ventas intrusivo.

---

### Fases de implementación

| Fase | Alcance | Effort |
|------|---------|--------|
| **Fase 1 (MVP soporte)** | Widget + FAQs + formulario de reporte → email + tabla DB | 5 pts |
| **Fase 2** | Panel interno admin LexCore con gestión de tickets | 5 pts |
| **Fase 3** | Botón "Pasar a backlog" → GitHub Issues API | 3 pts |

> Implementar Fase 1 primero. Fase 2 se puede hacer con la misma DB.

---

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

### PREC-001 · Modelo de precios freemium — `blocked`
- **🚫 BLOQUEADO (2026-04-16):** Decisión PO. No planificar hasta tener primeros usuarios reales y feedback de precio.
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

### PJN-001 · Consulta de expedientes PJN en tiempo real — `blocked`
- **🚫 BLOQUEADO (2026-04-16):** Requiere análisis de API PJN + spike técnico. No planificar sin investigación previa.
- **Quién lo tiene:** Veredicta, LITIS, MetaJurídico, IUSNET, LexDoctor.
- **Qué hace:** Conectar con el Portal Judicial Nacional y traer el estado actualizado del expediente.
- **Qué LexCore puede hacer mejor:** Caché automático cuando PJN está caído (Veredicta lo tiene, los demás no).
- **Criterios de aceptación:**
  - [ ] CA1: En el detalle de expediente, hay un botón "Sincronizar con PJN"
  - [ ] CA2: Se trae y guarda como movimiento automático cualquier novedad nueva
  - [ ] CA3: Si PJN está caído, muestra el último estado cacheado con timestamp
  - [ ] CA4: Badge de "Nuevo movimiento PJN" en la lista de expedientes

### PJN-002 · Sincronización automática con PJN (background) — `blocked`
- **🚫 BLOQUEADO (2026-04-16):** Depende de PJN-001. No planificar hasta que PJN-001 esté done.
- **Quién lo tiene:** Veredicta (diferenciador).
- **Qué hace:** Sin que el abogado haga nada, el sistema consulta PJN cada noche y notifica si hay novedades.
- **Criterios de aceptación:**
  - [ ] CA1: Tarea programada nocturna que consulta PJN para todos los expedientes activos
  - [ ] CA2: Si hay novedad: crea movimiento automático + badge de notificación in-app
  - [ ] CA3: Email diario resumen "Novedades del día" si hay movimientos nuevos

### MON-01 · Trial 30 días + modo lectura — `blocked`
- **🚫 BLOQUEADO (2026-04-16):** Sin usuarios reales aún. No tiene sentido implementar un límite de trial sin clientes. Revisar cuando haya primeros estudios en producción.

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

### COLLAB-001 · Colaboración en tiempo real en expediente — `blocked`
- **🚫 BLOQUEADO (2026-04-16):** Requiere WebSockets + infraestructura adicional. Complejidad alta para el valor actual. Revisar cuando haya equipos de 3+ usuarios activos simultáneos.
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

## 🚀 CHECKLIST PRIMER DEPLOY A PRODUCCIÓN

> Todo lo marcado como ❌ debe estar resuelto antes de abrir el producto a usuarios reales.
> Criterio de "listo para PRD": un estudio puede registrarse, operar y pagar sin intervención manual.

---

### 1. Infraestructura y deploy

| # | Item | Estado | Notas |
|---|------|--------|-------|
| INF-01 | Railway configurado con backend FastAPI | ❌ pendiente | Variables de entorno en Railway |
| INF-02 | Vercel configurado con frontend Next.js | ❌ pendiente | `NEXTAUTH_URL` apuntando a dominio real |
| INF-03 | PostgreSQL en Railway (o Supabase DB) | ❌ pendiente | No usar DB local |
| INF-04 | Migraciones Alembic aplicadas en prod | ❌ pendiente | `alembic upgrade head` en Railway |
| INF-05 | Dominio propio configurado (ej: app.lexcore.ar) | ❌ pendiente | DNS + HTTPS automático |
| INF-06 | CORS actualizado con dominio real | ❌ pendiente | Sacar `localhost:3001` de CORS en prod |
| INF-07 | Storage para documentos (Cloudflare R2) | ❌ pendiente | MinIO solo es para dev. R2 es gratuito hasta 10GB |
| INF-08 | Variables de entorno de prod definidas | ❌ pendiente | Ver lista abajo |

**Variables de entorno requeridas en prod:**
```
DATABASE_URL=postgresql://...
SECRET_KEY=<random 64 chars>
ENVIRONMENT=production
ALLOW_DEV_ENDPOINTS=false
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=https://app.lexcore.ar
NEXT_PUBLIC_API_URL=https://api.lexcore.ar
RESEND_API_KEY=...
OPENAI_API_KEY=...          # opcional, para resumen IA
GOOGLE_CLIENT_ID=...        # para Google OAuth
GOOGLE_CLIENT_SECRET=...
S3_ENDPOINT_URL=https://...r2.cloudflarestorage.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET_NAME=lexcore-docs
```

---

### 2. Auth y seguridad

| # | Item | Estado | Notas |
|---|------|--------|-------|
| SEC-01 | `SECRET_KEY` robusta (no la de dev) | ❌ pendiente | Mínimo 64 chars random |
| SEC-02 | Rate limiting en login activo | ✅ hecho | 5 intentos → bloqueo 15min |
| SEC-03 | Endpoints `/dev/*` deshabilitados en prod | ✅ hecho | `ALLOW_DEV_ENDPOINTS=false` |
| SEC-04 | Google OAuth redirige a dominio real | ❌ pendiente | Actualizar en Google Cloud Console |
| SEC-05 | HTTPS en todos los endpoints | ❌ pendiente | Railway + Vercel lo dan automático con dominio |
| SEC-06 | Tokens JWT con expiración razonable | ✅ hecho | 30 días (revisar si es correcto para prod) |

---

### 3. Trial y monetización

| # | Item | Estado | Notas |
|---|------|--------|-------|
| MON-01 | Campo `trial_ends_at` en modelo Studio | ✅ hecho | Se setea al registrar |
| MON-02 | Middleware que evalúa estado del trial | ❌ pendiente | No implementado aún |
| MON-03 | Email día 25 avisando fin de trial | ❌ pendiente | Requiere job/cron o trigger |
| MON-04 | Modo lectura día 31 (no puede crear) | ❌ pendiente | Bloqueo en middleware o frontend |
| MON-05 | Página de "plan vencido" con CTA pago | ❌ pendiente | Diseño y ruta pendientes |
| MON-06 | Integración de pagos (MercadoPago u otro) | ❌ pendiente | Post-MVP si se valida primero manualmente |

> **Decisión sugerida:** para el primer deploy, MON-02/03/04/05 pueden ser manuales (el admin extiende el trial a mano). MON-06 es definitivamente post-MVP.

---

### 4. Email transaccional

| # | Item | Estado | Notas |
|---|------|--------|-------|
| EMAIL-01 | Resend configurado con dominio verificado | ❌ pendiente | Verificar dominio en resend.com |
| EMAIL-02 | Email de invitación funciona en prod | ✅ hecho (código) | Depende de EMAIL-01 |
| EMAIL-03 | Email de vencimientos urgentes funciona | ✅ hecho (código) | Depende de EMAIL-01 |
| EMAIL-04 | Email de bienvenida al registrarse | ❌ pendiente | No implementado |

---

### 5. Observabilidad

| # | Item | Estado | Notas |
|---|------|--------|-------|
| OBS-01 | Sentry backend (FastAPI) | ❌ bloqueado | Activar con primer cliente real (US-11) |
| OBS-02 | Sentry frontend (Next.js) | ❌ bloqueado | Ídem |
| OBS-03 | Logs en Railway visibles | ✅ automático | Railway captura stdout |
| OBS-04 | Health check endpoint | ✅ hecho | `GET /health` |

---

### 6. Calidad y datos

| # | Item | Estado | Notas |
|---|------|--------|-------|
| QA-01 | 117 tests pasan en CI | ✅ hecho | Suite completa verde |
| QA-02 | Seed de demo deshabilitado en prod | ✅ hecho | Solo con `ALLOW_DEV_ENDPOINTS` |
| QA-03 | Smoke test manual post-deploy | ❌ pendiente | Checklist de 5 min: register → expediente → vencimiento |
| QA-04 | Backup automático de la DB | ❌ pendiente | Railway tiene snapshots, verificar que estén activos |

---

### 7. UX pre-launch

| # | Item | Estado | Notas |
|---|------|--------|-------|
| UX-01 | Página de registro pulida (first impression) | ✅ hecho | `/register` |
| UX-02 | Landing page o página de marketing | ❌ pendiente | Al menos una página `/` que explique el producto |
| UX-03 | Error pages (404, 500) con branding | ❌ pendiente | Las de Next.js default no tienen marca |
| UX-04 | Logo/favicon definitivo | ❌ pendiente | Actualmente usa ícono genérico |
| UX-05 | Términos y condiciones + Privacidad | ❌ pendiente | Requerido legalmente para recolectar datos |

---

### Resumen ejecutivo

| Categoría | Listo | Pendiente |
|-----------|-------|-----------|
| Infraestructura | 0/8 | 8 |
| Seguridad | 3/6 | 3 |
| Trial/Monetización | 1/6 | 5 |
| Email | 2/4 | 2 |
| Observabilidad | 2/4 | 2 |
| Calidad | 2/4 | 2 |
| UX pre-launch | 2/5 | 3 |
| **Total** | **12/37** | **25** |

> **Mínimo viable para primer usuario real:** INF-01 a INF-06 + SEC-01 + SEC-04 + EMAIL-01 + QA-03. El resto puede ir iterando.

---

## UX — Listados configurables

### UX-001 · Columnas ordenables y configurables en listados — `idea`
- **Prioridad:** P2
- **Como** abogado, **quiero** ordenar las columnas de los listados y elegir cuáles ver **para** personalizar la vista según mi flujo de trabajo.
- **Módulos:** Expedientes, Clientes
- **Criterios de aceptación:**
  - [ ] CA1: Puedo hacer clic en el header de cualquier columna para ordenar ASC/DESC
  - [ ] CA2: El orden se mantiene mientras navego dentro del módulo
  - [ ] CA3: Hay un botón/ícono para abrir un panel de configuración de columnas
  - [ ] CA4: Puedo activar/desactivar columnas (con al menos una siempre visible)
  - [ ] CA5: La configuración se persiste por usuario (localStorage como mínimo, DB como ideal)
  - [ ] CA6: En mobile se adapta — columnas configurables no aplican en vista card
- **Casos borde:** columna con todos los valores nulos al ordenar, resetear a configuración por defecto

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
