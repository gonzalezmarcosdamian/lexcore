# LexCore — Documento Funcional Iterable

> **Naturaleza de este documento:** Es la fuente de verdad del *qué* y el *por qué* del producto.
> Se actualiza al inicio de cada sprint (antes de implementar) y al cierre (después de validar).
> No describe *cómo* se implementa — eso vive en el código y en LEARNINGS.md.
>
> **Proceso de actualización:**
> 1. Al refinar historias (/fa): actualizar sección "En construcción"
> 2. Al completar features (/qa): mover a "Implementado" con criterios tachados ✓
> 3. Al cerrar sprint (/sm): bump de versión + changelog

**Versión funcional:** 0.3.0
**Última iteración:** 2026-04-15 (Sprint 03 — cerrado)
**Próxima iteración:** Sprint 04 (target 2026-04-22)

---

## Propósito del producto

LexCore es un **backoffice de gestión para estudios de abogados** argentinos.
Reemplaza el uso de hojas de cálculo, WhatsApp y carpetas físicas por un sistema centralizado, multi-usuario y con alertas automáticas.

**Usuario principal:** Abogado en estudio mediano (2–15 personas). No es un técnico.
**Dispositivos:** Principalmente desktop, pero debe funcionar bien en celular (abogados que van a tribunales).
**Idioma:** Español argentino. Terminología legal argentina.

---

## Módulos del sistema

### Estado por módulo

| Módulo | Estado | Versión | Descripción |
|--------|--------|---------|-------------|
| Auth | Implementado ✓ | 0.1.0 | Registro, login, Google OAuth, JWT |
| Clientes | Implementado ✓ | 0.2.0 | CRUD personas físicas/jurídicas, soft delete |
| Expedientes | Implementado ✓ | 0.2.0 | CRUD expedientes, estados, movimientos, abogados |
| Vencimientos | Implementado ✓ | 0.3.0 | CRUD vencimientos, alertas urgencia, dashboard |
| Equipo | Implementado ✓ | 0.3.0 | Invitaciones con token, roles, revocación |
| Honorarios | En construcción 🔨 | — | Sprint 04 |
| Documentos | Pendiente | — | Sprint 05 |
| Notificaciones | Pendiente | — | Sprint 04 |
| Búsqueda global | Pendiente | — | Sprint 04 |

---

## Módulos implementados — Criterios validados

### Auth
- ✓ Registro crea estudio + usuario admin en una sola operación
- ✓ Login devuelve JWT con `studio_id` + `role` en payload
- ✓ Todas las rutas `/studio/*` protegidas — redirige a `/login` si no hay sesión
- ✓ Google OAuth disponible (requiere agregar email en test users de Cloud Console)
- ✓ Bypass `/dev/autologin` disponible solo en desarrollo (no en prod)

### Clientes
- ✓ Crear cliente con: nombre, tipo (física/jurídica), CUIT/DNI, teléfono, email
- ✓ Buscar por nombre o CUIT/DNI (query param `q`)
- ✓ Filtrar por tipo (física/jurídica)
- ✓ Archivar cliente (soft delete) — no aparece en listas por defecto
- ✓ Ver cliente archivado con toggle "Ver archivados"
- ✓ Aislamiento tenant verificado en tests
- ✓ Expedientes vinculados visibles en ficha de cliente

### Expedientes
- ✓ Crear expediente con: número, carátula, fuero, juzgado, estado, cliente, abogado responsable, fecha inicio
- ✓ Estados: `activo` / `archivado` / `cerrado`
- ✓ Buscar por número o carátula
- ✓ Filtrar por estado y fuero
- ✓ Movimientos: log cronológico inverso de novedades (texto libre + fecha auto)
- ✓ Abogados: asignar N abogados con roles `responsable` / `colaborador` / `supervision`
- ✓ No se puede quitar al responsable mientras hay solo uno
- ✓ Aislamiento tenant verificado en tests

