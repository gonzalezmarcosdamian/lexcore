# Tech Lead Validation — SUBS + SADM
> Fecha: 2026-04-22 | Autor: /tl | Estado: **APROBADO**

---

## 1. Alcance

Este documento valida el diseño técnico de:
- **SUBS-001 a SUBS-006** — Módulo de suscripción con MercadoPago
- **SADM-001 a SADM-004** — Módulo superadmin (backoffice interno)

Prerrequisito funcional: POC de MP Subscriptions validada localmente (checkout, webhook, 3 planes × 2 ciclos).

---

## 2. Esquema de base de datos

### 2.1 Cambios en tabla `studios` (migración única)

```sql
ALTER TABLE studios
  ADD COLUMN plan VARCHAR DEFAULT 'trial'
    CHECK (plan IN ('trial','starter','pro','estudio','read_only')),
  ADD COLUMN billing_cycle VARCHAR
    CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN subscription_id VARCHAR,          -- MP preapproval_id
  ADD COLUMN subscription_status VARCHAR
    CHECK (subscription_status IN ('active','paused','cancelled','pending')),
  ADD COLUMN next_billing_date DATE,
  ADD COLUMN subscription_updated_at TIMESTAMPTZ;
```

**Valores por defecto al migrar:** `plan = 'trial'` para todos los estudios existentes.
`trial_ends_at` ya existe — no tocar.

---

### 2.2 Nueva tabla `subscription_events` (append-only)

```sql
CREATE TABLE subscription_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        VARCHAR NOT NULL REFERENCES studios(id),
  event_type       VARCHAR NOT NULL,   -- created | charge_success | charge_failed | cancelled | upgraded | downgraded
  plan             VARCHAR NOT NULL,
  billing_cycle    VARCHAR,
  amount           NUMERIC(12,2),
  mp_payment_id    VARCHAR,            -- ID del pago en MP (nullable)
  mp_preapproval_id VARCHAR,           -- para idempotencia
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ix_sub_events_tenant ON subscription_events(tenant_id);
```

**Invariante:** nunca se hace UPDATE ni DELETE en esta tabla. Solo INSERT.

---

### 2.3 Cambios en tabla `users`

```sql
ALTER TABLE users
  ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
```

Un script de seed setea `is_superadmin = TRUE` para `ingonzalezdamian@gmail.com` post-migración.

---

### 2.4 Nueva tabla `plan_prices` (historial de precios)

```sql
CREATE TABLE plan_prices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan         VARCHAR NOT NULL CHECK (plan IN ('starter','pro','estudio')),
  billing_cycle VARCHAR NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  amount       NUMERIC(12,2) NOT NULL,
  currency     VARCHAR(3) NOT NULL DEFAULT 'ARS',
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to     TIMESTAMPTZ,           -- NULL = precio actual vigente
  created_by   VARCHAR,               -- user_id del superadmin que lo cambió
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

Cada suscripción activa referencia `plan_price_id` (FK a esta tabla) para mantener el precio al momento de contratar.

**Precio inicial (seed):**

| plan | billing_cycle | amount |
|------|--------------|--------|
| starter | monthly | 22000.00 |
| starter | annual | 20166.67 |
| pro | monthly | 38000.00 |
| pro | annual | 34833.33 |
| estudio | monthly | 65000.00 |
| estudio | annual | 59583.33 |

> Annual = monthly × 11 / 12 (cobro mensual equivalente).

Agregar `plan_price_id VARCHAR REFERENCES plan_prices(id)` en `studios` (nullable — estudios en trial no tienen precio asociado).

---

### 2.5 Nueva tabla `metrics_snapshots`

```sql
CREATE TABLE metrics_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data        JSONB NOT NULL,
  -- data incluye: total_studios, trial_studios, paying_studios,
  --               studios_per_plan, mrr_ars, arr_ars,
  --               total_users, total_expedientes, total_documentos,
  --               total_tareas, total_vencimientos
  created_by  VARCHAR    -- user_id del superadmin que disparó el sync
);
CREATE INDEX ix_metrics_snapshots_at ON metrics_snapshots(snapshot_at DESC);
```

No tiene `tenant_id` — es global, solo accesible desde `/superadmin`.

---

## 3. Diagrama de relaciones nuevas

```
studios
  ├── plan (enum)
  ├── billing_cycle (enum)
  ├── subscription_id → [MercadoPago externo]
  ├── subscription_status (enum)
  ├── next_billing_date
  ├── plan_price_id → plan_prices.id
  └── trial_ends_at (ya existe)

