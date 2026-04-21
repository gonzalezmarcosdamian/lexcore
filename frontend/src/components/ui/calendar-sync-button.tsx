"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface SyncResult {
  synced: number;
  errors: number;
  total: number;
}

interface Props {
  /** "banner" muestra callout con descripción; "compact" solo el botón con ícono */
  variant?: "banner" | "compact";
}

const CalIcon = () => (
  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM4.5 7.5V4.5h2.25V6h1.5V4.5h7.5V6h1.5V4.5H19.5V7.5h-15z"/>
  </svg>
);

const SyncIcon = ({ spinning }: { spinning: boolean }) => (
  <svg className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export function CalendarSyncButton({ variant = "compact" }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;
  const isGoogleUser = (session?.user as any)?.authProvider === "google";

  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!token) return null;

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.post<SyncResult>("/vencimientos/sync-calendar", {}, token);
      setResult(res);
      setTimeout(() => setResult(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al sincronizar";
      if (msg.includes("calendario") || msg.includes("calendar_id") || msg.includes("elegir") || msg.includes("perfil")) {
        router.push("/perfil");
        return;
      }
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>("/auth/google-calendar/connect", token);
      window.location.href = res.url;
    } catch {
      setError("No se pudo iniciar la conexión");
      setTimeout(() => setError(null), 5000);
      setConnecting(false);
    }
  };

  // ── Usuario sin Google: invitar a conectar ────────────────────────────────
  if (!isGoogleUser) {
    if (variant === "banner") {
      return (
        <div className="flex items-center justify-between bg-white border border-ink-100 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CalIcon />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-800">Google Calendar</p>
              {error
                ? <p className="text-xs text-red-500">{error}</p>
                : <p className="text-xs text-ink-400">Conectá tu calendario para sincronizar vencimientos</p>
              }
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
          >
            {connecting ? "Redirigiendo…" : "Conectar"}
          </button>
        </div>
      );
    }
    // compact
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        title="Conectar Google Calendar"
        className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-blue-600 border border-ink-200 hover:border-blue-300 px-3 py-2 rounded-xl transition disabled:opacity-50"
      >
        <CalIcon />
        {connecting ? "…" : "Sync Calendar"}
      </button>
    );
  }

  // ── Usuario Google: sync directo ──────────────────────────────────────────
  if (variant === "banner") {
    return (
      <div className="flex items-center justify-between bg-white border border-ink-100 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CalIcon />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-800">Google Calendar</p>
            {result ? (
              <p className="text-xs text-green-600">{result.synced} evento{result.synced !== 1 ? "s" : ""} sincronizado{result.synced !== 1 ? "s" : ""}</p>
            ) : error ? (
              <p className="text-xs text-red-500">
                {error.includes("calendar_id") || error.includes("configurado") || error.includes("elegir")
                  ? <Link href="/perfil" className="underline">Elegí tu calendario en Perfil</Link>
                  : error}
              </p>
            ) : (
              <p className="text-xs text-ink-400">Sincronizá vencimientos y tareas con tu calendario</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          title="Sincronizar con Google Calendar"
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-300 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex-shrink-0"
        >
          <SyncIcon spinning={syncing} />
          {syncing ? "Sync…" : "Sincronizar"}
        </button>
      </div>
    );
  }

  // compact
  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      title="Sincronizar vencimientos con Google Calendar"
      className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-600 border border-ink-200 hover:border-brand-300 px-3 py-2 rounded-xl transition disabled:opacity-50"
    >
      <SyncIcon spinning={syncing} />
      {result
        ? <span className="text-green-600">{result.synced} sync</span>
        : error
        ? <span className="text-red-500">Error</span>
        : syncing ? "Sync…" : "Sync Calendar"
      }
    </button>
  );
}
