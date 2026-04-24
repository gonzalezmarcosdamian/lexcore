/**
 * Paleta central de colores por tipo de item.
 * Importar desde acá — nunca hardcodear en componentes.
 */

export const ITEM_COLORS = {
  vencimiento: {
    dot:     "bg-amber-400",
    badge:   "bg-amber-100 text-amber-700",
    border:  "border-l-amber-400",
    bg:      "bg-amber-50",
    text:    "text-amber-700",
    button:  "bg-amber-600 hover:bg-amber-700 text-white",
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
