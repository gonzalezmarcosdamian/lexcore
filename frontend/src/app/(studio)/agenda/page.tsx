"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Tarea, TareaEstado, TareaTipo, Vencimiento, Expediente } from "@/lib/api";
import { PeriodSelector, PeriodoValue, getDatesFromValue } from "@/components/ui/period-selector";
import { CalendarSyncButton } from "@/components/ui/calendar-sync-button";
import { AdjuntosInline } from "@/components/ui/adjuntos-inline";

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

// ── Edit Modals ───────────────────────────────────────────────────────────────

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

function EditTareaModal({ t, token, expedientes, onSaved, onClose }: { t: Tarea; token: string; expedientes: Expediente[]; onSaved: (u: Tarea) => void; onClose: () => void }) {
  const [titulo, setTitulo] = useState(t.titulo);
  const [fechaLimite, setFechaLimite] = useState(t.fecha_limite ?? "");
  const [estado, setEstado] = useState(t.estado);
  const [expedienteId, setExpedienteId] = useState(t.expediente_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo, estado, expediente_id: expedienteId || null };
      body.fecha_limite = fechaLimite || null;
      const updated = await api.patch<Tarea>(`/tareas/${t.id}`, body, token);
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

// ── Tarjeta Vencimiento ───────────────────────────────────────────────────────

function VencimientoCard({
  v, exp, token, onToggle, onEdit, onDelete,
}: {
  v: Vencimiento;
  exp?: Expediente;
  token: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = esVencida(v.fecha) && !v.cumplido;
  const urgente = esUrgente(v.fecha) && !v.cumplido;

  return (
    <div className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition ${
      v.cumplido      ? "bg-green-50 border-green-100 opacity-70" :
      vencida         ? "bg-red-50 border-red-200" :
      urgente         ? "bg-amber-50 border-amber-200" :
                        "bg-white border-ink-100 hover:border-ink-200"
    }`}>
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0 p-1 -m-1">
        {v.cumplido ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : (
          <div className={`w-5 h-5 rounded-full border-2 ${urgente ? "border-amber-400" : vencida ? "border-red-400" : "border-ink-300 hover:border-brand-400"}`} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Vencimiento
          </span>
          {urgente && <span className="text-[10px] font-bold text-amber-600">⚡ Urgente</span>}
          {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencido</span>}
        </div>
        <p className={`text-sm font-medium leading-snug ${v.cumplido ? "line-through text-ink-400" : "text-ink-900"}`}>{v.descripcion}</p>
        {exp ? (
          <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline mt-0.5 block truncate">
            {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
          </Link>
        ) : (
          <Link href={`/expedientes/${v.expediente_id}`} className="text-xs text-brand-600 hover:underline mt-1 block">Ver expediente →</Link>
        )}
        <AdjuntosInline vencimientoId={v.id} token={token} />
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={onDelete} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg font-semibold transition">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2 py-1 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition ml-1">
          <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta Tarea ─────────────────────────────────────────────────────────────

const ESTADO_CICLO: Record<TareaEstado, TareaEstado> = {
  pendiente: "en_curso",
  en_curso:  "hecha",
  hecha:     "pendiente",
};

const TIPO_TAREA_LABEL: Record<string, string> = { judicial: "⚖️", extrajudicial: "🤝", administrativa: "🏢", operativa: "🔧" };

function TareaCard({
  t, exp, token, onToggle, onEdit, onDelete,
}: {
  t: Tarea;
  exp?: Expediente;
  token: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = t.fecha_limite && esVencida(t.fecha_limite) && t.estado !== "hecha";

  return (
    <div className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition ${
      t.estado === "hecha" ? "bg-green-50 border-green-100 opacity-70" :
      vencida              ? "bg-red-50 border-red-200" :
      t.estado === "en_curso" ? "bg-blue-50 border-blue-100" :
                             "bg-white border-ink-100 hover:border-ink-200"
    }`}>
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0 p-1 -m-1" title={`Estado: ${t.estado} → click para avanzar`}>
        {t.estado === "hecha" ? (
          <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : t.estado === "en_curso" ? (
          <div className="w-5 h-5 rounded border-2 border-blue-400 bg-blue-100 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded border-2 border-ink-300 hover:border-brand-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            {TIPO_TAREA_LABEL[t.tipo] ?? ""} {t.tipo ?? "Tarea"}
          </span>
          {t.estado === "en_curso" && <span className="text-[10px] font-semibold text-blue-600">En curso</span>}
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
          {exp ? (
            <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline truncate max-w-[180px]">
              {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
            </Link>
          ) : t.expediente_id ? (
            <Link href={`/expedientes/${t.expediente_id}`} className="text-xs text-brand-600 hover:underline">Ver expediente →</Link>
          ) : null}
        </div>
        <AdjuntosInline tareaId={t.id} token={token} />
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={onDelete} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg font-semibold transition">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2 py-1 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition ml-1">
          <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      )}
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

function Columna({ titulo, color, icono, count, children }: {
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

  const now2 = new Date();
  const [periodoValue, setPeriodoValue] = useState<PeriodoValue>({
    periodo: "anio",
    desde: `${now2.getFullYear()}-01-01`,
    hasta: `${now2.getFullYear()}-12-31`,
  });
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);

  const [editingV, setEditingV] = useState<Vencimiento | null>(null);
  const [editingT, setEditingT] = useState<Tarea | null>(null);

  const [filtroTipoVenc, setFiltroTipoVenc] = useState<string>("");
  const [filtroTipoTarea, setFiltroTipoTarea] = useState<string>("");

  const [showTareaModal, setShowTareaModal] = useState(false);
  const [tareaForm, setTareaForm] = useState({ titulo: "", expediente_id: "", fecha_limite: "", descripcion: "", tipo: "judicial" as TareaTipo });
  const [savingTarea, setSavingTarea] = useState(false);
  const [tareaError, setTareaError] = useState("");

  const [showVencimientoModal, setShowVencimientoModal] = useState(false);
  const [vencimientoForm, setVencimientoForm] = useState({ descripcion: "", fecha: "", tipo: "vencimiento", expediente_id: "" });
  const [savingVencimiento, setSavingVencimiento] = useState(false);
  const [vencimientoError, setVencimientoError] = useState("");

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
    api.get<Expediente[]>("/expedientes", token).then(setExpedientes).catch(() => {});
  }, [token]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchData]);

  const expLookup = useMemo(() => {
    const map: Record<string, Expediente> = {};
    for (const e of expedientes) map[e.id] = e;
    return map;
  }, [expedientes]);

  const toggleVencimiento = async (v: Vencimiento) => {
    if (!token) return;
    const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { cumplido: !v.cumplido }, token);
    setVencimientos(prev => prev.map(x => x.id === v.id ? updated : x));
  };

  const deleteVencimiento = async (id: string) => {
    if (!token) return;
    await api.delete(`/vencimientos/${id}`, token);
    setVencimientos(prev => prev.filter(x => x.id !== id));
  };

  const deleteTarea = async (id: string) => {
    if (!token) return;
    await api.delete(`/tareas/${id}`, token);
    setTareas(prev => prev.filter(x => x.id !== id));
  };

  const handleCrearTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingTarea(true);
    setTareaError("");
    try {
      const created = await api.post<Tarea>("/tareas", {
        titulo: tareaForm.titulo,
        tipo: tareaForm.tipo,
        expediente_id: tareaForm.expediente_id || undefined,
        fecha_limite: tareaForm.fecha_limite || undefined,
        descripcion: tareaForm.descripcion || undefined,
      }, token);
      setTareas(prev => [...prev, created]);
      setShowTareaModal(false);
      setTareaForm({ titulo: "", expediente_id: "", fecha_limite: "", descripcion: "", tipo: "judicial" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear tarea";
      setTareaError(msg);
    } finally {
      setSavingTarea(false);
    }
  };

  const handleCrearVencimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingVencimiento(true);
    setVencimientoError("");
    try {
      const created = await api.post<Vencimiento>("/vencimientos", {
        descripcion: vencimientoForm.descripcion,
        fecha: vencimientoForm.fecha,
        tipo: vencimientoForm.tipo,
        expediente_id: vencimientoForm.expediente_id || undefined,
      }, token);
      setVencimientos(prev => [...prev, created]);
      setShowVencimientoModal(false);
      setVencimientoForm({ descripcion: "", fecha: "", tipo: "vencimiento", expediente_id: "" });
    } catch (err: unknown) {
      setVencimientoError(err instanceof Error ? err.message : "Error al crear vencimiento");
    } finally {
      setSavingVencimiento(false);
    }
  };

  const toggleTarea = async (t: Tarea) => {
    if (!token) return;
    const next = ESTADO_CICLO[t.estado];
    const updated = await api.patch<Tarea>(`/tareas/${t.id}`, { estado: next }, token);
    setTareas(prev => prev.map(x => x.id === t.id ? updated : x));
  };

  const { desde, hasta } = getDatesFromValue(periodoValue);

  const vFiltradas = vencimientos.filter(v => inRange(v.fecha, desde, hasta) && (!filtroTipoVenc || v.tipo === filtroTipoVenc));
  const tFiltradas = tareas.filter(t => t.fecha_limite && inRange(t.fecha_limite, desde, hasta) && (!filtroTipoTarea || t.tipo === filtroTipoTarea));

  const todasFechas = Array.from(new Set([
    ...vFiltradas.map(v => v.fecha),
    ...tFiltradas.map(t => t.fecha_limite!),
  ])).sort();

  const totalPendientes = vFiltradas.filter(v => !v.cumplido).length + tFiltradas.filter(t => t.estado !== "hecha").length;
  const urgentes = vFiltradas.filter(v => !v.cumplido && esUrgente(v.fecha)).length;
  const empty = vFiltradas.length === 0 && tFiltradas.length === 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      {editingV && token && (
        <EditVencimientoModal v={editingV} token={token} onSaved={(u) => { setVencimientos(prev => prev.map(x => x.id === u.id ? u : x)); setEditingV(null); }} onClose={() => setEditingV(null)} />
      )}
      {editingT && token && (
        <EditTareaModal t={editingT} token={token} expedientes={expedientes} onSaved={(u) => { setTareas(prev => prev.map(x => x.id === u.id ? u : x)); setEditingT(null); }} onClose={() => setEditingT(null)} />
      )}

      {/* Modal Nuevo Vencimiento */}
      {showVencimientoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink-900">Nuevo vencimiento</h2>
              <button onClick={() => setShowVencimientoModal(false)} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCrearVencimiento} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Descripción *</label>
                <input required value={vencimientoForm.descripcion} onChange={(e) => setVencimientoForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="Ej: Presentar memorial" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
                <input required type="date" value={vencimientoForm.fecha} onChange={(e) => setVencimientoForm(f => ({ ...f, fecha: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
                <select value={vencimientoForm.tipo} onChange={(e) => setVencimientoForm(f => ({ ...f, tipo: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="vencimiento">Vencimiento</option>
                  <option value="audiencia">Audiencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
                <select value={vencimientoForm.expediente_id} onChange={(e) => setVencimientoForm(f => ({ ...f, expediente_id: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">— Sin expediente —</option>
                  {expedientes.map((ex) => <option key={ex.id} value={ex.id}>{ex.numero} · {ex.cliente_nombre ?? ex.caratula}</option>)}
                </select>
              </div>
              {vencimientoError && <p className="text-xs text-red-500">{vencimientoError}</p>}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowVencimientoModal(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
                <button type="submit" disabled={savingVencimiento} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{savingVencimiento ? "Guardando…" : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-semibold transition"
          >
            + Tarea
          </button>
          <button
            onClick={() => { setShowVencimientoModal(true); setVencimientoError(""); }}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-semibold transition"
          >
            + Vencimiento
          </button>
          <CalendarSyncButton variant="compact" />
        </div>
      </div>

      <PeriodSelector value={periodoValue} onChange={setPeriodoValue} />

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
            No hay vencimientos ni tareas con fecha en este período.
            {periodoValue.periodo !== "anio" && (
              <> <button onClick={() => setPeriodoValue({ periodo: "anio", desde: `${new Date().getFullYear()}-01-01`, hasta: `${new Date().getFullYear()}-12-31` })} className="text-brand-600 hover:underline font-medium">Ver este año →</button></>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setShowVencimientoModal(true); setVencimientoError(""); }} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-semibold transition">
              + Vencimiento
            </button>
            <Link href="/expedientes" className="text-xs border border-ink-200 text-ink-600 hover:bg-ink-50 px-3 py-1.5 rounded-lg font-medium transition">
              Ver expedientes
            </Link>
          </div>
        </div>
      )}

      {!loading && !empty && (
        <>
          {/* Filtros de tipo */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-500">Vencimientos:</span>
              {(["", "vencimiento", "audiencia", "presentacion", "pericia", "otro"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipoVenc(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${filtroTipoVenc === t ? "bg-purple-600 text-white border-purple-600" : "bg-white text-ink-500 border-ink-200 hover:border-purple-300"}`}>
                  {t === "" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-500">Tareas:</span>
              {(["", "judicial", "extrajudicial", "administrativa", "operativa"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipoTarea(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${filtroTipoTarea === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-ink-500 border-ink-200 hover:border-blue-300"}`}>
                  {t === "" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Desktop */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            <Columna titulo="Vencimientos" color="border-purple-300" count={vFiltradas.length}
              icono={<svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            >
              {vFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-ink-400">Sin vencimientos en este período</p>
                  <button onClick={() => { setShowVencimientoModal(true); setVencimientoError(""); }} className="text-xs text-purple-600 hover:underline mt-1 block">+ Agregar vencimiento</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {todasFechas.filter(f => vFiltradas.some(v => v.fecha === f)).map(fecha => (
                    <div key={fecha}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>{formatFecha(fecha)}</p>
                      <div className="space-y-2">
                        {vFiltradas.filter(v => v.fecha === fecha).map(v => (
                          <VencimientoCard key={v.id} v={v} exp={expLookup[v.expediente_id]} token={token!} onToggle={() => toggleVencimiento(v)} onEdit={() => setEditingV(v)} onDelete={() => deleteVencimiento(v.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Columna>

            <Columna titulo="Tareas" color="border-blue-300" count={tFiltradas.length}
              icono={<svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            >
              {tFiltradas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-ink-400">Sin tareas con fecha en este período</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {todasFechas.filter(f => tFiltradas.some(t => t.fecha_limite === f)).map(fecha => (
                    <div key={fecha}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>{formatFecha(fecha)}</p>
                      <div className="space-y-2">
                        {tFiltradas.filter(t => t.fecha_limite === fecha).map(t => (
                          <TareaCard key={t.id} t={t} exp={t.expediente_id ? expLookup[t.expediente_id] : undefined} token={token!} onToggle={() => toggleTarea(t)} onEdit={() => setEditingT(t)} onDelete={() => deleteTarea(t.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Columna>
          </div>

          {/* Mobile */}
          <div className="lg:hidden space-y-6">
            {todasFechas.map(fecha => {
              const vDia = vFiltradas.filter(v => v.fecha === fecha);
              const tDia = tFiltradas.filter(t => t.fecha_limite === fecha);
              return (
                <div key={fecha}>
                  <div className="flex items-center gap-3 mb-2">
                    <p className={`text-xs font-bold uppercase tracking-wider ${fecha === today ? "text-brand-600" : "text-ink-400"}`}>{formatFecha(fecha)}</p>
                    <div className="flex-1 h-px bg-ink-100" />
                  </div>
                  <div className="space-y-2">
                    {vDia.map(v => <VencimientoCard key={v.id} v={v} exp={expLookup[v.expediente_id]} token={token!} onToggle={() => toggleVencimiento(v)} onEdit={() => setEditingV(v)} onDelete={() => deleteVencimiento(v.id)} />)}
                    {tDia.map(t => <TareaCard key={t.id} t={t} exp={t.expediente_id ? expLookup[t.expediente_id] : undefined} token={token!} onToggle={() => toggleTarea(t)} onEdit={() => setEditingT(t)} onDelete={() => deleteTarea(t.id)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal: Nueva tarea */}
      {showTareaModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowTareaModal(false); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
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
                <input required autoFocus value={tareaForm.titulo} onChange={(e) => setTareaForm({ ...tareaForm, titulo: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" placeholder="Ej: Redactar escrito de responde" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Tipo</label>
                <select value={tareaForm.tipo} onChange={(e) => setTareaForm({ ...tareaForm, tipo: e.target.value as TareaTipo })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition">
                  <option value="judicial">⚖️ Judicial</option>
                  <option value="extrajudicial">🤝 Extrajudicial</option>
                  <option value="administrativa">🏢 Administrativa</option>
                  <option value="operativa">🔧 Operativa</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Expediente</label>
                  <select value={tareaForm.expediente_id} onChange={(e) => setTareaForm({ ...tareaForm, expediente_id: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition">
                    <option value="">Sin expediente</option>
                    {expedientes.map((exp) => <option key={exp.id} value={exp.id}>{exp.numero} — {exp.caratula}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Fecha límite</label>
                  <input type="date" value={tareaForm.fecha_limite} onChange={(e) => setTareaForm({ ...tareaForm, fecha_limite: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Descripción</label>
                <input value={tareaForm.descripcion} onChange={(e) => setTareaForm({ ...tareaForm, descripcion: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowTareaModal(false)} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-3 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
                <button type="submit" disabled={savingTarea} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 text-sm font-semibold transition shadow-sm disabled:opacity-50">{savingTarea ? "Creando…" : "Crear tarea"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