### Vencimientos
- ✓ Crear vencimiento asociado a expediente: descripción, fecha, tipo
- ✓ Tipos: `vencimiento` / `audiencia` / `presentacion` / `pericia` / `otro`
- ✓ Alerta urgente: < 48hs → badge rojo "Urgente"
- ✓ Filtro próximos N días (7 / 30 / 90 / todos)
- ✓ Marcar como cumplido (toggle)
- ✓ Dashboard: lista de próximos 30 días + banner de urgentes
- ✓ Aislamiento tenant verificado en tests
- ☐ Push a Google Calendar — pendiente (Sprint 04 o 05)

### Equipo
- ✓ Admin puede invitar usuarios con: email, nombre completo, rol
- ✓ Roles disponibles para invitar: `socio`, `asociado`, `pasante` (no puede crear otro admin)
- ✓ Token de invitación con expiración 7 días
- ✓ Admin puede revocar invitaciones pendientes
- ✓ Lista de miembros activos con badges de rol
- ☐ Email de invitación — pendiente (Sprint 04)
- ☐ Cambio de rol de usuario activo — pendiente (Sprint 04)

---

## Sprint 04 — En construcción 🔨

**Objetivo del sprint:** Cerrar el loop económico básico (honorarios) + mejorar UX crítica (notificaciones + búsqueda).

**Duración target:** 2026-04-15 → 2026-04-22

### HON-001 · Honorarios por expediente — `refined`

**Historia:** Como abogado, quiero registrar honorarios acordados y pagos recibidos por expediente, para saber en todo momento qué me deben mis clientes.

**Por qué ahora:** Sin honorarios, LexCore no es útil para la gestión económica del estudio. Es la feature que justifica el pago de una suscripción.

**Criterios de aceptación:**
- [ ] CA1: En el detalle del expediente hay una nueva pestaña "Honorarios"
- [ ] CA2: Puedo registrar el monto acordado con: importe, moneda (ARS/USD), concepto, fecha
- [ ] CA3: Puedo registrar pagos recibidos con: importe, moneda, fecha, comprobante (texto libre)
- [ ] CA4: El sistema muestra automáticamente el saldo pendiente = acordado - pagado
- [ ] CA5: El dashboard muestra el total de honorarios pendientes del estudio (suma de todos los expedientes)
- [ ] CA6: Aislamiento tenant verificado en tests
- [ ] CA7: Puedo registrar honorarios en ARS y USD para el mismo expediente (honorarios mixtos)

**Casos borde:**
- Expediente sin honorarios registrados → el campo muestra "Sin honorarios acordados"
- Pago mayor al acordado → el sistema lo permite (diferencia negativa = a favor del cliente)
- Expediente cerrado → puede seguir registrando pagos pendientes

**Diseño de datos:**
```
Honorario: expediente_id, monto_acordado, moneda_acordado, concepto, fecha_acuerdo
Pago:       honorario_id, importe, moneda, fecha, comprobante_texto
```

---

### NOT-001 · Notificaciones in-app de urgentes — `refined`

**Historia:** Como abogado, quiero ver un badge en el sidebar cuando tengo vencimientos urgentes, para no depender solo de mirar la lista de vencimientos.

**Por qué ahora:** UX crítica — el abogado puede estar en otra pantalla y no ver el dashboard. El badge es el mecanismo de alerta pasivo más simple.

**Criterios de aceptación:**
- [ ] CA1: El sidebar muestra un badge rojo con número en "Vencimientos" cuando hay ≥1 vencimiento urgente (< 48hs, no cumplido)
- [ ] CA2: El badge desaparece cuando no hay urgentes
- [ ] CA3: El badge se actualiza al cargar la página (no necesita ser real-time en esta iteración)
- [ ] CA4: En mobile (bottom nav), el tab de Vencimientos también muestra el badge

**Casos borde:**
- 0 urgentes → sin badge (no mostrar "0")
- > 99 urgentes → mostrar "99+"

---

### BUS-001 · Búsqueda global — `refined`

**Historia:** Como abogado, quiero buscar desde cualquier pantalla por número de expediente, carátula o nombre de cliente, para encontrar lo que necesito sin navegar por los listados.

**Por qué ahora:** Con > 50 expedientes el uso de los listados se vuelve engorroso. La búsqueda es el atajo crítico de productividad.

