"use client";

import { DateInput } from "@/components/ui/date-input";
import { todayAR } from "@/lib/date";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api, Gasto, GastoPlantilla, GastoCategoria, GastoEstado, Ingreso, IngresoCategoria, Moneda, Expediente, Cliente } from "@/lib/api";
import { ContableHero } from "@/components/features/contable-hero";
import { PageHelp } from "@/components/ui/page-help";
import { SortButton, SortModal, SortOption } from "@/components/ui/sort-modal";

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

const today = todayAR();

const EMPTY_GASTO_FORM = {
  descripcion: "",
  categoria: "otros" as GastoCategoria,
  monto: "",
  moneda: "ARS" as Moneda,
  fecha: today,
  notas: "",
  cliente_id: "",
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
  "w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
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
  const [vistaAnual, setVistaAnual] = useState(false);

  // Data
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [plantillas, setPlantillas] = useState<GastoPlantilla[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loadingIngresos, setLoadingIngresos] = useState(false);
  const [ingresosFetched, setIngresosFetched] = useState(false);
  const [loadingGastos, setLoadingGastos] = useState(true);
  const [loadingPlantillas, setLoadingPlantillas] = useState(true);
  const [honorariosPendientesARS, setHonorariosPendientesARS] = useState<number | null>(null);

  // Expedientes para selector de ingresos
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token, { estado: "activo" }).then(setExpedientes).catch(() => {});
    api.get<Cliente[]>("/clientes", token).then((cls) => setClientes(cls.filter(c => !c.archivado))).catch(() => {});
  }, [token]);

  // Ingresos form
  const EMPTY_INGRESO_FORM = { descripcion: "", categoria: "otros" as IngresoCategoria, monto: "", moneda: "ARS" as Moneda, fecha: today, notas: "", expediente_id: "", cliente_id: "" };
  const [ingresoForm, setIngresoForm] = useState(EMPTY_INGRESO_FORM);
  const [showIngresoForm, setShowIngresoForm] = useState(false);
  const [editingIngresoId, setEditingIngresoId] = useState<string | null>(null);

  const CATEGORIAS_INGRESO: { value: IngresoCategoria; label: string }[] = [
    { value: "honorarios_cobrados", label: "Honorarios cobrados" },
    { value: "reintegros", label: "Reintegros" },
    { value: "consultas", label: "Consultas" },
    { value: "otros", label: "Otros" },
  ];

  const INGRESO_COLORS: Record<IngresoCategoria, string> = {
    honorarios_cobrados: "bg-green-100 text-green-700",
    reintegros: "bg-teal-100 text-teal-700",
    consultas: "bg-blue-100 text-blue-700",
    otros: "bg-ink-100 text-ink-600",
  };

  // UI state
  const [tab, setTab] = useState<"periodo" | "ingresos">("periodo");
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [gastoTipo, setGastoTipo] = useState<"puntual" | "recurrente">("puntual");
  const [showMesPicker, setShowMesPicker] = useState(false);
  const [pickerAnio, setPickerAnio] = useState(hoy.getFullYear());
  const [showPlantillaForm, setShowPlantillaForm] = useState(false);
  const [showPlantillasPanel, setShowPlantillasPanel] = useState(false);
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);
  const [editingPlantillaId, setEditingPlantillaId] = useState<string | null>(null);
  const [gastoForm, setGastoForm] = useState(EMPTY_GASTO_FORM);
  const [plantillaForm, setPlantillaForm] = useState(EMPTY_PLANTILLA_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort
  type GastoSortKey = "fecha" | "monto" | "descripcion" | "categoria";
  const [sortKey, setSortKey] = useState<GastoSortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sortOpen, setSortOpen] = useState(false);

  const GASTO_SORT_OPTIONS: SortOption<GastoSortKey>[] = [
    { key: "fecha", label: "Fecha", icon: "📅" },
    { key: "monto", label: "Monto", icon: "💰" },
    { key: "descripcion", label: "Descripción", icon: "📝" },
    { key: "categoria", label: "Categoría", icon: "🏷️" },
  ];

  function sortGastos(list: Gasto[]) {
    return [...list].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "fecha") return mul * a.fecha.localeCompare(b.fecha);
      if (sortKey === "monto") return mul * (Number(a.monto) - Number(b.monto));
      if (sortKey === "descripcion") return mul * a.descripcion.localeCompare(b.descripcion, "es");
      if (sortKey === "categoria") return mul * a.categoria.localeCompare(b.categoria, "es");
      return 0;
    });
  }

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
      .get<Gasto[]>("/gastos", token, vistaAnual ? { anio } : { mes, anio })
      .then(setGastos)
      .catch(() => {})
      .finally(() => setLoadingGastos(false));
  }, [token, mes, anio, vistaAnual]);

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
  useEffect(() => {
    if (!token) return;
    api.get<{ saldo_pendiente_ars: number; saldo_pendiente_usd: number; expedientes_con_deuda: number }>("/honorarios/resumen", token)
      .then((r) => setHonorariosPendientesARS(Number(r.saldo_pendiente_ars)))
      .catch(() => {});
  }, [token]);
  useEffect(() => {
    if (!showMesPicker) return;
    const handler = () => setShowMesPicker(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showMesPicker]);

  const fetchIngresos = useCallback(() => {
    if (!token) return;
    setLoadingIngresos(true);
    api.get<Ingreso[]>("/ingresos", token, vistaAnual ? { anio } : { mes, anio })
      .then(setIngresos)
      .catch(() => {})
      .finally(() => { setLoadingIngresos(false); setIngresosFetched(true); });
  }, [token, mes, anio, vistaAnual]);

  useEffect(() => { fetchIngresos(); }, [fetchIngresos]);

  // Derived
  const recurrentes = gastos.filter((g) => g.plantilla_id);
  const puntuales = gastos.filter((g) => !g.plantilla_id);
  const pendientesCount = recurrentes.filter((g) => g.estado === "pendiente").length;

  const confirmadosARS = gastos.filter((g) => g.estado === "confirmado" && g.moneda === "ARS").reduce((s, g) => s + Number(g.monto), 0);
  const confirmadosUSD = gastos.filter((g) => g.estado === "confirmado" && g.moneda === "USD").reduce((s, g) => s + Number(g.monto), 0);

  // ── Totales ingresos ──
  const ingresosARS = ingresos.filter((i) => i.moneda === "ARS").reduce((s, i) => s + Number(i.monto), 0);
  const ingresosUSD = ingresos.filter((i) => i.moneda === "USD").reduce((s, i) => s + Number(i.monto), 0);

  const handleIngresoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!ingresoForm.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(ingresoForm.fecha)) {
      setError("La fecha es obligatoria. Usá el formato DD/MM/AAAA.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...ingresoForm, monto: ingresoForm.monto, notas: ingresoForm.notas || undefined, expediente_id: ingresoForm.expediente_id || undefined, cliente_id: ingresoForm.cliente_id || undefined };
      if (editingIngresoId) {
        const updated = await api.patch<Ingreso>(`/ingresos/${editingIngresoId}`, payload, token);
        setIngresos((prev) => prev.map((i) => (i.id === editingIngresoId ? updated : i)));
      } else {
        const created = await api.post<Ingreso>("/ingresos", payload, token);
        setIngresos((prev) => [created, ...prev]);
      }
      setShowIngresoForm(false);
      setEditingIngresoId(null);
      setIngresoForm(EMPTY_INGRESO_FORM);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIngreso = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await api.delete(`/ingresos/${id}`, token);
      setIngresos((prev) => prev.filter((i) => i.id !== id));
    } catch { } finally { setDeletingId(null); }
  };

  // ── Gastos puntual form ──

  const handleGastoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!gastoForm.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(gastoForm.fecha)) {
      setError("La fecha es obligatoria. Usá el formato DD/MM/AAAA.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...gastoForm,
        monto: gastoForm.monto,
        notas: gastoForm.notas || undefined,
        cliente_id: gastoForm.cliente_id || undefined,
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
      cliente_id: g.cliente_id ?? "",
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
      setShowGastoForm(false);
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
    if (vistaAnual) { setAnio(a => a - 1); return; }
    const { mes: m, anio: a } = prevMes(mes, anio);
    setMes(m); setAnio(a);
  };
  const goNext = () => {
    if (vistaAnual) { setAnio(a => a + 1); return; }
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
          description="Controlá egresos e ingresos del estudio mes a mes. Los totales alimentan el dashboard financiero."
          items={[
            { icon: "💸", title: "Gastos", description: "Registrá cualquier gasto del estudio: alquiler, sueldos, servicios, costos judiciales, honorarios a terceros. Podés vincularlo a un expediente para ver el costo del caso." },
            { icon: "🟢", title: "Confirmado vs pendiente", description: "Pendiente (naranja) = gasto previsto pero no ejecutado. Confirmado (verde) = pagado. Solo los confirmados se suman a los totales del período." },
            { icon: "💵", title: "Monedas ARS / USD", description: "Podés registrar gastos en pesos o dólares. Los KPIs del dashboard muestran los totales por moneda por separado." },
            { icon: "📋", title: "Ingresos", description: "Registrá ingresos que no son honorarios de expedientes: consultas, asesoramiento externo, retenciones. También se pueden vincular a un expediente." },
            { icon: "📅", title: "Navegación por período", description: "Usá las flechas para ver y editar gastos e ingresos de cualquier mes histórico." },
          ]}
          tip="Asociar un gasto a un expediente te permite ver el costo real de cada caso en el detalle del expediente."
        />
      </div>

      {/* ── Hero financiero ── */}
      {token && <ContableHero token={token} />}

      {/* ── Barra de control unificada ── */}
      <div className="bg-white border border-ink-100 rounded-2xl shadow-sm overflow-hidden">
        {/* CTAs + Período: una fila en desktop, dos en mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 sm:pb-3">
            <button
              onClick={() => { setShowGastoForm(true); setEditingGastoId(null); setGastoTipo("puntual"); setGastoForm({ ...EMPTY_GASTO_FORM, fecha: `${anio}-${String(mes).padStart(2, "0")}-01` }); setError(""); }}
              className="sm:flex-none flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              <span>Egreso</span>
              {pendientesCount > 0 && <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-white/30 rounded-full">{pendientesCount}</span>}
            </button>
            <button
              onClick={() => { setShowIngresoForm(true); setEditingIngresoId(null); setIngresoForm({ ...EMPTY_INGRESO_FORM, fecha: `${anio}-${String(mes).padStart(2, "0")}-01` }); setError(""); }}
              className="sm:flex-none flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              <span>Ingreso</span>
            </button>
          </div>

        {/* Período */}
        <div className="flex items-center justify-between sm:justify-end px-4 pb-3 sm:pt-3 border-t sm:border-t-0 border-ink-50 pt-2 gap-2">
          {/* Toggle Mes/Año */}
          <div className="flex gap-1 bg-ink-100 rounded-lg p-0.5">
            <button onClick={() => setVistaAnual(false)} className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${!vistaAnual ? "bg-white text-ink-800 shadow-sm" : "text-ink-400 hover:text-ink-600"}`}>Mes</button>
            <button onClick={() => setVistaAnual(true)} className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${vistaAnual ? "bg-white text-ink-800 shadow-sm" : "text-ink-400 hover:text-ink-600"}`}>Año</button>
          </div>
          <div className="flex items-center gap-1">
            {/* Navegación */}
            <div className="flex items-center gap-1">
              <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              {/* Label clickeable → picker de mes/año */}
              <div className="relative">
                <button
                  onClick={() => { setPickerAnio(anio); setShowMesPicker((v) => !v); }}
                  className="text-sm font-semibold text-ink-900 min-w-[110px] text-center capitalize hover:text-brand-600 transition px-1 py-0.5 rounded-lg hover:bg-brand-50"
                >
                  {vistaAnual ? String(anio) : periodoLabel(mes, anio)} ▾
                </button>
                {showMesPicker && !vistaAnual && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-ink-100 p-3 w-56" onClick={(e) => e.stopPropagation()}>
                    {/* Selector de año */}
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setPickerAnio((y) => y - 1)} className="p-1 rounded-lg hover:bg-ink-50 text-ink-500 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-sm font-bold text-ink-900">{pickerAnio}</span>
                      <button onClick={() => setPickerAnio((y) => Math.min(y + 1, hoy.getFullYear()))} disabled={pickerAnio >= hoy.getFullYear()} className="p-1 rounded-lg hover:bg-ink-50 text-ink-500 transition disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    {/* Grilla de meses */}
                    <div className="grid grid-cols-4 gap-1">
                      {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => {
                        const mNum = i + 1;
                        const esFuturo = pickerAnio === hoy.getFullYear() && mNum > hoy.getMonth() + 1;
                        const esActual = mNum === mes && pickerAnio === anio;
                        return (
                          <button
                            key={m}
                            disabled={esFuturo}
                            onClick={() => { setMes(mNum); setAnio(pickerAnio); setShowMesPicker(false); }}
                            className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                              esActual ? "bg-brand-600 text-white" :
                              esFuturo ? "text-ink-200 cursor-default" :
                              "hover:bg-brand-50 text-ink-700 hover:text-brand-600"
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={goNext} disabled={!vistaAnual && isCurrentMonth} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 transition disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
              {!isCurrentMonth && !vistaAnual && (
                <button onClick={() => { setMes(hoy.getMonth() + 1); setAnio(hoy.getFullYear()); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2">
                  Hoy
                </button>
              )}
            </div>
          </div>
          </div>{/* fin flex-col */}
        </div>
      </div>{/* fin barra de control */}

      {/* ══ EGRESOS + INGRESOS ══ */}
      <div className="space-y-8">

          {/* Acciones egresos */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider flex items-center gap-2">
              Egresos
              {pendientesCount > 0 && <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">{pendientesCount} pendientes</span>}
            </h2>
            <div className="relative">
              <SortButton open={sortOpen} onToggle={() => setSortOpen((o) => !o)} />
              {sortOpen && (
                <SortModal
                  options={GASTO_SORT_OPTIONS}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
                  onClose={() => setSortOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Totales del período */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm grid grid-cols-3 divide-x divide-ink-100">
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">Egresos ARS</p>
              <p className="text-sm sm:text-xl font-bold text-ink-900 truncate">
                {loadingGastos ? <span className="inline-block w-16 h-5 bg-ink-100 rounded animate-pulse" /> : `$${confirmadosARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
              </p>
              <p className="text-[10px] text-ink-400 mt-0.5 hidden sm:block">confirmados</p>
            </div>
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">Egresos USD</p>
              <p className="text-sm sm:text-xl font-bold text-ink-900 truncate">
                {loadingGastos ? <span className="inline-block w-16 h-5 bg-ink-100 rounded animate-pulse" /> : `U$D${confirmadosUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
              </p>
              <p className="text-[10px] text-ink-400 mt-0.5 hidden sm:block">confirmados</p>
            </div>
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">Hon. pend.</p>
              <p className="text-sm sm:text-xl font-bold text-amber-600 truncate">
                {honorariosPendientesARS === null
                  ? <span className="inline-block w-16 h-5 bg-ink-100 rounded animate-pulse" />
                  : `$${honorariosPendientesARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
              </p>
              <p className="text-[10px] text-ink-400 mt-0.5 hidden sm:block">honorarios a cobrar</p>
            </div>
          </div>


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
                    {sortGastos(recurrentes).map((g) => {
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
                    onClick={() => { setShowGastoForm(true); setEditingGastoId(null); setGastoTipo("puntual"); setGastoForm({ ...EMPTY_GASTO_FORM, fecha: `${anio}-${String(mes).padStart(2, "0")}-01` }); setError(""); }}
                    className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Registrar uno →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-ink-50">
                  {sortGastos(puntuales).map((g) => (
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

        {/* ══ INGRESOS ══ */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Ingresos</h2>

          {/* Totales */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm grid grid-cols-3 divide-x divide-ink-100">
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">ARS</p>
              <p className="text-sm sm:text-xl font-bold text-green-700 truncate">{loadingIngresos ? <span className="inline-block w-16 h-5 bg-ink-100 rounded animate-pulse" /> : `$${ingresosARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}</p>
            </div>
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">USD</p>
              <p className="text-sm sm:text-xl font-bold text-green-700 truncate">{loadingIngresos ? <span className="inline-block w-16 h-5 bg-ink-100 rounded animate-pulse" /> : `U$D${ingresosUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}</p>
            </div>
            <div className="px-3 py-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-ink-400 uppercase tracking-wider font-medium mb-1 truncate">Registros</p>
              <p className="text-sm sm:text-xl font-bold text-ink-900 truncate">{loadingIngresos ? <span className="inline-block w-6 h-5 bg-ink-100 rounded animate-pulse" /> : ingresos.length}</p>
            </div>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            {loadingIngresos ? (
              <div className="divide-y divide-ink-50">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : ingresos.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-ink-400">Sin ingresos registrados en este período</p>
                <button onClick={() => { setShowIngresoForm(true); setError(""); }} className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium">Registrar el primero →</button>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {sortGastos(ingresos as unknown as Gasto[]).map((raw) => {
                  const i = raw as unknown as Ingreso;
                  const catLabel = CATEGORIAS_INGRESO.find((c) => c.value === i.categoria)?.label ?? i.categoria;
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${INGRESO_COLORS[i.categoria]}`}>{catLabel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 font-medium truncate">{i.descripcion}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-ink-400">{new Date(i.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</p>
                          {i.expediente_id && (() => {
                            const exp = expedientes.find(e => e.id === i.expediente_id);
                            return exp ? <span className="text-xs font-mono text-ink-500 bg-ink-50 border border-ink-100 rounded px-1.5 py-0.5">{exp.numero}</span> : null;
                          })()}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-green-700 flex-shrink-0">{formatMoney(Number(i.monto), i.moneda)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { setIngresoForm({ descripcion: i.descripcion, categoria: i.categoria, monto: String(i.monto), moneda: i.moneda, fecha: i.fecha, notas: i.notas ?? "", expediente_id: i.expediente_id ?? "", cliente_id: i.cliente_id ?? "" }); setEditingIngresoId(i.id); setShowIngresoForm(true); setError(""); }} className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg hover:bg-ink-50 transition">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteIngreso(i.id)} disabled={deletingId === i.id} className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                          {deletingId === i.id ? <span className="w-3.5 h-3.5 block rounded-full border-2 border-red-300 border-t-transparent animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>{/* fin space-y-8 */}

      {/* ══ MODAL: Gasto puntual ══ */}
      {showGastoForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowGastoForm(false); setEditingGastoId(null); setError(""); } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">{editingGastoId ? "Editar gasto" : "Nuevo egreso"}</h2>
              <button onClick={() => { setShowGastoForm(false); setEditingGastoId(null); setError(""); }} className="text-ink-400 hover:text-ink-700 transition p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Switch Puntual / Recurrente — solo al crear */}
            {!editingGastoId && (
              <div className="px-6 pt-4 pb-0">
                <div className="flex gap-1 bg-ink-100 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => { setGastoTipo("puntual"); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${gastoTipo === "puntual" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
                  >
                    Puntual
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGastoTipo("recurrente"); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${gastoTipo === "recurrente" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}
                  >
                    🔄 Recurrente
                  </button>
                </div>
                {gastoTipo === "recurrente" && (
                  <p className="text-xs text-ink-400 mt-2 px-1">Se genera automáticamente cada mes en el día indicado.</p>
                )}
              </div>
            )}

            {/* Formulario Puntual */}
            {(gastoTipo === "puntual" || editingGastoId) && (
              <form onSubmit={handleGastoSubmit} className="px-6 py-5 space-y-4">
                {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
                <div>
                  <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                  <input required autoFocus value={gastoForm.descripcion} onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Reparación impresora" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                    <select required value={gastoForm.categoria} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                      {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Fecha <span className="text-red-500">*</span></label>
                    <DateInput value={gastoForm.fecha} onChange={v => setGastoForm({ ...gastoForm, fecha: v })} required />
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
                </div>
                <div>
                  <label className={labelClass}>Cliente <span className="text-ink-400 font-normal">(opcional)</span></label>
                  <select value={gastoForm.cliente_id} onChange={(e) => setGastoForm({ ...gastoForm, cliente_id: e.target.value })} className={inputClass}>
                    <option value="">Sin cliente asociado</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Notas</label>
                  <input value={gastoForm.notas} onChange={(e) => setGastoForm({ ...gastoForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowGastoForm(false); setEditingGastoId(null); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-3 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-3 text-sm font-semibold transition shadow-sm disabled:opacity-50">{saving ? "Guardando…" : editingGastoId ? "Guardar cambios" : "Registrar"}</button>
                </div>
              </form>
            )}

            {/* Formulario Recurrente */}
            {gastoTipo === "recurrente" && !editingGastoId && (
              <form onSubmit={handlePlantillaSubmit} className="px-6 py-5 space-y-4">
                {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
                <div>
                  <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                  <input required autoFocus value={plantillaForm.descripcion} onChange={(e) => setPlantillaForm({ ...plantillaForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Alquiler oficina" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                    <select required value={plantillaForm.categoria} onChange={(e) => setPlantillaForm({ ...plantillaForm, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                      {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Día del mes</label>
                    <select value={plantillaForm.dia_del_mes} onChange={(e) => setPlantillaForm({ ...plantillaForm, dia_del_mes: e.target.value })} className={inputClass}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>Día {d}</option>
                      ))}
                      <option value="0">Último día del mes</option>
                    </select>
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
                </div>
                <div>
                  <label className={labelClass}>Notas</label>
                  <input value={plantillaForm.notas} onChange={(e) => setPlantillaForm({ ...plantillaForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowGastoForm(false); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-3 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-3 text-sm font-semibold transition shadow-sm disabled:opacity-50">{saving ? "Guardando…" : "Crear recurrente"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL: Ingreso ══ */}
      {showIngresoForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowIngresoForm(false); setEditingIngresoId(null); setError(""); } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">{editingIngresoId ? "Editar ingreso" : "Registrar ingreso"}</h2>
              <button onClick={() => { setShowIngresoForm(false); setEditingIngresoId(null); setError(""); }} className="text-ink-400 hover:text-ink-700 transition p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleIngresoSubmit} className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <div>
                <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                <input required autoFocus value={ingresoForm.descripcion} onChange={(e) => setIngresoForm({ ...ingresoForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Pago honorarios García" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                  <select required value={ingresoForm.categoria} onChange={(e) => setIngresoForm({ ...ingresoForm, categoria: e.target.value as IngresoCategoria })} className={inputClass}>
                    {CATEGORIAS_INGRESO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Fecha <span className="text-red-500">*</span></label>
                  <DateInput value={ingresoForm.fecha} onChange={v => setIngresoForm({ ...ingresoForm, fecha: v })} required />
                </div>
                <div>
                  <label className={labelClass}>Monto <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.01" min="0" value={ingresoForm.monto} onChange={(e) => setIngresoForm({ ...ingresoForm, monto: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>Moneda</label>
                  <select value={ingresoForm.moneda} onChange={(e) => setIngresoForm({ ...ingresoForm, moneda: e.target.value as Moneda })} className={inputClass}>
                    <option value="ARS">ARS — Peso</option>
                    <option value="USD">USD — Dólar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Cliente <span className="text-ink-400 font-normal">(opcional)</span></label>
                <select value={ingresoForm.cliente_id} onChange={(e) => setIngresoForm({ ...ingresoForm, cliente_id: e.target.value })} className={inputClass}>
                  <option value="">Sin cliente asociado</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Expediente <span className="text-ink-400 font-normal">(opcional)</span></label>
                <select value={ingresoForm.expediente_id} onChange={(e) => setIngresoForm({ ...ingresoForm, expediente_id: e.target.value })} className={inputClass}>
                  <option value="">Sin expediente asociado</option>
                  {expedientes.map((exp) => <option key={exp.id} value={exp.id}>{exp.numero} — {exp.caratula}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Notas</label>
                <input value={ingresoForm.notas} onChange={(e) => setIngresoForm({ ...ingresoForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowIngresoForm(false); setEditingIngresoId(null); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">{saving ? "Guardando…" : editingIngresoId ? "Guardar" : "Registrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: Plantilla recurrente ══ */}
      {showPlantillaForm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowPlantillaForm(false); setEditingPlantillaId(null); setError(""); } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">{editingPlantillaId ? "Editar plantilla" : "Nueva plantilla recurrente"}</h2>
              <button onClick={() => { setShowPlantillaForm(false); setEditingPlantillaId(null); setError(""); }} className="text-ink-400 hover:text-ink-700 transition p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handlePlantillaSubmit} className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <div>
                <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
                <input required autoFocus value={plantillaForm.descripcion} onChange={(e) => setPlantillaForm({ ...plantillaForm, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Alquiler oficina" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Categoría <span className="text-red-500">*</span></label>
                  <select required value={plantillaForm.categoria} onChange={(e) => setPlantillaForm({ ...plantillaForm, categoria: e.target.value as GastoCategoria })} className={inputClass}>
                    {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Día del mes</label>
                  <select value={plantillaForm.dia_del_mes} onChange={(e) => setPlantillaForm({ ...plantillaForm, dia_del_mes: e.target.value })} className={inputClass}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                    <option value="0">Último día del mes</option>
                  </select>
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
              </div>
              <div>
                <label className={labelClass}>Notas</label>
                <input value={plantillaForm.notas} onChange={(e) => setPlantillaForm({ ...plantillaForm, notas: e.target.value })} className={inputClass} placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowPlantillaForm(false); setEditingPlantillaId(null); setError(""); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">{saving ? "Guardando…" : editingPlantillaId ? "Guardar cambios" : "Crear plantilla"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: Panel de plantillas recurrentes ══ */}
      {showPlantillasPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPlantillasPanel(false); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Gastos recurrentes</h2>
                <p className="text-xs text-ink-400 mt-0.5">Se generan automáticamente al inicio de cada mes</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowPlantillaForm(true); setEditingPlantillaId(null); setPlantillaForm(EMPTY_PLANTILLA_FORM); setError(""); }} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-3 py-2 text-sm font-semibold transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Nueva
                </button>
                <button onClick={() => setShowPlantillasPanel(false)} className="text-ink-400 hover:text-ink-700 transition p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingPlantillas ? (
                <div className="divide-y divide-ink-50">{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : plantillas.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2">🔄</p>
                  <p className="text-sm font-medium text-ink-700 mb-1">Sin plantillas aún</p>
                  <p className="text-xs text-ink-400 mb-3">Creá plantillas para gastos fijos mensuales.</p>
                  <button onClick={() => { setShowPlantillaForm(true); setError(""); }} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Crear primera plantilla →</button>
                </div>
              ) : (
                <div className="divide-y divide-ink-50">
                  {plantillas.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                      <button onClick={() => handleToggleActiva(p)} title={p.activa ? "Desactivar" : "Activar"} className={`flex-shrink-0 w-8 h-5 rounded-full transition ${p.activa ? "bg-brand-500" : "bg-ink-200"} relative`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${p.activa ? "translate-x-3" : "translate-x-0.5"}`} />
                      </button>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORIA_COLORS[p.categoria]}`}>{catLabel(p.categoria)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${p.activa ? "text-ink-900" : "text-ink-400 line-through"}`}>{p.descripcion}</p>
                        <p className="text-xs text-ink-400">{p.dia_del_mes === 0 ? "Último día del mes" : `Día ${p.dia_del_mes}`} · {formatMoney(Number(p.monto_esperado), p.moneda)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { handleEditPlantilla(p); }} className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg hover:bg-ink-50 transition">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeletePlantilla(p.id)} disabled={deletingId === p.id} className="text-ink-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                          {deletingId === p.id ? <span className="w-3.5 h-3.5 block rounded-full border-2 border-red-300 border-t-transparent animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
