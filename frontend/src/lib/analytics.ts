/**
 * Helpers para eventos custom de Google Analytics 4.
 * Usa gtag() solo si GA está cargado (NEXT_PUBLIC_GA_ID seteado).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params ?? {});
  }
}

// ── Funnel de conversión ──────────────────────────────────────────────────────

/** Click en "Empezar gratis" en la landing */
export const trackBeginRegistration = () => track("begin_registration");

/** Registro completado (email o Google) */
export const trackSignUp = (method: "email" | "google") =>
  track("sign_up", { method });

/** Login exitoso */
export const trackLogin = (method: "email" | "google") =>
  track("login", { method });

// ── Funnel de activación ─────────────────────────────────────────────────────

/** Primer cliente creado */
export const trackFirstCliente = () => track("first_cliente");

/** Primer expediente creado */
export const trackFirstExpediente = () => track("first_expediente");

/** Primer movimiento/vencimiento creado */
export const trackFirstMovimiento = () => track("first_movimiento");

/** Google Calendar conectado desde /perfil */
export const trackCalendarConnected = () => track("calendar_connected");

/** Sync de Calendar ejecutado */
export const trackCalendarSync = (synced: number) =>
  track("calendar_sync", { synced_count: synced });

// ── Monetización ─────────────────────────────────────────────────────────────

/** Usuario inicia checkout de suscripción */
export const trackBeginCheckout = (plan: string) =>
  track("begin_checkout", { plan });
