# Routers — Convenciones

## Responsabilidad
Orquestación únicamente. Sin lógica de negocio inline — eso va en `services/`.

## Validación de tenant (OBLIGATORIO en cada endpoint)
```python
tenant_id = current_user["studio_id"]
obj = db.query(Modelo).filter(Modelo.id == id, Modelo.tenant_id == tenant_id).first()
if not obj:
    raise HTTPException(status_code=404, detail="No encontrado")
```
Nunca devolver datos sin validar `tenant_id`. Sin excepción.

## Errores
- `HTTPException` con mensajes en español
- 404 para "no encontrado o no pertenece al tenant"
- 422 para validación de input
- 403 solo para permisos de rol (no para tenant)

## Patrones frecuentes
- `current_user["studio_id"]` → tenant_id
- `current_user["sub"]` → user_id
- Paginación: `skip: int = 0, limit: int = 100`
- Ordenamiento: siempre explícito en la query, nunca en Python

## Archivos en este directorio
| Archivo | Dominio |
|---------|---------|
| expedientes.py | Expedientes + actividad/bitácora + PDF |
| clientes.py | Clientes del estudio |
| honorarios.py | Honorarios y pagos |
| tareas.py | Tareas internas |
| movimientos.py | Movimientos procesales |
| vencimientos.py | Vencimientos y audiencias |
| documentos.py | Documentos adjuntos |
| ingresos.py | Ingresos directos |
| gastos.py | Gastos del estudio |
| users.py | Usuarios del estudio |
| studios.py | Perfil del estudio |
| auth.py | Login, registro, Google OAuth |
| google_calendar.py | Sync con Google Calendar |
| search.py | Búsqueda global |
| invitaciones.py | Invitar usuarios |
| superadmin.py | Panel superadmin LexCore |
| suscripcion.py | Suscripciones y trial |