**Criterios de aceptación:**
- [ ] CA1: Hay un input de búsqueda visible en el sidebar (debajo del logo)
- [ ] CA2: Al tipear ≥ 3 caracteres, aparece un panel de resultados con expedientes y clientes que coinciden
- [ ] CA3: Resultados agrupados: primero expedientes, luego clientes (máx 5 de cada tipo)
- [ ] CA4: Cada resultado muestra ícono de tipo, nombre principal y dato secundario (número / CUIT)
- [ ] CA5: Click en resultado navega al detalle y cierra el panel
- [ ] CA6: Escape o click fuera cierra el panel
- [ ] CA7: Debounce 300ms para no spamear el backend

**Casos borde:**
- Sin resultados → mensaje "Sin resultados para {query}"
- Error de red → el panel no aparece (falla silenciosa)

---

### USR-002 · Email de invitación — `refined`

**Historia:** Como admin, quiero que el usuario invitado reciba un email con el link de activación, para que el proceso de onboarding sea self-service.

**Por qué ahora:** Sin email, el admin debe pasar el link manualmente. Frena el onboarding real.

**Criterios de aceptación:**
- [ ] CA1: Al crear invitación, se envía email al destinatario con el link `{BASE_URL}/aceptar-invitacion/{token}`
- [ ] CA2: El email tiene: nombre del estudio, nombre del invitador, rol asignado, y botón CTA
- [ ] CA3: Si el envío de email falla, la invitación igual se crea (falla silenciosa con log)
- [ ] CA4: La página `/aceptar-invitacion/{token}` permite al usuario crear su contraseña

**Proveedor email:** Resend (dev: modo sandbox). Variable de entorno: `RESEND_API_KEY`.

---

## Criterios de calidad del sprint (no negociables)

Para que cualquier historia de Sprint 04 quede en `done`:

1. **Tests:** Al menos 1 test de CRUD + 1 test de aislamiento tenant (backend)
2. **Mobile:** La pantalla es usable en 375px (frontend)
3. **Error handling:** Los errores de API muestran mensaje en español al usuario
4. **Tipo-safe:** `tsc --noEmit` pasa sin errores (frontend)
5. **Docs:** PRODUCTO.md + BACKLOG.md actualizados al cerrar la historia

---

## Invariantes del producto (jamás romper)

| # | Invariante | Cómo se verifica |
|---|-----------|-----------------|
| 1 | Un estudio nunca ve datos de otro | Test de aislamiento tenant en cada entidad |
| 2 | Un expediente siempre tiene ≥1 abogado responsable | Validación en backend al intentar remover |
| 3 | Vencimientos < 48hs → siempre marcados urgentes | Lógica en frontend + badge NOT-001 |
| 4 | Acciones destructivas tienen confirmación | Dialog antes de archivar/eliminar |
| 5 | Toda pantalla funciona en 375px | Review visual antes de marcar done |

---

## Glosario (términos del dominio)

| Término | Definición |
|---------|-----------|
| Estudio | Tenant. Una firma de abogados con sus usuarios y datos. |
| Expediente | Caso judicial o extrajudicial. Puede ser contencioso o de asesoramiento. |
| Carátula | Nombre formal del expediente. Ej: "García, Juan c/ Banco Nación s/ daños". |
| Fuero | Rama del derecho del expediente. Ej: Civil, Penal, Laboral, Comercial. |
| Vencimiento | Plazo procesal con fecha límite. Sinónimo: "plazo", "fecha de audiencia". |
| Movimiento | Novedad o actuación en un expediente. Sinónimo: "notificación", "cédula". |
| Socio | Abogado con acceso completo excepto configuración del estudio. |
| Asociado | Abogado que gestiona expedientes asignados. |
| Pasante | Colaborador con acceso de solo lectura. |

---

## Roadmap simplificado

```
Sprint 01 ✓  Auth + setup base
Sprint 02 ✓  Clientes + Expedientes + Movimientos
Sprint 03 ✓  Vencimientos + Equipo + Dashboard + TDD
Sprint 04 🔨 Honorarios + Notificaciones + Búsqueda + Email invitación
Sprint 05    Documentos adjuntos + Google Calendar push + PWA
Sprint 06    Reportes + Integración PJN (Poder Judicial)
```