subscription_events
  └── tenant_id → studios.id  (append-only)

plan_prices
  └── [tabla maestra — sin FK a studios directa]

users
  └── is_superadmin (bool)

metrics_snapshots
  └── [tabla global sin tenant_id]
```

---

## 4. Contratos de API

### 4.1 Rutas SUBS (router `/suscripcion`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/suscripcion/planes` | cualquier usuario | Devuelve planes vigentes desde `plan_prices` + public key MP |
| POST | `/suscripcion/checkout` | admin | Crea preapproval en MP, devuelve `checkout_url` |
| POST | `/suscripcion/webhook` | público (validar firma) | Recibe IPN de MP, procesa estado |
| PATCH | `/suscripcion/cancel` | admin | Cancela preapproval en MP |
| GET | `/suscripcion/status` | admin | Devuelve estado actual + historial de eventos |

**`POST /suscripcion/checkout` request:**
```json
{ "plan": "pro", "billing_cycle": "monthly" }
```

**`POST /suscripcion/checkout` response:**
```json
{
  "checkout_url": "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=...",
  "preapproval_id": "2c938084...",
  "plan": "pro",
  "amount": 38000.0,
  "billing_cycle": "monthly"
}
```

**`POST /suscripcion/webhook` — payloads relevantes de MP:**

```json
// preapproval authorized (suscripción activada)
{ "type": "preapproval", "data": { "id": "2c938084..." } }
// → GET /preapproval/{id} → status = "authorized"
//   Acción: studio.subscription_status = "active", studio.plan = <plan elegido>,
//            studio.next_billing_date = next_payment_date, INSERT subscription_event

// preapproval charged (cobro exitoso)
{ "type": "subscription_authorized_payment", "data": { "id": "<payment_id>" } }
// → INSERT subscription_event con event_type = "charge_success"

// preapproval paused (cobro fallido)
// status = "paused" en respuesta GET /preapproval/{id}
// Acción: studio.subscription_status = "paused"
//         INSERT subscription_event event_type = "charge_failed"

// preapproval cancelled
// status = "cancelled"
// Acción: studio.subscription_status = "cancelled", studio.plan = "read_only"
```

**Idempotencia webhook:** guardar `mp_preapproval_id + event_type` en `subscription_events`. Si ya existe ese par → skip.

---

**`GET /suscripcion/status` response:**
```json
{
  "plan": "pro",
  "plan_label": "Pro",
  "billing_cycle": "monthly",
  "subscription_status": "active",
  "next_billing_date": "2026-05-22",
  "next_billing_amount": 38000.0,
  "trial_ends_at": null,
  "dias_restantes_trial": null,
  "studio_access_level": "full",
  "eventos": [
    { "event_type": "created", "plan": "pro", "amount": 38000.0, "created_at": "..." },
    { "event_type": "charge_success", "plan": "pro", "amount": 38000.0, "mp_payment_id": "...", "created_at": "..." }
  ]
}
```

---

### 4.2 Rutas SUBS-003: Access level

`GET /auth/me` — agregar campo `studio_access_level: "full" | "read_only"`.

**Lógica `get_studio_access_level(studio)`:**
```python
def get_studio_access_level(studio) -> str:
    # Suscripción activa → siempre full
    if studio.subscription_status == "active":
        return "full"
    # Trial vigente (y sin suscripción)
    if studio.trial_ends_at and studio.trial_ends_at > datetime.now(utc):
        return "full"
    # Todo lo demás → read_only
    return "read_only"
```

`Dependency FastAPI RequireFullAccess`:
- Se inyecta en todos los endpoints POST/PATCH/DELETE de dominios de negocio
- Lanza `HTTP 402` con `{"detail": "read_only", "message": "..."}`
- GET siempre pasa sin este dependency

---

### 4.3 Rutas SUBS-004: Límite usuarios

`POST /users/invite` — verificación antes de crear:
```python
PLAN_USER_LIMITS = { "trial": 2, "starter": 2, "pro": 6, "estudio": None }

activos = db.query(func.count(User.id)).filter(
    User.tenant_id == studio_id, User.activo == True
).scalar()
limite = PLAN_USER_LIMITS.get(studio.plan)
if limite is not None and activos >= limite:
    raise HTTPException(403, detail={"code": "plan_limit", "plan": studio.plan, "limit": limite, "current": activos})
```

