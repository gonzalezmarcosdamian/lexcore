# Audit Mobile/Desktop — LexCore
**Fecha:** 2026-04-25  
**Objetivo:** Empatar experiencia mobile con desktop en todos los módulos.

---

## Resumen ejecutivo

| Estado | Módulos |
|--------|---------|
| ✅ Correcto | agenda, dashboard, expedientes lista, expedientes detalle, clientes lista, clientes detalle, gastos/contable, todos los forms nuevos |
| 🔴 Crítico (solucionado) | movimientos/[id], tareas/[id] — redirigían a /agenda en mobile |
| ⚠️ Aceptable | vencimientos/page.tsx — sin split pero funcional |

---

## Módulos auditados

### ✅ Agenda (`agenda/page.tsx`)
- Split explícito `lg:hidden` / `hidden lg:block`
- Mobile: lista cronológica + sheets de detalle + filtros en una línea
- Desktop: tablero kanban + calendario + filtros horizontales
- **Paridad: COMPLETA**

### ✅ Dashboard (`dashboard/page.tsx`)
- Sin split CSS explícito pero usa `window.innerWidth < 1024` para sheets vs navegación
- Mobile: calendar mini con dots, panel del día, sheets para detalle
- Desktop: calendar expandido con pills de texto, lista completa
- **Paridad: COMPLETA**

### ✅ Expedientes lista (`expedientes/page.tsx`)
- Split explícito: mobile=cards, desktop=tabla con columnas reordenables
- Mobile: cards con info esencial, sidebar como overlay
- Desktop: tabla con todas las columnas, sidebar con filtros
- **Paridad: COMPLETA**

### ✅ Expedientes detalle (`expedientes/[id]/page.tsx`)
- Layout `grid-cols-1 lg:grid-cols-[280px_1fr]` — colapsa a 1 col en mobile
- Sidebar queda arriba en mobile, bitácora abajo
- Honorarios, bitácora: full-width en ambos
- **Paridad: BUENA** (leve: el sidebar con datos del exp queda muy largo en mobile)

### ✅ Clientes lista (`clientes/page.tsx`)
- Layout responsive flex, sin split necesario
- **Paridad: COMPLETA**

### ✅ Clientes detalle (`clientes/[id]/page.tsx`)
- `grid-cols-1 lg:grid-cols-3` — colapsa correctamente
- **Paridad: BUENA**

### 🔴→✅ Movimientos detalle (`movimientos/[id]/page.tsx`)
- **BUG SOLUCIONADO:** Tenía `useEffect` que redirigía mobile < 1024px a `/agenda`
- **Fix:** Eliminado el redirect — la página usa `max-w-3xl mx-auto px-3 pb-28` que es responsive
- **Paridad post-fix: COMPLETA**

### 🔴→✅ Tareas detalle (`tareas/[id]/page.tsx`)
- **BUG SOLUCIONADO:** Mismo patrón, redirigía mobile a `/agenda`
- **Fix:** Eliminado el redirect
- **Paridad post-fix: COMPLETA**

### ✅ Forms nuevos (movimientos/nuevo, tareas/nueva, honorarios/nuevo, honorarios/pago)
- Todos usan `max-w-2xl mx-auto px-4 pb-28`
- `pb-28` asegura que el botón submit no quede tapado por la nav bar mobile
- Grids internos: `grid-cols-2` que colapsan correctamente en pantallas pequeñas
- **Paridad: COMPLETA**

### ✅ Contable (`gastos/page.tsx`)
- Header unificado responsive (tabs + período en una barra)
- Grids usan `grid-cols-1 sm:grid-cols-N`
- Sin split explícito necesario — layout lineal funciona en mobile
- **Paridad: BUENA**

### ⚠️ Vencimientos lista (`vencimientos/page.tsx`)
- Sin split mobile/desktop explícito
- Funciona en mobile (lista vertical)
- El redirect `/vencimientos/[id]` → `/movimientos/[id]` funciona (ya sin redirect a /agenda)
- **Paridad: ACEPTABLE** (mejorable con split para mayor densidad)

---

## Fixes aplicados

### MOB-001: Eliminar redirects mobile en páginas de detalle
**Archivos:** `movimientos/[id]/page.tsx`, `tareas/[id]/page.tsx`  
**Cambio:** Removed `useEffect(() => { if (window.innerWidth < 1024) router.replace("/agenda") }, [router])`  
**Razón:** Las páginas ya son responsive (`max-w-3xl mx-auto px-3`). El redirect rompía la navegación desde expediente en mobile.

---

## Checklist de test manual

### Movimientos detalle — mobile
- [ ] Desde la bitácora de un expediente en mobile, tocás un movimiento → abre `/movimientos/{id}` (no redirige a /agenda)
- [ ] La página carga correctamente en 375px
- [ ] El botón "Cumplido/Pendiente" funciona
- [ ] Las notas se pueden agregar
- [ ] El botón de eliminar funciona

### Tareas detalle — mobile  
- [ ] Desde la bitácora, tocás una tarea → abre `/tareas/{id}`
- [ ] Ídem checks de movimiento

### Forms — mobile
- [ ] `/movimientos/nuevo` — formulario completo visible en 375px sin overflow
- [ ] `/tareas/nueva` — ídem
- [ ] `/honorarios/nuevo` — ídem, cuotas colapsables visibles
- [ ] `/honorarios/pago` — botón "Registrar pago" visible sin scroll

### Expediente detalle — mobile
- [ ] Sidebar (datos del expediente) aparece arriba correctamente
- [ ] Bitácora debajo del sidebar
- [ ] Honorarios debajo de la bitácora
- [ ] Botones [+ Movimiento] [+ Tarea] visibles y funcionan

### Agenda — mobile
- [ ] Filtros en una línea con scroll horizontal
- [ ] Picker del día abre correctamente
- [ ] Items de la lista navegan al detalle (no a /agenda)

---

## Pendiente (backlog)
- **EXP-MOB-001**: En expediente detalle mobile, el sidebar con datos del expediente queda muy largo antes de la bitácora. Considerar colapsar el sidebar en mobile.
- **VENC-MOB-001**: Página de lista de vencimientos sin split mobile — considerar agregar cards para mobile (igual que expedientes).
