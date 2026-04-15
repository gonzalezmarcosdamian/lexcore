# Sprint 05 — Planning

**Fecha:** 2026-04-15
**Duración:** 1 semana (sesiones asíncronas)
**Sprint anterior:** Sprint 04 — cerrado ✓
**Objetivo del sprint:** UX de primer uso + búsqueda global rediseñada + gestión del equipo completa + documentos funcionales

---

## Objetivo

> "El estudio se ve y se siente como un producto terminado: la primera experiencia es clara, la carga es fluida, el equipo está bien gestionado y los documentos de los expedientes funcionan."

---

## Historias comprometidas

### 🟢 CARRY-OVER de Sprint 04 (ya implementado, falta cerrar doc)

| Historia | Estado real | Acción |
|----------|-------------|--------|
| DOC-001: Documentos en expedientes | ✅ Implementado (MinIO + presigned URLs) | Mover a done en BACKLOG.md |
| USR-003: Equipo — listar miembros reales | ✅ Implementado (`GET /users`) | Mover a done |
| USR-004: Cambio de rol + eliminar miembro | ✅ Implementado (`PATCH /users/{id}/role`, `DELETE /users/{id}`) | Mover a done |
| PageHelp: botones `?` en todas las pantallas | ✅ Implementado | Registrar como mejora UX |

---

### 🔵 Sprint 05 — Nuevas historias

#### UX-001 · Splash screen de value props — P2
- **Criterios:** aparece 1 sola vez (localStorage), 3-4 value props, botón "Comenzar", no aparece si ya hay datos
- **Estimación:** S (medio día)
- **Asignado a:** /dev

#### UX-002 · Skeletons de carga globales — P2
- **Criterios:** todas las listas con skeleton, métricas del dashboard, tabs de expediente
- **Estimación:** M (1 día)
- **Asignado a:** /dev

#### BUS-001 · Búsqueda global modal (Cmd+K) — P2
- **Criterios:** modal centrado con overlay, Cmd+K / Ctrl+K, ícono lupa en topbar, Escape cierra
- **Estimación:** S (la lógica ya existe en SearchPanel, solo hay que rearmar el contenedor)
- **Asignado a:** /dev

#### VCT-004 · Sync directo Google Calendar — P0
- **Criterios:** botón "Sync Calendar" en vencimientos, push de todos los pendientes, requiere Google OAuth
- **Estimación:** L (2 días — depende de refresh token flow)
- **Asignado a:** /dev (después de revisar estado del refresh token en DB)
- **Riesgo:** Si el Google OAuth refresh token no está almacenado correctamente, bloquea esta historia → bajar a Sprint 06

#### DASH-001 · Persistencia de período en dashboard — P2
- **Criterios:** localStorage, badge visual del período activo cuando no es default
- **Estimación:** XS (pocas horas)
- **Asignado a:** /dev

---

## Capacidad estimada

| Tamaño | Días | Historias |
|--------|------|-----------|
| XS | < 2hs | DASH-001 |
| S | ~4hs | UX-001, BUS-001 |
| M | ~1 día | UX-002 |
| L | ~2 días | VCT-004 |
| **Total** | **~4-5 días** | 5 historias |

---

## Definition of Done (Sprint 05)

- [ ] tsc --noEmit sin errores
- [ ] Tests backend: 81+ pasando (no regresiones)
- [ ] Cada historia validada manualmente en browser (mobile 375px + desktop)
- [ ] PRODUCTO.md actualizado con features nuevas
- [ ] BACKLOG.md: historias movidas a `done`
- [ ] Daily del sprint creada en `sprint-05/daily/`

---

## Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| VCT-004: refresh token de Google no disponible | Alto | Verificar en DB antes de empezar. Si no está, mover a Sprint 06 |
| UX-001: detección "usuario nuevo" puede ser compleja | Bajo | Usar solo localStorage como criterio — simple y predecible |
| Sprint corto — muchas historias XS/S | Bajo | Priorizar UX-001 + BUS-001 + UX-002. VCT-004 es opcional |

---

## Notas de arquitectura (pre-aprobadas)

- `SearchPanel` → reutilizar lógica, solo cambiar el contenedor (div modal vs div sidebar)
- Splash → `localStorage.getItem("lexcore_onboarded")` como flag. Setear al hacer click "Comenzar"
- Skeletons → crear componentes `SkeletonRow`, `SkeletonCard`, `SkeletonStat` en `components/ui/`
