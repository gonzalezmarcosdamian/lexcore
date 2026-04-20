"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { api, Vencimiento, HonorarioResumen, GastoResumen, IngresoResumen, Expediente, Cliente, Tarea } from "@/lib/api";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PageHelp } from "@/components/ui/page-help";
import { SplashScreen } from "@/components/ui/splash-screen";

function isUrgente(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 48 * 3600 * 1000;
}

function isWarning(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 7 * 24 * 3600 * 1000;
}

function formatFecha(fecha: string) {
  const d = new Date(fecha);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function StatCard({
  label,
  value,
  trend,
  trendColor = "text-green-600",
  loading = false,
}: {
  label: string;
  value: number | string;
  trend?: string;
  trendColor?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
      <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className="text-3xl font-bold text-ink-900 mb-1">
        {loading ? <span className="inline-block w-10 h-8 bg-ink-100 rounded animate-pulse" /> : value}
      </p>
      {trend && <p className={`text-xs font-medium ${trendColor}`}>{trend}</p>}
    </div>
  );
}


type Periodo = 1 | 7 | 30 | 90;

const PERIODOS: { label: string; value: Periodo; sublabel: string }[] = [
  { label: "Hoy", value: 1, sublabel: "próximas 24hs" },
  { label: "Esta semana", value: 7, sublabel: "próximos 7 días" },
  { label: "Este mes", value: 30, sublabel: "próximos 30 días" },
  { label: "Trimestre", value: 90, sublabel: "próximos 90 días" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    if (typeof window === "undefined") return 30;
    const saved = localStorage.getItem("lexcore_dash_periodo");
    return (saved && [1, 7, 30, 90].includes(Number(saved)) ? Number(saved) : 30) as Periodo;
  });
  const [proximos, setProximos] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [honorarios, setHonorarios] = useState<HonorarioResumen | null>(null);
  const [gastoResumen, setGastoResumen] = useState<GastoResumen | null>(null);
  const [ingresoResumen, setIngresoResumen] = useState<IngresoResumen | null>(null);
  const [totalExpedientes, setTotalExpedientes] = useState<number | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
  const [expStats, setExpStats] = useState<{ activo: number; archivado: number; cerrado: number } | null>(null);
  const [tareasHoy, setTareasHoy] = useState<Tarea[]>([]);
  const [markingTarea, setMarkingTarea] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<Vencimiento[]>("/vencimientos", token, { cumplido: false, proximos: periodo })
      .then(setProximos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, periodo]);

  useEffect(() => {
    if (!token) return;
    api
      .get<HonorarioResumen>("/honorarios/resumen", token)
      .then(setHonorarios)
      .catch(() => setHonorarios({ saldo_pendiente_ars: 0, saldo_pendiente_usd: 0, expedientes_con_deuda: 0, total_cobrado_ars: 0, total_cobrado_usd: 0 } as any));
    api
      .get<GastoResumen>("/gastos/resumen", token)
      .then(setGastoResumen)
      .catch(() => setGastoResumen({ total_ars: 0, total_usd: 0 } as any));
    api
      .get<IngresoResumen>("/ingresos/resumen", token)
      .then(setIngresoResumen)
      .catch(() => setIngresoResumen({ total_ars: 0, total_usd: 0 } as any));
    Promise.all([
      api.get<Expediente[]>("/expedientes", token, { estado: "activo" }),
      api.get<Expediente[]>("/expedientes", token, { estado: "archivado" }),
      api.get<Expediente[]>("/expedientes", token, { estado: "cerrado" }),
    ]).then(([activos, archivados, cerrados]) => {
      setTotalExpedientes(activos.length);
      setExpStats({ activo: activos.length, archivado: archivados.length, cerrado: cerrados.length });
    }).catch(() => {
      setTotalExpedientes(0);
      setExpStats({ activo: 0, archivado: 0, cerrado: 0 });
    });
    api
      .get<Cliente[]>("/clientes", token)
      .then((cls) => setTotalClientes(cls.filter((c) => !c.archivado).length))
      .catch(() => setTotalClientes(0));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const todayStr = new Date().toISOString().split("T")[0];
    api.get<Tarea[]>("/tareas", token)
      .then((t) => setTareasHoy(t.filter((x) => x.estado !== "hecha" && x.fecha_limite && x.fecha_limite <= todayStr)))
      .catch(() => {});
  }, [token]);

  const vencimientosHoy = proximos.filter((v) => {
    const todayStr = new Date().toISOString().split("T")[0];
    return v.fecha === todayStr;
  });

  async function handleTareaHecha(id: string) {
    if (!token) return;
    setMarkingTarea(id);
    try {
      await api.patch<Tarea>(`/tareas/${id}`, { estado: "hecha" }, token);
      setTareasHoy((prev) => prev.filter((t) => t.id !== id));
    } catch {} finally { setMarkingTarea(null); }
  }

  const urgentes = proximos.filter((v) => isUrgente(v.fecha));

  async function handleCumplido(id: string) {
    if (!token) return;
    setMarking(id);
    try {
      await api.patch(`/vencimientos/${id}`, { cumplido: true }, token);
      setProximos((prev) => prev.filter((v) => v.id !== id));
    } catch {
    } finally {
      setMarking(null);
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
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
          description="Vista general del estado del estudio en tiempo real"
          items={[
            { icon: "📊", title: "Métricas principales", description: "Expedientes activos, clientes, vencimientos pendientes y urgentes. Todos con datos reales del estudio." },
            { icon: "🔴", title: "Urgentes (< 48hs)", description: "Vencimientos que vencen en menos de 48 horas. Requieren atención inmediata." },
            { icon: "✅", title: "Marcar cumplido", description: "Podés marcar vencimientos como cumplidos directamente desde el dashboard sin salir de esta pantalla." },
            { icon: "💰", title: "Honorarios pendientes", description: "Saldo total a cobrar en ARS y USD, y cuántos expedientes tienen deuda." },
            { icon: "📅", title: "Filtros de temporalidad", description: "Cambiá la vista entre Hoy, Esta semana, Este mes o Trimestre. El contador de vencimientos y la lista se actualizan al instante." },
          ]}
          tip="El dashboard se actualiza cada vez que ingresás. Para ver el historial completo, navegá a Vencimientos o Expedientes."
        />
      </div>

      {/* ── Bloque "Hoy" — siempre visible si hay items ── */}
      {(vencimientosHoy.length > 0 || tareasHoy.length > 0) && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-ink-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-sm font-semibold text-ink-900">Para hoy</span>
              <span className="text-xs text-ink-400 bg-ink-100 rounded-full px-2 py-0.5">
                {vencimientosHoy.length + tareasHoy.length}
              </span>
            </div>
            <Link href="/agenda" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver agenda →</Link>
          </div>
          <div className="divide-y divide-ink-50">
            {vencimientosHoy.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                <button
                  onClick={() => handleCumplido(v.id)}
                  disabled={marking === v.id}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition disabled:opacity-50"
                />
                <span className="flex-shrink-0 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">Vencimiento</span>
                <p className="flex-1 text-sm text-ink-800 font-medium truncate">{v.descripcion}</p>
                {isUrgente(v.fecha) && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">⚡ Urgente</span>}
              </div>
            ))}
            {tareasHoy.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <button
                  onClick={() => handleTareaHecha(t.id)}
                  disabled={markingTarea === t.id}
                  className="flex-shrink-0 w-5 h-5 rounded border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                />
                <span className="flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 uppercase tracking-wide">Tarea</span>
                <p className="flex-1 text-sm text-ink-800 font-medium truncate">{t.titulo}</p>
                {t.estado === "en_curso" && <span className="text-[10px] font-semibold text-blue-500">En curso</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — sin expedientes todavía */}
      {totalExpedientes === 0 ? (
        <div className="py-8">
          <div className="max-w-xl mx-auto text-center mb-10">
            <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">Tu estudio está listo</h2>
            <p className="text-sm text-ink-400 leading-relaxed">
              Para ver el dashboard en acción necesitás cargar tus primeros datos.<br />
              Seguí estos 3 pasos en orden.
            </p>
          </div>

          {/* Journey steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
            {[
              {
                step: "1",
                icon: "👤",
                title: "Agregá un cliente",
                desc: "Todo expediente necesita un cliente. Registrá su nombre, CUIT y datos de contacto.",
                href: "/clientes/nuevo",
                cta: "Nuevo cliente",
                color: "brand",
              },
              {
                step: "2",
                icon: "📁",
                title: "Creá un expediente",
                desc: "Asociá al cliente, asigná un responsable y definí el tipo de causa.",
                href: "/expedientes/nuevo",
                cta: "Nuevo expediente",
                color: "brand",
              },
              {
                step: "3",
                icon: "📅",
                title: "Cargá un vencimiento",
                desc: "Plazo de presentación, audiencia, pericia — lo que venza primero. LexCore te avisa.",
                href: "/vencimientos/nuevo",
                cta: "Nuevo vencimiento",
                color: "brand",
              },
            ].map((item, i) => {
              const done = (i === 0 && (totalClientes ?? 0) > 0);
              return (
                <div key={i} className={`border rounded-2xl p-5 shadow-sm flex flex-col transition-all ${done ? "bg-ink-50 border-ink-100 opacity-60" : "bg-white border-ink-100"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {done ? (
                      <span className="w-7 h-7 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0">✓</span>
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
                    )}
                    <span className="text-xl">{item.icon}</span>
                    {done && <span className="ml-auto text-xs text-green-600 font-medium">Completado</span>}
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${done ? "text-ink-400 line-through" : "text-ink-900"}`}>{item.title}</p>
                  <p className="text-xs text-ink-400 leading-relaxed mb-4 flex-1">{item.desc}</p>
                  {!done && (
                    <a href={item.href} className="w-full text-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
                      {item.cta}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-ink-300">
            También podés configurar tu equipo y perfil del estudio desde el menú lateral
          </p>
        </div>
      ) : (
        <>
          {/* Filtros de temporalidad */}
          <div className="flex items-center gap-2 flex-wrap">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriodo(p.value); localStorage.setItem("lexcore_dash_periodo", String(p.value)); }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  periodo === p.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white border border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-ink-400 ml-1">
              {PERIODOS.find((p) => p.value === periodo)?.sublabel}
            </span>
          </div>

          {/* Stats grid — operativos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Expedientes activos" value={totalExpedientes ?? "—"} loading={totalExpedientes === null} />
            <StatCard label="Clientes activos" value={totalClientes ?? "—"} loading={totalClientes === null} />
            <StatCard label="Vencimientos pendientes" value={proximos.length} trend={PERIODOS.find((p) => p.value === periodo)?.sublabel} trendColor="text-yellow-600" loading={loading} />
            <StatCard
              label="Urgentes (<48hs)"
              value={urgentes.length}
              trend={urgentes.length > 0 ? "requieren atención" : "todo en orden"}
              trendColor={urgentes.length > 0 ? "text-red-600" : "text-green-600"}
              loading={loading}
            />
          </div>
        </>
      )}

      {/* KPIs contables y resto — solo cuando hay expedientes */}
      {(totalExpedientes === null || totalExpedientes > 0) && <>

      {/* KPIs contables del mes */}
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
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Ingresos ARS</p>
                <p className="text-2xl font-bold text-green-700">
                  {loadingContable ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `$ ${Number(ingARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Egresos ARS</p>
                <p className="text-2xl font-bold text-red-600">
                  {loadingContable ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `$ ${Number(egARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
                </p>
              </div>
              <div className={`bg-white rounded-2xl border shadow-sm p-5 ${!loadingContable && resultadoARS >= 0 ? "border-green-100" : "border-red-100"}`}>
                <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Resultado ARS</p>
                <p className={`text-2xl font-bold ${loadingContable ? "text-ink-900" : resultadoARS >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {loadingContable ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `${resultadoARS >= 0 ? "+" : ""}$ ${Number(resultadoARS).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <p className="text-xs text-ink-400 uppercase tracking-wider font-medium mb-2">Hon. pendiente</p>
                <p className="text-2xl font-bold text-ink-900">
                  {honorarios === null ? <span className="inline-block w-24 h-7 bg-ink-100 rounded animate-pulse" /> : `$ ${Number(honorarios.saldo_pendiente_ars).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`}
                </p>
                {honorarios && <p className="text-xs text-ink-400 mt-1">{honorarios.expedientes_con_deuda} exp. con deuda</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gráfico expedientes por estado */}
      {expStats && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Expedientes</p>
              <p className="text-sm font-semibold text-ink-900 mt-0.5">
                {expStats.activo + expStats.archivado + expStats.cerrado} en total
              </p>
            </div>
            <a href="/expedientes" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver todos →</a>
          </div>
          <div className="flex gap-6 items-end">
            {/* Barchart */}
            <div className="flex-1 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Activos", value: expStats.activo, color: "#22c55e" },
                  { name: "Archivados", value: expStats.archivado, color: "#94a3b8" },
                  { name: "Cerrados", value: expStats.cerrado, color: "#f87171" },
                ]} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(v: unknown) => [v as number, "expedientes"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[
                      { color: "#22c55e" },
                      { color: "#94a3b8" },
                      { color: "#f87171" },
                    ].map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Leyenda lateral */}
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

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left col — vencimientos */}
        <div className="flex-1 lg:w-0 min-w-0">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">
                Vencimientos — {PERIODOS.find((p) => p.value === periodo)?.sublabel}
              </h2>
              <a href="/vencimientos" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Ver todos
              </a>
            </div>
            {loading ? (
              <div className="divide-y divide-ink-50">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-14 h-6 bg-ink-100 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-ink-100 rounded w-3/4" />
                      <div className="h-2.5 bg-ink-50 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : proximos.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-ink-400">Sin vencimientos en los próximos 30 días</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {proximos.slice(0, 8).map((v) => {
                  const urgente = isUrgente(v.fecha);
                  const warning = !urgente && isWarning(v.fecha);
                  return (
                    <div key={v.id} className={`flex items-center gap-3 px-5 py-3 ${urgente ? "bg-red-50/50" : ""}`}>
                      <span
                        className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          urgente
                            ? "bg-red-100 text-red-700"
                            : warning
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {formatFecha(v.fecha)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 truncate font-medium">{v.descripcion}</p>
                        <p className="text-xs text-ink-400 truncate">{v.tipo}</p>
                      </div>
                      <button
                        onClick={() => handleCumplido(v.id)}
                        disabled={marking === v.id}
                        className="flex-shrink-0 text-xs text-ink-400 hover:text-green-700 border border-ink-200 hover:border-green-300 hover:bg-green-50 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                      >
                        {marking === v.id ? "..." : "Cumplido"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">

          {/* Honorarios pendientes */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Honorarios pendientes</h2>
              <a href="/expedientes" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver expedientes</a>
            </div>
            <div className="divide-y divide-ink-50">
              {honorarios ? (
                <>
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-ink-600">Saldo ARS</span>
                    <span className="text-sm font-semibold text-ink-900">
                      {honorarios.saldo_pendiente_ars > 0
                        ? `$ ${Number(honorarios.saldo_pendiente_ars).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
                        : <span className="text-green-600 font-medium">Todo cobrado</span>
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-ink-600">Saldo USD</span>
                    <span className="text-sm font-semibold text-ink-900">
                      {honorarios.saldo_pendiente_usd > 0
                        ? `U$D ${Number(honorarios.saldo_pendiente_usd).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
                        : <span className="text-green-600 font-medium">Todo cobrado</span>
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-ink-600">Expedientes con saldo</span>
                    <span className="text-sm font-semibold text-ink-900">{honorarios.expedientes_con_deuda}</span>
                  </div>
                </>
              ) : (
                <div className="px-5 py-6 flex flex-col gap-2 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-3 bg-ink-100 rounded w-full" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Widget financiero — Este mes */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Este mes</h2>
              <a href="/gastos" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver contable</a>
            </div>
            <div className="divide-y divide-ink-50">
              {gastoResumen ? (
                <>
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-ink-600">Ingresos ARS</span>
                    <span className="text-sm font-semibold text-green-700">
                      {honorarios && honorarios.total_cobrado_ars > 0
                        ? `$ ${Number(honorarios.total_cobrado_ars).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
                        : "$ 0"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-ink-600">Gastos ARS</span>
                    <span className="text-sm font-semibold text-red-600">
                      {gastoResumen.total_ars > 0
                        ? `$ ${Number(gastoResumen.total_ars).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
                        : "$ 0"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3 bg-ink-50/50">
                    <span className="text-sm font-semibold text-ink-900">Resultado neto ARS</span>
                    <span className={`text-sm font-bold ${(Number(honorarios?.total_cobrado_ars ?? 0) - Number(gastoResumen.total_ars)) >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {(() => {
                        const neto = Number(honorarios?.total_cobrado_ars ?? 0) - Number(gastoResumen.total_ars);
                        return `${neto >= 0 ? "+" : ""}$ ${Math.abs(neto).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
                      })()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="px-5 py-6 flex flex-col gap-2 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-3 bg-ink-100 rounded w-full" />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      </>}
    </div>
  );
}
