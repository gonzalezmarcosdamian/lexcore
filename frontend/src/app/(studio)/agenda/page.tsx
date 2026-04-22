"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Tarea, TareaEstado, TareaTipo, Vencimiento, Expediente, Cliente } from "@/lib/api";
import { PeriodSelector, PeriodoValue, getDatesFromValue } from "@/components/ui/period-selector";
import { CalendarSyncButton } from "@/components/ui/calendar-sync-button";
import { AdjuntosInline } from "@/components/ui/adjuntos-inline";
import { CalendarioMensual, CalEvent, DiaInhabil } from "@/components/ui/calendar-mensual";

function esVencida(fecha: string): boolean {
  return new Date(fecha + "T23:59:59") < new Date();
}

function esUrgente(fecha: string): boolean {
  const diff = (new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff < 48;
}

function formatFecha(f: string): string {
  const today = new Date().toISOString().split("T")[0];
  if (f === today) return "Hoy";
  const d = new Date(f + "T12:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

// ── JIRA-style Status Pill ────────────────────────────────────────────────────

const VENC_ESTADOS = [
  { value: "pendiente", label: "PENDIENTE", cls: "bg-ink-100 text-ink-600" },
  { value: "cumplido",  label: "CUMPLIDO",  cls: "bg-green-100 text-green-700" },
] as const;

const TAREA_ESTADOS = [
  { value: "pendiente", label: "PENDIENTE", cls: "bg-ink-100 text-ink-600" },
  { value: "en_curso",  label: "EN CURSO",  cls: "bg-blue-100 text-blue-700" },
  { value: "hecha",     label: "HECHO",     cls: "bg-green-100 text-green-700" },
] as const;

function VencimientoStatusPill({ cumplido, onChange }: { cumplido: boolean; onChange: (c: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = cumplido ? VENC_ESTADOS[1] : VENC_ESTADOS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase cursor-pointer select-none transition ${current.cls}`}
      >
        {current.label}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-ink-200 rounded-lg shadow-lg py-1 min-w-[130px]">
          {VENC_ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => { onChange(e.value === "cumplido"); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-ink-50 transition ${e.value === current.value ? "opacity-40 cursor-default" : ""}`}
            >
              <span className={`inline-block px-1.5 py-0.5 rounded ${e.cls}`}>{e.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TareaStatusPill({ estado, onChange }: { estado: TareaEstado; onChange: (e: TareaEstado) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = TAREA_ESTADOS.find(e => e.value === estado) ?? TAREA_ESTADOS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase cursor-pointer select-none transition ${current.cls}`}
      >
        {current.label}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-ink-200 rounded-lg shadow-lg py-1 min-w-[130px]">
          {TAREA_ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => { onChange(e.value as TareaEstado); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase hover:bg-ink-50 transition ${e.value === estado ? "opacity-40 cursor-default" : ""}`}
            >
              <span className={`inline-block px-1.5 py-0.5 rounded ${e.cls}`}>{e.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Modals ───────────────────────────────────────────────────────────────

function EditVencimientoModal({ v, token, onSaved, onClose }: { v: Vencimiento; token: string; onSaved: (u: Vencimiento) => void; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(v.descripcion);
  const [fecha, setFecha] = useState(v.fecha);
  const [hora, setHora] = useState(v.hora ?? "");
  const [tipo, setTipo] = useState(v.tipo);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { descripcion, fecha, hora: hora || null, tipo }, token);
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
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
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
  const [hora, setHora] = useState(t.hora ?? "");
  const [estado, setEstado] = useState(t.estado);
  const [expedienteId, setExpedienteId] = useState(t.expediente_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo, estado, expediente_id: expedienteId || null };
      body.fecha_limite = fechaLimite || null;
      body.hora = hora || null;
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
              <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
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
  v, exp, token, onToggle, onEdit, onDelete, onDetail, draggable: isDraggable, onDragStart,
}: {
  v: Vencimiento;
  exp?: Expediente;
  token: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetail?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = esVencida(v.fecha) && !v.cumplido;
  const urgente = esUrgente(v.fecha) && !v.cumplido;

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        v.cumplido      ? "bg-green-50 border-green-100 opacity-70" :
        vencida         ? "bg-red-50 border-red-200" :
        urgente         ? "bg-amber-50 border-amber-200" :
                          "bg-white border-ink-100 hover:border-ink-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <VencimientoStatusPill cumplido={v.cumplido} onChange={onToggle} />
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {v.tipo ?? "Vencimiento"}
          </span>
          {urgente && <span className="text-[10px] font-bold text-amber-600">⚡ Urgente</span>}
          {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencido</span>}
        </div>
        <button onClick={onDetail} className={`text-sm font-medium leading-snug text-left hover:text-brand-600 transition ${v.cumplido ? "line-through text-ink-400" : "text-ink-900"}`}>{v.descripcion}</button>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-ink-400">{formatFecha(v.fecha)}{v.hora ? ` · ${v.hora}` : ""}</span>
          {exp ? (
            <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline truncate">
              {exp.numero}{exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
            </Link>
          ) : (
            <Link href={`/expedientes/${v.expediente_id}`} className="text-xs text-brand-600 hover:underline">Ver expediente →</Link>
          )}
        </div>
        <AdjuntosInline vencimientoId={v.id} token={token} />
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={onDelete} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg font-semibold transition">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2 py-1 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-1">
          <button onClick={onDetail} title="Ver detalle" className="p-1.5 rounded-lg text-ink-300 hover:text-brand-600 hover:bg-brand-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition">
            <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta Tarea ─────────────────────────────────────────────────────────────

const TIPO_TAREA_LABEL: Record<string, string> = { judicial: "⚖️", extrajudicial: "🤝", administrativa: "🏢", operativa: "🔧" };

function TareaCard({
  t, exp, token, onToggle, onEdit, onDelete, onDetail, draggable: isDraggable, onDragStart,
}: {
  t: Tarea;
  exp?: Expediente;
  token: string;
  onToggle: (estado: TareaEstado) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetail?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const vencida = t.fecha_limite && esVencida(t.fecha_limite) && t.estado !== "hecha";

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        t.estado === "hecha"    ? "bg-green-50 border-green-100 opacity-70" :
        vencida                 ? "bg-red-50 border-red-200" :
        t.estado === "en_curso" ? "bg-blue-50 border-blue-100" :
                                  "bg-white border-ink-100 hover:border-ink-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <TareaStatusPill estado={t.estado} onChange={onToggle} />
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            {TIPO_TAREA_LABEL[t.tipo] ?? ""} {t.tipo ?? "Tarea"}
          </span>
          {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencida</span>}
        </div>
        <button onClick={onDetail} className={`text-sm font-medium leading-snug text-left hover:text-brand-600 transition ${t.estado === "hecha" ? "line-through text-ink-400" : "text-ink-900"}`}>{t.titulo}</button>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {t.fecha_limite && <span className="text-xs text-ink-400">{formatFecha(t.fecha_limite)}{t.hora ? ` · ${t.hora}` : ""}</span>}
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

      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={onDelete} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg font-semibold transition">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2 py-1 rounded-lg hover:bg-ink-50 transition">No</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-1">
          <button onClick={onDetail} title="Ver detalle" className="p-1.5 rounded-lg text-ink-300 hover:text-brand-600 hover:bg-brand-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition">
            <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
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

// ── Kanban Tablero ────────────────────────────────────────────────────────────

type KanbanCol = "pendiente" | "en_curso" | "hecho";

const KANBAN_COLS: { id: KanbanCol; label: string; headerCls: string; bgCls: string }[] = [
  { id: "pendiente", label: "PENDIENTE", headerCls: "border-ink-300 text-ink-600",    bgCls: "bg-ink-50/60" },
  { id: "en_curso",  label: "EN CURSO",  headerCls: "border-blue-400 text-blue-700",  bgCls: "bg-blue-50/40" },
  { id: "hecho",     label: "HECHO",     headerCls: "border-green-400 text-green-700", bgCls: "bg-green-50/30" },
];

function AgendaTablero({
  vencimientos, tareas, expLookup, token,
  onToggleVenc, onToggleTarea,
  onEditVenc, onEditTarea,
  onDeleteVenc, onDeleteTarea,
  onDetailVenc, onDetailTarea,
}: {
  vencimientos: Vencimiento[];
  tareas: Tarea[];
  expLookup: Record<string, Expediente>;
  token: string;
  onToggleVenc: (v: Vencimiento) => void;
  onToggleTarea: (t: Tarea, estado: TareaEstado) => void;
  onEditVenc: (v: Vencimiento) => void;
  onEditTarea: (t: Tarea) => void;
  onDeleteVenc: (id: string) => void;
  onDeleteTarea: (id: string) => void;
  onDetailVenc: (v: Vencimiento) => void;
  onDetailTarea: (t: Tarea) => void;
}) {
  const [dragOver, setDragOver] = useState<KanbanCol | null>(null);
  const dragRef = useRef<{ type: "v" | "t"; id: string } | null>(null);

  const colVenc = (col: KanbanCol): Vencimiento[] => {
    if (col === "pendiente") return vencimientos.filter(v => !v.cumplido);
    if (col === "hecho")     return vencimientos.filter(v => v.cumplido);
    return [];
  };

  const colTarea = (col: KanbanCol): Tarea[] => {
    if (col === "pendiente") return tareas.filter(t => t.estado === "pendiente");
    if (col === "en_curso")  return tareas.filter(t => t.estado === "en_curso");
    return tareas.filter(t => t.estado === "hecha");
  };

  const handleDrop = (col: KanbanCol) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "v") {
      const venc = vencimientos.find(v => v.id === drag.id);
      if (!venc) return;
      const shouldBeCumplido = col === "hecho";
      if (venc.cumplido !== shouldBeCumplido) onToggleVenc(venc);
    } else {
      const tarea = tareas.find(t => t.id === drag.id);
      if (!tarea) return;
      const estadoMap: Record<KanbanCol, TareaEstado> = { pendiente: "pendiente", en_curso: "en_curso", hecho: "hecha" };
      const nuevoEstado = estadoMap[col];
      if (tarea.estado !== nuevoEstado) onToggleTarea(tarea, nuevoEstado);
    }
    dragRef.current = null;
    setDragOver(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {KANBAN_COLS.map(col => {
        const vs = colVenc(col.id);
        const ts = colTarea(col.id);
        const total = vs.length + ts.length;
        const isOver = dragOver === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(col.id)}
            className={`flex flex-col gap-2 min-h-[200px] rounded-xl p-3 transition-colors ${col.bgCls} ${isOver ? "ring-2 ring-brand-400 ring-inset" : ""}`}
          >
            {/* Column header */}
            <div className={`flex items-center gap-2 pb-2 border-b-2 ${col.headerCls} mb-1`}>
              <span className="text-xs font-bold tracking-wider">{col.label}</span>
              <span className="ml-auto text-xs font-semibold text-ink-400">{total}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {vs.map(v => (
                <VencimientoCard
                  key={v.id}
                  v={v}
                  exp={expLookup[v.expediente_id]}
                  token={token}
                  draggable
                  onDragStart={(e) => { dragRef.current = { type: "v", id: v.id }; e.dataTransfer.effectAllowed = "move"; }}
                  onToggle={() => onToggleVenc(v)}
                  onEdit={() => onEditVenc(v)}
                  onDelete={() => onDeleteVenc(v.id)}
                  onDetail={() => onDetailVenc(v)}
                />
              ))}
              {ts.map(t => (
                <TareaCard
                  key={t.id}
                  t={t}
                  exp={t.expediente_id ? expLookup[t.expediente_id] : undefined}
                  token={token}
                  draggable
                  onDragStart={(e) => { dragRef.current = { type: "t", id: t.id }; e.dataTransfer.effectAllowed = "move"; }}
                  onToggle={(estado) => onToggleTarea(t, estado)}
                  onEdit={() => onEditTarea(t)}
                  onDelete={() => onDeleteTarea(t.id)}
                  onDetail={() => onDetailTarea(t)}
                />
              ))}
              {total === 0 && (
                <p className="text-xs text-ink-300 text-center py-6 italic">Sin items</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

type Vista = "tablero" | "calendario";

export default function AgendaPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const router = useRouter();

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
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [inhabiles, setInhabiles] = useState<DiaInhabil[]>([]);
  const [vista, setVista] = useState<Vista>("tablero");
  const now3 = new Date();
  const [calMes, setCalMes] = useState(now3.getMonth() + 1);
  const [calAnio, setCalAnio] = useState(now3.getFullYear());

  const [editingV, setEditingV] = useState<Vencimiento | null>(null);
  const [editingT, setEditingT] = useState<Tarea | null>(null);

  const [filtroTipoVenc, setFiltroTipoVenc] = useState<string>("");
  const [filtroTipoTarea, setFiltroTipoTarea] = useState<string>("");

  const [diaPickerFecha, setDiaPickerFecha] = useState<string | null>(null);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [tareaForm, setTareaForm] = useState({ titulo: "", expediente_id: "", cliente_id: "", fecha_limite: "", hora: "", descripcion: "", tipo: "judicial" as TareaTipo });
  const [savingTarea, setSavingTarea] = useState(false);
  const [tareaError, setTareaError] = useState("");

  const [showVencimientoModal, setShowVencimientoModal] = useState(false);
  const [vencimientoForm, setVencimientoForm] = useState({ descripcion: "", fecha: "", hora: "", tipo: "vencimiento", expediente_id: "" });
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
    api.get<Cliente[]>("/clientes", token).then(setClientes).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const desde = `${calAnio}-${String(calMes).padStart(2, "0")}-01`;
    const lastDay = new Date(calAnio, calMes, 0).getDate();
    const hasta = `${calAnio}-${String(calMes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    api.get<DiaInhabil[]>("/feriados", token, { desde, hasta }).then(setInhabiles).catch(() => {});
  }, [token, calMes, calAnio]);

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
        cliente_id: tareaForm.cliente_id || undefined,
        fecha_limite: tareaForm.fecha_limite || undefined,
        hora: tareaForm.hora || undefined,
        descripcion: tareaForm.descripcion || undefined,
      }, token);
      setTareas(prev => [...prev, created]);
      setShowTareaModal(false);
      setTareaForm({ titulo: "", expediente_id: "", cliente_id: "", fecha_limite: "", hora: "", descripcion: "", tipo: "judicial" });
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
        hora: vencimientoForm.hora || undefined,
        tipo: vencimientoForm.tipo,
        expediente_id: vencimientoForm.expediente_id || undefined,
      }, token);
      setVencimientos(prev => [...prev, created]);
      setShowVencimientoModal(false);
      setVencimientoForm({ descripcion: "", fecha: "", hora: "", tipo: "vencimiento", expediente_id: "" });
    } catch (err: unknown) {
      setVencimientoError(err instanceof Error ? err.message : "Error al crear vencimiento");
    } finally {
      setSavingVencimiento(false);
    }
  };

  const handleToggleTarea = async (t: Tarea, estado?: TareaEstado) => {
    if (!token) return;
    const CICLO: Record<TareaEstado, TareaEstado> = { pendiente: "en_curso", en_curso: "hecha", hecha: "pendiente" };
    const next = estado ?? CICLO[t.estado];
    const updated = await api.patch<Tarea>(`/tareas/${t.id}`, { estado: next }, token);
    setTareas(prev => prev.map(x => x.id === t.id ? updated : x));
  };

  const { desde, hasta } = getDatesFromValue(periodoValue);
  const vFiltradas = vencimientos.filter(v => v.fecha >= desde && v.fecha <= hasta && (!filtroTipoVenc || v.tipo === filtroTipoVenc));
  const tFiltradas = tareas.filter(t => (!t.fecha_limite || (t.fecha_limite >= desde && t.fecha_limite <= hasta)) && (!filtroTipoTarea || t.tipo === filtroTipoTarea));

  const totalPendientes = vencimientos.filter(v => !v.cumplido).length + tareas.filter(t => t.estado !== "hecha").length;
  const urgentes = vencimientos.filter(v => !v.cumplido && esUrgente(v.fecha)).length;

  const eventosCalendario = useMemo(() => [
    ...vencimientos.map(v => ({
      id: v.id,
      tipo: "vencimiento" as const,
      titulo: v.descripcion,
      hora: v.hora,
      cumplido: v.cumplido,
      expediente_id: v.expediente_id,
      fecha: v.fecha,
      color: (v.cumplido ? "blue" : esUrgente(v.fecha) ? "red" : "purple") as CalEvent["color"],
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
      color: (t.estado === "en_curso" ? "blue" : esVencida(t.fecha_limite!) ? "red" : "amber") as CalEvent["color"],
    })),
  ], [vencimientos, tareas]);

  const handlePrevMes = () => {
    if (calMes === 1) { setCalMes(12); setCalAnio(a => a - 1); }
    else setCalMes(m => m - 1);
  };
  const handleNextMes = () => {
    if (calMes === 12) { setCalMes(1); setCalAnio(a => a + 1); }
    else setCalMes(m => m + 1);
  };
  const handleClickDia = (fecha: string) => {
    setDiaPickerFecha(fecha);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      {editingV && token && (
        <EditVencimientoModal v={editingV} token={token} onSaved={(u) => { setVencimientos(prev => prev.map(x => x.id === u.id ? u : x)); setEditingV(null); }} onClose={() => setEditingV(null)} />
      )}
      {editingT && token && (
        <EditTareaModal t={editingT} token={token} expedientes={expedientes} onSaved={(u) => { setTareas(prev => prev.map(x => x.id === u.id ? u : x)); setEditingT(null); }} onClose={() => setEditingT(null)} />
      )}

      {diaPickerFecha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDiaPickerFecha(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-ink-800 mb-1">
              {new Date(diaPickerFecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-xs text-ink-400 mb-4">¿Qué querés agregar?</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTareaForm(f => ({ ...f, fecha_limite: diaPickerFecha }));
                  setShowTareaModal(true);
                  setTareaError("");
                  setDiaPickerFecha(null);
                }}
                className="flex-1 flex flex-col items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl py-4 transition"
              >
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="text-xs font-semibold text-blue-700">Tarea</span>
              </button>
              <button
                onClick={() => {
                  setVencimientoForm(f => ({ ...f, fecha: diaPickerFecha }));
                  setShowVencimientoModal(true);
                  setVencimientoError("");
                  setDiaPickerFecha(null);
                }}
                className="flex-1 flex flex-col items-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl py-4 transition"
              >
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-semibold text-purple-700">Vencimiento</span>
              </button>
            </div>
          </div>
        </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
                  <input required type="date" value={vencimientoForm.fecha} onChange={(e) => setVencimientoForm(f => ({ ...f, fecha: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
                  <input type="time" value={vencimientoForm.hora} onChange={(e) => setVencimientoForm(f => ({ ...f, hora: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Agenda</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {totalPendientes} pendiente{totalPendientes !== 1 ? "s" : ""}
            {urgentes > 0 && <span className="ml-2 text-red-600 font-semibold">· {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {/* Toggle vista */}
          <div className="flex rounded-lg border border-ink-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setVista("tablero")}
              className={`px-3 py-1.5 transition ${vista === "tablero" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}
            >
              ⊞ Tablero
            </button>
            <button
              onClick={() => setVista("calendario")}
              className={`px-3 py-1.5 transition ${vista === "calendario" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}
            >
              📅 Calendario
            </button>
          </div>
          <button
            onClick={() => { setTareaForm(f => ({ ...f, fecha_limite: "" })); setShowTareaModal(true); setTareaError(""); }}
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

      {/* Filtros — solo en tablero */}
      {vista === "tablero" && !loading && (
        <div className="space-y-3">
          <PeriodSelector value={periodoValue} onChange={setPeriodoValue} />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-ink-500">Vencimientos:</span>
              {(["", "vencimiento", "audiencia", "presentacion", "pericia", "otro"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipoVenc(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${filtroTipoVenc === t ? "bg-purple-600 text-white border-purple-600" : "bg-white text-ink-500 border-ink-200 hover:border-purple-300"}`}>
                  {t === "" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-ink-500">Tareas:</span>
              {(["", "judicial", "extrajudicial", "administrativa", "operativa"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipoTarea(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${filtroTipoTarea === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-ink-500 border-ink-200 hover:border-blue-300"}`}>
                  {t === "" ? "Todos" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vista Tablero */}
      {vista === "tablero" && (
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="space-y-3"><Skeleton /></div>)}
          </div>
        ) : (
          <AgendaTablero
            vencimientos={vFiltradas}
            tareas={tFiltradas}
            expLookup={expLookup}
            token={token!}
            onToggleVenc={toggleVencimiento}
            onToggleTarea={handleToggleTarea}
            onEditVenc={setEditingV}
            onEditTarea={setEditingT}
            onDeleteVenc={deleteVencimiento}
            onDeleteTarea={deleteTarea}
            onDetailVenc={(v) => router.push(`/vencimientos/${v.id}`)}
            onDetailTarea={(t) => router.push(`/tareas/${t.id}`)}
          />
        )
      )}

      {/* Vista Calendario */}
      {vista === "calendario" && (
        <CalendarioMensual
          anio={calAnio}
          mes={calMes}
          eventos={eventosCalendario}
          inhabiles={inhabiles}
          onPrevMes={handlePrevMes}
          onNextMes={handleNextMes}
          onClickDia={handleClickDia}
          onClickEvento={(ev) => router.push(`/${ev.tipo === "tarea" ? "tareas" : "vencimientos"}/${ev.id}`)}
        />
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
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Cliente</label>
                <select value={tareaForm.cliente_id} onChange={(e) => setTareaForm({ ...tareaForm, cliente_id: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition">
                  <option value="">Sin cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Expediente</label>
                <select value={tareaForm.expediente_id} onChange={(e) => setTareaForm({ ...tareaForm, expediente_id: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition">
                  <option value="">Sin expediente</option>
                  {expedientes.map((exp) => <option key={exp.id} value={exp.id}>{exp.numero} — {exp.caratula}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Fecha límite</label>
                  <input type="date" value={tareaForm.fecha_limite} onChange={(e) => setTareaForm({ ...tareaForm, fecha_limite: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Hora</label>
                  <input type="time" value={tareaForm.hora} onChange={(e) => setTareaForm({ ...tareaForm, hora: e.target.value })} className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
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
