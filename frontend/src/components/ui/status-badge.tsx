/**
 * StatusBadge — componente unificado de estado para toda la app.
 * Uso: <StatusBadge variant="urgente" /> | <StatusBadge variant="pendiente" label="En espera" />
 */

type Variant =
  | "urgente"
  | "pendiente"
  | "en_curso"
  | "hecha"
  | "activo"
  | "archivado"
  | "cerrado"
  | "cumplido"
  | "no_cumplido"
  | "confirmado";

const CONFIG: Record<Variant, { label: string; cls: string; dot: string }> = {
  urgente:     { label: "Urgente",    cls: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500" },
  pendiente:   { label: "Pendiente",  cls: "bg-yellow-50 text-yellow-700 border-yellow-100", dot: "bg-yellow-400" },
  en_curso:    { label: "En curso",   cls: "bg-blue-50 text-blue-700 border-blue-100",    dot: "bg-blue-400" },
  hecha:       { label: "Hecha",      cls: "bg-green-50 text-green-700 border-green-100", dot: "bg-green-500" },
  activo:      { label: "Activo",     cls: "bg-green-50 text-green-700 border-green-100", dot: "bg-green-500" },
  archivado:   { label: "Archivado",  cls: "bg-ink-50 text-ink-500 border-ink-200",       dot: "bg-ink-400" },
  cerrado:     { label: "Cerrado",    cls: "bg-ink-100 text-ink-600 border-ink-200",      dot: "bg-ink-500" },
  cumplido:    { label: "Cumplido",   cls: "bg-green-50 text-green-700 border-green-100", dot: "bg-green-500" },
  no_cumplido: { label: "Pendiente",  cls: "bg-yellow-50 text-yellow-700 border-yellow-100", dot: "bg-yellow-400" },
  confirmado:  { label: "Confirmado", cls: "bg-green-50 text-green-700 border-green-100", dot: "bg-green-500" },
};

interface StatusBadgeProps {
  variant: Variant;
  label?: string;       // override del label por defecto
  dot?: boolean;        // mostrar punto de color (default true)
  size?: "sm" | "md";  // sm = text-[10px], md = text-xs (default)
}

export function StatusBadge({ variant, label, dot = true, size = "md" }: StatusBadgeProps) {
  const cfg = CONFIG[variant];
  const textCls = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full border ${textCls} ${cfg.cls}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
      {label ?? cfg.label}
    </span>
  );
}
