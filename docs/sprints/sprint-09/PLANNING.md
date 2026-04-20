# Sprint 09 — Planning (revisado 2026-04-16)

**Período:** 2026-04-30 → 2026-05-13 (2 semanas)
**Capacidad:** ~18 puntos (historias bloqueadas removidas)
**Objetivo:** IA integrada al expediente + UX mobile-first + observabilidad + búsqueda mejorada.

---

## Historias en este sprint

| ID | Historia | Pts | Estado |
|----|----------|-----|--------|
| US-AI-01 | Resumen IA del expediente (OpenAI) | 5 | `refined` |
| US-10 | Creación de expediente en 2 pasos mobile-first | 5 | `refined` |
| US-11 | Sentry + logs estructurados | 5 | `ready` |
| US-15 | Full-text search PostgreSQL | 2 | `ready` |
| TECH-001 | Fix setup-studio inseguro | 1 | `ready` |
| **TOTAL** | | **18 pts** | |

### Historias bloqueadas (NO planificar)
- US-12: Decisión PO pendiente sobre formato (Word vs PDF) → `blocked`
- US-13: Reemplazado por canal WhatsApp → `blocked`
- PREC-001: Esperando feedback de primeros usuarios reales → `blocked`
- PJN-001/002: Requiere spike técnico API PJN → `blocked`
- COLLAB-001: WebSockets — complejidad alta para valor actual → `blocked`

---

## Detalle de historias

### US-AI-01 · Resumen IA del expediente — `refined`
- Tabla `expediente_resumenes` con `UNIQUE(tenant_id, expediente_id)`
- Botón "Generar resumen" en detalle de expediente (no auto en carga)
- OpenAI API: contexto = carátula + movimientos + vencimientos + tareas + honorarios
- Badge "Desactualizado" cuando hay nuevos movimientos/vencimientos/tareas/pagos post-resumen
- Límite: 5 regeneraciones manuales por día por expediente (429 si excede)
- Fallo silencioso: si OpenAI falla, conserva resumen anterior (502 al frontend)

### US-10 · Creación expediente 2 pasos mobile-first — `refined`
- Paso 1: datos básicos (carátula, tipo, fuero)
- Paso 2: partes + responsable
- Diseñado en 375px primero
- Stepper visual con validación por paso

### US-11 · Sentry + logs estructurados — `ready`
- `sentry-sdk` en backend con `traces_sample_rate=0.1`
- Structured logging con `structlog`
- Frontend: `@sentry/nextjs`
- Error boundaries en páginas críticas

### US-15 · Full-text search PostgreSQL — `ready`
- `tsvector` en `expedientes.caratula + numero`
- Endpoint `GET /expedientes/search?q=` con `ts_rank`
- Integrar en búsqueda global Cmd+K

### TECH-001 · Fix setup-studio inseguro — `ready`
- Endpoint `/dev/setup-studio` no debe existir en producción
- Mover a un comando CLI o script de seed
- Proteger con variable de entorno `ALLOW_DEV_ENDPOINTS`

---

## Definición de Done

- [ ] Resumen IA visible en expediente, con badge de "Desactualizado"
- [ ] Creación de expediente funciona en 375px en <60 segundos (2 pasos)
- [ ] Sentry captura errores en staging
- [ ] Búsqueda global usa full-text PostgreSQL
- [ ] PRODUCTO.md actualizado
