"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface SyncResult {
  synced: number;
  errors: number;
  total: number;
}

interface LastSync {
  ts: number; // unix ms
  synced: number;
}

interface Props {
  variant?: "banner" | "compact";
}

const LS_KEY = "lexcore_last_calendar_sync";

function loadLastSync(): LastSync | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLastSync(data: LastSync) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}

const TZ = "America/Argentina/Buenos_Aires";

function formatLastSync(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  if (hrs < 24) return `hoy a las ${hhmm}`;
  if (hrs < 48) return `ayer a las ${hhmm}`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: TZ }) + ` a las ${hhmm}`;
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

const CheckIcon = () => (
  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export function CalendarSyncButton({ variant = "compact" }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;
  const isGoogleUser = (session?.user as any)?.authProvider === "google";

  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [justSynced, setJustSynced] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<LastSync | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLastSync(loadLastSync());
  }, []);

  if (!token) return null;

  const handleSync = async () => {
    setSyncing(true);
    setJustSynced(null);
    setError(null);
    try {
      const res = await api.post<SyncResult>("/vencimientos/sync-calendar", {}, token);
      const ls: LastSync = { ts: Date.now(), synced: res.synced };
      saveLastSync(ls);
      setLastSync(ls);
      setJustSynced(res);
      setTimeout(() => setJustSynced(null), 4000);
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

  // ── Usuario sin Google: invitar a conectar (muy discreto) ───────────────
  if (!isGoogleUser) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <CalIcon />
        <span>Google Calendar no conectado</span>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="text-blue-500 hover:text-blue-700 font-medium underline underline-offset-2 transition disabled:opacity-50"
        >
          {connecting ? "…" : "Conectar"}
        </button>
      </div>
    );
  }

  // ── Usuario Google: solo ícono de sync, sin texto de disclaimer ────────────
  const syncTitle = justSynced
    ? `✓ ${justSynced.synced} sincronizados`
    : error ? error
    : lastSync ? `Última sync: ${formatLastSync(lastSync.ts)}`
    : "Sincronizar con Google Calendar";

  if (error?.includes("calendar_id") || error?.includes("elegir")) {
    return <Link href="/perfil" className="text-xs text-blue-500 underline underline-offset-2">Configurar calendario</Link>;
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      title={syncTitle}
      className={`p-2 rounded-lg transition ${
        justSynced ? "text-green-500" : error ? "text-red-400" : "text-ink-400 hover:text-brand-600 hover:bg-ink-50"
      } disabled:opacity-40`}
    >
      <SyncIcon spinning={syncing} />
    </button>
  );
}
