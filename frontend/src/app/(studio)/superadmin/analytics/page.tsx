"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";

interface MetricsData {
  total_studios: number;
  trial_studios: number;
  paying_studios: number;
  read_only_studios: number;
  studios_per_plan: Record<string, number>;
  total_users: number;
  total_expedientes: number;
  total_documentos: number;
  total_tareas: number;
  total_vencimientos: number;
}

interface SnapshotResponse {
  snapshot_at: string | null;
  data: MetricsData | null;
}

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-amber-400",
  starter: "bg-blue-400",
  pro: "bg-purple-400",
  estudio: "bg-brand-500",
  read_only: "bg-ink-300",
};

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-ink-100 shadow-sm p-5 ${color ?? ""}`}>
      <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function SuperadminAnalyticsPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [snap, setSnap] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<{ snapshot_at: string; data: MetricsData }[]>([]);

  const load = async () => {
    if (!token) return;
    const [s, h] = await Promise.all([
      api.get<SnapshotResponse>("/superadmin/metrics/latest", token),
      api.get<{ snapshot_at: string; data: MetricsData }[]>("/superadmin/metrics/history", token),
    ]);
    setSnap(s);
    setHistory(h);
    setLoading(false);
  };

  useEffect(() => { if (token) load(); }, [token]);

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      await api.post("/superadmin/metrics/sync", {}, token);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const d = snap?.data;

  const conversionRate = d && d.total_studios > 0
    ? ((d.paying_studios / d.total_studios) * 100).toFixed(1)
    : "—";

  const trialConversion = d && d.trial_studios > 0
    ? (((d.total_studios - d.trial_studios - d.read_only_studios) / d.total_studios) * 100).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Analytics de producto</h1>
          {snap?.snapshot_at && (
            <p className="text-xs text-ink-400 mt-0.5">
              Último snapshot: {new Date(snap.snapshot_at).toLocaleString("es-AR")}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-ink-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : !d ? (
        <div className="text-center py-12">
          <p className="text-ink-400 text-sm mb-3">No hay datos aún.</p>
          <button onClick={handleSync} className="text-amber-600 text-sm font-semibold hover:underline">Generar primer snapshot</button>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Estudios totales" value={d.total_studios} />
            <KpiCard label="Pagando" value={d.paying_studios} sub={`${conversionRate}% conversión`} />
            <KpiCard label="En trial" value={d.trial_studios} sub={`${trialConversion}% converted`} />
            <KpiCard label="Read-only" value={d.read_only_studios} sub="Trial vencido" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Usuarios" value={d.total_users} />
            <KpiCard label="Expedientes" value={d.total_expedientes} />
            <KpiCard label="Tareas" value={d.total_tareas} />
            <KpiCard label="Documentos" value={d.total_documentos} />
          </div>

          {/* Distribución por plan */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-700 mb-4">Distribución por plan</h2>
            <div className="space-y-3">
              {Object.entries(d.studios_per_plan).sort((a, b) => b[1] - a[1]).map(([plan, count]) => {
                const pct = d.total_studios > 0 ? (count / d.total_studios) * 100 : 0;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-ink-700 capitalize">{plan}</span>
                      <span className="text-xs text-ink-400">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${PLAN_COLORS[plan] ?? "bg-ink-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historial de snapshots */}
          {history.length > 1 && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-ink-700 mb-4">Historial (últimos {history.length} snapshots)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink-100">
                      <th className="text-left py-2 pr-4 text-ink-500 font-semibold">Fecha</th>
                      <th className="text-right py-2 px-2 text-ink-500 font-semibold">Estudios</th>
                      <th className="text-right py-2 px-2 text-ink-500 font-semibold">Pagando</th>
                      <th className="text-right py-2 px-2 text-ink-500 font-semibold">Trial</th>
                      <th className="text-right py-2 px-2 text-ink-500 font-semibold">Usuarios</th>
                      <th className="text-right py-2 pl-2 text-ink-500 font-semibold">Expedientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((s, i) => (
                      <tr key={i} className="border-b border-ink-50">
                        <td className="py-2 pr-4 text-ink-600">
                          {new Date(s.snapshot_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-2 text-right text-ink-900 font-semibold">{s.data.total_studios}</td>
                        <td className="py-2 px-2 text-right text-green-600 font-semibold">{s.data.paying_studios}</td>
                        <td className="py-2 px-2 text-right text-amber-600">{s.data.trial_studios}</td>
                        <td className="py-2 px-2 text-right text-ink-600">{s.data.total_users}</td>
                        <td className="py-2 pl-2 text-right text-ink-600">{s.data.total_expedientes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
