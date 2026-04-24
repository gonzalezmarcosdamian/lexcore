/**
 * Paleta central — DECISION FINAL (Gonzalo 2026-04-25):
 *   Tareas      = AZUL   (trabajo interno a hacer)
 *   Movimientos = NARANJA (actos procesales externos, plazos)
 *   Honorarios  = VERDE ESMERALDA
 */

export const ITEM_COLORS = {
  movimiento: {
    dot:     "bg-orange-500",
    badge:   "bg-orange-100 text-orange-700",
    border:  "border-l-orange-500",
    bg:      "bg-orange-50",
    text:    "text-orange-700",
    button:  "bg-orange-600 hover:bg-orange-700 text-white",
    urgent:  { dot: "bg-red-500", badge: "bg-red-100 text-red-700", border: "border-l-red-500" },
  },
  // alias backward compat
  vencimiento: {
    dot:     "bg-orange-500",
    badge:   "bg-orange-100 text-orange-700",
    border:  "border-l-orange-500",
    bg:      "bg-orange-50",
    text:    "text-orange-700",
    button:  "bg-orange-600 hover:bg-orange-700 text-white",
    urgent:  { dot: "bg-red-500", badge: "bg-red-100 text-red-700", border: "border-l-red-500" },
  },
  tarea: {
    dot:     "bg-blue-500",
    badge:   "bg-blue-100 text-blue-700",
    border:  "border-l-blue-500",
    bg:      "bg-blue-50",
    text:    "text-blue-700",
    button:  "bg-blue-600 hover:bg-blue-700 text-white",
  },
  honorario: {
    dot:     "bg-emerald-500",
    badge:   "bg-emerald-100 text-emerald-700",
    border:  "border-l-emerald-500",
    bg:      "bg-emerald-50",
    text:    "text-emerald-700",
    button:  "bg-emerald-600 hover:bg-emerald-700 text-white",
    vencido: { dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
    proximo: { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700" },
  },
  paralizado: {
    dot:     "bg-blue-300",
    badge:   "bg-blue-100 text-blue-600",
    border:  "border-l-blue-300",
    bg:      "bg-blue-50",
  },
} as const;

export type ItemTipo = keyof typeof ITEM_COLORS;
