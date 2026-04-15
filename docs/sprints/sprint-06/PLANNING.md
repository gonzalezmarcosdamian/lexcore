# Sprint 06 — Planning

**Fecha:** 2026-04-15
**Duración:** 1 semana (sesiones asíncronas)
**Sprint anterior:** Sprint 05 — cerrado ✓
**Objetivo del sprint:** UX pulida + notificaciones con navegación + módulo contable base

---

## Objetivo

> "El estudio empieza a sentirse como software profesional: los formularios son cómodos, las notificaciones llevan al lugar correcto, y ya se puede registrar lo que entra y lo que sale de dinero."

---

## Estado de Sprint 05 — carry-over

| Historia | Estado |
|----------|--------|
| UX-001 Splash screen | ✅ Done (modo DEV — siempre visible para testeo) |
| UX-002 Skeletons globales | ✅ Done |
| BUS-001 Modal Cmd+K | ✅ Done |
| DASH-001 Persistencia período | ✅ Done |
| VCT-004 Google Calendar sync | 🟡 Rediseñado — ya no requiere login Google. Cualquier usuario conecta Calendar desde `/perfil` via OAuth2 separado. Entra en Sprint 06. |

---

## Historias Sprint 06

### 🔵 Bloque UX — Polish de formularios y navegación

#### UX-006 · Pre-selección de expediente en formularios — P1
- Al crear vencimiento/honorario desde el detalle de un expediente, el campo `expediente_id` viene pre-seleccionado y bloqueado
- Mecanismo: `?expediente_id=xxx` como query param → form lo lee, pre-llena y muestra banner "Creando para: EXP-XXXX"
- **Estimación:** S (medio día)
- **Impacto:** Alta fricción actual — el usuario tiene que buscar el expediente manualmente

#### UX-003 · Centrado de formularios ABM — P2
- `max-w-2xl mx-auto` en todos los forms de nuevo/edición: clientes, expedientes, vencimientos
- Grid 2 columnas en desktop donde aplica
- **Estimación:** XS (2hs)

#### UX-004 · Efecto de expansión en search bars — P2
- Transición suave `transition-all` al hacer focus en las búsquedas de clientes, expedientes, vencimientos
- **Estimación:** XS (1hs)

#### UX-005 · Atajo búsqueda agnóstico (⌘K / Ctrl+K) — P2
- Detectar OS con `navigator.platform` y mostrar el atajo correcto en el botón del topbar
- **Estimación:** XS (30min)

---

### 🔔 Bloque Notificaciones

#### NOT-002 · Panel desplegable de notificaciones — P1
- Click en pill "N urgentes" abre dropdown con lista de vencimientos urgentes y próximos
- Cada notificación navega al expediente al hacer click
- Botón "Marcar todas como vistas" baja el badge
- En mobile: bottom sheet
- **Estimación:** M (1 día)
- **Impacto:** Hoy el pill solo lleva a `/vencimientos` — sin contexto de qué hacer

---

### 💰 Bloque Contabilidad — fase 1

#### CONT-001 · Gastos y costos del estudio — P1
- **Backend:** modelo `Gasto` (categoría, descripción, monto, moneda, fecha, expediente_id opcional, recurrente)
- **Backend:** migración Alembic + router `GET/POST /gastos`, `PATCH/DELETE /gastos/{id}`
- **Backend:** tests TDD con aislamiento tenant
- **Frontend:** nueva página `/gastos` en el sidebar + formulario de carga
- **Estimación:** L (2 días)

#### CONT-002 · Widget financiero en dashboard — P1
- Widget en sidebar del dashboard: "Este mes" → ingresos (honorarios cobrados) vs egresos (gastos) → resultado neto
- Solo visible para admin/socio
- **Estimación:** M (1 día — depende de CONT-001)
- **Dependencias:** CONT-001

---

### 📅 VCT-004 · Sync Google Calendar — P1 (desbloqueado)
- **Prerequisito resuelto:** El sync ya NO requiere login con Google. Cualquier usuario (email o Google) puede conectar su Calendar desde `/perfil` via un OAuth2 flow separado
- Flujo: botón "Conectar Google Calendar" → OAuth scope Calendar → selector de calendarios → sync
- Nueva columna en `User`: `google_calendar_id`
- Nuevos endpoints: `GET /auth/google-calendar/connect`, `GET /auth/google-calendar/callback`
- **Estimación:** L (2 días)

---

## Capacidad y priorización

