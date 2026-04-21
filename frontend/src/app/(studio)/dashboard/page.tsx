"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { api, Vencimiento, HonorarioResumen, GastoResumen, IngresoResumen, Expediente, Cliente, Tarea, TareaTipo } from "@/lib/api";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PageHelp } from "@/components/ui/page-help";
import { SplashScreen } from "@/components/ui/splash-screen";
import { PeriodSelector, PeriodoValue, getDatesFromValue } from "@/components/ui/period-selector";
import { CalendarSyncButton } from "@/components/ui/calendar-sync-button";

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
  const [totalExpedientes, setTotalExpedientes] = useState<number | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
  const [expStats, setExpStats] = useState<{ activo: number; archivado: number; cerrado: number } | null>(null);
  const [studioConfigured, setStudioConfigured] = useState(false);

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
    Promise.all([
      api.get<Expediente[]>("/expedientes", token, { estado: "activo" }),
      api.get<Expediente[]>("/expedientes", token, { estado: "archivado" }),
      api.get<Expediente[]>("/expedientes", token, { estado: "cerrado" }),
    ]).then(([activos, archivados, cerrados]) => {
      setTotalExpedientes(activos.length);
      setExpStats({ activo: activos.length, archivado: archivados.length, cerrado: cerrados.length });
    }).catch(() => { setTotalExpedientes(0); setExpStats({ activo: 0, archivado: 0, cerrado: 0 }); });
    api.get<Cliente[]>("/clientes", token)
      .then((cls) => setTotalClientes(cls.filter((c) => !c.archivado).length))
      .catch(() => setTotalClientes(0));
    api.get<{ email_contacto?: string }>("/studios/me", token)
      .then((s) => setStudioConfigured(!!s.email_contacto))
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

  const { desde: pDesde, hasta: pHasta } = getDatesFromValue(periodoValue);
  const inRange = (f: string) => !pDesde || !pHasta ? true : f >= pDesde && f <= pHasta;

  const tareasFiltradas = tareas.filter((t) => !t.fecha_limite || inRange(t.fecha_limite));
  const proximosFiltrados = proximos.filter((v) => inRange(v.fecha));

  const tareasHoy = tareasFiltradas.filter((t) => t.fecha_limite && t.fecha_limite <= today);
  const tareasFuturas = tareasFiltradas.filter((t) => t.fecha_limite && t.fecha_limite > today);
  const tareasSinFecha = tareasFiltradas.filter((t) => !t.fecha_limite);
  const vencimientosHoy = proximosFiltrados.filter((v) => v.fecha === today);
  const urgentes = proximosFiltrados.filter((v) => isUrgente(v.fecha) && v.fecha !== today);
  const proximos30 = proximosFiltrados.filter((v) => !isUrgente(v.fecha) && v.fecha !== today);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {editingT && token && <EditTareaModal tarea={editingT} token={token} expedientes={Object.values(expLookup)} onSaved={(t) => { setTareas((prev) => prev.map((x) => x.id === t.id ? t : x)); setEditingT(null); }} onClose={() => setEditingT(null)} />}
      {editingV && token && <EditVencimientoModal v={editingV} token={token} onSaved={(u) => { setProximos((prev) => prev.map((x) => x.id === u.id ? u : x)); setEditingV(null); }} onClose={() => setEditingV(null)} />}
      {showNewTarea && token && <NewTareaModal token={token} expedientes={Object.values(expLookup)} onCreated={(t) => { setTareas((prev) => [t, ...prev]); setShowNewTarea(false); }} onClose={() => setShowNewTarea(false)} />}
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

      {/* Empty state */}
      {totalExpedientes === 0 ? (
        <div className="py-8">
          <div className="max-w-xl mx-auto text-center mb-10">
            <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">Tu estudio está listo</h2>
            <p className="text-sm text-ink-400 leading-relaxed">Para ver el dashboard en acción necesitás cargar tus primeros datos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { step: "1", icon: "🏛️", title: "Configurá tu estudio", desc: "Nombre, logo, email de contacto y dirección.", href: "/perfil", cta: "Ir al perfil" },
              { step: "2", icon: "👤", title: "Agregá un cliente", desc: "Todo expediente necesita un cliente.", href: "/clientes/nuevo", cta: "Nuevo cliente" },
              { step: "3", icon: "📁", title: "Creá un expediente", desc: "Asociá al cliente y definí la causa.", href: "/expedientes/nuevo", cta: "Nuevo expediente" },
            ].map((item, i) => {
              const done = (i === 0 && studioConfigured) || (i === 1 && (totalClientes ?? 0) > 0);
              return (
                <div key={i} className={`border rounded-2xl p-5 shadow-sm flex flex-col ${done ? "bg-ink-50 border-ink-100 opacity-60" : "bg-white border-ink-100"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {done ? <span className="w-7 h-7 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0">✓</span>
                      : <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>}
                    <span className="text-xl">{item.icon}</span>
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${done ? "text-ink-400 line-through" : "text-ink-900"}`}>{item.title}</p>
                  <p className="text-xs text-ink-400 leading-relaxed mb-4 flex-1">{item.desc}</p>
                  {!done && <a href={item.href} className="w-full text-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">{item.cta}</a>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Selector de período */}
          <PeriodSelector value={periodoValue} onChange={setPeriodoValue} />

          {/* ── Fila de stats compacta ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Expedientes activos", value: totalExpedientes ?? "—" },
              { label: "Clientes activos", value: totalClientes ?? "—" },
              { label: "Tareas pendientes", value: tareasFiltradas.length, accent: tareasHoy.length > 0 ? "red" : undefined },
              { label: "Vencimientos pendientes", value: proximosFiltrados.length, accent: urgentes.length > 0 ? "red" : undefined },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-white rounded-2xl border border-ink-100 shadow-sm px-4 py-3.5 flex flex-col gap-1">
                <p className="text-xs text-ink-400 font-medium leading-tight truncate">{label}</p>
                <p className={`text-2xl font-bold ${accent === "red" ? "text-red-600" : "text-ink-900"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Google Calendar sync banner ── */}
          <CalendarSyncButton variant="banner" />

          {/* ── Bloque principal: Tareas + Vencimientos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ─ Tareas ─ */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-ink-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <h2 className="text-sm font-semibold text-ink-900">Tareas pendientes</h2>
                  {tareasFiltradas.length > 0 && (
                    <span className="text-xs bg-ink-100 text-ink-500 rounded-full px-2 py-0.5 font-medium">{tareasFiltradas.length}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNewTarea(true)} className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Nueva
                  </button>
                  <Link href="/agenda" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver agenda →</Link>
                </div>
              </div>

              {loadingTareas ? (
                <div className="divide-y divide-ink-50">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-5 bg-ink-100 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-1.5"><div className="h-3 bg-ink-100 rounded w-3/4" /><div className="h-2 bg-ink-50 rounded w-1/3" /></div>
                    </div>
                  ))}
                </div>
              ) : tareasFiltradas.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <p className="text-sm font-medium text-ink-600">Sin tareas pendientes</p>
                  <Link href="/tareas" className="text-xs text-brand-600 mt-1 hover:underline">Cargar una →</Link>
                </div>
              ) : (
                <div className="divide-y divide-ink-50 overflow-y-auto max-h-96">
                  {/* Vencidas / hoy */}
                  {tareasHoy.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-red-50/60">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Vencidas o para hoy</p>
                      </div>
                      {tareasHoy.map((t) => (
                        <TareaRow key={t.id} tarea={t} exp={expLookup[t.expediente_id]} onHecha={handleTareaHecha} onEdit={setEditingT} onDelete={handleDeleteTarea} marking={markingTarea} deleting={deletingT} />
                      ))}
                    </>
                  )}
                  {/* Futuras */}
                  {tareasFuturas.length > 0 && (
                    <>
                      {tareasHoy.length > 0 && (
                        <div className="px-5 py-2 bg-ink-50/60">
                          <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Próximas</p>
                        </div>
                      )}
                      {tareasFuturas.map((t) => (
                        <TareaRow key={t.id} tarea={t} exp={expLookup[t.expediente_id]} onHecha={handleTareaHecha} onEdit={setEditingT} onDelete={handleDeleteTarea} marking={markingTarea} deleting={deletingT} />
                      ))}
                    </>
                  )}
                  {/* Sin fecha */}
                  {tareasSinFecha.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-ink-50/60">
                        <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Sin fecha límite</p>
                      </div>
                      {tareasSinFecha.map((t) => (
                        <TareaRow key={t.id} tarea={t} exp={expLookup[t.expediente_id]} onHecha={handleTareaHecha} onEdit={setEditingT} onDelete={handleDeleteTarea} marking={markingTarea} deleting={deletingT} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ─ Vencimientos ─ */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-ink-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <h2 className="text-sm font-semibold text-ink-900">Vencimientos</h2>
                  {proximosFiltrados.length > 0 && (
                    <span className="text-xs bg-ink-100 text-ink-500 rounded-full px-2 py-0.5 font-medium">{proximosFiltrados.length}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNewVenc(true)} className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Nuevo
                  </button>
                  <Link href="/agenda" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver agenda →</Link>
                </div>
              </div>

              {loading ? (
                <div className="divide-y divide-ink-50">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
                      <div className="w-14 h-6 bg-ink-100 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5"><div className="h-3 bg-ink-100 rounded w-3/4" /><div className="h-2 bg-ink-50 rounded w-1/3" /></div>
                    </div>
                  ))}
                </div>
              ) : proximosFiltrados.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
                  <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                  <p className="text-sm font-medium text-ink-600">Sin vencimientos próximos</p>
                  <Link href="/vencimientos/nuevo" className="text-xs text-brand-600 mt-1 hover:underline">Cargar uno →</Link>
                </div>
              ) : (
                <div className="divide-y divide-ink-50 overflow-y-auto max-h-96">
                  {/* Hoy */}
                  {vencimientosHoy.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-red-50/60">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Hoy</p>
                      </div>
                      {vencimientosHoy.map((v) => (
                        <VencimientoRow key={v.id} v={v} exp={expLookup[v.expediente_id]} onCumplido={handleCumplido} onEdit={setEditingV} onDelete={handleDeleteVencimiento} marking={marking} deleting={deletingV} />
                      ))}
                    </>
                  )}
                  {/* Urgentes */}
                  {urgentes.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-amber-50/60">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">⚡ Urgentes (menos de 48hs)</p>
                      </div>
                      {urgentes.map((v) => (
                        <VencimientoRow key={v.id} v={v} exp={expLookup[v.expediente_id]} onCumplido={handleCumplido} onEdit={setEditingV} onDelete={handleDeleteVencimiento} marking={marking} deleting={deletingV} />
                      ))}
                    </>
                  )}
                  {/* Próximos */}
                  {proximos30.length > 0 && (
                    <>
                      {(vencimientosHoy.length > 0 || urgentes.length > 0) && (
                        <div className="px-5 py-2 bg-ink-50/60">
                          <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Próximos</p>
                        </div>
                      )}
                      {proximos30.slice(0, 12).map((v) => (
                        <VencimientoRow key={v.id} v={v} exp={expLookup[v.expediente_id]} onCumplido={handleCumplido} onEdit={setEditingV} onDelete={handleDeleteVencimiento} marking={marking} deleting={deletingV} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ── KPIs contables ── */}
          {(() => {
            const hoy = new Date();
            const mesLabel = hoy.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
            const ingARS = ingresoResumen?.total_ars ?? 0;
            const egARS = gastoResumen?.total_ars ?? 0;
            const resultadoARS = ingARS - egARS;
            const loadingContable = ingresoResumen === null || gastoResumen === null;
            return (
              <div>
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 capitalize">Contable — {mesLabel}</p>
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

          {/* ── Gráfico expedientes ── */}
          {expStats && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Expedientes</p>
                  <p className="text-sm font-semibold text-ink-900 mt-0.5">{expStats.activo + expStats.archivado + expStats.cerrado} en total</p>
                </div>
                <Link href="/expedientes" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver todos →</Link>
              </div>
              <div className="flex gap-6 items-end">
                <div className="flex-1 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Activos", value: expStats.activo, color: "#22c55e" },
                      { name: "Archivados", value: expStats.archivado, color: "#94a3b8" },
                      { name: "Cerrados", value: expStats.cerrado, color: "#f87171" },
                    ]} barCategoryGap="30%">
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f8fafc" }} formatter={(v: unknown) => [v as number, "expedientes"]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[{ color: "#22c55e" }, { color: "#94a3b8" }, { color: "#f87171" }].map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-shrink-0 space-y-3 pb-1">
                  {[
                    { label: "Activos", value: expStats.activo, color: "bg-green-500", text: "text-green-700" },
                    { label: "Archivados", value: expStats.archivado, color: "bg-slate-400", text: "text-slate-600" },
                    { label: "Cerrados", value: expStats.cerrado, color: "bg-red-400", text: "text-red-600" },
                  ].map(({ label, value, color, text }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                      <span className="text-xs text-ink-500 w-20">{label}</span>
                      <span className={`text-sm font-bold ${text}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

const inputCls = "w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";

function NewTareaModal({ token, expedientes, onCreated, onClose }: { token: string; expedientes: Expediente[]; onCreated: (t: Tarea) => void; onClose: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TareaTipo>("judicial");
  const [expedienteId, setExpedienteId] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!titulo.trim()) { setErr("El título es obligatorio"); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { titulo: titulo.trim(), tipo, estado: "pendiente" };
      if (expedienteId) body.expediente_id = expedienteId;
      if (fechaLimite) body.fecha_limite = fechaLimite;
      if (hora) body.hora = hora;
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
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
            <select value={expedienteId} onChange={e => setExpedienteId(e.target.value)} className={inputCls}>
              <option value="">— Sin expediente —</option>
              {expedientes.map(ex => <option key={ex.id} value={ex.id}>{ex.numero} · {ex.cliente_nombre ?? ex.caratula}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
              <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
            </div>
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
            <select value={expedienteId} onChange={e => setExpedienteId(e.target.value)} className={inputCls}>
              <option value="">— Seleccioná —</option>
              {expedientes.map(ex => <option key={ex.id} value={ex.id}>{ex.numero} · {ex.cliente_nombre ?? ex.caratula}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputCls} />
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
  const [estado, setEstado] = useState(tarea.estado);
  const [expedienteId, setExpedienteId] = useState(tarea.expediente_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo, estado, expediente_id: expedienteId || null };
      if (fechaLimite) body.fecha_limite = fechaLimite; else body.fecha_limite = null;
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
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as Tarea["estado"])} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
            <select value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="">— Sin expediente —</option>
              {expedientes.map((ex) => <option key={ex.id} value={ex.id}>{ex.numero} · {ex.cliente_nombre ?? ex.caratula}</option>)}
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

function EditVencimientoModal({ v, token, onSaved, onClose }: { v: Vencimiento; token: string; onSaved: (u: Vencimiento) => void; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(v.descripcion);
  const [fecha, setFecha] = useState(v.fecha);
  const [tipo, setTipo] = useState(v.tipo);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { descripcion, fecha, tipo }, token);
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
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
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

function TareaRow({ tarea, exp, onHecha, onEdit, onDelete, marking, deleting }: {
  tarea: Tarea;
  exp?: Expediente;
  onHecha: (id: string) => void;
  onEdit: (t: Tarea) => void;
  onDelete: (id: string) => void;
  marking: string | null;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = tarea.fecha_limite && tarea.fecha_limite < today;
  const esHoy = tarea.fecha_limite === today;
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition group ${vencida ? "bg-red-50/30" : ""}`}>
      <button
        onClick={() => onHecha(tarea.id)}
        disabled={marking === tarea.id}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 transition disabled:opacity-50 ${
          marking === tarea.id ? "bg-blue-100 border-blue-300" : "border-blue-300 hover:border-blue-500 hover:bg-blue-50"
        }`}
      >
        {marking === tarea.id && <svg className="w-full h-full text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-900 font-medium truncate">{tarea.titulo}</p>
        {exp && (
          <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline truncate block max-w-[180px]">
            {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
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
              {vencida ? `venció ${formatFecha(tarea.fecha_limite)}` : formatFechaLarga(tarea.fecha_limite)}
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

function VencimientoRow({ v, exp, onCumplido, onEdit, onDelete, marking, deleting }: {
  v: Vencimiento;
  exp?: Expediente;
  onCumplido: (id: string) => void;
  onEdit: (v: Vencimiento) => void;
  onDelete: (id: string) => void;
  marking: string | null;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const urg = isUrgente(v.fecha);
  const warning = !urg && isWarning(v.fecha);
  const vencida = isVencida(v.fecha);
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 transition group ${urg ? "bg-red-50/20" : ""}`}>
      <button
        onClick={() => onCumplido(v.id)}
        disabled={marking === v.id}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition disabled:opacity-50 ${
          marking === v.id ? "bg-purple-100 border-purple-300" : "border-purple-300 hover:border-purple-500 hover:bg-purple-50"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-900 font-medium truncate">{v.descripcion}</p>
        {exp ? (
          <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline truncate block max-w-[180px]">
            {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
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
            {formatFecha(v.fecha)}
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
