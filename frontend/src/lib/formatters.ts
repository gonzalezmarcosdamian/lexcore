/**
 * Funciones de formato compartidas en toda la app.
 * Centraliza la duplicación de fmt/formatFecha/formatDate/formatMoney.
 */

// ── Moneda ────────────────────────────────────────────────────────────────────

/** Formatea monto con símbolo de moneda. Ej: "$ 1.500.000" */
export function formatMoney(monto: number, moneda: string): string {
  return `${moneda === "ARS" ? "$" : "U$D"} ${Number(monto).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
}

/** Formatea monto con escala K/M para espacios reducidos. Ej: "$1,5M", "$450K" */
export function formatMoneyCompact(n: number, moneda: string): string {
  const s = moneda === "ARS" ? "$" : "U$D";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${s}${(abs / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${s}${(abs / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })}K`;
  return `${s}${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

/**
 * Fecha corta relativa. Ej: "Hoy", "Ayer", "Lun 27", "27 abr"
 * Recibe string ISO YYYY-MM-DD.
 */
export function formatFecha(fecha: string): string {
  if (!fecha) return "";
  const d = new Date(fecha + "T12:00:00");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (fecha === todayStr) return "Hoy";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (fecha === yStr) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/**
 * Fecha larga. Ej: "Lunes 27 de Abril de 2026"
 */
export function formatFechaLarga(fecha: string): string {
  if (!fecha) return "";
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

/**
 * Fecha desde ISO timestamp. Ej: "27 abr 2026"
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Fecha relativa desde ahora. Ej: "Hoy", "Ayer", "Hace 3d", "Hace 2sem"
 */
export function formatRelativa(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias <= 7) return `Hace ${dias}d`;
  if (dias <= 30) return `Hace ${Math.floor(dias / 7)}sem`;
  return `Hace ${Math.floor(dias / 30)}m`;
}

// ── Documentos ────────────────────────────────────────────────────────────────

/** Formatea tamaño en bytes a KB/MB. Ej: "1,2 MB", "450 KB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Documentos de identidad ───────────────────────────────────────────────────

/** Formatea CUIT con guiones. Ej: "20-12345678-9" */
export function formatCuit(valor: string): string {
  const clean = valor.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}
