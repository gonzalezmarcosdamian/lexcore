# LexCore — Bitácora de Sesiones

> Una entrada por sesión de trabajo. Describe qué se hizo, qué decisiones se tomaron, qué quedó pendiente.

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
