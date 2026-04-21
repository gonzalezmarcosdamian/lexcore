# Sprint 11 — Planning

**Fecha:** 2026-04-21
**Duración:** 2 semanas
**Objetivo:** Completar el núcleo del producto para cierre de MVP — perfil de estudio completo, UX expediente mobile-first, deuda técnica de tests y mejoras de performance.

---

## Historias comprometidas

### P1 — Críticas

#### US-21 · Perfil completo del estudio — `ready`
- **Esfuerzo:** M (5pts)
- **Criterios:**
  - [ ] CA1: Avatar con iniciales + color derivado del nombre (ya implementado — verificar)
  - [ ] CA2: Sección "Mi estudio" — nombre, logo (upload a Cloudinary), dirección, teléfono, email contacto
  - [ ] CA3: Sección "Mi plan" — muestra Trial, días restantes, CTA "Contactanos para continuar"
  - [ ] CA4: Sección "Mis datos" — nombre, email (read-only), rol, cambio de contraseña
  - [ ] CA5: Logo del estudio visible en sidebar (reemplaza el ícono de balanza)
- **Notas técnicas:**
  - Logo: upload a Cloudinary (mismo servicio que documentos), guardar URL en `Studio.logo_url`
  - Migración: agregar `logo_url: str | None` y `direccion`, `telefono` a `Studio`
  - `GET /studios/me` ya existe — extender con campos nuevos

#### US-10 · Creación de expediente en 2 pasos (mobile-first) — `refined`
- **Esfuerzo:** M (5pts)
- **Criterios:**
  - [ ] CA1: Paso 1 (datos mínimos): carátula, cliente, fuero → guardar en <60s desde 375px
  - [ ] CA2: Paso 2 (datos secundarios): juzgado, número PJN, equipo, descripción — accesibles después desde el detalle
  - [ ] CA3: Formulario completo funciona en 375px sin scroll horizontal ni campos ocultos
- **Notas técnicas:**
  - Refactor de `/expedientes/nuevo/page.tsx` — dividir en Step 1 / Step 2 con stepper visual
  - Step 2 puede ser el mismo formulario de edición del expediente ya existente

#### US-01 CA4 · Tests de aislamiento tenant para Tareas — deuda técnica
- **Esfuerzo:** S (2pts)
- **Criterios:**
  - [ ] Crear `backend/app/tests/test_tareas.py` con test de aislamiento multi-tenant
  - [ ] Un usuario de estudio A no puede ver ni modificar tareas de estudio B (404)
  - [ ] Correr con pytest junto al resto del suite

---

### P2 — Nice-to-have

#### US-14 · Preview de documentos in-app — `idea`
- **Esfuerzo:** M (5pts)
- **Criterios:**
  - [ ] CA1: PDFs abren en modal con `<iframe>` via el proxy de backend ya existente
  - [ ] CA2: Imágenes (JPG/PNG) en preview con zoom básico
  - [ ] CA3: Botón de descarga desde el modal
- **Notas técnicas:** El proxy `GET /documentos/{id}/content?inline=true` ya existe. Solo falta el modal frontend.

#### US-15 · Índices full-text PostgreSQL — `ready`
- **Esfuerzo:** S (2pts)
- **Criterios:**
  - [ ] CA1: `tsvector` en columnas numero, caratula (expedientes) y nombre (clientes)
  - [ ] CA2: Búsqueda retorna en <200ms para datasets grandes
  - [ ] CA3: Migración Alembic limpia — ya existe `cb965ddbf355_add_fulltext_search_indexes.py` sin aplicar

#### UX-006 · Pre-selección de expediente en formularios — `idea`
- **Esfuerzo:** S (2pts)
- **Criterios:**
  - [ ] CA1: `/vencimientos/nuevo?expediente_id=xxx` pre-llena y bloquea el selector
  - [ ] CA2: Banner "Creando para: EXP-2026-XXX — Carátula" visible
  - [ ] CA4: Sin `?expediente_id` → selector vacío y editable (comportamiento actual)
- **Notas técnicas:** El form de nuevo vencimiento ya lee params — es un `useSearchParams` + `useState` init.

#### LEGAL-001 · Política de Privacidad visible — `idea`
- **Esfuerzo:** S (1pt)
- **Criterios:**
  - [ ] Página `/privacidad` con política básica conforme Ley 25.326 (Argentina)
  - [ ] Link en el footer del login y en el perfil

#### LEGAL-002 · Términos y Condiciones — `idea`
- **Esfuerzo:** S (1pt)
- **Criterios:**
  - [ ] Página `/terminos` con T&C básicos
  - [ ] Checkbox de aceptación en el formulario de registro

---

## Historias excluidas / bloqueadas (no entran)

| ID | Historia | Motivo |
|----|---------|--------|
| US-AI-01 | Resumen IA | Bloqueado — post-MVP |
| US-12 | Generador cabecera | Bloqueado — post-MVP |
| US-13 | Portal cliente | Bloqueado — post-MVP |
| US-16 | Timesheets | Bloqueado — post-MVP |
| WHATSAPP-001 | Bot WhatsApp | Bloqueado — post-MVP |
| US-20 | Swap Supabase | Bloqueado — post-MVP |
| US-11 | Sentry | Bloqueado — esperar clientes reales |

---

## Capacidad estimada

| Historia | Esfuerzo |
|---------|---------|
| US-21 Perfil completo | 5pts |
| US-10 Expediente 2 pasos | 5pts |
| US-01 CA4 Tests tareas | 2pts |
| US-14 Preview documentos | 5pts |
| US-15 Full-text indexes | 2pts |
| UX-006 Pre-selección expediente | 2pts |
| LEGAL-001 Política privacidad | 1pt |
| LEGAL-002 T&C | 1pt |
| **Total** | **23pts** |

---

## Orden de implementación sugerido

1. `US-15` — Índices full-text (migración existente, 30 min, riesgo bajo)
2. `US-01 CA4` — Tests tareas (deuda técnica, desbloquea confianza)
3. `UX-006` — Pre-selección expediente (UX quick win, muy pedido por usuarios)
4. `US-21` — Perfil completo (logo + plan — impacto visual para demos)
5. `US-10` — Expediente 2 pasos (refactor más grande)
6. `US-14` — Preview documentos (usa infra existente)
7. `LEGAL-001/002` — Páginas legales (texto + routing)
