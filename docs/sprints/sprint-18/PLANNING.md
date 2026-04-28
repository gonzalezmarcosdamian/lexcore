# Sprint 18 — Superadmin operativo + sesión Google + deuda técnica

**Fecha inicio:** 2026-04-28
**Fecha fin:** 2026-05-11
**Estado:** Planificado
**Objetivo:** Visibilidad operativa para el superadmin (precios, trials, actividad) + sesión Google sin re-login diario + limpieza de deuda técnica pre-escala.

---

## Contexto

El producto está en prod con usuarios reales. GA4 activo. Bottom sheet scroll-lock resuelto.
Prioridades: no operar a ciegas en superadmin + fricción de login Google + deuda técnica de bajo riesgo.

---

## Historias comprometidas

| ID | Título | Pts | Prioridad |
|----|--------|-----|-----------|
| AUTH-SESSION-001 | Sesión Google dura 30 días (refresh token NextAuth) | 3 | P0 |
| SADM-010 | Gestión de precios de planes desde UI superadmin | 5 | P0 |
| SADM-011 | Trials a punto de vencer — lista + CTA extender | 3 | P0 |
| **UX-COLOR-001** | **Paleta uniforme: tareas=azul, movimientos=naranja en toda la app** | **2** | **P1** |
| **UX-AGENDA-ROWS-001** | **Filas de agenda con expediente + cliente + adjuntos visibles** | **3** | **P1** |
| SADM-013 | Actividad reciente por tenant (DAU/WAU, último login) | 5 | P1 |
| SADM-014 | Adopción por feature (% de uso por módulo) | 3 | P1 |
| DT-VCT-002 | `/vencimientos` → redirect a `/agenda` | 1 | P1 |
| DT-VCT-005 | Default tipo Movimiento `"vencimiento"` → `"otro"` | 1 | P2 |
| UX-SHEET-001 | Swipe-down para cerrar bottom sheets (drag handle) | 5 | P1 |

**Total:** 31 puntos

---

## Detalle

### AUTH-SESSION-001 (3pts) — P0
**Problema:** Google access_token vence en 1h. NextAuth no hace refresh → re-login diario.
**Fix:**
- `session: { maxAge: 30 * 24 * 60 * 60 }` en NextAuth config
- Callback `jwt`: si token vencido, refrescar con `refresh_token` de Google
- `access_type: "offline"` + `prompt: "consent"` al primer login Google para garantizar refresh_token
**Criterios:**
- [ ] Usuario Google no necesita re-loguearse en 7+ días
- [ ] Si refresh falla → redirect limpio a login, no error 500

### SADM-010 (5pts) — P0
**Problema:** Cambiar precios requiere SQL directo en Railway.
**Ya existe:** tabla `plan_prices` + `GET/POST /superadmin/plan-prices`
**Fix frontend** — sección nueva en `/superadmin`:
- Tabla de precios actuales por plan (starter/pro/estudio) y ciclo (mensual/anual)
- Form inline para nuevo precio: plan, ciclo, monto ARS, vigente_desde
- Badge "activo" en el precio vigente — el más reciente con vigente_desde ≤ hoy
- Historial de precios anteriores colapsable
**Criterios:**
- [ ] Ver precios actuales de cada plan desde el superadmin
- [ ] Crear nuevo precio con fecha de vigencia sin tocar la DB directamente
- [ ] Historial visible para saber qué pagó cada estudio

### SADM-011 (3pts) — P0
**Fix backend:** `GET /superadmin/trials-proximos?dias=10` → estudios con trial_ends_at en los próximos N días, con conteo de expedientes como proxy de actividad
**Fix frontend** — card/tab en `/superadmin`:
- Nombre estudio, email admin, días restantes (badge rojo ≤5d, amarillo ≤10d)
- Expedientes creados últimos 7 días
- Botón "Extender 15 días" (llama override existente)
- Botón "Copiar email" → clipboard
**Criterios:**
- [ ] Ver estudios con trial por vencer en los próximos 10 días
- [ ] Extender trial con un click sin ir al detalle del estudio
- [ ] Email copiable

### SADM-013 (5pts) — P1
**Fix backend:** ampliar `/superadmin/studios` con métricas agregadas por estudio:
- Último movimiento creado (MAX created_at en movimientos)
- Expedientes creados esta semana
- Total expedientes activos
**Fix frontend:**
- Columnas: "Última actividad", "Exps esta semana"
- Filtro: Activos / Dormidos (sin actividad 14d) / Nunca usaron
**Criterios:**
- [ ] Tabla muestra última actividad y actividad semanal por estudio
- [ ] Filtro de dormidos funciona
- [ ] Sin N+1 — una sola query agregada

