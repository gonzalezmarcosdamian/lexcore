"use client";

import { TimeInput } from "@/components/ui/time-input";

import { DateInput } from "@/components/ui/date-input";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, Vencimiento, HonorarioResumen, GastoResumen, IngresoResumen, Expediente, Cliente, Tarea, TareaTipo } from "@/lib/api";
import Link from "next/link";
import { PageHelp } from "@/components/ui/page-help";
import { SplashScreen } from "@/components/ui/splash-screen";
import { PeriodSelector, PeriodoValue, getDatesFromValue } from "@/components/ui/period-selector";
import { CalendarSyncButton } from "@/components/ui/calendar-sync-button";
import { CalEvent, DiaInhabil } from "@/components/ui/calendar-mensual";
import { ExpedienteSelect } from "@/components/ui/expediente-select";

const today = new Date().toISOString().split("T")[0];

function isUrgente(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 48 * 3600 * 1000;
}
function isWarning(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 7 * 24 * 3600 * 1000;
}
function isVencida(fecha: string) {
  return fecha < today;
}
function formatFecha(fecha: string) {
  if (fecha === today) return "Hoy";
  const d = new Date(fecha + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
function formatFechaLarga(fecha: string) {
  if (fecha === today) return "Hoy";
  const d = new Date(fecha + "T12:00:00");
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff === 1) return "Mañana";
  if (diff > 0 && diff <= 6) return d.toLocaleDateString("es-AR", { weekday: "long" });
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const router = useRouter();

  const [proximos, setProximos] = useState<Vencimiento[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTareas, setLoadingTareas] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [markingTarea, setMarkingTarea] = useState<string | null>(null);
  const [deletingV, setDeletingV] = useState<string | null>(null);
  const [deletingT, setDeletingT] = useState<string | null>(null);
  const [editingV, setEditingV] = useState<Vencimiento | null>(null);
  const [editingT, setEditingT] = useState<Tarea | null>(null);
  const [showNewTarea, setShowNewTarea] = useState(false);
  const [showNewVenc, setShowNewVenc] = useState(false);
  const [expLookup, setExpLookup] = useState<Record<string, Expediente>>({});
  const now = new Date();
  const [periodoValue, setPeriodoValue] = useState<PeriodoValue>({
    periodo: "anio",
    desde: `${now.getFullYear()}-01-01`,
    hasta: `${now.getFullYear()}-12-31`,
  });
  const [honorarios, setHonorarios] = useState<HonorarioResumen | null>(null);
  const [gastoResumen, setGastoResumen] = useState<GastoResumen | null>(null);
  const [ingresoResumen, setIngresoResumen] = useState<IngresoResumen | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const now4 = new Date();
  const [calMes, setCalMes] = useState(now4.getMonth() + 1);
  const [calAnio, setCalAnio] = useState(now4.getFullYear());
  const [inhabiles, setInhabiles] = useState<DiaInhabil[]>([]);
  const [diaPickerFecha, setDiaPickerFecha] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.get<Vencimiento[]>("/vencimientos", token, { cumplido: false, proximos: 365 })
      .then(setProximos).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoadingTareas(true);
    api.get<Tarea[]>("/tareas", token)
      .then((t) => setTareas(t.filter((x) => x.estado !== "hecha")))
      .catch(() => {}).finally(() => setLoadingTareas(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token)
      .then((exps) => {
        const map: Record<string, Expediente> = {};
        for (const e of exps) map[e.id] = e;
        setExpLookup(map);
      }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get<HonorarioResumen>("/honorarios/resumen", token).then(setHonorarios).catch(() => setHonorarios({ saldo_pendiente_ars: 0, saldo_pendiente_usd: 0, expedientes_con_deuda: 0, total_cobrado_ars: 0, total_cobrado_usd: 0 } as any));
    api.get<GastoResumen>("/gastos/resumen", token).then(setGastoResumen).catch(() => setGastoResumen({ total_ars: 0, total_usd: 0 } as any));
    api.get<IngresoResumen>("/ingresos/resumen", token).then(setIngresoResumen).catch(() => setIngresoResumen({ total_ars: 0, total_usd: 0 } as any));
    api.get<Cliente[]>("/clientes", token)
      .then((cls) => setClientes(cls.filter((c) => !c.archivado)))
      .catch(() => {});
  }, [token]);

  async function handleCumplido(id: string) {
    if (!token) return;
    setMarking(id);
    try {
      await api.patch(`/vencimientos/${id}`, { cumplido: true }, token);
      setProximos((prev) => prev.filter((v) => v.id !== id));
    } catch {} finally { setMarking(null); }
  }

  async function handleTareaHecha(id: string) {
    if (!token) return;
    setMarkingTarea(id);
    try {
      await api.patch<Tarea>(`/tareas/${id}`, { estado: "hecha" }, token);
      setTareas((prev) => prev.filter((t) => t.id !== id));
    } catch {} finally { setMarkingTarea(null); }
  }

  async function handleDeleteVencimiento(id: string) {
    if (!token) return;
    setDeletingV(id);
    try {
      await api.delete(`/vencimientos/${id}`, token);
      setProximos((prev) => prev.filter((v) => v.id !== id));
    } catch {} finally { setDeletingV(null); }
  }

  async function handleDeleteTarea(id: string) {
    if (!token) return;
    setDeletingT(id);
    try {
      await api.delete(`/tareas/${id}`, token);
      setTareas((prev) => prev.filter((t) => t.id !== id));
    } catch {} finally { setDeletingT(null); }
  }

  useEffect(() => {
    if (!token) return;
    const desde = `${calAnio}-${String(calMes).padStart(2, "0")}-01`;
    const lastDay = new Date(calAnio, calMes, 0).getDate();
    const hasta = `${calAnio}-${String(calMes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    api.get<DiaInhabil[]>("/feriados", token, { desde, hasta }).then(setInhabiles).catch(() => {});
  }, [token, calMes, calAnio]);

  const eventosCalendario = useMemo<CalEvent[]>(() => [
    ...proximos.map(v => ({
      id: v.id,
      tipo: "vencimiento" as const,
      titulo: v.descripcion,
      hora: v.hora,
      cumplido: v.cumplido,
      expediente_id: v.expediente_id,
      fecha: v.fecha,
      color: (v.cumplido ? "blue" : isUrgente(v.fecha) ? "red" : "purple") as CalEvent["color"],
    })),
    ...tareas.filter(t => t.fecha_limite).map(t => ({
      id: t.id,
      tipo: "tarea" as const,
      titulo: t.titulo,
      hora: t.hora,
      estado: t.estado,
      expediente_id: t.expediente_id,
      fecha: t.fecha_limite!,
      fecha_limite: t.fecha_limite!,
      color: (t.estado === "en_curso" ? "blue" : t.fecha_limite! < today ? "red" : "amber") as CalEvent["color"],
    })),
  ], [proximos, tareas]);

  const { desde: pDesde, hasta: pHasta } = getDatesFromValue(periodoValue);
  const inRange = (f: string) => !pDesde || !pHasta ? true : f >= pDesde && f <= pHasta;

  const tareasFiltradas = tareas.filter((t) => !t.fecha_limite || inRange(t.fecha_limite));
  const proximosFiltrados = proximos.filter((v) => inRange(v.fecha));

  const sortT = (arr: Tarea[]) => [...arr].sort((a, b) => ((a.fecha_limite ?? "") + (a.hora ?? "")).localeCompare((b.fecha_limite ?? "") + (b.hora ?? "")));
  const sortV = (arr: Vencimiento[]) => [...arr].sort((a, b) => ((a.fecha ?? "") + (a.hora ?? "")).localeCompare((b.fecha ?? "") + (b.hora ?? "")));

  const tareasHoy = sortT(tareasFiltradas.filter((t) => t.fecha_limite && t.fecha_limite <= today));
  const tareasFuturas = sortT(tareasFiltradas.filter((t) => t.fecha_limite && t.fecha_limite > today));
  const tareasSinFecha = tareasFiltradas.filter((t) => !t.fecha_limite);
  const vencimientosHoy = sortV(proximosFiltrados.filter((v) => v.fecha === today));
  const urgentes = sortV(proximosFiltrados.filter((v) => isUrgente(v.fecha) && v.fecha !== today));
  const proximos30 = sortV(proximosFiltrados.filter((v) => !isUrgente(v.fecha) && v.fecha !== today));

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {editingT && token && <EditTareaModal tarea={editingT} token={token} expedientes={Object.values(expLookup)} onSaved={(t) => { setTareas((prev) => prev.map((x) => x.id === t.id ? t : x)); setEditingT(null); }} onClose={() => setEditingT(null)} />}
      {editingV && token && <EditVencimientoModal v={editingV} token={token} onSaved={(u) => { setProximos((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditingV(null); }} onClose={() => setEditingV(null)} />}
      {showNewTarea && token && <NewTareaModal token={token} expedientes={Object.values(expLookup)} clientes={clientes} onCreated={(t) => { setTareas((prev) => [t, ...prev]); setShowNewTarea(false); }} onClose={() => setShowNewTarea(false)} />}
      {showNewVenc && token && <NewVencimientoModal token={token} expedientes={Object.values(expLookup)} onCreated={(v) => { setProximos((prev) => [v, ...prev]); setShowNewVenc(false); }} onClose={() => setShowNewVenc(false)} />}
      <SplashScreen />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-400">Bienvenido,</p>
          <h1 className="text-2xl font-bold text-ink-900">{session?.user?.name}</h1>
          {session?.user?.role && (
            <span className="inline-block mt-1 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {session.user.role}
            </span>
          )}
        </div>
        <PageHelp
          title="Dashboard"
          description="Vista general del estado del estudio en tiempo real. Todo lo que necesitás ver al arrancar el día está acá."
          items={[
            { icon: "✅", title: "Tareas pendientes", description: "Tus tareas sin completar, ordenadas por fecha límite. Las vencidas aparecen primero en rojo. Podés cambiar el estado directamente desde acá." },
            { icon: "📅", title: "Vencimientos", description: "Plazos procesales de los próximos 365 días. Los urgentes (< 48hs) se destacan en rojo y generan el badge de alerta en el header." },
            { icon: "💰", title: "Honorarios pendientes", description: "Total a cobrar en ARS y USD, sumando todos los expedientes activos con saldo pendiente." },
            { icon: "📊", title: "Selector de período", description: "Filtrá los KPIs financieros (ingresos, egresos, honorarios cobrados) por mes, trimestre, semestre o año." },
            { icon: "📈", title: "Gráfico de egresos", description: "Evolución mensual de los gastos del estudio dentro del período seleccionado." },
          ]}
          tip="El dashboard no reemplaza la Agenda: los KPIs son financieros, mientras que Vencimientos y Tareas son operativos."
        />
      </div>

      {/* ── Google Calendar sync banner ── */}
      <CalendarSyncButton variant="banner" />

          {/* ── Agenda semanal ── */}
          <AgendaWidget
            eventos={eventosCalendario}
            inhabiles={inhabiles}
            vencimientosHoy={vencimientosHoy}
            urgentes={urgentes}
            tareasHoy={tareasHoy}
            expLookup={expLookup}
            marking={marking}
            markingTarea={markingTarea}
            deletingV={deletingV}
            deletingT={deletingT}
            onShowNewTarea={() => setShowNewTarea(true)}
            onShowNewVenc={() => setShowNewVenc(true)}
            onCumplido={handleCumplido}
            onDetailV={(v) => router.push(`/vencimientos/${v.id}`)}
            onEditV={setEditingV}
            onDeleteV={handleDeleteVencimiento}
            onHecha={handleTareaHecha}
            onDetailT={(t) => router.push(`/tareas/${t.id}`)}
            onEditT={setEditingT}
            onDeleteT={handleDeleteTarea}
          />

          {/* ── Contable ── */}
          {(() => {
            const ingARS = ingresoResumen?.total_ars ?? 0;
            const egARS = gastoResumen?.total_ars ?? 0;
            const resultadoARS = ingARS - egARS;
            const loadingContable = ingresoResumen === null || gastoResumen === null;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Contable</p>
                  <PeriodSelector value={periodoValue} onChange={setPeriodoValue} compact />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Ingresos ARS", value: loadingContable ? null : `$ ${Number(ingARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`, color: "text-green-700" },
                    { label: "Egresos ARS", value: loadingContable ? null : `$ ${Number(egARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`, color: "text-red-600" },
                    { label: "Resultado ARS", value: loadingContable ? null : `${resultadoARS >= 0 ? "+" : ""}$ ${Number(resultadoARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`, color: resultadoARS >= 0 ? "text-green-700" : "text-red-600" },
                    { label: "Hon. pendiente", value: honorarios === null ? null : `$ ${Number(honorarios.saldo_pendiente_ars).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`, sub: honorarios ? `${honorarios.expedientes_con_deuda} exp. con deuda` : undefined, color: "text-ink-900" },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                      <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">{label}</p>
                      {value === null
                        ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" />
                        : <p className={`text-2xl font-bold ${color}`}>{value}</p>}
                      {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

const inputCls = "w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

function NewTareaModal({ token, expedientes, clientes, onCreated, onClose }: { token: string; expedientes: Expediente[]; clientes: Cliente[]; onCreated: (t: Tarea) => void; onClose: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TareaTipo>("judicial");
  const [expedienteId, setExpedienteId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [hora, setHora] = useState("");
  const [descripcionTarea, setDescripcionTarea] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!titulo.trim()) { setErr("El título es obligatorio"); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { titulo: titulo.trim(), tipo, estado: "pendiente" };
      if (expedienteId) body.expediente_id = expedienteId;
      if (clienteId) body.cliente_id = clienteId;
      if (fechaLimite) body.fecha_limite = fechaLimite;
      if (hora) body.hora = hora;
      if (descripcionTarea) body.descripcion = descripcionTarea;
      const created = await api.post<Tarea>("/tareas", body, token);
      onCreated(created);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Nueva tarea</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Título *</label>
            <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} className={inputCls} placeholder="Ej: Presentar escrito, comprar toner…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TareaTipo)} className={inputCls}>
              <option value="judicial">⚖️ Judicial</option>
              <option value="extrajudicial">🤝 Extrajudicial</option>
              <option value="administrativa">🏢 Administrativa</option>
              <option value="operativa">🔧 Operativa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
              <option value="">— Sin cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
            <ExpedienteSelect expedientes={expedientes} value={expedienteId} onChange={setExpedienteId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
              <DateInput value={fechaLimite} onChange={setFechaLimite} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <TimeInput value={hora} onChange={setHora} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción</label>
            <textarea value={descripcionTarea} onChange={e => setDescripcionTarea(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Opcional" />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{saving ? "Guardando…" : "Crear tarea"}</button>
        </div>
      </div>
    </div>
  );
}

function NewVencimientoModal({ token, expedientes, onCreated, onClose }: { token: string; expedientes: Expediente[]; onCreated: (v: Vencimiento) => void; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("vencimiento");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [expedienteId, setExpedienteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!descripcion.trim()) { setErr("La descripción es obligatoria"); return; }
    if (!fecha) { setErr("La fecha es obligatoria"); return; }
    if (!expedienteId) { setErr("Seleccioná un expediente"); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { descripcion: descripcion.trim(), tipo, fecha, expediente_id: expedienteId };
      if (hora) body.hora = hora;
      const created = await api.post<Vencimiento>("/vencimientos", body, token);
      onCreated(created);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Nuevo vencimiento</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción *</label>
            <input autoFocus value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} placeholder="Ej: Audiencia de vista de causa" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
              <option value="vencimiento">Vencimiento</option>
              <option value="audiencia">Audiencia</option>
              <option value="presentacion">Presentación</option>
              <option value="pericia">Pericia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente *</label>
            <ExpedienteSelect expedientes={expedientes} value={expedienteId} onChange={setExpedienteId} placeholder="— Seleccioná —" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
              <DateInput value={fecha} onChange={setFecha} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <TimeInput value={hora} onChange={setHora} />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{saving ? "Guardando…" : "Crear vencimiento"}</button>
        </div>
      </div>
    </div>
  );
}

function EditTareaModal({ tarea, token, expedientes, onSaved, onClose }: { tarea: Tarea; token: string; expedientes: Expediente[]; onSaved: (t: Tarea) => void; onClose: () => void }) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [fechaLimite, setFechaLimite] = useState(tarea.fecha_limite ?? "");
  const [hora, setHora] = useState(tarea.hora ?? "");
  const [estado, setEstado] = useState(tarea.estado);
  const [expedienteId, setExpedienteId] = useState(tarea.expediente_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo, estado, expediente_id: expedienteId || null };
      if (fechaLimite) body.fecha_limite = fechaLimite; else body.fecha_limite = null;
      body.hora = hora || null;
      const updated = await api.patch<Tarea>(`/tareas/${tarea.id}`, body, token);
      onSaved(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Editar tarea</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
              <DateInput value={fechaLimite} onChange={setFechaLimite} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <TimeInput value={hora} onChange={setHora} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as Tarea["estado"])} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="hecha">Hecha</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
            <ExpedienteSelect expedientes={expedientes} value={expedienteId} onChange={setExpedienteId} />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function EditVencimientoModal({ v, token, onSaved, onClose }: { v: Vencimiento; token: string; onSaved: (u: Vencimiento) => void; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(v.descripcion);
  const [fecha, setFecha] = useState(v.fecha);
  const [hora, setHora] = useState((v as any).hora ?? "");
  const [tipo, setTipo] = useState(v.tipo);
  const [cumplido, setCumplido] = useState(v.cumplido);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { descripcion, fecha, hora: hora || null, tipo, cumplido }, token);
      onSaved(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Editar vencimiento</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha</label>
              <DateInput value={fecha} onChange={setFecha} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <TimeInput value={hora} onChange={setHora} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="vencimiento">Vencimiento</option>
              <option value="audiencia">Audiencia</option>
              <option value="presentacion">Presentación</option>
              <option value="pericia">Pericia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
            <select value={cumplido ? "cumplido" : "pendiente"} onChange={(e) => setCumplido(e.target.value === "cumplido")} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="pendiente">Pendiente</option>
              <option value="cumplido">Cumplido</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function TareaRow({ tarea, exp, onHecha, onEdit, onDelete, onDetail, marking, deleting }: {
  tarea: Tarea;
  exp?: Expediente;
  onHecha: (id: string) => void;
  onEdit: (t: Tarea) => void;
  onDelete: (id: string) => void;
  onDetail: (t: Tarea) => void;
  marking: string | null;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = tarea.fecha_limite && tarea.fecha_limite < today;
  const esHoy = tarea.fecha_limite === today;
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition group ${vencida ? "bg-red-50/30" : ""}`}>
      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
        tarea.estado === "hecha" ? "bg-green-500" : tarea.estado === "en_curso" ? "bg-blue-400" : "bg-ink-300"
      }`} />
      <div className="flex-1 min-w-0">
        <button onClick={() => onDetail(tarea)} className="text-sm text-ink-900 font-medium truncate block hover:text-brand-600 transition text-left w-full">{tarea.titulo}</button>
        {exp && (
          <Link href={`/expedientes/${exp.id}`} className="text-xs text-ink-400 truncate block hover:text-brand-600 transition">
            {exp.caratula || exp.cliente_nombre || exp.numero}
            {(exp.juzgado || exp.localidad) && <span className="text-ink-300"> · {[exp.juzgado, exp.localidad].filter(Boolean).join(", ")}</span>}
          </Link>
        )}
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={() => { onDelete(tarea.id); setConfirmDelete(false); }} disabled={deleting === tarea.id} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition disabled:opacity-50">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2.5 py-1.5 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <>
          {tarea.estado === "en_curso" && (
            <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">En curso</span>
          )}
          {tarea.fecha_limite && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
              vencida ? "bg-red-100 text-red-600" : esHoy ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-500"
            }`}>
              {vencida ? `venció ${formatFecha(tarea.fecha_limite)}` : formatFechaLarga(tarea.fecha_limite)}{tarea.hora ? ` · ${tarea.hora}` : ""}
            </span>
          )}
          <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition flex-shrink-0">
            <button onClick={() => onEdit(tarea)} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── AgendaWidget: mini-semana + hoy ──────────────────────────────────────────

function AgendaWidget({
  eventos, inhabiles, vencimientosHoy, urgentes, tareasHoy, expLookup,
  marking, markingTarea, deletingV, deletingT,
  onShowNewTarea, onShowNewVenc, onCumplido, onEditV, onDeleteV, onHecha, onEditT, onDeleteT,
  onDetailV, onDetailT,
}: {
  eventos: CalEvent[];
  inhabiles: DiaInhabil[];
  vencimientosHoy: Vencimiento[];
  urgentes: Vencimiento[];
  tareasHoy: Tarea[];
  expLookup: Record<string, Expediente>;
  marking: string | null; markingTarea: string | null;
  deletingV: string | null; deletingT: string | null;
  onShowNewTarea: () => void; onShowNewVenc: () => void;
  onCumplido: (id: string) => void; onEditV: (v: Vencimiento) => void; onDeleteV: (id: string) => void;
  onHecha: (id: string) => void; onEditT: (t: Tarea) => void; onDeleteT: (id: string) => void;
  onDetailV: (v: Vencimiento) => void; onDetailT: (t: Tarea) => void;
}) {
  const hoy = new Date();
  const todayStr = hoy.toISOString().split("T")[0];
  const [semanaOffset, setSemanaOffset] = useState(0); // 0 = semana actual, +1 = próxima, -1 = anterior

  // Construir los 7 días de la semana (lun → dom) con offset
  const diasSemana = useMemo(() => {
    const diaSemana = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((diaSemana + 6) % 7) + semanaOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }, [semanaOffset]);

  const semanaLabel = useMemo(() => {
    if (semanaOffset === 0) return "Esta semana";
    if (semanaOffset === 1) return "Próxima semana";
    if (semanaOffset === -1) return "Semana pasada";
    const d = new Date(diasSemana[0] + "T12:00:00");
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + " – " +
      new Date(diasSemana[6] + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  }, [semanaOffset, diasSemana]);

  const eventosPorFecha = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of eventos) {
      const f = e.tipo === "tarea" ? (e as any).fecha_limite ?? (e as any).fecha : (e as any).fecha;
      if (!f) continue;
      if (!map[f]) map[f] = [];
      map[f].push(e);
    }
    for (const f of Object.keys(map)) {
      map[f].sort((a, b) => {
        if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
        if (a.hora) return -1;
        if (b.hora) return 1;
        return 0;
      });
    }
    return map;
  }, [eventos]);

  const inhabileSet = useMemo(() => new Set(inhabiles.map(i => i.fecha)), [inhabiles]);

  const DIAS_LABEL = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
  const hayUrgentes = vencimientosHoy.length > 0 || urgentes.length > 0 || tareasHoy.length > 0;
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(todayStr);

  const eventosDelDia = eventosPorFecha[diaSeleccionado] ?? [];
  const esHoySeleccionado = diaSeleccionado === todayStr;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-700">Agenda</h2>
        <div className="flex items-center gap-2">
          <button onClick={onShowNewTarea} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition">+ Tarea</button>
          <button onClick={onShowNewVenc} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition">+ Vencimiento</button>
          <Link href="/agenda" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver agenda →</Link>
        </div>
      </div>

      {/* Calendario semanal */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-50">
          <button onClick={() => setSemanaOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={() => setSemanaOffset(0)} className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${semanaOffset === 0 ? "text-brand-600 bg-brand-50" : "text-ink-500 hover:text-ink-800 hover:bg-ink-50"}`}>
            {semanaLabel}
          </button>
          <button onClick={() => setSemanaOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        {/* Grid de días */}
        <div className="grid grid-cols-7 divide-x divide-ink-50">
          {diasSemana.map((fecha, i) => {
            const esHoy = fecha === todayStr;
            const esSel = fecha === diaSeleccionado;
            const evs = eventosPorFecha[fecha] ?? [];
            const esInhabil = inhabileSet.has(fecha);
            const dia = parseInt(fecha.slice(8));
            const mes = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { month: "short" });

            return (
              <button
                key={fecha}
                onClick={() => setDiaSeleccionado(fecha)}
                className={`flex flex-col items-stretch text-left transition group min-h-[72px] lg:min-h-[280px] ${
                  esSel ? "bg-brand-50/60" : esHoy ? "bg-brand-50/30" : "hover:bg-ink-50/40"
                }`}
              >
                {/* Cabecera del día */}
                <div className={`flex flex-col items-center py-3 border-b ${esSel ? "border-brand-200 bg-brand-600" : esHoy ? "border-brand-100 bg-brand-50" : "border-ink-50 bg-ink-50/40"}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${esSel ? "text-white/80" : esHoy ? "text-brand-500" : "text-ink-400"}`}>{DIAS_LABEL[i]}</span>
                  <span className={`text-lg font-bold mt-0.5 ${esSel ? "text-white" : esHoy ? "text-brand-700" : esInhabil ? "text-red-400" : "text-ink-800"}`}>{dia}</span>
                  {/* Mes si es el primero de mes */}
                  {dia === 1 && <span className={`text-[9px] uppercase font-semibold ${esSel ? "text-white/70" : "text-ink-400"}`}>{mes}</span>}
                </div>

                {/* Eventos — desktop: pills con texto; mobile: solo dots */}
                <div className="flex-1 p-1.5 space-y-1 overflow-hidden">
                  {/* Desktop: pills con título */}
                  <div className="hidden lg:block space-y-1">
                    {evs.slice(0, 4).map((e, j) => {
                      const colorCls =
                        e.color === "red"    ? "bg-red-50 border-red-200 text-red-700" :
                        e.color === "purple" ? "bg-purple-50 border-purple-200 text-purple-700" :
                        e.color === "blue"   ? "bg-blue-50 border-blue-200 text-blue-700" :
                                               "bg-amber-50 border-amber-200 text-amber-700";
                      const dotCls =
                        e.color === "red"    ? "bg-red-400" :
                        e.color === "purple" ? "bg-purple-400" :
                        e.color === "blue"   ? "bg-blue-400" : "bg-amber-400";
                      return (
                        <button
                          key={j}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (e.tipo === "vencimiento") {
                              onDetailV({ id: e.id, descripcion: e.titulo, fecha: (e as any).fecha, tipo: "", cumplido: e.cumplido ?? false, expediente_id: e.expediente_id ?? "", hora: e.hora } as Vencimiento);
                            } else {
                              onDetailT({ id: e.id, titulo: e.titulo, estado: (e.estado ?? "pendiente") as Tarea["estado"], fecha_limite: (e as any).fecha_limite, expediente_id: e.expediente_id, hora: e.hora } as Tarea);
                            }
                          }}
                          className={`w-full flex items-center gap-1 px-1.5 py-1 rounded-md border text-[10px] font-medium truncate text-left hover:opacity-80 transition ${colorCls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                          <span className="truncate">{e.hora ? `${e.hora} ` : ""}{e.titulo}</span>
                        </button>
                      );
                    })}
                    {evs.length > 4 && (
                      <p className="text-[10px] text-ink-400 font-medium px-1">+{evs.length - 4} más</p>
                    )}
                  </div>
                  {/* Mobile: dots */}
                  <div className="lg:hidden flex flex-wrap gap-0.5 justify-center pt-1">
                    {evs.slice(0, 3).map((e, j) => (
                      <span key={j} className={`w-1.5 h-1.5 rounded-full ${
                        e.color === "red" ? "bg-red-400" :
                        e.color === "purple" ? "bg-purple-400" :
                        e.color === "blue" ? "bg-blue-400" : "bg-amber-400"
                      }`} />
                    ))}
                    {evs.length > 3 && <span className="text-[8px] text-ink-400 font-bold">+</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del día seleccionado */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-50 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {esHoySeleccionado && <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">HOY</span>}
            <span className="text-sm font-semibold text-ink-800 capitalize">
              {new Date(diaSeleccionado + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {eventosDelDia.some(e => e.color === "red") && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">⚡ Urgente</span>
            )}
          </div>
          <Link href="/agenda" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex-shrink-0">Ver agenda →</Link>
        </div>

        {eventosDelDia.length === 0 ? (
          <div className="px-5 py-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <p className="text-sm text-ink-500">Sin eventos para este día</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-50 max-h-64 overflow-y-auto">
            {eventosDelDia.map(ev => {
              if (ev.tipo === "vencimiento") {
                const v = { id: ev.id, descripcion: ev.titulo, fecha: (ev as any).fecha, tipo: "", cumplido: ev.cumplido ?? false, expediente_id: ev.expediente_id ?? "", hora: ev.hora } as Vencimiento;
                return <VencimientoRow key={ev.id} v={v} exp={expLookup[ev.expediente_id ?? ""]} onCumplido={onCumplido} onEdit={onEditV} onDelete={onDeleteV} onDetail={onDetailV} marking={marking} deleting={deletingV} />;
              } else {
                const t = { id: ev.id, titulo: ev.titulo, estado: (ev.estado ?? "pendiente") as Tarea["estado"], fecha_limite: (ev as any).fecha_limite, expediente_id: ev.expediente_id, hora: ev.hora } as Tarea;
                return <TareaRow key={ev.id} tarea={t} exp={expLookup[ev.expediente_id ?? ""]} onHecha={onHecha} onEdit={onEditT} onDelete={onDeleteT} onDetail={onDetailT} marking={markingTarea} deleting={deletingT} />;
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VencimientoRow({ v, exp, onCumplido, onEdit, onDelete, onDetail, marking, deleting }: {
  v: Vencimiento;
  exp?: Expediente;
  onCumplido: (id: string) => void;
  onEdit: (v: Vencimiento) => void;
  onDelete: (id: string) => void;
  onDetail: (v: Vencimiento) => void;
  marking: string | null;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const urg = isUrgente(v.fecha);
  const warning = !urg && isWarning(v.fecha);
  const vencida = isVencida(v.fecha);
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition group ${urg ? "bg-red-50/20" : ""}`}>
      <div className={`flex-shrink-0 w-2 h-2 rounded-full ${v.cumplido ? "bg-green-500" : urg || vencida ? "bg-red-400" : warning ? "bg-amber-400" : "bg-purple-300"}`} />
      <div className="flex-1 min-w-0">
        <button onClick={() => onDetail(v)} className="text-sm text-ink-900 font-medium truncate block hover:text-brand-600 transition text-left w-full">{v.descripcion}</button>
        {exp ? (
          <Link href={`/expedientes/${exp.id}`} className="text-xs text-ink-400 truncate block hover:text-brand-600 transition">
            {exp.caratula || exp.cliente_nombre || exp.numero}
            {(exp.juzgado || exp.localidad) && <span className="text-ink-300"> · {[exp.juzgado, exp.localidad].filter(Boolean).join(", ")}</span>}
          </Link>
        ) : (
          <p className="text-xs text-ink-400 truncate">{v.tipo}</p>
        )}
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={() => { onDelete(v.id); setConfirmDelete(false); }} disabled={deleting === v.id} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition disabled:opacity-50">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2.5 py-1.5 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            urg || vencida ? "bg-red-100 text-red-700" : warning ? "bg-yellow-100 text-yellow-700" : "bg-ink-100 text-ink-500"
          }`}>
            {formatFecha(v.fecha)}{v.hora ? ` · ${v.hora}` : ""}
          </span>
          <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition flex-shrink-0">
            <button onClick={() => onEdit(v)} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
