# components/features — Convenciones

## Responsabilidad
Componentes que conocen el dominio de LexCore. Pueden llamar a la API, recibir token, y contener lógica de negocio.

## Diferencia con components/ui/
- `ui/` → primitivos sin dominio (botones, inputs, modales genéricos)
- `features/` → componentes con dominio (saben qué es un Expediente, una Tarea, un Honorario)

## Patrones
- Reciben `token` como prop — nunca lo leen desde contexto directamente
- Usan `api.get/post/patch/delete` de `@/lib/api` — nunca `fetch` directo
- Errores: mostrar al usuario, no swallow silencioso
- Mobile-first: diseñar para 375px primero

## Archivos actuales
| Archivo | Qué hace |
|---------|----------|
| movimiento-detail-sheet.tsx | Sheet de detalle de movimiento procesal |
| tarea-detail-sheet.tsx | Sheet de detalle de tarea con docs/notas |
| vencimiento-detail-sheet.tsx | Sheet de detalle de vencimiento con docs/notas |
| evento-detail-modal.tsx | Modal de detalle de evento de agenda |