---

### 4.4 Rutas SADM (router `/superadmin`)

Todas requieren `current_user.is_superadmin == True` → 403 si no.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/superadmin/studios` | Lista todos los estudios con plan, status, trial_ends_at |
| GET | `/superadmin/studios/{id}` | Detalle de un estudio (usuarios, expedientes, suscripción) |
| GET | `/superadmin/plan-prices` | Lista historial de precios |
| POST | `/superadmin/plan-prices` | Crea nuevo precio (cierra el anterior automáticamente) |
| GET | `/superadmin/metrics/latest` | Último snapshot de métricas |
| POST | `/superadmin/metrics/sync` | Genera snapshot manual con queries a DB |
| GET | `/superadmin/metrics/history` | Historial de snapshots (últimos 30) |

**`POST /superadmin/plan-prices` request:**
```json
{ "plan": "pro", "billing_cycle": "monthly", "amount": 42000.00 }
```
Cierra el `valid_to` del precio anterior para ese `(plan, billing_cycle)`.

**`POST /superadmin/metrics/sync` — queries que ejecuta:**
```python
data = {
    "total_studios": db.query(func.count(Studio.id)).scalar(),
    "trial_studios": db.query(func.count(...)).filter(plan='trial').scalar(),
    "paying_studios": db.query(...).filter(subscription_status='active').scalar(),
    "studios_per_plan": { plan: count for plan, count in db.query(Studio.plan, func.count())... },
    "mrr_ars": db.query(func.sum(plan_prices.amount))...join(studios where sub_status='active'),
    "total_users": db.query(func.count(User.id)).scalar(),
    "total_expedientes": db.query(func.count(Expediente.id)).scalar(),
    "total_documentos": db.query(func.count(Documento.id)).scalar(),
    "total_tareas": db.query(func.count(Tarea.id)).scalar(),
    "total_vencimientos": db.query(func.count(Vencimiento.id)).scalar(),
}
```

---

### 4.5 Rutas de frontend nuevas

```
/superadmin                     → redirect a /superadmin/metricas
/superadmin/metricas            → panel principal con KPIs
/superadmin/estudios            → lista de tenants
/superadmin/estudios/[id]       → detalle de tenant
/superadmin/precios             → gestión de plan_prices
```

Layout separado: `app/(superadmin)/layout.tsx` — verifica `is_superadmin` en sesión, redirige a `/dashboard` si no.
Switch en sidebar del studio: botón "Panel Superadmin" visible solo si `is_superadmin = true` en JWT.

---

## 5. Dependencias y orden de implementación

```
SUBS-001  ──── DB schema + migración (prereq de TODO)
    │
    ├── SUBS-002  ── Checkout + webhook (necesita subscription_events)
    │       │
    │       └── SUBS-003  ── Modo lectura (necesita plan en Studio)
    │               │
    │               ├── SUBS-004  ── Límite usuarios (independiente pero necesita plan)
    │               └── SUBS-005  ── Alertas email (extiende job existente de APScheduler)
    │
    └── SUBS-006  ── Frontend portal (consume todo lo anterior)

SADM-001  ──── is_superadmin en User + migración (prereq de SADM)
    │
    ├── SADM-002  ── plan_prices + endpoints gestión
    └── SADM-003 + SADM-004  ── metrics_snapshots (paralelo entre sí)
