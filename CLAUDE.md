# LexCore — Reglas de trabajo (Claude Code)

## CONTEXTO DEL PROYECTO

**LexCore** es una plataforma multi-tenant de gestión para estudios de abogados.
Arranca como backoffice + landing page. Cada estudio es un tenant aislado.

Stack:
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (Docker local)
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS + Shadcn/ui
- **Auth**: JWT propio en dev → Supabase en prod (swap sin cambios de contrato)
- **ORM**: Alembic para migraciones
- **Infra futura**: Railway (backend) + Vercel (frontend)
- **Frontend puerto local**: 3001 (3000 ocupado por otro proyecto)

---

## REGLA ABSOLUTA — NUNCA SIN AUTORIZACIÓN EXPLÍCITA

Hasta que el usuario diga "deployá", "mandá a prod", "ok mergea":

- ❌ Push a `main` o `master`
- ❌ Deploy a Railway, Vercel, o cualquier servicio externo
- ❌ Mergear PRs
- ❌ Tocar variables de entorno de producción

---

## EQUIPO DE AGENTES

Cada agente tiene un rol y se invoca con un comando. Ver `docs/agents/ROSTER.md` para detalle completo.

| Comando | Rol | Cuándo invocar |
|---------|-----|----------------|
| `/sm` | Scrum Master | Al inicio de cada sesión |
| `/fa` | Analista Funcional | Al refinar historias |
| `/tl` | Tech Lead | Antes de cualquier feature con impacto arquitectónico |
| `/dev` | Developer | Cuando la historia está en estado `ready` |
| `/qa` | QA | Al terminar implementación, antes de `done` |
| `/ux` | UX Designer | Antes de implementar cualquier pantalla |
| `/po` | Product Owner | Al inicio de sprint planning o decisiones de roadmap |

**Regla de oro:** Ninguna historia llega a `/dev` sin pasar por `/fa` (criterios claros) + `/tl` (diseño técnico aprobado).

---

## PROCESO RÍGIDO — ACTUALIZACIÓN DE PRODUCTO

**Después de cada feature implementada, OBLIGATORIO:**

1. Actualizar `docs/producto/PRODUCTO.md` con:
   - Feature movida de "pendiente" a "implementada"
   - Versión bumpeada si corresponde
   - Fecha de implementación

2. Mover la historia a estado `done` en `docs/backlog/BACKLOG.md`

3. Crear entry en `docs/sprints/sprint-XX/daily/YYYY-MM-DD.md`

**Si no se hizo esto, la feature NO está done. Sin excepción.**

El hook de `PostToolUse` en Edit/Write recuerda esto automáticamente.
El hook de `Stop` muestra el checklist de cierre de sesión.

---

## FLUJO DE TRABAJO POR FEATURE

```
/po  → prioriza backlog
/fa  → refina historia (criterios de aceptación)
/tl  → valida diseño técnico, aprueba o rechaza
/ux  → diseña UI si aplica (mobile-first 375px)
/dev → implementa: model → __init__.py → migration → service → router → test → frontend
/qa  → valida criterios de aceptación + test de tenant
/sm  → actualiza docs, mueve historia a done
```

---

## ESTRUCTURA DE DOCUMENTACIÓN

```
docs/
├── agents/
│   ├── ROSTER.md          — definición de roles y responsabilidades
│   └── skills.md          — prompts de invocación por agente
├── backlog/
│   ├── BACKLOG.md         — backlog priorizado (P0/P1/P2/backlog)
│   └── TEMPLATE_HISTORIA.md
├── sprints/
│   ├── TEMPLATE_PLANNING.md
│   ├── TEMPLATE_RETRO.md
│   ├── TEMPLATE_DAILY.md
│   └── sprint-01/
│       ├── PLANNING.md
│       ├── daily/          — un archivo por día (YYYY-MM-DD.md)
│       └── artifacts/      — outputs del sprint
├── producto/
│   └── PRODUCTO.md        — estado real del producto (SIEMPRE actualizado)
├── BITACORA.md            — historial de sesiones
├── LEARNINGS.md           — decisiones técnicas y razones
└── CHANGELOG.md           — versiones y cambios
```

---

## ESTRUCTURA DE CARPETAS DEL PROYECTO

```
lexcore/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/          — config, auth (JWT), deps, database
│   │   ├── models/        — SQLAlchemy models (todos con tenant_id)
│   │   ├── schemas/       — Pydantic schemas
│   │   ├── routers/       — endpoints por dominio
│   │   ├── services/      — lógica de negocio (sin acceso directo a DB)
│   │   └── tests/         — pytest, un archivo por router
│   ├── alembic/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── ui/        — primitivos sin lógica de negocio
│   │   │   └── features/  — componentes que conocen el dominio
│   │   ├── lib/
│   │   │   └── api.ts     — API client único, nunca fetch directo en componentes
│   │   └── types/
│   └── package.json
├── docker-compose.yml
├── .env / .env.example
└── docs/
```

