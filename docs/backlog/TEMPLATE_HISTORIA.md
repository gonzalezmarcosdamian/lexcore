# Template de Historia de Usuario

Copiar y completar para cada historia nueva.
No mover a `refined` hasta que todos los campos estén completos.

---

### [DOMINIO]-[NRO] · [Título corto]

- **Estado:** `idea`
- **Prioridad:** P0 / P1 / P2 / backlog
- **Sprint target:** sprint-XX (o `sin asignar`)
- **Agente que refinó:** /fa
- **Agente que aprobó técnica:** /tl

**Historia:**
Como [rol: admin | abogado | pasante | sistema], quiero [acción concreta] para [beneficio de negocio real].

**Criterios de aceptación:**
- [ ] CA1: [verificable y específico]
- [ ] CA2: [verificable y específico]
- [ ] CA3: [verificable y específico]

**Casos borde:**
- [caso borde 1]
- [caso borde 2]

**Notas técnicas** (completar en revisión /tl):
- Modelos afectados: 
- Endpoints nuevos: 
- Migración requerida: sí / no
- Test de aislamiento tenant: obligatorio si toca datos

**Checklist QA:**
- [ ] Todos los CA verificados
- [ ] Test de aislamiento tenant existe y pasa
- [ ] No hay regresiones en features existentes
- [ ] PRODUCTO.md actualizado ← NO OLVIDAR
