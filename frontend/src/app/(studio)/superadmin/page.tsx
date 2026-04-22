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

export default function SuperadminPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const router = useRouter();

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudioRow | null>(null);
  const [form, setForm] = useState<OverrideForm>({ plan: "", subscription_status: "", reset_trial: false, trial_ends_at: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [search, setSearch] = useState("");

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
      setMsg({ text: "Override aplicado", type: "ok" });
      const updated = await api.get<StudioRow[]>("/superadmin/studios", token);
      setStudios(updated);
      setSelected(updated.find(s => s.id === selected.id) ?? null);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Error", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = studios.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const trialDays = (s: StudioRow) => {
    if (!s.trial_ends_at) return null;
    return Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Estudios</h1>
          <p className="text-sm text-ink-400 mt-0.5">{studios.length} estudios registrados</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar estudio…"
          className="border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-56"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-ink-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Estudio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide">Trial</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const days = trialDays(s);
                return (
                  <tr key={s.id} className={`border-b border-ink-50 hover:bg-ink-50/50 transition ${i % 2 === 0 ? "" : "bg-ink-50/20"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      <p className="text-xs text-ink-400">{s.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge[s.plan] ?? "bg-ink-100 text-ink-600"}`}>
                        {s.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.subscription_status ? (
                        <span className={`text-xs font-medium ${
                          s.subscription_status === "active" ? "text-green-600" :
                          s.subscription_status === "paused" ? "text-amber-600" : "text-red-500"
                        }`}>
                          {s.subscription_status}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {days !== null ? (
                        <span className={days <= 0 ? "text-red-500 font-medium" : days <= 5 ? "text-amber-600 font-medium" : ""}>
                          {days <= 0 ? "Vencido" : `${days}d restantes`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/superadmin/studios/${s.id}`}
                          className="text-xs text-ink-500 hover:text-ink-800 font-medium border border-ink-200 hover:bg-ink-50 px-3 py-1.5 rounded-lg transition"
                        >
                          Detalle
                        </Link>
                        <button
                          onClick={() => openOverride(s)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition"
                        >
                          Override
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal override */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">Override — {selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
            </div>

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

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Trial ends at (opcional)</label>
              <input type="datetime-local" value={form.trial_ends_at}
                onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.reset_trial} onChange={e => setForm(f => ({ ...f, reset_trial: e.target.checked }))}
                className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-400" />
              <span className="text-sm text-ink-700">Resetear trial (+30 días desde hoy)</span>
            </label>

            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                msg.type === "ok" ? "text-green-700 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100"
              }`}>{msg.text}</p>
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