---

## DOMINIO DEL NEGOCIO

Un **Estudio** (tenant) tiene:
- **Abogados** (usuarios con roles: admin, socio, asociado, pasante)
- **Clientes** (personas físicas o jurídicas)
- **Expedientes** (casos judiciales o extrajudiciales)
- **Tareas** (asociadas a expedientes, con responsable y fecha límite)
- **Audiencias / Vencimientos** (agenda con alertas)
- **Documentos** (adjuntos a expedientes)
- **Honorarios** (facturación y seguimiento de pagos)

Invariantes críticos:
- Un estudio nunca puede ver datos de otro estudio
- Un expediente siempre tiene al menos un abogado responsable
- Vencimientos con menos de 48h → marcados como urgentes

---

## REGLA RÍGIDA — NUEVO MODELO SQLALCHEMY

**Cada vez que se crea un archivo en `backend/app/models/`, OBLIGATORIO en este orden:**

1. **Definir el modelo** en `backend/app/models/nuevo_modelo.py` (hereda de `TenantModel`)
2. **Registrarlo en `backend/app/models/__init__.py`** — importar la clase Y agregarla a `__all__`
   - ❌ Sin este paso, Alembic genera migraciones vacías (el autogenerate no detecta el modelo)
3. **Generar la migración**: `docker compose exec backend alembic revision --autogenerate -m "add X table"`
4. **Verificar** que el archivo de migración tenga `op.create_table(...)` — si está vacío, faltó el paso 2
5. **Aplicar**: `docker compose exec backend alembic upgrade head`

**Si la migración sale vacía → el modelo no está en `__init__.py`. Sin excepción.**

---

## ARQUITECTURA MULTI-TENANT

- Backend: middleware extrae `studio_id` del JWT → todos los modelos tienen `tenant_id`
- `BaseQuery` filtra por `tenant_id` automáticamente — NUNCA omitir
- Ningún endpoint puede devolver datos sin validar `resource.studio_id == current_user.studio_id`
- Tests de aislamiento son **obligatorios** para cada entidad nueva

---

## CONVENCIONES DE CÓDIGO

### Backend
- Todos los modelos de dominio heredan de `TenantModel` (`app/models/base.py`)
- Services reciben la sesión DB como parámetro, no la importan
- Endpoints validan `studio_id` contra el JWT, no contra el body
- Errores de negocio: `HTTPException` con mensaje en español

### Frontend
- `components/ui/` — solo primitivos sin lógica de negocio
- `components/features/` — componentes que conocen el dominio
- El API client vive en `lib/api.ts` — nunca `fetch` directo en componentes
- Mobile-first: diseñar primero en 375px

---

## DOCKER — COMANDOS FRECUENTES

```bash
# Levantar todo
docker compose up -d

# Ver logs del backend
docker logs lexcore-backend-1 -f

# Crear migración
docker compose exec backend alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
docker compose exec backend alembic upgrade head

# Reconstruir backend (después de cambiar requirements.txt)
docker compose up -d --build backend
```

---

## HOOKS AUTOMÁTICOS CONFIGURADOS

Ver `.claude/settings.json` para la configuración técnica.

| Hook | Trigger | Acción |
|------|---------|--------|
| PostToolUse | Edit/Write en backend/app o frontend/src | Recordatorio de actualizar PRODUCTO.md |
| Stop | Al terminar la sesión | Checklist de cierre (docs, daily, backlog, bitácora) |

---

## DECISIONES TÉCNICAS VIGENTES

Ver `docs/LEARNINGS.md` para el historial completo.

| Decisión | Razón |
|----------|-------|
| JWT propio en dev | Evitar cuota de Supabase. Swap planificado al MVP. |
| Puerto frontend 3001 | Puerto 3000 ocupado por otro proyecto local |
| `pydantic[email]` | Requerido para usar `EmailStr` |
| Mobile-first siempre | Abogados trabajan en movimiento |
| Número de expediente autogenerado | El sistema genera `EXP-{año}-{NNNN}` — evita errores y garantiza formato. Ver `_generar_numero()` en `routers/expedientes.py` |
| Estado inicial de expediente = activo | Un expediente nace activo siempre. `ExpedienteCreate` no acepta `estado`. |
| Vencimientos y Tareas son ortogonales | No hay FK entre ellos. Vencimiento = plazo procesal. Tarea = trabajo interno. Si se relacionan en el futuro: `vencimiento_id` opcional en `Tarea`. |
| Monetización: trial 30 días sin tarjeta | Acceso completo → día 25 aviso email → día 31 modo lectura. Campo `trial_ends_at` en modelo `Studio`. |