### SADM-014 (3pts) — P1
**Fix backend:** `GET /superadmin/adoption` → `{ total_studios, google_calendar, resumen_ia, contable, documentos, tareas }`
**Fix frontend:** sección "Adopción" con pills o barras de % por feature
**Criterios:**
- [ ] Ver % de estudios que usa cada módulo principal

### DT-VCT-002 (1pt) — P1
Reemplazar `vencimientos/page.tsx` por redirect a `/agenda`.
Reemplazar `vencimientos/nuevo/page.tsx` por redirect a `/movimientos/nuevo`.

### DT-VCT-005 (1pt) — P2
Cambiar `default="vencimiento"` → `default="otro"` en modelo Movimiento + migración Alembic.

### UX-SHEET-001 (5pts) — P1
Componente `BottomSheet` genérico con drag handle:
- Handle visual (pill gris top-center)
- Track `touchstart`/`touchmove`/`touchend`
- Cerrar si drag > 80px abajo O velocidad > 0.5px/ms
- Snap-back suave si no supera threshold
**Criterios:**
- [ ] Swipe-down cierra el sheet con animación
- [ ] Snap-back si no supera threshold
- [ ] Funciona en iOS Safari y Chrome Android

---

## Detalle — Nuevas historias UX (feedback beta 2026-04-28)

### UX-COLOR-001 (2pts) — P1
**Regla única:** tareas = azul, movimientos/vencimientos = naranja, en toda la app.
**Archivos a tocar:**
- `calendar-mensual.tsx` — dots de color en el calendario mensual
- `agenda/page.tsx` — pills en lista cronológica y kanban
- `dashboard/page.tsx` — AgendaWidget (mini-semana + panel día)
- `expedientes/[id]/page.tsx` — bitácora (cards de tarea vs movimiento)
**Criterios:**
- [ ] En cualquier pantalla, el dot/pill de una tarea es azul
- [ ] En cualquier pantalla, el dot/pill de un movimiento es naranja/ámbar
- [ ] Urgente sigue siendo rojo (se superpone al color base)

### UX-AGENDA-ROWS-001 (3pts) — P1
**Formato de fila deseado en vista lista de agenda:**
```
[PENDIENTE ▾]  [VENCIMIENTO]  [+ Urgente]
Vence Noticia Contestación de Exhorto (Con Cargo)
Jue 30 de abril · 10:00 · EXP-2026-0014 · Campos Marcela Jimena
▸ Adjuntos (2)
```
**Fix:**
- Agregar línea 2 debajo del título: `fecha larga · hora · numero_expediente · cliente_nombre`
- Si tiene documentos: link colapsable "▸ Adjuntos (N)" que navega al detalle
- Solo en la **vista lista** (no kanban — el kanban tiene cards más compactas)
**Criterios:**
- [ ] Cada fila muestra expediente y cliente sin abrir el detalle
- [ ] "Adjuntos" visible si hay documentos, oculto si no
- [ ] Funciona en mobile 375px sin overflow

---

## Orden de implementación

```
Día 1-2:  AUTH-SESSION-001         — fricción diaria para usuarios reales
Día 3:    UX-COLOR-001             — visible y molesto para el usuario beta
Día 4:    UX-AGENDA-ROWS-001       — pedido directo del usuario real
Día 5-6:  SADM-011                 — valor comercial inmediato (trials)
Día 7-9:  SADM-010                 — necesario antes de más usuarios pagos
Día 10:   SADM-013 + 014           — visibilidad de uso
Día 11:   DT-VCT-002 + 005         — limpieza rápida (2pts, 1h c/u)
Día 12:   UX-SHEET-001             — si queda tiempo
```

---

## Excluidos (próximo sprint)

- SADM-012 (storage MB) — requiere integración R2 API
- SADM-015 (retención) — necesita más datos acumulados
- SADM-016 (CSV export) — útil, no urgente
- DT-VCT-003/004/006 — naming, post-escala

---

## DoD Sprint 18

- [ ] Código en master
- [ ] Tests backend pasando (197+ → agregar para endpoints nuevos)
- [ ] Flujo probado mobile 375px
- [ ] PRODUCTO.md actualizado con v0.21.0
- [ ] Sin errores TypeScript
- [ ] Railway + Vercel desplegados
