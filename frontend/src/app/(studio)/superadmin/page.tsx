"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface StudioRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
  ultima_actividad: string | null;
  exp_esta_semana: number;
  total_expedientes: number;
  total_usuarios: number;
}

interface OverrideForm {
  plan: string;
  subscription_status: string;
  reset_trial: boolean;
  trial_ends_at: string;
}

const PLAN_OPTIONS = ["trial", "starter", "pro", "estudio", "read_only"];
const STATUS_OPTIONS = ["", "active", "paused", "cancelled"];

const planBadge: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  estudio: "bg-brand-100 text-brand-700",
  read_only: "bg-ink-100 text-ink-500",
};

function trialDays(s: StudioRow) {
  if (!s.trial_ends_at) return null;
  return Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function actividadLabel(iso: string | null): string {
  if (!iso) return "Sin actividad";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias <= 7) return `Hace ${dias}d`;
  if (dias <= 30) return `Hace ${Math.floor(dias / 7)}sem`;
  return `Hace ${Math.floor(dias / 30)}m`;
}

export default function SuperadminPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const router = useRouter();

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudioRow | null>(null);
  const [form, setForm] = useState<OverrideForm>({ plan: "", subscription_status: "", reset_trial: false, trial_ends_at: "" });
  const [saving, setSaving] = useState(false);
  const [extending, setExtending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "trials">("todos");

  const reload = async () => {
    if (!token) return;
    const data = await api.get<StudioRow[]>("/superadmin/studios", token);
    setStudios(data);
  };

  useEffect(() => {
    if (!token) return;
    api.get<StudioRow[]>("/superadmin/studios", token)
      .then(setStudios)
      .catch((e) => {
        if (e.message?.includes("403") || e.message?.includes("denegado")) router.replace("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const openOverride = (s: StudioRow) => {
    setSelected(s);
    setForm({ plan: s.plan, subscription_status: s.subscription_status ?? "", reset_trial: false, trial_ends_at: "" });
    setMsg(null);
  };

  const handleSave = async () => {
    if (!selected || !token) return;
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (form.plan) body.plan = form.plan;
      if (form.subscription_status) body.subscription_status = form.subscription_status;
      if (form.reset_trial) body.reset_trial = true;
      if (form.trial_ends_at) body.trial_ends_at = form.trial_ends_at;
      await api.patch(`/superadmin/studios/${selected.id}/override`, body, token);
      setMsg({ text: "Override aplicado ✓", type: "ok" });
      await reload();
      setSelected(prev => studios.find(s => s.id === prev?.id) ?? null);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Error", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleExtend = async (studioId: string, dias = 15) => {
    if (!token) return;
    setExtending(studioId);
    try {
      await api.post(`/superadmin/studios/${studioId}/extend-trial?dias=${dias}`, {}, token);
      await reload();
    } finally {
      setExtending(null);
    }
  };

  const trialsUrgentes = studios.filter(s => {
    const d = trialDays(s);
    return s.plan === "trial" && d !== null && d >= 0 && d <= 10;
  }).sort((a, b) => (trialDays(a) ?? 99) - (trialDays(b) ?? 99));

  const filtered = studios.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const displayed = tab === "trials"
    ? filtered.filter(s => s.plan === "trial")
    : filtered;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Superadmin</h1>
          <p className="text-sm text-ink-400 mt-0.5">{studios.length} estudios · {trialsUrgentes.length} trials próximos</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar estudio…"
          className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-56"
        />
      </div>

      {/* ── Trials urgentes ── */}
      {trialsUrgentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-sm font-semibold text-amber-800">Trials por vencer ({trialsUrgentes.length})</p>
            <span className="text-xs text-amber-600">— contactar antes de que pierdan acceso</span>
          </div>
          <div className="divide-y divide-amber-100">
            {trialsUrgentes.map(s => {
              const d = trialDays(s)!;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{s.name}</p>
                    <p className="text-xs text-ink-500">{s.slug} · {s.total_expedientes} exps · {s.total_usuarios} usuarios</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {d === 0 ? "Vence hoy" : `${d}d`}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(s.slug);
                      }}
                      className="text-xs text-ink-400 hover:text-ink-700 border border-ink-200 px-2 py-1 rounded-lg transition"
                      title="Copiar slug/email"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => handleExtend(s.id, 15)}
                      disabled={extending === s.id}
                      className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {extending === s.id ? "…" : "+15d"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-ink-100 rounded-xl p-1 w-fit">
        {(["todos", "trials"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition capitalize ${tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            {t === "todos" ? `Todos (${studios.length})` : `Trials (${studios.filter(s => s.plan === "trial").length})`}
          </button>
        ))}
      </div>

      {/* ── Tabla ── */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-ink-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Estudio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Trial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Actividad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Exps</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, i) => {
                const days = trialDays(s);
                const activo = s.ultima_actividad && (Date.now() - new Date(s.ultima_actividad).getTime()) < 7 * 86400_000;
                return (
                  <tr key={s.id} className={`border-b border-ink-50 hover:bg-ink-50/50 transition ${i % 2 === 0 ? "" : "bg-ink-50/20"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activo ? "bg-green-500" : "bg-ink-300"}`} />
                        <div>
                          <p className="font-medium text-ink-900">{s.name}</p>
                          <p className="text-xs text-ink-400">{s.slug} · {s.total_usuarios} usuarios</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge[s.plan] ?? "bg-ink-100 text-ink-600"}`}>
                        {s.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {days !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className={days <= 0 ? "text-red-500 font-semibold" : days <= 5 ? "text-amber-600 font-semibold" : "text-ink-500"}>
                            {days <= 0 ? "Vencido" : `${days}d`}
                          </span>
                          {s.plan === "trial" && days >= 0 && (
                            <button
                              onClick={() => handleExtend(s.id, 15)}
                              disabled={extending === s.id}
                              className="text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-100 px-1.5 py-0.5 rounded transition disabled:opacity-50"
                            >
                              {extending === s.id ? "…" : "+15d"}
                            </button>
                          )}
                        </div>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>
                        <span className={s.ultima_actividad ? (activo ? "text-green-600 font-medium" : "text-ink-500") : "text-ink-300"}>
                          {actividadLabel(s.ultima_actividad)}
                        </span>
                        {s.exp_esta_semana > 0 && (
                          <span className="ml-1.5 text-[10px] bg-brand-50 text-brand-600 font-semibold px-1.5 py-0.5 rounded-full">
                            +{s.exp_esta_semana} esta semana
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {s.total_expedientes > 0 ? s.total_expedientes : <span className="text-ink-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/superadmin/studios/${s.id}`}
                          className="text-xs text-ink-500 hover:text-ink-800 font-medium border border-ink-200 hover:bg-ink-50 px-3 py-1.5 rounded-lg transition">
                          Detalle
                        </Link>
                        <button onClick={() => openOverride(s)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition">
                          Override
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal override ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Override — {selected.name}</h2>
                <p className="text-xs text-ink-400 mt-0.5">{selected.total_expedientes} exps · {selected.total_usuarios} usuarios · {actividadLabel(selected.ultima_actividad)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Subscription status</label>
                <select value={form.subscription_status} onChange={e => setForm(f => ({ ...f, subscription_status: e.target.value }))}
                  className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || "— sin cambio —"}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Trial ends at (opcional)</label>
              <input type="datetime-local" value={form.trial_ends_at}
                onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.reset_trial} onChange={e => setForm(f => ({ ...f, reset_trial: e.target.checked }))}
                  className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400" />
                <span className="text-sm text-ink-700">Resetear trial (+30d)</span>
              </label>
              <button onClick={() => handleExtend(selected.id, 15)} disabled={extending === selected.id}
                className="text-sm font-semibold text-green-700 underline hover:no-underline transition disabled:opacity-50">
                Extender +15d rápido
              </button>
            </div>

            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${msg.type === "ok" ? "text-green-700 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100"}`}>
                {msg.text}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setSelected(null)}
                className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">
                {saving ? "Guardando…" : "Aplicar override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
