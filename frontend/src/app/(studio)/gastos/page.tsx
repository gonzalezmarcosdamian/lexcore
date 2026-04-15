"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api, Gasto, GastoPlantilla, GastoCategoria, GastoEstado, Moneda } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ESTADO_CONFIG: Record<GastoEstado, { label: string; color: string; dot: string }> = {
  pendiente: { label: "Pendiente", color: "bg-red-50 text-red-600 border border-red-100", dot: "bg-red-500" },
  confirmado: { label: "Confirmado", color: "bg-green-50 text-green-700 border border-green-100", dot: "bg-green-500" },
};

const today = new Date().toISOString().split("T")[0];

const EMPTY_GASTO_FORM = {
  descripcion: "",
  categoria: "otros" as GastoCategoria,
  monto: "",
  moneda: "ARS" as Moneda,
  fecha: today,
  notas: "",
};

const EMPTY_PLANTILLA_FORM = {
  descripcion: "",
  categoria: "otros" as GastoCategoria,
  monto_esperado: "",
  moneda: "ARS" as Moneda,
  dia_del_mes: "1",
  notas: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function catLabel(cat: GastoCategoria) {
  return CATEGORIAS.find((c) => c.value === cat)?.label ?? cat;
}

function formatMoney(monto: number, moneda: Moneda) {
  return `${moneda === "ARS" ? "$" : "U$D"} ${monto.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
}

function periodoLabel(mes: number, anio: number) {
  const d = new Date(anio, mes - 1, 1);
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function prevMes(mes: number, anio: number) {
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}
function nextMes(mes: number, anio: number) {
  return mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function SkeletonRow() {
  return (
    <div className="px-5 py-4 flex items-center gap-3 animate-pulse">
      <div className="w-20 h-5 bg-ink-100 rounded-full" />
      <div className="flex-1 h-4 bg-ink-100 rounded w-1/2" />
      <div className="w-24 h-5 bg-ink-100 rounded" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContablePage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  // Data
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [plantillas, setPlantillas] = useState<GastoPlantilla[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(true);
  const [loadingPlantillas, setLoadingPlantillas] = useState(true);

  // UI state
  const [tab, setTab] = useState<"periodo" | "plantillas">("periodo");
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showPlantillaForm, setShowPlantillaForm] = useState(false);
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  const [editingPlantillaId, setEditingPlantillaId] = useState<string | null>(null);
  const [gastoForm, setGastoForm] = useState(EMPTY_GASTO_FORM);
  const [plantillaForm, setPlantillaForm] = useState(EMPTY_PLANTILLA_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Confirmar modal state
  const [confirmModal, setConfirmModal] = useState<{
    gastoId: string;
    montoEsperado: number;
    moneda: Moneda;
  } | null>(null);
  const [confirmMonto, setConfirmMonto] = useState("");

  const fetchGastos = useCallback(() => {
    if (!token) return;
    setLoadingGastos(true);
    api
      .get<Gasto[]>("/gastos", token, { mes, anio })
      .then(setGastos)
      .catch(() => {})
      .finally(() => setLoadingGastos(false));
  }, [token, mes, anio]);

  const fetchPlantillas = useCallback(() => {
    if (!token) return;
    setLoadingPlantillas(true);
    api
      .get<GastoPlantilla[]>("/gastos/plantillas", token)
      .then(setPlantillas)
      .catch(() => {})
      .finally(() => setLoadingPlantillas(false));
  }, [token]);

  useEffect(() => { fetchGastos(); }, [fetchGastos]);
  useEffect(() => { fetchPlantillas(); }, [fetchPlantillas]);

  // Derived
  const recurrentes = gastos.filter((g) => g.plantilla_id);
  const puntuales = gastos.filter((g) => !g.plantilla_id);
  const pendientesCount = recurrentes.filter((g) => g.estado === "pendiente").length;

  const confirmadosARS = gastos.filter((g) => g.estado === "confirmado" && g.moneda === "ARS").reduce((s, g) => s + Number(g.monto), 0);
  const confirmadosUSD = gastos.filter((g) => g.estado === "confirmado" && g.moneda === "USD").reduce((s, g) => s + Number(g.monto), 0);

  // ── Gastos puntual form ──

  const handleGastoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...gastoForm,
        monto: gastoForm.monto,
        notas: gastoForm.notas || undefined,
      };
      if (editingGastoId) {
        const updated = await api.patch<Gasto>(`/gastos/${editingGastoId}`, payload, token);
        setGastos((prev) => prev.map((g) => (g.id === editingGastoId ? updated : g)));
      } else {
        const created = await api.post<Gasto>("/gastos", payload, token);
        setGastos((prev) => [...prev, created]);
      }
      setShowGastoForm(false);
      setEditingGastoId(null);
      setGastoForm(EMPTY_GASTO_FORM);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEditGasto = (g: Gasto) => {
    setGastoForm({
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: String(g.monto),
      moneda: g.moneda,
      fecha: g.fecha,
      notas: g.notas ?? "",
    });
    setEditingGastoId(g.id);
    setShowGastoForm(true);
    setError("");
  };

  const handleDeleteGasto = async (id: string) => {
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

  // ── Plantilla form ──

  const handlePlantillaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...plantillaForm,
        dia_del_mes: Number(plantillaForm.dia_del_mes),
        notas: plantillaForm.notas || undefined,
      };
      if (editingPlantillaId) {
        const updated = await api.patch<GastoPlantilla>(`/gastos/plantillas/${editingPlantillaId}`, payload, token);
        setPlantillas((prev) => prev.map((p) => (p.id === editingPlantillaId ? updated : p)));
      } else {
        const created = await api.post<GastoPlantilla>("/gastos/plantillas", payload, token);
        setPlantillas((prev) => [...prev, created]);
      }
      setShowPlantillaForm(false);
      setEditingPlantillaId(null);
      setPlantillaForm(EMPTY_PLANTILLA_FORM);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlantilla = (p: GastoPlantilla) => {
    setPlantillaForm({
      descripcion: p.descripcion,
      categoria: p.categoria,
      monto_esperado: String(p.monto_esperado),
      moneda: p.moneda,
      dia_del_mes: String(p.dia_del_mes),
      notas: p.notas ?? "",
    });
    setEditingPlantillaId(p.id);
    setShowPlantillaForm(true);
    setError("");
  };

  const handleDeletePlantilla = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await api.delete(`/gastos/plantillas/${id}`, token);
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
      fetchGastos();
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActiva = async (p: GastoPlantilla) => {
    if (!token) return;
    try {
      const updated = await api.patch<GastoPlantilla>(`/gastos/plantillas/${p.id}`, { activa: !p.activa }, token);
      setPlantillas((prev) => prev.map((pl) => (pl.id === p.id ? updated : pl)));
    } catch {}
  };

  // ── Confirmar gasto ──

  const openConfirmar = (g: Gasto) => {
    setConfirmModal({ gastoId: g.id, montoEsperado: Number(g.monto), moneda: g.moneda });
    setConfirmMonto(String(g.monto));
  };

  const handleConfirmar = async () => {
    if (!token || !confirmModal) return;
    setConfirmandoId(confirmModal.gastoId);
    try {
      const body: Record<string, unknown> = {};
      const montoNum = parseFloat(confirmMonto);
      if (!isNaN(montoNum) && montoNum !== confirmModal.montoEsperado) {
        body.monto_real = confirmMonto;
      }
      const updated = await api.post<Gasto>(`/gastos/${confirmModal.gastoId}/confirmar`, body, token);
      setGastos((prev) => prev.map((g) => (g.id === confirmModal.gastoId ? updated : g)));
      setConfirmModal(null);
    } catch {
    } finally {
      setConfirmandoId(null);
    }
  };

  // ── Navigation ──

  const goPrev = () => {
    const { mes: m, anio: a } = prevMes(mes, anio);
    setMes(m); setAnio(a);
  };
  const goNext = () => {
    const { mes: m, anio: a } = nextMes(mes, anio);
    setMes(m); setAnio(a);
  };
  const isCurrentMonth = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  return (
    <div className="space-y-6 pb-20 lg:pb-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Contable</h1>
          <p className="text-sm text-ink-400 mt-0.5">Gastos y costos del estudio</p>
        </div>
        <PageHelp
          title="Módulo Contable"
          description="Controlá los gastos del estudio con periodicidad mensual"
          items={[
            { icon: "🔄", title: "Gastos recurrentes", description: "Definí plantillas para gastos mensuales fijos (alquiler, sueldos). Se generan automáticamente cada mes y te pedirán confirmación." },
            { icon: "💸", title: "Gastos puntuales", description: "Registrá cualquier gasto no programado en cualquier momento." },
            { icon: "🟢", title: "Semáforo", description: "Rojo = pendiente de confirmar. Verde = confirmado. Solo los confirmados cuentan en los totales." },
            { icon: "📅", title: "Navegación por período", description: "Usá las flechas para ver y gestionar gastos de cualquier mes." },
          ]}
          tip="Los gastos confirmados alimentan el widget financiero del dashboard."
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("periodo")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tab === "periodo" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
        >
          Período
          {pendientesCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
              {pendientesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("plantillas")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tab === "plantillas" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
        >
          Plantillas recurrentes
          <span className="ml-1.5 text-xs text-ink-400">({plantillas.length})</span>
        </button>
      </div>

      {/* ══ TAB: PERÍODO ══ */}
      {tab === "periodo" && (
        <div className="space-y-5">

          {/* Navegación de mes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goPrev} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-600 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-base font-semibold text-ink-900 capitalize min-w-[160px] text-center">
                {periodoLabel(mes, anio)}
              </span>
              <button onClick={goNext} disabled={isCurrentMonth} className="p-2 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-600 transition disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isCurrentMonth && (
                <button onClick={() => { setMes(hoy.getMonth() + 1); setAnio(hoy.getFullYear()); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Hoy
                </button>
              )}
            </div>

            <button
              onClick={() => { setShowGastoForm(true); setEditingGastoId(null); setGastoForm({ ...EMPTY_GASTO_FORM, fecha: `${anio}-${String(mes).padStart(2, "0")}-01` }); setError(""); }}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo gasto
            </button>
          </div>

          {/* Totales del período */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
              <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-1">Total ARS</p>
              <p className="text-xl font-bold text-ink-900">
                {loadingGastos ? <span className="inline-block w-24 h-6 bg-ink-100 rounded animate-pulse" /> : `$ ${confirmadosARS.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">confirmados</p>
            </div>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
              <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-1">Total USD</p>
              <p className="text-xl font-bold text-ink-900">
                {loadingGastos ? <span className="inline-block w-24 h-6 bg-ink-100 rounded animate-pulse" /> : `U$D ${confirmadosUSD.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">confirmados</p>
            </div>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
              <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-1">Pendientes</p>
              <p className={`text-xl font-bold ${pendientesCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {loadingGastos ? <span className="inline-block w-10 h-6 bg-ink-100 rounded animate-pulse" /> : pendientesCount}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">por confirmar</p>
            </div>
          </div>

          {/* Formulario gasto puntual */}
          {showGastoForm && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 max-w-2xl">
              <h2 className="text-base font-semibold text-ink-900 mb-4">{editingGastoId ? "Editar gasto" : "Nuevo gasto puntual"}</h2>
              {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
              <form onSubmit={handleGastoSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                    <input required value={gastoForm.descripcion} onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Reparación impresora" />
                  </div>
                  <div>
                    <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                    <select required value={gastoForm.categoria} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                      {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Fecha <span className="text-red-500">*</span></label>
                    <input required type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Monto <span className="text-red-500">*</span></label>
                    <input required type="number" step="0.01" min="0" value={gastoForm.monto} onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })} className={inputClass} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda</label>
                    <select value={gastoForm.moneda} onChange={(e) => setGastoForm({ ...gastoForm, moneda: e.target.value as Moneda })} className={inputClass}>
                      <option value="ARS">ARS — Peso</option>
                      <option value="USD">USD — Dólar</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notas</label>
                    <input value={gastoForm.notas} onChange={(e) => setGastoForm({ ...gastoForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowGastoForm(false); setEditingGastoId(null); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">
                    {saving ? "Guardando…" : editingGastoId ? "Guardar cambios" : "Registrar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sección: Recurrentes del mes */}
          {(loadingGastos || recurrentes.length > 0) && (
            <section>
              <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Recurrentes</h2>
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                {loadingGastos ? (
                  <div className="divide-y divide-ink-50">
                    {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : (
                  <div className="divide-y divide-ink-50">
                    {recurrentes.map((g) => {
                      const cfg = ESTADO_CONFIG[g.estado];
                      return (
                        <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                          {/* Semáforo */}
                          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {/* Categoría */}
                          <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIA_COLORS[g.categoria]}`}>
                            {catLabel(g.categoria)}
                          </span>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink-900 font-medium truncate">{g.descripcion}</p>
                            <p className="text-xs text-ink-400">
                              {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                          {/* Monto */}
                          <span className="text-sm font-semibold text-ink-900 flex-shrink-0">
                            {formatMoney(Number(g.monto), g.moneda)}
                          </span>
                          {/* Acciones */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {g.estado === "pendiente" && (
                              <button
                                onClick={() => openConfirmar(g)}
                                className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-100 px-3 py-1.5 rounded-lg transition"
                              >
                                Confirmar
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteGasto(g.id)}
                              disabled={deletingId === g.id}
                              className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                            >
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
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Sección: Puntuales del mes */}
          <section>
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Puntuales</h2>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
              {loadingGastos ? (
                <div className="divide-y divide-ink-50">
                  {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
                </div>
              ) : puntuales.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-ink-400">Sin gastos puntuales en este período</p>
                  <button
                    onClick={() => { setShowGastoForm(true); setEditingGastoId(null); setGastoForm({ ...EMPTY_GASTO_FORM, fecha: `${anio}-${String(mes).padStart(2, "0")}-01` }); setError(""); }}
                    className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Registrar uno →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-ink-50">
                  {puntuales.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIA_COLORS[g.categoria]}`}>
                        {catLabel(g.categoria)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 font-medium truncate">{g.descripcion}</p>
                        <p className="text-xs text-ink-400">
                          {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-ink-900 flex-shrink-0">
                        {formatMoney(Number(g.monto), g.moneda)}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleEditGasto(g)} className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg hover:bg-ink-50 transition">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteGasto(g.id)} disabled={deletingId === g.id} className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
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
          </section>
        </div>
      )}

      {/* ══ TAB: PLANTILLAS ══ */}
      {tab === "plantillas" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Las plantillas activas generan instancias automáticamente al inicio de cada mes.
            </p>
            <button
              onClick={() => { setShowPlantillaForm(true); setEditingPlantillaId(null); setPlantillaForm(EMPTY_PLANTILLA_FORM); setError(""); }}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nueva plantilla
            </button>
          </div>

          {/* Formulario plantilla */}
          {showPlantillaForm && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 max-w-2xl">
              <h2 className="text-base font-semibold text-ink-900 mb-4">{editingPlantillaId ? "Editar plantilla" : "Nueva plantilla recurrente"}</h2>
              {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
              <form onSubmit={handlePlantillaSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                    <input required value={plantillaForm.descripcion} onChange={(e) => setPlantillaForm({ ...plantillaForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Alquiler oficina" />
                  </div>
                  <div>
                    <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                    <select required value={plantillaForm.categoria} onChange={(e) => setPlantillaForm({ ...plantillaForm, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                      {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Día del mes</label>
                    <input type="number" min="1" max="28" value={plantillaForm.dia_del_mes} onChange={(e) => setPlantillaForm({ ...plantillaForm, dia_del_mes: e.target.value })} className={inputClass} />
                    <p className="text-xs text-ink-400 mt-1">Máx. 28 para evitar problemas en febrero.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Monto esperado <span className="text-red-500">*</span></label>
                    <input required type="number" step="0.01" min="0" value={plantillaForm.monto_esperado} onChange={(e) => setPlantillaForm({ ...plantillaForm, monto_esperado: e.target.value })} className={inputClass} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelClass}>Moneda</label>
                    <select value={plantillaForm.moneda} onChange={(e) => setPlantillaForm({ ...plantillaForm, moneda: e.target.value as Moneda })} className={inputClass}>
                      <option value="ARS">ARS — Peso</option>
                      <option value="USD">USD — Dólar</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notas</label>
                    <input value={plantillaForm.notas} onChange={(e) => setPlantillaForm({ ...plantillaForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowPlantillaForm(false); setEditingPlantillaId(null); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">
                    {saving ? "Guardando…" : editingPlantillaId ? "Guardar cambios" : "Crear plantilla"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista plantillas */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            {loadingPlantillas ? (
              <div className="divide-y divide-ink-50">
                {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : plantillas.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">🔄</p>
                <p className="text-sm font-medium text-ink-700 mb-1">Sin plantillas aún</p>
                <p className="text-xs text-ink-400 mb-3">Creá plantillas para gastos fijos mensuales como alquiler o sueldos.</p>
                <button
                  onClick={() => { setShowPlantillaForm(true); setError(""); }}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Crear primera plantilla →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {plantillas.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                    {/* Activa toggle */}
                    <button
                      onClick={() => handleToggleActiva(p)}
                      title={p.activa ? "Desactivar" : "Activar"}
                      className={`flex-shrink-0 w-8 h-5 rounded-full transition ${p.activa ? "bg-brand-500" : "bg-ink-200"} relative`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${p.activa ? "translate-x-3" : "translate-x-0.5"}`} />
                    </button>

                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIA_COLORS[p.categoria]}`}>
                      {catLabel(p.categoria)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${p.activa ? "text-ink-900" : "text-ink-400 line-through"}`}>{p.descripcion}</p>
                      <p className="text-xs text-ink-400">Día {p.dia_del_mes} de cada mes</p>
                    </div>

                    <span className="text-sm font-semibold text-ink-900 flex-shrink-0">
                      {formatMoney(Number(p.monto_esperado), p.moneda)}
                    </span>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleEditPlantilla(p)} className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg hover:bg-ink-50 transition">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeletePlantilla(p.id)} disabled={deletingId === p.id} className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                        {deletingId === p.id ? (
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
      )}

      {/* ══ MODAL: Confirmar gasto recurrente ══ */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-ink-900 mb-1">Confirmar gasto</h3>
            <p className="text-sm text-ink-500 mb-4">
              Monto esperado: <span className="font-semibold text-ink-800">{formatMoney(confirmModal.montoEsperado, confirmModal.moneda)}</span>. Si el monto real fue diferente, modificalo.
            </p>
            <div className="mb-4">
              <label className={labelClass}>Monto real ({confirmModal.moneda})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={confirmMonto}
                onChange={(e) => setConfirmMonto(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={!!confirmandoId}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
              >
                {confirmandoId ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
