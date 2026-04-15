# LexCore — Bitácora de Sesiones

> Una entrada por sesión de trabajo. Describe qué se hizo, qué decisiones se tomaron, qué quedó pendiente.

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