```

**Orden de sprints sugerido:**
1. SUBS-001 (migración + modelos)
2. SUBS-002 (checkout + webhook) — el más complejo
3. SUBS-003 + SUBS-004 en paralelo (misma sesión)
4. SUBS-005 (job existente, extensión simple)
5. SADM-001 + SADM-002 (migración + precios)
6. SADM-003 + SADM-004 (métricas)
7. SUBS-006 + frontend superadmin (UI final)

---

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Webhook MP llega antes de que el usuario vuelva a `/perfil?subs=ok` | Alta | Bajo | El frontend revalida `/auth/me` al cargar `/perfil` — siempre toma el estado real de DB |
| MP no envía webhook (timeout, red) | Media | Alto | Polling manual vía `GET /suscripcion/preapproval/{id}` desde el front cuando detecta `?subs=ok` en URL como fallback |
| Ciclo anual: MP no soporta `frequency = 12` en preapproval | Media | Medio | POC ya validó `frequency = 1, frequency_type = months`. Para anual usar mismo mecanismo con `amount = precio × 11 / 12`. El usuario paga 12 cuotas mensuales reducidas. |
| Duplicación de `subscription_events` por retry del webhook | Media | Medio | Idempotencia: índice UNIQUE en `(mp_preapproval_id, event_type, mp_payment_id)` donde `mp_payment_id IS NOT NULL` |
| `is_superadmin` en JWT expone dato sensible | Baja | Medio | El JWT ya contiene `role` — agregar `is_superadmin: bool`. El campo es solo lectura en frontend, nunca se puede setear desde la app. Seed script manual en Railway. |
| `metrics_snapshots` crece indefinidamente | Baja | Bajo | Retención: mantener últimos 365 registros. Job mensual de cleanup. JSONB es compacto. |
| `RequireFullAccess` olvidado en un endpoint nuevo | Media | Alto | Crear un test paramétrico que valide todos los routers POST/PATCH/DELETE tienen la dependency |

---

## 7. Decisiones técnicas confirmadas

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Ciclo anual = 12 cobros mensuales reducidos (× 11/12) | Pago único anual | MP Subscriptions maneja recurring mejor que one-shot. Usuario siente el descuento mes a mes. |
| `plan_prices` como tabla append-only | Hardcodear precios en código | Permite cambiar precios sin deploy. Historial para auditoría. Suscripciones mantienen precio original. |
| `is_superadmin` en DB (bool) | Hardcodear email en config | Escalable: se pueden agregar otros superadmins con un UPDATE. Sin deploy. |
| `metrics_snapshots` con sync manual | Queries en tiempo real | Protege estabilidad de prod. Superadmin acepta datos con latencia. |
| `subscription_events` append-only | Campo `status` editable | Permite auditoría completa. Nunca se pierde historial de pagos. |
| `RequireFullAccess` como FastAPI Dependency | Middleware global | Granularidad por endpoint. GET siempre pasa. Más explícito, más testeable. |
| Modo read_only a nivel studio | A nivel usuario | El bloqueo es de negocio: el estudio no pagó. No importa qué usuario. |

---

## 8. Casos borde documentados

**SUBS-001:**
- Estudios existentes al migrar → `plan = 'trial'`, `subscription_status = NULL`. `trial_ends_at` ya seteado.
- Estudio que vence trial y luego paga → `plan` pasa de `trial` a `starter/pro/estudio`.

**SUBS-002:**
- `back_url` debe ser HTTPS pública. En dev: fallback a `https://lexcore-kappa.vercel.app/perfil?subs=ok`. Documentado en suscripcion.py.
- `payer_email` no viene en JWT — siempre leer de DB.
- Webhook debe responder 200 siempre aunque falle el procesamiento interno (MP reintenta si no recibe 200 → infinite loop).

**SUBS-003:**
- Admin en modo read_only puede acceder a `/perfil` para ver planes y suscribirse (no bloquear GET en suscripcion).
- `RequireFullAccess` no aplica a: `/auth/*`, `/suscripcion/*`, `/users/me`, `/studios/me`.

**SUBS-004:**
- Usuario desactivado (`activo = False`) no cuenta para el límite.
- Downgrade con usuarios excedentes: estado `pending_user_reduction` — no procesar webhook de cambio de plan hasta que el admin resuelva.

**SUBS-005:**
- Idempotencia en emails: guardar en `subscription_events` un registro `event_type = "alert_sent"` con metadata `{ "days_before": 7, "date": "2026-05-15" }`. Si ya existe ese par `(tenant_id, days_before, date)` → skip.

**SADM-002:**
- Cambiar precio no afecta suscripciones activas (tienen su `plan_price_id` fijo).
- Nuevo precio aplica solo a suscripciones nuevas o renovaciones.

---

## 9. Estructura de archivos nuevos

