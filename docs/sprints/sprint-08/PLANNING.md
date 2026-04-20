# Sprint 08 — Planning

**Período:** 2026-04-15 → 2026-04-29 (2 semanas)
**Capacidad:** ~36 puntos
**Objetivo:** Módulo de Tareas end-to-end + Vista Agenda + piso de confiabilidad (tests tenant, observabilidad, seguridad) + UX polish crítico.

---

## Decisiones de PO — CERRADAS (2026-04-15)

| Decisión | Resolución |
|----------|-----------|
| ¿Tareas vinculadas solo a expediente o también libres? | **Vinculadas a expediente** |
| ¿Portal de cliente es plan base o premium? | **Plan base** — incluido sin costo adicional |
| ¿Integración PJN/MEV/SCBA? | **Fuera del roadmap** — sin integraciones externas en MVP |
| Modelo de monetización | **Trial 30 días sin tarjeta** → modo lectura al día 31 → email aviso día 25 |

---

## Historias en este sprint

| ID | Historia | Pts | Estado |
|----|----------|-----|--------|
| US-01 | Módulo de Tareas — CRUD completo (backend + frontend) | 5 | `ready` |
| US-02 | Vista Agenda Diaria/Semanal (vencimientos + tareas) | 5 | `ready` |
| US-03 | Notificaciones por email — vencimientos urgentes | 2 | `ready` |
| US-04 | Tests de aislamiento multi-tenant — cobertura completa | 5 | `ready` |
| US-06 | Tareas en detalle de expediente (sección colapsable) | 2 | `ready` |
| US-07 | Búsqueda global funcional en mobile | 2 | `ready` |
| US-08 | Empty states con onboarding guiado | 2 | `ready` |
| US-09 | Sistema de estados visuales unificado (StatusBadge) | 2 | `ready` |
| US-11 | Observabilidad básica — Sentry + logs estructurados | 5 | `ready` |
| US-15 | Índices full-text PostgreSQL para búsqueda | 2 | `ready` |
| US-17 | Rate limiting y política de contraseñas | 2 | `ready` |
| US-18 | Skeleton loaders y toasts consistentes | 2 | `ready` |
| **TOTAL** | | **36 pts** | |

---

## Orden de implementación sugerido

```
Semana 1:
  Día 1-2: US-01 backend (modelo Tarea, migración, router, tests tenant)
  Día 3:   US-06 frontend (sección tareas en detalle expediente)
  Día 4-5: US-02 Vista Agenda (página /agenda en sidebar)
  Día 5:   US-04 Tests multi-tenant (mientras backend está fresco)

Semana 2:
  Día 6:   US-03 Email urgentes (reusar infra Resend)
  Día 7:   US-09 StatusBadge + US-08 Empty states
  Día 8:   US-07 Búsqueda mobile + US-18 Skeletons/Toasts
  Día 9:   US-15 Full-text index + US-17 Rate limiting
  Día 10:  US-11 Sentry + buffer bugs + PRODUCTO.md
```

---

## Definición de Done

- [ ] Módulo de tareas funcionando end-to-end con test de tenant
- [ ] Vista /agenda en navegación con vencimientos + tareas unificados
- [ ] Email de alerta al pasar vencimiento a urgente (via Resend)
- [ ] Test de aislamiento en cada entidad (9 entidades cubiertas)
- [ ] Sentry capturando errores con tenant_id
- [ ] StatusBadge reutilizable aplicado en toda la app
- [ ] Empty states en expedientes, clientes, vencimientos, dashboard
- [ ] Búsqueda funcional en mobile sin Cmd+K
- [ ] Login con rate limiting (5 intentos → bloqueo 15min)
- [ ] PRODUCTO.md actualizado al cierre del sprint
