# Sprint 01 — Planning

**Fecha inicio:** 2026-04-15
**Fecha fin:** 2026-04-28 (2 semanas)
**Goal del sprint:** Stack levantado + flujo de auth completo (register, login, sesión)

---

## Historias comprometidas

| ID | Título | Puntos | Estado | Asignado a |
|----|--------|--------|--------|-----------|
| AUTH-001 | Registro de estudio y primer usuario admin | 3 | `ready` | /dev |
| AUTH-002 | Login con email y contraseña | 2 | `ready` | /dev |
| AUTH-003 | Middleware de protección de rutas frontend | 2 | `ready` | /dev |

**Total puntos:** 7

---

## Definición de "Done" para este sprint

- [ ] Código en branch `feat/auth-flow`
- [ ] Tests de aislamiento tenant para usuarios
- [ ] Flujo completo probado en browser (mobile 375px)
- [ ] `docs/producto/PRODUCTO.md` actualizado con las features entregadas
- [ ] Sin errores de TypeScript (`tsc --noEmit`)
- [ ] PR creado (no mergeado sin autorización explícita)

---

## Capacidad

Solo dev (1 persona + AI). Velocidad estimada: 6-8 puntos por sprint de 2 semanas.

---

## Riesgos identificados

- Decisión de JWT local vs Supabase puede requerir refactor posterior → mitigado con capa de abstracción en `core/auth.py`
- Next.js App Router + middleware de auth tiene edge cases → validar con `/qa` antes de cerrar

---

## Notas de planning

Stack base levantado y funcionando (Docker, Alembic, tablas `studios` y `users`).
El sprint arranca con base sólida. Enfoque 100% en auth flow.
