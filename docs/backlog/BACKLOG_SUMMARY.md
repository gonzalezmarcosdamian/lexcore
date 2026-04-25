# BACKLOG_SUMMARY — Índice comprimido

> Usar este archivo para planificación y sprint planning.
> Para el detalle completo de cada historia: ver BACKLOG.md.
> Última actualización: 2026-04-25

## Estado del producto
- **Versión:** 0.19.0 | **Sprint activo:** Sprint 16 (completado)
- **Stack:** FastAPI + PostgreSQL + Next.js 14 + Tailwind + Shadcn

---

## COMPLETADAS (done)
AUTH-001/002/003/004/005 · CAL-001 · US-01/02/03/04/06/07/08/09/10/13/14/15/17/18
EXP-NUM-001 · UX-006 · VCT-001/002/003/004 · HON-001..N · Sprint 08-16 completos

---

## ACTIVAS / PRÓXIMAS

### P0 — Bloqueante MVP
| ID | Historia | Estado | Sprint |
|----|----------|--------|--------|
| CLT-001 | CRUD clientes | idea | 02 |
| EXP-001 | CRUD expedientes | idea | 02 |
| EXP-002 | Detalle expediente + timeline | idea | 02 |

### P1 — Importantes MVP
| ID | Historia | Estado |
|----|----------|--------|
| US-15 | Índices full-text PostgreSQL | ready |
| US-21 | Perfil del estudio y usuario | refined |
| US-10 | Creación expediente 2 pasos mobile | refined |
| EXP-LOC-001 | Localidad del expediente | idea |
| MOV-EDIT-001 | Editar/eliminar movimientos | idea |
| VCT-HORA-001 | Hora en vencimientos | idea |
| EXP-CLI-MULTI-001 | Múltiples clientes por expediente | idea |
| USR-001 | Invitar usuarios al estudio | idea |
| EXP-003 | Múltiples abogados con roles | idea |
| CLT-002 | Historial expedientes por cliente | idea |
| CONT-001 | Gastos y costos del estudio | idea |
| CONT-002 | Dashboard financiero | idea |
| CONT-003 | Costos por expediente | idea |
| CONT-004 | Facturación y comprobantes | idea |
| DEVEFF-003 | Generar tipos TS desde Pydantic | idea |
| DEVEFF-005 | Logs estructurados + request_id | idea |

### P2 — Nice-to-have MVP
| ID | Historia | Estado |
|----|----------|--------|
| UX-001 | Splash screen value props | idea |
| UX-003/004/005 | UX mejoras listados/búsqueda | idea |
| NOT-001/002/003 | Notificaciones in-app | idea |
| DOC-001 | Adjuntar documentos a expedientes | idea |
| BUS-001 | Búsqueda global Cmd+K | idea |
| CX-001 | Centro de ayuda + soporte | idea |
| DEVEFF-001 | Extraer _sort_key a services/actividad.py | idea |
| DEVEFF-002 | Tipado estricto en meta de ActividadItem | idea |
| DEVEFF-004 | CLAUDE.md por carpeta (hecho ✓) | done |
| DEVEFF-006 | Hook resumen PRODUCTO.md (hecho ✓) | done |
| DEVEFF-007 | BACKLOG_SUMMARY.md (este archivo ✓) | done |

### Suscripción (refinadas)
| ID | Historia | Estado |
|----|----------|--------|
| SUBS-001 | Modelo datos suscripción | refined |
| SUBS-002 | Checkout MercadoPago | refined |
| SUBS-003 | Modo lectura automático | refined |
| SUBS-004 | Límite usuarios por plan | refined |
| SUBS-005 | Alertas cobro/fallo pago | refined |
| SUBS-006 | Portal gestión suscripción | refined |

### Superadmin (refinadas)
| ID | Historia | Estado |
|----|----------|--------|
| SADM-001 | Modelo y acceso superadmin | refined |
| SADM-002 | Gestión precios con historial | refined |
| SADM-003 | Métricas de producto | refined |
| SADM-004 | Métricas de negocio | refined |

---

## BLOQUEADAS (no planificar)
| ID | Historia | Bloqueante |
|----|----------|------------|
| US-AI-01 | Resumen IA expediente | costo API |
| US-11 | Sentry + logs estructurados | depende DEVEFF-005 |
| US-12 | Generador cabecera escrito | requiere LLM |
| US-13 | Portal cliente read-only | post-MVP |
| US-16 | Timesheets | post-MVP |
| US-20 | Swap JWT → Supabase | post-MVP |
| PJN-001/002 | Integración PJN | API no pública |
| WHATSAPP-001 | Bot WhatsApp | post-MVP |
| COLLAB-001 | Colaboración real-time | post-MVP |
| PREC-001 | Modelo freemium | depende SUBS |

---

## BACKLOG post-MVP
RPT-001/002 · INT-001/002 · MOB-001 · AI-001/002/003 · ONB-001 · CONF-001 · USR-002
JURI-001 · LICIT-001 · MULTI-001 · UX-001/002
