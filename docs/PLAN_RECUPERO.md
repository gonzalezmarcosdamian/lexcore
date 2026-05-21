# Plan de Recupero — LexCore

> Documento vivo. Actualizar después de cada incidente.
> Última actualización: 2026-05-21

---

## Incidente tipo 1 — DB de Railway caída

### Síntomas
- Backend en crash loop: `psycopg2.OperationalError: connection to server ... failed`
- PostgreSQL logs: `catatonit: failed to exec pid1: No such file or directory`
- `railway logs` muestra "Mounting volume on: ..." en loop sin llegar al startup

### Causa probable
Volumen de PostgreSQL corrupto tras incidente de plataforma Railway o restart forzado del host.

### Pasos de recuperación

**1. Verificar status de Railway**
```
https://status.railway.app
```
Si hay incidente activo → esperar resolución antes de actuar.

**2. Intentar redeploy del servicio PostgreSQL desde el dashboard**
- railway.com → proyecto `friendly-healing` → servicio **PostgreSQL**
- NO usar "Restart" (no recrea el container)
- Usar **"Redeploy"** o crear un nuevo deployment desde Settings

**3. Una vez que la DB arranca → redeploy del backend**
```bash
cd "c:/Users/gonza/OneDrive/Documentos/lexcore"  # ← SIEMPRE desde la raíz
RAILWAY_TOKEN=0a33fdae-bbdc-4e87-b6d2-13f0acb214d2 railway up --detach
```

**4. Verificar startup**
```bash
RAILWAY_TOKEN=0a33fdae-bbdc-4e87-b6d2-13f0acb214d2 railway logs
# Esperar: "Application startup complete" + "/health 200 OK"
```

**5. Hacer backup inmediato** (ver sección de backups)

---

## Incidente tipo 2 — Backend caído, DB OK

### Síntomas
- Frontend muestra "Failed to fetch" o errores 5xx
- `railway logs` muestra error de Python/FastAPI

### Pasos
```bash
cd "c:/Users/gonza/OneDrive/Documentos/lexcore"
RAILWAY_TOKEN=0a33fdae-bbdc-4e87-b6d2-13f0acb214d2 railway up --detach
```

---

## Incidente tipo 3 — Frontend caído (Vercel)

### Síntomas
- Pantalla en blanco o "Application error"
- Vercel dashboard muestra build fallido

### Pasos
```bash
cd "c:/Users/gonza/OneDrive/Documentos/lexcore"
npx vercel deploy --prod --yes
```

---

## Backups

### Backup manual (JSON completo)
```bash
cd "c:/Users/gonza/OneDrive/Documentos/lexcore"
DATE=$(python -c "from datetime import date; print(date.today())")
docker compose exec backend python -c "
import json
from sqlalchemy import create_engine, text
engine = create_engine('DB_URL_AQUI')
backup = {}
with engine.connect() as conn:
    tables = conn.execute(text(\"SELECT tablename FROM pg_tables WHERE schemaname='public'\")).fetchall()
    for (t,) in tables:
        rows = conn.execute(text(f'SELECT * FROM {t}')).fetchall()
        cols = conn.execute(text(f'SELECT * FROM {t} LIMIT 0')).keys()
        backup[t] = [dict(zip(cols, [str(v) if v is not None else None for v in r])) for r in rows]
with open('/tmp/backup.json','w') as f:
    json.dump(backup, f, default=str)
print('OK:', len(backup), 'tablas')
" && docker compose cp backend:/tmp/backup.json "backup-${DATE}.json"
```

### Frecuencia recomendada
- **Antes de cada deploy mayor** — manual
- **Semanalmente** — agregar cron en Railway o GitHub Action

### Backups existentes
| Fecha | Archivo | Tablas | Notas |
|-------|---------|--------|-------|
| 2026-05-21 | `backup-2026-05-21.json` | 26 | Post-incidente Railway |

---

## Checklist post-incidente

- [ ] Backend responde `/health` con 200
- [ ] Frontend carga dashboard sin errores
- [ ] Usuarios existentes pueden loguearse
- [ ] Tests E2E pasan: `npx playwright test --project=chromium`
- [ ] Backup tomado con fecha del día
- [ ] Incidente documentado en `docs/LEARNINGS.md`
- [ ] Bitácora actualizada

---

## Contactos y recursos

| Recurso | URL |
|---------|-----|
| Railway status | https://status.railway.app |
| Railway soporte | https://station.railway.com |
| Railway dashboard | https://railway.com/project/140dda30-77b0-4ba2-b04b-bbb5a69fa7e9 |
| Vercel dashboard | https://vercel.com/gonzalezmarcosdamians-projects/lexcore |
| RAILWAY_TOKEN | `0a33fdae-bbdc-4e87-b6d2-13f0acb214d2` (project token, permanente) |
