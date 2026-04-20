"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Tarea, TareaEstado, Vencimiento, Expediente } from "@/lib/api";

type Periodo = "hoy" | "semana" | "mes" | "anio";

const PERIODO_LABELS: Record<Periodo, string> = {
  hoy:    "Hoy",
  semana: "Esta semana",
  mes:    "Este mes",
  anio:   "Este año",
};

function getDates(periodo: Periodo): { desde: string; hasta: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  if (periodo === "hoy") return { desde: today, hasta: today };

  if (periodo === "semana") {
    const day = now.getDay() || 7;
    const lunes = new Date(now); lunes.setDate(now.getDate() - day + 1);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { desde: fmt(lunes), hasta: fmt(domingo) };
  }

  if (periodo === "mes") {
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { desde: fmt(inicio), hasta: fmt(fin) };
  }

  // Este año
  return { desde: `${now.getFullYear()}-01-01`, hasta: `${now.getFullYear()}-12-31` };
}

function inRange(fecha: string, desde: string, hasta: string): boolean {
  return fecha >= desde && fecha <= hasta;
}

function esVencida(fecha: string): boolean {
  return new Date(fecha + "T23:59:59") < new Date();
}

function esUrgente(fecha: string): boolean {
  const diff = (new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff < 48;
}

const today = new Date().toISOString().split("T")[0];

function formatFecha(f: string): string {
  if (f === today) return "Hoy";
  const d = new Date(f + "T12:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

// ── Tarjeta Vencimiento ───────────────────────────────────────────────────────

function VencimientoCard({ v, onToggle }: { v: Vencimiento; onToggle: () => void }) {
  const vencida = esVencida(v.fecha) && !v.cumplido;
  const urgente = esUrgente(v.fecha) && !v.cumplido;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition ${
      v.cumplido      ? "bg-green-50 border-green-100 opacity-70" :
      vencida         ? "bg-red-50 border-red-200" :
      urgente         ? "bg-amber-50 border-amber-200" :
                        "bg-white border-ink-100 hover:border-ink-200"
    }`}>
      {/* Checkbox circular */}
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
        {v.cumplido ? (
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : (
          <div className={`w-4 h-4 rounded-full border-2 ${urgente ? "border-amber-400" : vencida ? "border-red-400" : "border-ink-300 hover:border-brand-400"}`} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Badge tipo */}
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Vencimiento
          </span>
          {urgente && <span className="text-[10px] font-bold text-amber-600">⚡ Urgente</span>}
          {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencido</span>}
        </div>
        <p className={`text-sm font-medium leading-snug ${v.cumplido ? "line-through text-ink-400" : "text-ink-900"}`}>{v.descripcion}</p>
        {v.tipo && v.tipo !== "vencimiento" && (
          <p className="text-xs text-ink-400 mt-0.5">{v.tipo}</p>
        )}
        <Link href={`/expedientes/${v.expediente_id}`} className="text-xs text-brand-600 hover:underline mt-1 block">
          Ver expediente →
        </Link>
      </div>
    </div>
  );
}

// ── Tarjeta Tarea ─────────────────────────────────────────────────────────────

const ESTADO_CICLO: Record<TareaEstado, TareaEstado> = {
  pendiente: "en_curso",
  en_curso:  "hecha",
  hecha:     "pendiente",
};

function TareaCard({ t, onToggle }: { t: Tarea; onToggle: () => void }) {
  const vencida = t.fecha_limite && esVencida(t.fecha_limite) && t.estado !== "hecha";

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition ${
      t.estado === "hecha" ? "bg-green-50 border-green-100 opacity-70" :
      vencida              ? "bg-red-50 border-red-200" :
      t.estado === "en_curso" ? "bg-blue-50 border-blue-100" :
                             "bg-white border-ink-100 hover:border-ink-200"
    }`}>
      {/* Checkbox cuadrado */}
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0" title={`Estado: ${t.estado} → click para avanzar`}>
        {t.estado === "hecha" ? (
          <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : t.estado === "en_curso" ? (
          <div className="w-4 h-4 rounded border-2 border-blue-400 bg-blue-100 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
        ) : (
          <div className="w-4 h-4 rounded border-2 border-ink-300 hover:border-brand-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Badge tipo */}
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Tarea
          </span>
          {t.estado === "en_curso" && (
            <span className="text-[10px] font-semibold text-blue-600">En curso</span>
          )}
          {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencida</span>}
        </div>
        <p className={`text-sm font-medium leading-snug ${t.estado === "hecha" ? "line-through text-ink-400" : "text-ink-900"}`}>{t.titulo}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {t.responsable_nombre && (
            <span className="text-xs text-ink-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {t.responsable_nombre}
            </span>
          )}
          {t.expediente_id && (
            <Link href={`/expedientes/${t.expediente_id}`} className="text-xs text-brand-600 hover:underline">
              Ver expediente →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  );
}

// ── Columna ───────────────────────────────────────────────────────────────────

function Columna({
  titulo, color, icono, count, children,
}: {
  titulo: string; color: string; icono: React.ReactNode; count: number; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 pb-2 border-b-2 ${color}`}>
        {icono}
        <span className="text-sm font-bold text-ink-800">{titulo}</span>
        <span className="ml-auto text-xs font-semibold text-ink-400">{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [tareaForm, setTareaForm] = useState({ titulo: "", expediente_id: "", fecha_limite: "", descripcion: "" });
  const [savingTarea, setSavingTarea] = useState(false);
  const [tareaError, setTareaError] = useState("");
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.get<Vencimiento[]>("/vencimientos", token, { proximos: 365 }),
      api.get<Tarea[]>("/tareas", token),
    ]).then(([v, t]) => {
      setVencimientos(v);
      setTareas(t);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token, { estado: "activo" }).then(setExpedientes).catch(() => {});
  }, [token]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  const toggleVencimiento = async (v: Vencimiento) => {
    if (!token) return;
    const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { cumplido: !v.cumplido }, token);
    setVencimientos(prev => prev.map(x => x.id === v.id ? updated : x));
  };

  const handleCrearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingTarea(true);
    setTareaError("");
    try {
      const created = await api.post<Tarea>("/tareas", {
        titulo: tareaForm.titulo,
        expediente_id: tareaForm.expediente_id || undefined,
        fecha_limite: tareaForm.fecha_limite || undefined,
        descripcion: tareaForm.descripcion || undefined,
      }, token);
      setTareas(prev => [...prev, created]);
      setShowTareaModal(false);
      setTareaForm({ titulo: "", expediente_id: "", fecha_limite: "", descripcion: "" });
    } catch (err: unknown) {
      setTareaError(err instanceof Error ? err.message : "Error al crear tarea");
    } finally {
      setSavingTarea(false);
    }
  };

  const toggleTarea = async (t: Tarea) => {
    if (!token) return;
    const next = ESTADO_CICLO[t.estado];
    const updated = await api.patch<Tarea>(`/tareas/${t.id}`, { estado: next }, token);
    setTareas(prev => prev.map(x => x.id === t.id ? updated : x));
  };

  const { desde, hasta } = getDates(periodo);

  const vFiltradas = vencimientos.filter(v => inRange(v.fecha, desde, hasta));
  const tFiltradas = tareas.filter(t => t.fecha_limite && inRange(t.fecha_limite, desde, hasta));

  // Fechas únicas de ambas columnas
  const todasFechas = Array.from(new Set([
    ...vFiltradas.map(v => v.fecha),
    ...tFiltradas.map(t => t.fecha_limite!),
  ])).sort();

  const totalPendientes = vFiltradas.filter(v => !v.cumplido).length + tFiltradas.filter(t => t.estado !== "hecha").length;
  const urgentes = vFiltradas.filter(v => !v.cumplido && esUrgente(v.fecha)).length;
  const empty = vFiltradas.length === 0 && tFiltradas.length === 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Agenda</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {totalPendientes} pendiente{totalPendientes !== 1 ? "s" : ""}
            {urgentes > 0 && <span className="ml-2 text-red-600 font-semibold">· {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowTareaModal(true); setTareaError(""); }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition hidden sm:block"
          >
            + Tarea
          </button>
          <Link href="/vencimientos/nuevo" className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold transition hidden sm:block">
            + Vencimiento
          </Link>
        </div>
      </div>

      {/* Selector de período */}
      <div className="flex gap-1 bg-ink-50 rounded-xl p-1 w-fit">
        {(["hoy", "semana", "mes", "anio"] as Periodo[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`text-sm px-4 py-1.5 rounded-lg font-medium transition ${
              periodo === p ? "bg-white shadow-sm text-ink-900" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {PERIODO_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 flex-shrink-0" />
          Vencimientos procesales
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-blue-400 flex-shrink-0" />
          Tareas internas
        </span>
      </div>

      {loading && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div><Skeleton /></div>
          <div><Skeleton /></div>
        </div>
      )}

      {!loading && empty && (
        <div className="text-center py-12">
          <p className="text-sm font-semibold text-ink-700 mb-1">Sin eventos en este período</p>
          <p className="text-xs text-ink-400 mb-4">
            No hay vencimientos ni tareas con fecha en {PERIODO_LABELS[periodo].toLowerCase()}.
            {periodo !== "anio" && (
              <> <button onClick={() => setPeriodo("anio")} className="text-brand-600 hover:underline font-medium">Ver este año →</button></>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/vencimientos/nuevo" className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold transition">
              + Vencimiento
            </Link>
            <Link href="/expedientes" className="text-xs border border-ink-200 text-ink-600 hover:bg-ink-50 px-3 py-1.5 rounded-lg font-medium transition">
              Ver expedientes
            </Link>
          </div>
        </div>
      )}

      {/* ── Layout dos columnas en desktop, stack en mobile ── */}
      {!loading && !empty && (
        <>
          {/* Desktop: columnas fijas lado a lado */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            {/* Col Vencimientos */}
            <Columna
              titulo="Vencimientos"
              color="border-purple-300"
              count={vFiltradas.length}
              icono={
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              {vFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-ink-400">Sin vencimientos en este período</p>
                  <Link href="/vencimientos/nuevo" className="text-xs text-purple-600 hover:underline mt-1 block">+ Agregar vencimiento</Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {todasFechas.filter(f => vFiltradas.some(v => v.fecha === f)).map(fecha => (
                    <div key={fecha}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>
                        {formatFecha(fecha)}
                      </p>
                      <div className="space-y-2">
                        {vFiltradas.filter(v => v.fecha === fecha).map(v => (
                          <VencimientoCard key={v.id} v={v} onToggle={() => toggleVencimiento(v)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Columna>

            {/* Col Tareas */}
            <Columna
              titulo="Tareas"
              color="border-blue-300"
              count={tFiltradas.length}
              icono={
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            >
              {tFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-ink-400">Sin tareas con fecha en este período</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {todasFechas.filter(f => tFiltradas.some(t => t.fecha_limite === f)).map(fecha => (
                    <div key={fecha}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>
                        {formatFecha(fecha)}
                      </p>
                      <div className="space-y-2">
                        {tFiltradas.filter(t => t.fecha_limite === fecha).map(t => (
                          <TareaCard key={t.id} t={t} onToggle={() => toggleTarea(t)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Columna>
          </div>

          {/* Mobile: cronológico intercalado con badges diferenciados */}
          <div className="lg:hidden space-y-6">
            {todasFechas.map(fecha => {
              const vDia = vFiltradas.filter(v => v.fecha === fecha);
              const tDia = tFiltradas.filter(t => t.fecha_limite === fecha);
              return (
                <div key={fecha}>
                  <div className="flex items-center gap-3 mb-2">
                    <p className={`text-xs font-bold uppercase tracking-wider ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>
                      {formatFecha(fecha)}
                    </p>
                    <div className="flex-1 h-px bg-ink-100" />
                  </div>
                  <div className="space-y-2">
                    {vDia.map(v => <VencimientoCard key={v.id} v={v} onToggle={() => toggleVencimiento(v)} />)}
                    {tDia.map(t => <TareaCard key={t.id} t={t} onToggle={() => toggleTarea(t)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modal: Nueva tarea ── */}
      {showTareaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowTareaModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">Nueva tarea</h2>
              <button onClick={() => setShowTareaModal(false)} className="text-ink-400 hover:text-ink-700 transition p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCrearTarea} className="px-6 py-5 space-y-4">
              {tareaError && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{tareaError}</div>}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Título <span className="text-red-500">*</span></label>
                <input
                  required
                  autoFocus
                  value={tareaForm.titulo}
                  onChange={(e) => setTareaForm({ ...tareaForm, titulo: e.target.value })}
                  className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  placeholder="Ej: Redactar escrito de responde"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Expediente</label>
                  <select
                    value={tareaForm.expediente_id}
                    onChange={(e) => setTareaForm({ ...tareaForm, expediente_id: e.target.value })}
                    className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  >
                    <option value="">Sin expediente</option>
                    {expedientes.map((exp) => <option key={exp.id} value={exp.id}>{exp.numero} — {exp.caratula}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Fecha límite</label>
                  <input
                    type="date"
                    value={tareaForm.fecha_limite}
                    onChange={(e) => setTareaForm({ ...tareaForm, fecha_limite: e.target.value })}
                    className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Descripción</label>
                <input
                  value={tareaForm.descripcion}
                  onChange={(e) => setTareaForm({ ...tareaForm, descripcion: e.target.value })}
                  className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowTareaModal(false)} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                <button type="submit" disabled={savingTarea} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">{savingTarea ? "Creando…" : "Crear tarea"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