```
Obligatorio (P1):
  UX-006    S   — pre-selección expediente en forms
  NOT-002   M   — panel notificaciones desplegable
  CONT-001  L   — gastos backend + frontend
  CONT-002  M   — widget financiero dashboard
  VCT-004   L   — conectar Google Calendar + sync + selector de calendario

Si sobra tiempo (P2):
  UX-003   XS   — centrar forms ABM
  UX-004   XS   — expansión search bars
  UX-005   XS   — atajo agnóstico ⌘K / Ctrl+K

Total estimado: 6-7 días de trabajo efectivo
```

---

## Orden de ejecución sugerido

```
Día 1:  UX-006 + UX-003 + UX-004 + UX-005  (polish rápido, todo XS/S)
Día 2:  NOT-002 (panel notificaciones desplegable)
Día 3:  CONT-001 backend (modelo Gasto + migración + router + tests TDD)
Día 4:  CONT-001 frontend (página /gastos con CRUD)
Día 5:  CONT-002 (widget financiero en dashboard)
Día 6:  VCT-004 backend (OAuth2 connect flow + /auth/google-calendar/* + sync endpoint)
Día 7:  VCT-004 frontend (/perfil — sección conectar, selector calendarios, botón sync activo)
```

---

### 📅 VCT-004 · Sync Google Calendar — P1 (comprometido)

**Contexto:** Cualquier usuario (email o Google OAuth) puede conectar su Google Calendar desde su perfil, elegir en qué calendario sincronizar, y tener sus vencimientos actualizados automáticamente. No depende del método de login.

**Backend — nuevos endpoints:**
```
GET  /auth/google-calendar/connect    → genera URL OAuth2 (scope: calendar.events)
GET  /auth/google-calendar/callback   → recibe code, guarda refresh_token + calendar_id
GET  /auth/google-calendar/calendars  → lista calendarios disponibles del usuario
DELETE /auth/google-calendar/disconnect → borra refresh_token y calendar_id del usuario
POST /vencimientos/sync-calendar      → pushea todos los vencimientos pendientes al calendar elegido
```

**Backend — migración:**
- Nueva columna `google_calendar_id: str | None` en `User`

**Frontend — `/perfil` (página nueva):**
- Sección "Datos personales": nombre, email (solo lectura), rol
- Sección "Google Calendar":
  - Estado: "No conectado" → botón "Conectar Google Calendar"
  - Estado: "Conectado" → selector de calendario + botón "Desconectar"
  - El selector muestra nombre del calendario (no el ID técnico)

**Frontend — Vencimientos:**
- Botón "Sync Calendar" se activa cuando el usuario tiene `google_calendar_id` configurado
- Si no está conectado → tooltip "Conectá tu Google Calendar desde tu perfil"

**Estimación:** L (2 días — Día 6 backend, Día 7 frontend)

---

## Definition of Done

- [ ] `tsc --noEmit` sin errores
- [ ] Tests backend: sin regresiones sobre los actuales
- [ ] Cada historia validada en browser (mobile 375px + desktop)
- [ ] PRODUCTO.md actualizado a v0.6.0
- [ ] BACKLOG.md: historias movidas a `done`
- [ ] Daily del sprint creada

---

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| VCT-004 scope OAuth Calendar | Baja | El flow OAuth2 separado (solo Calendar, no login) es estándar. El riesgo es la configuración del callback URL en Google Cloud Console — verificar que esté registrado. |
| CONT-001 scope creep | Media | Mantener el modelo simple: sin contabilidad doble entrada, sin multi-moneda en el resultado neto por ahora |
| NOT-002 mobile bottom sheet complejo | Baja | Si tarda más de lo esperado, simplificar a dropdown estándar en mobile también |

---

## Nuevas entidades de datos en Sprint 06

### Modelo `Gasto` (CONT-001)
```python
class Gasto(TenantModel):
    __tablename__ = "gastos"

    descripcion: str
    categoria: GastoCategoria  # enum
    monto: Decimal
    moneda: Moneda  # ARS / USD
    fecha: date
    expediente_id: str | None  # FK opcional
    recurrente: bool = False
    notas: str | None
```

**Categorías:**
- `alquiler` · `sueldos` · `servicios` · `costos_judiciales` · `honorarios_terceros` · `otros`

**Endpoints nuevos:**
- `GET /gastos` — lista con filtros: período, categoría, expediente_id
- `POST /gastos` — crear
- `PATCH /gastos/{id}` — editar
- `DELETE /gastos/{id}` — eliminar
- `GET /gastos/resumen` — total ARS y USD del período (para widget dashboard)
