"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api, Gasto, GastoCategoria, Moneda } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";

const today = new Date().toISOString().split("T")[0];
const CATEGORIAS: { value: GastoCategoria; label: string }[] = [
  { value: "alquiler", label: "Alquiler" },
  { value: "sueldos", label: "Sueldos" },
  { value: "servicios", label: "Servicios" },
  { value: "costos_judiciales", label: "Costos judiciales" },
  { value: "honorarios_terceros", label: "Honorarios a terceros" },
  { value: "otros", label: "Otros" },
];

const CATEGORIA_COLORS: Record<GastoCategoria, string> = {
  alquiler: "bg-blue-100 text-blue-700",
  sueldos: "bg-purple-100 text-purple-700",
  servicios: "bg-cyan-100 text-cyan-700",
  costos_judiciales: "bg-orange-100 text-orange-700",
  honorarios_terceros: "bg-yellow-100 text-yellow-700",
  otros: "bg-ink-100 text-ink-600",
};

const EMPTY_FORM = {
  descripcion: "",
  categoria: "otros" as GastoCategoria,
  monto: "",
  moneda: "ARS" as Moneda,
  fecha: today,
  recurrente: false,
  notas: "",
  expediente_id: "",
};

export default function GastosPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filtroMes, setFiltroMes] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [mes, anio] = filtroMes.split("-").map(Number);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<Gasto[]>("/gastos", token, { mes, anio })
      .then(setGastos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, mes, anio]);

  const totalARS = gastos.filter((g) => g.moneda === "ARS").reduce((s, g) => s + Number(g.monto), 0);
  const totalUSD = gastos.filter((g) => g.moneda === "USD").reduce((s, g) => s + Number(g.monto), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      monto: form.monto,
      expediente_id: form.expediente_id || undefined,
      notas: form.notas || undefined,
    };
    try {
      if (editingId) {
        const updated = await api.patch<Gasto>(`/gastos/${editingId}`, payload, token);
        setGastos((prev) => prev.map((g) => (g.id === editingId ? updated : g)));
      } else {
        const created = await api.post<Gasto>("/gastos", payload, token);
        setGastos((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (g: Gasto) => {
    setForm({
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: String(g.monto),
      moneda: g.moneda,
      fecha: g.fecha,
      recurrente: g.recurrente,
      notas: g.notas ?? "",
      expediente_id: g.expediente_id ?? "",
    });
    setEditingId(g.id);
    setShowForm(true);
    setError("");
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await api.delete(`/gastos/${id}`, token);
      setGastos((prev) => prev.filter((g) => g.id !== id));
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const inputClass =
    "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
  const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Contable</h1>
          <p className="text-sm text-ink-400 mt-0.5">Gastos y costos del estudio</p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Gastos"
            description="Módulo de control de gastos y costos del estudio"
            items={[
              { icon: "💰", title: "Registrar gastos", description: "Cargá alquiler, sueldos, servicios y otros costos con fecha y categoría." },
              { icon: "📅", title: "Filtro por mes", description: "Filtrá los gastos por mes para ver qué se gastó en cada período." },
              { icon: "📊", title: "Totales por moneda", description: "Los totales de ARS y USD se calculan automáticamente según los gastos del mes." },
              { icon: "📎", title: "Gastos por expediente", description: "Podés asociar un gasto a un expediente para tener trazabilidad de costos judiciales." },
            ]}
            tip="El widget financiero del dashboard usa los datos de este módulo para mostrarte el resultado neto del mes."
          />
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo gasto
          </button>
        </div>
      </div>

      {/* Filtro de mes */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-600 font-medium">Período:</label>
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="bg-white border border-ink-200 rounded-xl px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
        />
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Total ARS</p>
          <p className="text-2xl font-bold text-ink-900">
            {loading ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `$ ${totalARS.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Total USD</p>
          <p className="text-2xl font-bold text-ink-900">
            {loading ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `U$D ${totalUSD.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Registros</p>
          <p className="text-2xl font-bold text-ink-900">
            {loading ? <span className="inline-block w-10 h-7 bg-ink-100 rounded animate-pulse" /> : gastos.length}
          </p>
        </div>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 max-w-2xl">
          <h2 className="text-base font-semibold text-ink-900 mb-4">{editingId ? "Editar gasto" : "Nuevo gasto"}</h2>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                <input required value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Alquiler oficina mayo" />
              </div>
              <div>
                <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                <select required value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha <span className="text-red-500">*</span></label>
                <input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Monto <span className="text-red-500">*</span></label>
                <input required type="number" step="0.01" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value as Moneda })} className={inputClass}>
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notas</label>
                <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="recurrente" checked={form.recurrente} onChange={(e) => setForm({ ...form, recurrente: e.target.checked })} className="rounded" />
                <label htmlFor="recurrente" className="text-sm text-ink-700">Gasto recurrente (mensual)</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={cancelForm} className="flex-1 text-center border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Registrar gasto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="text-sm font-semibold text-ink-900">
            Gastos de {new Date(mes + "-" + anio + "-01".replace(/(\d+)-(\d+)-(.+)/, `$2-01-$1`)).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
          </h2>
        </div>
        {loading ? (
          <div className="divide-y divide-ink-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
                <div className="w-20 h-5 bg-ink-100 rounded-full" />
                <div className="flex-1 h-4 bg-ink-100 rounded w-1/2" />
                <div className="w-24 h-5 bg-ink-100 rounded" />
              </div>
            ))}
          </div>
        ) : gastos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-ink-400">Sin gastos registrados en este período</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium">
              Registrar el primero →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {gastos.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIA_COLORS[g.categoria]}`}>
                  {CATEGORIAS.find((c) => c.value === g.categoria)?.label ?? g.categoria}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 font-medium truncate">{g.descripcion}</p>
                  <p className="text-xs text-ink-400">
                    {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    {g.recurrente && <span className="ml-2 text-ink-300">· recurrente</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink-900 flex-shrink-0">
                  {g.moneda === "ARS" ? "$" : "U$D"} {Number(g.monto).toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(g)} className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg hover:bg-ink-50 transition">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(g.id)} disabled={deletingId === g.id} className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                    {deletingId === g.id ? (
                      <span className="w-3.5 h-3.5 block rounded-full border-2 border-red-300 border-t-transparent animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