```
backend/app/
├── models/
│   ├── subscription_event.py    (nuevo)
│   ├── plan_price.py            (nuevo)
│   └── metrics_snapshot.py      (nuevo)
├── routers/
│   ├── suscripcion.py           (expandir POC existente)
│   └── superadmin.py            (nuevo)
├── services/
│   └── subscription_service.py  (lógica: access_level, webhook processing)
└── alembic/versions/
    └── XXXX_subscription_and_superadmin.py

frontend/src/app/
├── (studio)/perfil/
│   └── page.tsx                 (expandir sección Mi Plan con SUBS-006)
└── (superadmin)/
    ├── layout.tsx               (nuevo — guard is_superadmin)
    ├── metricas/page.tsx        (nuevo)
    ├── estudios/page.tsx        (nuevo)
    ├── estudios/[id]/page.tsx   (nuevo)
    └── precios/page.tsx         (nuevo)
```

---

## 10. Checklist de QA por historia

### SUBS-001
- [ ] Migración no rompe estudios existentes (plan = 'trial' por defecto)
- [ ] `GET /auth/me` incluye `studio_access_level`
- [ ] `GET /suscripcion/status` devuelve `plan_label` y `dias_restantes_trial` calculados

### SUBS-002
- [ ] `POST /suscripcion/checkout` retorna 403 para no-admin
- [ ] Webhook con firma inválida retorna `{"ok": false}` pero HTTP 200
- [ ] Webhook idempotente: mismo payload dos veces → un solo `subscription_event`
- [ ] Webhook `authorized` → `studio.plan` actualiza al plan del checkout

### SUBS-003
- [ ] `POST /expedientes/` con estudio en trial vencido → 402
- [ ] `GET /expedientes/` con estudio en trial vencido → 200
- [ ] Admin puede hacer `POST /suscripcion/checkout` en modo read_only
- [ ] Test paramétrico cubre todos los routers de escritura

### SUBS-004
- [ ] Invite con plan starter y 2 usuarios activos → 403 con `code: "plan_limit"`
- [ ] Usuario desactivado no suma al conteo
- [ ] Frontend muestra modal de upgrade (no formulario de invite) al límite

### SUBS-005
- [ ] Job no envía el mismo email dos veces el mismo día (idempotencia)
- [ ] Email de `charge_failed` se envía solo vía webhook, no vía job

### SUBS-006
- [ ] Sección Mi Plan invisible para rol distinto de admin
- [ ] Botón cancelar envía PATCH a MP y actualiza UI
- [ ] Tabla historial muestra últimos 12 eventos de `subscription_events`

### SADM-001
- [ ] `GET /superadmin/*` retorna 403 para usuario sin `is_superadmin`
- [ ] Seed script setea `is_superadmin = True` para `ingonzalezdamian@gmail.com`
- [ ] JWT incluye `is_superadmin: bool` (false por defecto)
- [ ] Switch "Panel Superadmin" solo visible si `is_superadmin = true` en sesión

### SADM-002
- [ ] `POST /superadmin/plan-prices` cierra `valid_to` del precio anterior
- [ ] `GET /suscripcion/planes` devuelve precios de `plan_prices WHERE valid_to IS NULL`
- [ ] Suscripción existente mantiene su `plan_price_id` original tras cambio de precio

### SADM-003 + SADM-004
- [ ] `POST /superadmin/metrics/sync` genera snapshot con todos los campos definidos
- [ ] Snapshot no bloquea otras requests (timeout razonable — máx 5s)
- [ ] Historial muestra últimos 30 snapshots ordenados DESC

---

## 11. Variables de entorno — adiciones requeridas

**Backend (Railway):**
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...     # producción, no el de test
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=<generar en dashboard MP>
BASE_URL=https://api.lexcore.ar          # para back_url en MP
```

**Frontend (Vercel):**
```
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
```

---

## 12. Veredicto TL

**APROBADO** con las siguientes condiciones:

1. **Empezar con SUBS-001** (migración). Aplicar en local y validar que los estudios existentes tienen `plan = 'trial'`.
2. **SUBS-002 requiere** que el webhook URL esté registrado en el dashboard de MP antes de testear en prod. En local usar ngrok o similar para el desarrollo.
3. **`RequireFullAccess` debe tener test paramétrico** que enumere todos los endpoints protegidos — esto previene regresiones cuando se agrega un router nuevo.
4. **SADM no bloquea SUBS** — son paralelos en DB pero SADM puede esperar a que SUBS-001 a SUBS-004 estén `done`.
5. **No hay decisiones técnicas abiertas** que bloqueen el inicio de SUBS-001.

> Próximo paso: `/dev` puede arrancar con SUBS-001.
