# Sprint 04 — Planning

**Período:** 2026-04-15 → 2026-04-22
**Sprint goal:** Cerrar el loop económico (honorarios) + UX crítica (notificaciones + búsqueda global + email de invitación).

---

## Historias del sprint

| ID | Historia | Prioridad | Estimación | Estado |
|----|----------|-----------|-----------|--------|
| HON-001 | Honorarios por expediente | P0 | L | `refined` |
| NOT-001 | Notificaciones in-app urgentes | P1 | S | `refined` |
| BUS-001 | Búsqueda global | P1 | M | `refined` |
| USR-002 | Email de invitación (Resend) | P1 | S | `refined` |

**Criterios funcionales completos:** ver `docs/funcional/FUNCIONAL.md` sección "Sprint 04".

---

## Orden de implementación sugerido

1. **HON-001** — más valor, más complejo (modelo + migration + router + frontend tab)
2. **NOT-001** — puro frontend, depende de `/vencimientos` existente
3. **BUS-001** — endpoint search nuevo + componente sidebar
4. **USR-002** — integración Resend, mínimo impacto en código existente

---

## Dependencias técnicas

- HON-001 → nueva migración Alembic (`honorarios`, `pagos_honorarios`)
- USR-002 → variable de entorno `RESEND_API_KEY` + package `resend` en requirements.txt
- BUS-001 → nuevo endpoint `GET /search?q=` que consulta clientes + expedientes en paralelo

---

## Definition of Done (sprint 04)

- [ ] Tests backend: CRUD + aislamiento tenant por historia
- [ ] `tsc --noEmit` sin errores
- [ ] Mobile: usable en 375px
- [ ] PRODUCTO.md actualizado
- [ ] BACKLOG.md historias → `done`
- [ ] Entry en daily del día

---

## Notas de arquitectura

### HON-001 — Diseño de modelos
```python
class Honorario(TenantModel):
    expediente_id: str          # FK expedientes
    concepto: str
    monto_acordado: Decimal
    moneda: str                 # "ARS" | "USD"
    fecha_acuerdo: date

class PagoHonorario(TenantModel):
    honorario_id: str           # FK honorarios
    importe: Decimal
    moneda: str                 # puede diferir del acordado
    fecha: date
    comprobante: str | None
```

### BUS-001 — Endpoint
```
GET /search?q={query}
Response: { expedientes: [...], clientes: [...] }
Máx 5 resultados por tipo. Busca en: caratula, numero (exp) / nombre, cuit_dni (clientes).
```

### NOT-001 — Implementación
Sin backend nuevo. El sidebar llama a `GET /vencimientos?dias=2` al montar y muestra el count.
Polling: solo al cargar la página (no WebSocket en esta iteración).
