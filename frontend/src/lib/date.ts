const TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en Argentina: YYYY-MM-DD */
export function todayAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Convierte un Date a YYYY-MM-DD en zona Argentina */
export function toDateStrAR(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Año actual en Argentina */
export function yearAR(): number {
  return parseInt(todayAR().slice(0, 4), 10);
}

/** Mes actual en Argentina (1-12) */
export function monthAR(): number {
  return parseInt(todayAR().slice(5, 7), 10);
}
