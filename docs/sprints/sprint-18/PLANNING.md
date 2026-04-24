# Sprint 18 — Rename Vencimiento → Movimiento + Rediseño Expediente

**Fecha:** 2026-04-24
**Estado:** En curso
**Objetivo:** Unificar la entidad Vencimiento bajo el nombre Movimiento (rename seguro sin pérdida de datos) y rediseñar el detalle del expediente con bitácora como eje central.

---

## Decisión de diseño

Un abogado trabaja con "movimientos procesales" — la demanda, la contestación, la audiencia, el vencimiento de plazo, la pericia. Todos son el mismo tipo de evento con fecha, hora y efectos en el expediente. Mantener dos entidades separadas (Vencimiento + Movimiento de bitácora) era una decisión técnica que no refleja el dominio.

**Vencimiento** pasa a ser un *tipo* de Movimiento (tipo="vencimiento"), no una entidad separada.
**El actual Movimiento de bitácora** (texto libre sin fecha obligatoria) desaparece — todo movimiento procesal tiene título, fecha y hora obligatorios.

### Por qué rename y no tabla nueva

| | Rename | Tabla nueva |
|--|--------|-------------|
| Pérdida de datos | Imposible | Riesgo real |
| Complejidad migración | 1 archivo, ~10 líneas SQL | 3+ archivos, 50+ líneas |
| Rollback | 1 migración inversa | Restore backup |
| Downtime | 0 | ~2 min |

---

## Scope del sprint

### PARTE 1 — Rename Vencimiento → Movimiento

#### Cambios en la DB (1 sola migración Alembic)

```sql
ALTER TABLE vencimientos RENAME TO movimientos;
ALTER TABLE movimientos RENAME COLUMN descripcion TO titulo;
ALTER TABLE movimientos ADD COLUMN descripcion TEXT;
ALTER TABLE movimientos ADD COLUMN estado VARCHAR(20) DEFAULT 'pendiente';
UPDATE movimientos SET estado = CASE WHEN cumplido THEN 'cumplido' ELSE 'pendiente' END;
ALTER TABLE movimientos DROP COLUMN cumplido;
ALTER TABLE notas RENAME COLUMN vencimiento_id TO movimiento_id;
ALTER TABLE documentos RENAME COLUMN vencimiento_id TO movimiento_id;
```

Rollback: mismo proceso en reverse.
Tabla `vencimientos` no se borra hasta confirmar prod estable por 1 semana.

#### Modelo Movimiento final

| Campo | Tipo | Origen |
|-------|------|--------|
| `titulo` | String(500), required | rename de `descripcion` |
| `descripcion` | Text, nullable | nuevo campo |
| `tipo` | Enum | sin cambio (vencimiento/audiencia/presentacion/pericia/otro) |
| `fecha` | String(10), required | sin cambio |
| `hora` | String(5), required | sin cambio |
| `estado` | String(20) | rename de `cumplido: bool` |
| `expediente_id` | FK | sin cambio |
| `notas` | relationship via `movimiento_id` | era `vencimiento_id` |
| `documentos` | relationship via `movimiento_id` | era `vencimiento_id` |

#### Impacto Backend

| Archivo | Acción |
|---------|--------|
| `models/expediente.py` | `class Vencimiento` → `class Movimiento`; tabla; campos |
| `models/nota.py` | `vencimiento_id` → `movimiento_id` |
| `models/documento.py` | `vencimiento_id` → `movimiento_id` |
| `models/__init__.py` | Export `Movimiento` |
| `schemas/expediente.py` | `VencimientoCreate/Out` → `MovimientoCreate/Out`; campos |
| `routers/vencimientos.py` | → `routers/movimientos.py`; prefix `/movimientos` |
| `routers/expedientes.py` | Imports + actividad feed |
| `routers/documentos.py` | `vencimiento_id` → `movimiento_id` |
| `routers/tareas.py` | Queries con `vencimiento_id` |
| `routers/ical.py` | Query `Movimiento`; campo `titulo` |
| `routers/google_calendar.py` | Ídem ical |
| `main.py` | Import nuevo router; scheduler usa `Movimiento` |
| `services/email.py` | Template: `descripcion` → `titulo` |
| `services/pdf_unificado.py` | Docs con `movimiento_id` |
| `alembic/versions/` | 1 migración rename |

#### Impacto Frontend

