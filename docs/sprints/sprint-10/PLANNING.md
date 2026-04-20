# Sprint 10 — Planning (revisado 2026-04-16)

**Período:** 2026-04-16 → 2026-04-30 (2 semanas)
**Capacidad:** ~18 puntos
**Objetivo:** Pulir UX, cubrir deuda técnica y agregar features de valor medio que no requieren dependencias externas.

---

## Historias en este sprint

| ID | Historia | Pts | Estado | Prioridad |
|----|----------|-----|--------|-----------|
| TECH-DT-01 | Tests aislamiento tenant — Tareas (CA4 de US-01) | 2 | `ready` | P0 deuda |
| TECH-001 | `/auth/setup-studio` — reemplazar lookup `pending` por JWT temporal | 2 | `ready` | P0 deuda |
| UX-006 | Pre-selección expediente en formularios (query param `?expediente_id`) | 3 | `refined` | P2 |
| US-14 | Preview de documentos PDF/imagen in-app | 5 | `idea` | P2 |
| NOT-002 | Panel notificaciones desplegable (dropdown urgentes completo) | 3 | `idea` | P2 |
| UX-003 | Centrado y ancho máximo en formularios ABM | 2 | `idea` | P2 |
| WHATSAPP-001 | Bot WhatsApp — consulta estado expediente por teléfono | 8 | `refined` | P1 |
| **TOTAL** | | **25 pts** | | |

### Bloqueadas — NO entran a este sprint
- **MON-01** — Trial 30 días: sin usuarios reales aún. Revisar al tener primeros estudios en producción.
- ~~WHATSAPP-001 bloqueado~~ → **ENTRA al sprint.** Backend + frontend se implementan ahora; cuenta Meta Business se gestiona en paralelo.
- **US-11** — Sentry: activar con primer cliente real en prod.
- **US-12** — Generador escrito: decisión PO pendiente sobre formato de salida.
- **US-13** — Portal cliente: reemplazado por WHATSAPP-001.

### Completadas en sprint anterior (US-21)
- ✅ Perfil del estudio y del usuario — avatar, datos, logo URL, plan placeholder, Google Calendar

---

## Detalle de historias

### TECH-DT-01 — Tests aislamiento tenant para Tareas
- Escribir `backend/app/tests/test_tareas.py` con test de aislamiento: usuario estudio A no puede ver/modificar tareas de estudio B
- Patrón igual al de `test_expedientes.py` y `test_vencimientos.py`
- **Done cuando:** `pytest test_tareas.py` pasa sin errores

### TECH-001 — Fix setup-studio
- Endpoint `/auth/setup-studio` actualmente usa `tenant_id == "pending"` como lookup — cualquiera con ese tenant_id podría llamarlo
- Reemplazar por validación de JWT temporal firmado al momento del registro
- **Done cuando:** test que verifica que un segundo llamado al endpoint con el mismo JWT falla con 401

### UX-006 — Pre-selección expediente en formularios
- Al navegar a `/vencimientos/nuevo?expediente_id=xxx`, el campo expediente viene pre-llenado y readonly
- Aplica también a honorarios nuevos desde el tab del expediente
- Botón "Nuevo vencimiento" en el detalle del expediente pasa el param automáticamente
- **Done cuando:** flujo completo funciona en mobile 375px sin tener que seleccionar expediente manualmente

### US-14 — Preview documentos in-app
- PDFs: `<iframe>` con la URL del documento dentro de un modal
- Imágenes (JPG/PNG): `<img>` con zoom on-click
- Botón descarga disponible desde el preview
- **Done cuando:** desde la lista de documentos de un expediente, click abre preview sin redirigir

### NOT-002 — Panel notificaciones desplegable
- El pill de urgentes ya existe en el header; expandirlo a dropdown completo
- Dropdown muestra: descripción, fecha, tipo, link directo al expediente
- "Marcar todas como vistas" baja el badge a cero (localStorage)
- En mobile: bottom sheet en lugar de dropdown
- **Done cuando:** CA1-CA7 del backlog cumplidos

### UX-003 — Centrado formularios ABM
- `max-w-2xl mx-auto` en `/clientes/nuevo`, `/expedientes/nuevo`, `/vencimientos/nuevo`
- Grid 1 col mobile / 2 col desktop donde aplique
- **Done cuando:** los 3 formularios tienen el mismo ancho y alineación

---

## Definición de Done del sprint

- [ ] `test_tareas.py` escrito y corriendo en pytest
- [ ] TECH-001 corregido y testeado
- [ ] UX-006 funciona en mobile — vencimientos y honorarios
- [ ] Preview de documentos funciona para PDF e imagen
- [ ] Panel de notificaciones desplegable en desktop y mobile
- [ ] Formularios ABM centrados y consistentes
- [ ] `PRODUCTO.md` actualizado al cerrar sprint