| Archivo | Acción |
|---------|--------|
| `lib/api.ts` | `Vencimiento` → `Movimiento`; `descripcion` → `titulo`; agregar `descripcion?`; `cumplido` → `estado` |
| `components/features/vencimiento-detail-sheet.tsx` | → `movimiento-detail-sheet.tsx` |
| `components/ui/calendar-mensual.tsx` | Tipo `"vencimiento"` → `"movimiento"` |
| `app/(studio)/vencimientos/page.tsx` | → `movimientos/page.tsx` |
| `app/(studio)/vencimientos/[id]/page.tsx` | → `movimientos/[id]/page.tsx` |
| `app/(studio)/vencimientos/nuevo/page.tsx` | → `movimientos/nuevo/page.tsx` |
| `app/(studio)/agenda/page.tsx` | Fetch `/movimientos`; tipos; handlers |
| `app/(studio)/dashboard/page.tsx` | Ídem agenda |
| `app/(studio)/clientes/[id]/page.tsx` | Fetch `/movimientos`; labels |
| `middleware.ts` | Redirect `/vencimientos` → `/movimientos` |

---

### PARTE 2 — Rediseño detalle expediente

#### Layout nuevo

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXP-2026-0001  ·  [ACTIVO]  [Paralizar]  [PDF]                    │
│  García Ramírez c/ Municipalidad de Córdoba                         │
│  Civil · Juzgado Civil 1 · Córdoba                                  │
├─────────────────────────┬───────────────────────────────────────────┤
│  SIDEBAR                │  BITÁCORA                                 │
│                         │  Historial completo del expediente  ↺    │
│  Nº Interno             │                                           │
│  Nº Judicial            │  [+ Movimiento procesal]  [+ Tarea]      │
│  Fuero                  │                                           │
│  Juzgado                │  ── 24 abr 2026 ────────────────────     │
│  Estado                 │  ┌───────────────────────────────────┐   │
│  Alta                   │  │ 📋 MOVIMIENTO  Audiencia · 10:00  │   │
│                         │  │ Audiencia de vista de causa       │   │
│  CLIENTES               │  │ Pendiente · 📎 acta.pdf           │   │
│                         │  └───────────────────────────────────┘   │
│  EQUIPO                 │                                           │
│                         │  ┌───────────────────────────────────┐   │
│  HONORARIOS             │  │ ✅ TAREA  nueva tarea             │   │
│  ARS                    │  │ judicial · Pendiente · 29-abr     │   │
│  Acordado  $ 150.000    │  └───────────────────────────────────┘   │
│  Cobrado   $ 50.000     │                                           │
│  Saldo     $ 100.000    │  ┌───────────────────────────────────┐   │
│  [███░░░] 33%           │  │ 💰 HONORARIO  Honorario 1         │   │
│                         │  │ ARS 1.234 · Saldo ARS 1.234       │   │
│  USD (si hay)           │  └───────────────────────────────────┘   │
│  ...                    │                                           │
│  [+ Nuevo honorario]    │                                           │
└─────────────────────────┴───────────────────────────────────────────┘
```

#### Qué desaparece

| Sección | Por qué | Datos |
|---------|---------|-------|
| Collapsible Vencimientos | → Movimientos en bitácora | Bitácora los muestra |
| Collapsible Tareas | Ya en bitácora | Bitácora las muestra |
| Collapsible Documentos | Adjuntos en ítems bitácora | Cada ítem tiene chip |
| HonorariosTab collapsible | Sube al sidebar | Sidebar con montos |

#### Impacto en expedientes/[id]/page.tsx

| Elemento | Acción |
|----------|--------|
| Imports HonorariosTab, TareasSection, DocumentosTab | Remover/refactorizar |
| Secciones collapsibles Honorarios/Vencimientos/Tareas/Docs | Eliminar |
| Sidebar: bloque Honorarios con montos ARS/USD + barra | Nuevo |
| Sidebar: botón [+ Nuevo honorario] inline | Nuevo |
| Bitácora: textarea reemplazada por [+ Movimiento] [+ Tarea] | Modificar |
| Modal nuevo movimiento desde expediente | Nuevo |
| Rows bitácora mejoradas (título, tipo, estado, adjunto) | Mejorar |

---

## Orden de implementación

```
FASE 1: Backup + Migración DB
FASE 2: Backend completo
FASE 3: Frontend completo
FASE 4: Rediseño expediente
FASE 5: TypeScript check + deploy + migración prod
```

## Estrategia de rollback

```bash
# Revertir DB
railway ssh -- "cd /app && alembic downgrade -1"
# Revertir código
git revert HEAD~N && git push origin master
```

## Verificación post-deploy

```bash
# Antes: anotar COUNT(vencimientos) en prod
# Después verificar:
SELECT COUNT(*) FROM movimientos;   -- debe ser >= COUNT original
SELECT COUNT(*) FROM notas WHERE movimiento_id IS NOT NULL;
SELECT COUNT(*) FROM documentos WHERE movimiento_id IS NOT NULL;
```
