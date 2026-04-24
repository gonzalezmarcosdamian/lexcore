"use client";

import { TimeInput } from "@/components/ui/time-input";

import { DateInput } from "@/components/ui/date-input";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Tarea, TareaEstado, TareaTipo, Vencimiento, Expediente, Cliente, Honorario } from "@/lib/api";
import { PeriodSelector, PeriodoValue, getDatesFromValue } from "@/components/ui/period-selector";
import { CalendarSyncButton } from "@/components/ui/calendar-sync-button";
import { AdjuntosInline } from "@/components/ui/adjuntos-inline";
import { CalendarioMensual, CalEvent, DiaInhabil } from "@/components/ui/calendar-mensual";
import { ExpedienteSelect } from "@/components/ui/expediente-select";
import { todayAR, yearAR, monthAR } from "@/lib/date";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FilterPillsRow } from "@/components/ui/filter-pills";
import { TareaDetailSheet } from "@/components/features/tarea-detail-sheet";
import { MovimientoDetailSheet } from "@/components/features/movimiento-detail-sheet";

function esVencida(fecha: string): boolean {
  return new Date(fecha + "T23:59:59") < new Date();
}

function esUrgente(fecha: string): boolean {
  const diff = (new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff < 48;
}

function formatFecha(f: string): string {
  const today = todayAR();
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
  const current = estado === "hecha" ? TAREA_ESTADOS[1] : TAREA_ESTADOS[0];
  const next: TareaEstado = estado === "hecha" ? "pendiente" : "hecha";
  return (
    <button
      onClick={() => onChange(next)}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase cursor-pointer select-none transition active:scale-95 ${current.cls}`}
    >
      {current.label}
    </button>
  );
}

// ── Edit Modals ───────────────────────────────────────────────────────────────

function EditVencimientoModal({ v, token, onSaved, onClose }: { v: Vencimiento; token: string; onSaved: (u: Vencimiento) => void; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(v.titulo);
  const [fecha, setFecha] = useState(v.fecha);
  const [hora, setHora] = useState(v.hora ?? "");
  const [tipo, setTipo] = useState(v.tipo);
  const [estado, setEstado] = useState(v.estado);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const save = async () => {
    const fe: Record<string,string> = {};
    if (!descripcion.trim()) fe.titulo = "El titulo es obligatorio";
    else if (descripcion.trim().length < 3) fe.titulo = "Minimo 3 caracteres";
    if (!fecha) fe.fecha = "La fecha es obligatoria";
    if (!hora) fe.hora = "La hora es obligatoria";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/movimientos/${v.id}`, { titulo: descripcion, fecha, hora: hora || null, tipo, estado }, token);
      onSaved(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Editar movimiento procesal</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEstado("pendiente")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${estado === "pendiente" ? "bg-ink-600 text-white border-ink-600" : "border-ink-200 text-ink-500 hover:bg-ink-50"}`}
              >
                Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstado("cumplido")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${estado === "cumplido" ? "bg-green-600 text-white border-green-600" : "border-ink-200 text-ink-500 hover:bg-ink-50"}`}
              >
                ✓ Cumplido
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Titulo *</label>
            <input value={descripcion} onChange={(e) => { setDescripcion(e.target.value); setFieldErrors(v => ({ ...v, titulo: "" })); }} className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${fieldErrors.titulo ? "border-red-400 focus:ring-red-400" : "border-ink-200 focus:ring-brand-400"}`} />
            {fieldErrors.titulo && <p className="text-xs text-red-500 mt-1">{fieldErrors.titulo}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
              <DateInput value={fecha} onChange={v => { setFecha(v); setFieldErrors(e => ({ ...e, fecha: "" })); }} ringColor={fieldErrors.fecha ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
              {fieldErrors.fecha && <p className="text-xs text-red-500 mt-1">{fieldErrors.fecha}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora *</label>
              <TimeInput value={hora} onChange={v => { setHora(v); setFieldErrors(e => ({ ...e, hora: "" })); }} ringColor={fieldErrors.hora ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
              {fieldErrors.hora && <p className="text-xs text-red-500 mt-1">{fieldErrors.hora}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="vencimiento">Vencimiento procesal</option>
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
  const [estado, setEstado] = useState<TareaEstado>(t.estado === "en_curso" ? "pendiente" : t.estado);
  const [flagParalizado, setFlagParalizado] = useState(t.flag_paralizado ?? false);
  const [expedienteId, setExpedienteId] = useState(t.expediente_id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo, estado, flag_paralizado: flagParalizado, expediente_id: expedienteId || null };
      body.fecha_limite = fechaLimite || null;
      body.hora = hora || null;
      const updated = await api.patch<Tarea>(`/tareas/${t.id}`, body, token);
      onSaved(updated);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Editar tarea</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
            <div className="flex gap-2">
              {(["pendiente", "hecha"] as const).map((s) => {
                const labels = { pendiente: "Pendiente", hecha: "✓ Hecha" };
                const active = { pendiente: "bg-ink-600 text-white border-ink-600", hecha: "bg-green-600 text-white border-green-600" };
                return (
                  <button key={s} type="button" onClick={() => setEstado(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${estado === s ? active[s] : "border-ink-200 text-ink-500 hover:bg-ink-50"}`}>
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>
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
            <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
            <ExpedienteSelect expedientes={expedientes} value={expedienteId} onChange={setExpedienteId} />
          </div>
          <button
            type="button"
            onClick={() => setFlagParalizado(p => !p)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition ${flagParalizado ? "bg-orange-50 border-orange-300 text-orange-700" : "border-ink-200 text-ink-500 hover:bg-ink-50"}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <span className="text-sm font-medium flex-1 text-left">Marcar como paralizada</span>
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${flagParalizado ? "bg-orange-500 border-orange-500" : "border-ink-300"}`}>
              {flagParalizado && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            </span>
          </button>
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
  const vencida = esVencida(v.fecha) && (v.estado !== "cumplido");
  const urgente = esUrgente(v.fecha) && (v.estado !== "cumplido");

  return (
    <>
      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar movimiento?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div
        draggable={isDraggable}
        onDragStart={onDragStart}
        className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${
          v.estado === "cumplido"      ? "bg-green-50 border-green-100 opacity-70" :
          vencida         ? "bg-red-50 border-red-200" :
          urgente         ? "bg-amber-50 border-orange-200" :
                            "bg-white border-ink-100 hover:border-ink-200"
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <VencimientoStatusPill cumplido={v.estado === "cumplido"} onChange={() => onToggle()} />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 uppercase tracking-wide">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {v.tipo ?? "Movimiento"}
            </span>
            {urgente && <span className="text-[10px] font-bold text-orange-600">⚡ Urgente</span>}
            {vencida && <span className="text-[10px] font-bold text-red-600 uppercase">Vencido</span>}
          </div>
          <button onClick={onDetail} className={`text-sm font-medium leading-snug text-left hover:text-brand-600 transition ${v.estado === "cumplido" ? "line-through text-ink-400" : "text-ink-900"}`}>{v.titulo}</button>
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
          <AdjuntosInline movimientoId={v.id} token={token} />
        </div>
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
      </div>
    </>
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
  const paralizada = t.flag_paralizado && t.estado !== "hecha";

  return (
    <>
      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar tarea?"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div
        draggable={isDraggable}
        onDragStart={onDragStart}
        className={`group rounded-xl border overflow-hidden transition ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${
          t.estado === "hecha" ? "bg-green-50 border-green-100 opacity-70" :
          paralizada           ? "bg-gradient-to-br from-slate-100/90 via-blue-50/60 to-slate-100/90 border-blue-200" :
          vencida              ? "bg-red-50 border-red-200" :
                                 "bg-white border-ink-100 hover:border-ink-200"
        }`}
      ><div className="px-4 py-3 flex items-start gap-3">
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
      </div>
        {paralizada && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-100/70 via-slate-100/80 to-blue-100/70 border-t border-blue-200/60">
            <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
            </svg>
            <span className="text-[10px] font-bold text-blue-400/90 uppercase tracking-[0.2em]">Paralizada</span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Mobile Item Unificado ─────────────────────────────────────────────────────

function AgendaItemMobile({
  tipo, titulo, estado, fecha, hora, expediente, urgente: isUrgente, vencido: isVencido, paralizado: isParalizado,
  onCycleEstado, onNavigate,
}: {
  tipo: "movimiento" | "vencimiento" | "tarea";
  titulo: string;
  estado: string;
  fecha?: string;
  hora?: string | null;
  expediente?: { id: string; numero: string; caratula?: string } | null;
  urgente?: boolean;
  vencido?: boolean;
  paralizado?: boolean;
  onCycleEstado: (e: React.MouseEvent) => void;
  onNavigate: () => void;
}) {
  const hecho = estado === "hecha" || estado === "cumplido";

  const badgeCls = hecho
    ? "bg-green-100 text-green-700"
    : isVencido ? "bg-red-100 text-red-700"
    : isUrgente ? "bg-amber-100 text-orange-700"
    : "bg-ink-100 text-ink-600";

  const badgeLabel = hecho
    ? tipo === "tarea" ? "HECHO" : "CUMPLIDO"
    : isVencido ? "VENCIDO"
    : isUrgente ? "URGENTE"
    : "PENDIENTE";

  const dotCls = (tipo === "vencimiento" || tipo === "movimiento")
    ? (isUrgente || isVencido ? "bg-red-500" : "bg-orange-500")
    : "bg-blue-500";

  return (
    <button
      onClick={onNavigate}
      className={`w-full text-left rounded-xl border overflow-hidden transition active:scale-[0.99] ${
        hecho           ? "bg-green-50/60 border-green-100 opacity-75" :
        isParalizado    ? "bg-gradient-to-br from-slate-100/90 via-blue-50/60 to-slate-100/90 border-blue-200" :
        isVencido       ? "bg-red-50 border-red-200" :
        isUrgente       ? "bg-amber-50 border-orange-200" :
                          "bg-white border-ink-100"
      }`}
    >
      <div className="px-3 py-3 flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${hecho ? "line-through text-ink-400" : "text-ink-900"}`}>
            {titulo}
          </p>
          {(fecha || expediente) && (
            <p className="text-xs text-ink-400 mt-0.5 truncate">
              {fecha && <span>{new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}{hora ? ` · ${hora}` : ""}</span>}
              {expediente && <span className="text-brand-600"> · {expediente.numero}</span>}
            </p>
          )}
        </div>
        <span
          onClick={onCycleEstado}
          className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase cursor-pointer select-none transition active:scale-95 ${badgeCls}`}
        >
          {badgeLabel}
        </span>
      </div>
      {isParalizado && !hecho && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-100/70 via-slate-100/80 to-blue-100/70 border-t border-blue-200/60">
          <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
          </svg>
          <span className="text-[10px] font-bold text-blue-400/90 uppercase tracking-[0.2em]">Paralizada</span>
        </div>
      )}
    </button>
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

type KanbanCol = "pendiente" | "hecho";

const KANBAN_COLS: { id: KanbanCol; label: string; headerCls: string; bgCls: string }[] = [
  { id: "pendiente", label: "PENDIENTE", headerCls: "border-ink-300 text-ink-600",     bgCls: "bg-ink-50/60" },
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
    const base = col === "pendiente" ? vencimientos.filter(v => (v.estado !== "cumplido")) : vencimientos.filter(v => v.estado === "cumplido");
    return [...base].sort((a, b) => ((a.fecha ?? "") + (a.hora ?? "")).localeCompare((b.fecha ?? "") + (b.hora ?? "")));
  };

  const colTarea = (col: KanbanCol): Tarea[] => {
    const base = col === "hecho"
      ? tareas.filter(t => t.estado === "hecha")
      : tareas.filter(t => t.estado !== "hecha");
    return [...base].sort((a, b) => {
      const ka = a.fecha_limite ? (a.fecha_limite + (a.hora ?? "")) : "9999";
      const kb = b.fecha_limite ? (b.fecha_limite + (b.hora ?? "")) : "9999";
      return ka.localeCompare(kb);
    });
  };

  const handleDrop = (col: KanbanCol) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "v") {
      const venc = vencimientos.find(v => v.id === drag.id);
      if (!venc) return;
      const shouldBeCumplido = col === "hecho";
      if ((venc.estado === "cumplido") !== shouldBeCumplido) onToggleVenc(venc);
    } else {
      const tarea = tareas.find(t => t.id === drag.id);
      if (!tarea) return;
      const nuevoEstado: TareaEstado = col === "hecho" ? "hecha" : "pendiente";
      if (tarea.estado !== nuevoEstado) onToggleTarea(tarea, nuevoEstado);
    }
    dragRef.current = null;
    setDragOver(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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


  const [periodoValue, setPeriodoValue] = useState<PeriodoValue>({
    periodo: "anio",
    desde: `${yearAR()}-01-01`,
    hasta: `${yearAR()}-12-31`,
  });
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [inhabiles, setInhabiles] = useState<DiaInhabil[]>([]);
  const [vista, setVista] = useState<Vista>("tablero");
  const [calMes, setCalMes] = useState(monthAR());
  const [calAnio, setCalAnio] = useState(yearAR());

  const [editingV, setEditingV] = useState<Vencimiento | null>(null);
  const [editingT, setEditingT] = useState<Tarea | null>(null);

  const [filtroTipoVenc, setFiltroTipoVenc] = useState<string>("");
  const [filtroTipoTarea, setFiltroTipoTarea] = useState<string>("");
  const [filtroParalizado, setFiltroParalizado] = useState(false);

  const [honorariosProximos, setHonorariosProximos] = useState<Honorario[]>([]);
  const [mobileDetailTarea, setMobileDetailTarea] = useState<string | null>(null);
  const [mobileDetailVenc, setMobileDetailVenc] = useState<string | null>(null);

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
    api.get<Honorario[]>("/honorarios/proximos", token, { dias: 365 }).then(setHonorariosProximos).catch(() => {});
    Promise.all([
      api.get<Vencimiento[]>("/movimientos", token, { proximos: 365 }),
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
    const updated = await api.patch<Vencimiento>(`/movimientos/${v.id}`, { estado: v.estado === "cumplido" ? "pendiente" : "cumplido" }, token);
    setVencimientos(prev => prev.map(x => x.id === v.id ? updated : x));
  };

  const deleteVencimiento = async (id: string) => {
    if (!token) return;
    await api.delete(`/movimientos/${id}`, token);
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
    if (!tareaForm.fecha_limite) { setTareaError("La fecha es obligatoria"); return; }
    if (!tareaForm.hora) { setTareaError("La hora es obligatoria"); return; }
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
    if (!vencimientoForm.fecha) { setVencimientoError("La fecha es obligatoria"); return; }
    if (!vencimientoForm.hora) { setVencimientoError("La hora es obligatoria"); return; }
    setSavingVencimiento(true);
    setVencimientoError("");
    try {
      const created = await api.post<Vencimiento>("/movimientos", {
        titulo: vencimientoForm.descripcion,
        fecha: vencimientoForm.fecha,
        hora: vencimientoForm.hora || undefined,
        tipo: vencimientoForm.tipo,
        expediente_id: vencimientoForm.expediente_id || "",
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
    const CICLO: Record<TareaEstado, TareaEstado> = { pendiente: "hecha", en_curso: "hecha", hecha: "pendiente" };
    const next = estado ?? CICLO[t.estado];
    const updated = await api.patch<Tarea>(`/tareas/${t.id}`, { estado: next }, token);
    setTareas(prev => prev.map(x => x.id === t.id ? updated : x));
  };

  const { desde, hasta } = getDatesFromValue(periodoValue);
  const vFiltradas = filtroParalizado ? [] : vencimientos.filter(v => v.fecha >= desde && v.fecha <= hasta && (!filtroTipoVenc || v.tipo === filtroTipoVenc));
  const tFiltradas = tareas.filter(t =>
    (!t.fecha_limite || (t.fecha_limite >= desde && t.fecha_limite <= hasta)) &&
    (!filtroTipoTarea || t.tipo === filtroTipoTarea) &&
    (!filtroParalizado || t.flag_paralizado)
  );

  const totalPendientes = vencimientos.filter(v => (v.estado !== "cumplido")).length + tareas.filter(t => t.estado !== "hecha").length;
  const urgentes = vencimientos.filter(v => (v.estado !== "cumplido") && esUrgente(v.fecha)).length;

  const eventosCalendario = useMemo(() => [
    ...vencimientos.map(v => ({
      id: v.id,
      tipo: "movimiento" as const,
      titulo: v.titulo,
      hora: v.hora,
      cumplido: v.estado === "cumplido",
      expediente_id: v.expediente_id,
      fecha: v.fecha,
      color: (v.estado === "cumplido" ? "blue" : esUrgente(v.fecha) ? "red" : "orange") as CalEvent["color"],
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
      color: (esVencida(t.fecha_limite!) ? "red" : "blue") as CalEvent["color"],
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

  // ── Mobile lista cronológica ────────────────────────────────────────────────
  const itemsCronologicos = useMemo(() => {
    const items: Array<{ fecha: string; hora?: string | null; tipo: "v" | "t"; id: string }> = [
      ...vFiltradas.map(v => ({ fecha: v.fecha, hora: v.hora, tipo: "v" as const, id: v.id })),
      ...tFiltradas.filter(t => t.fecha_limite).map(t => ({ fecha: t.fecha_limite!, hora: t.hora, tipo: "t" as const, id: t.id })),
    ];
    items.sort((a, b) => {
      const da = a.fecha + (a.hora ?? "");
      const db = b.fecha + (b.hora ?? "");
      return da.localeCompare(db);
    });
    const groups: Record<string, typeof items> = {};
    for (const item of items) {
      if (!groups[item.fecha]) groups[item.fecha] = [];
      groups[item.fecha].push(item);
    }
    return groups;
  }, [vFiltradas, tFiltradas]);

  return (
    <div className="max-w-5xl mx-auto py-4 px-3 sm:px-4 sm:py-6 space-y-4 pb-28">
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
                  const fecha = diaPickerFecha ?? "";
                  setDiaPickerFecha(null);
                  router.push(`/tareas/nueva${fecha ? `?fecha=${fecha}` : ""}`);
                }}
                className="flex-1 flex flex-col items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl py-4 transition"
              >
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="text-xs font-semibold text-blue-700">Tarea</span>
              </button>
              <button
                onClick={() => {
                  const fecha = diaPickerFecha ?? "";
                  setDiaPickerFecha(null);
                  router.push(`/movimientos/nuevo${fecha ? `?fecha=${fecha}` : ""}`);
                }}
                className="flex-1 flex flex-col items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl py-4 transition"
              >
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-semibold text-orange-700">Movimiento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Vencimiento */}
      {showVencimientoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowVencimientoModal(false); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink-900">Nuevo movimiento procesal</h2>
              <button onClick={() => setShowVencimientoModal(false)} className="text-ink-400 hover:text-ink-600 text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleCrearVencimiento} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Titulo *</label>
                <input required value={vencimientoForm.descripcion} onChange={(e) => setVencimientoForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="Ej: Presentar memorial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
                  <DateInput value={vencimientoForm.fecha} onChange={v => setVencimientoForm(f => ({ ...f, fecha: v }))} required ringColor="focus-within:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Hora *</label>
                  <TimeInput value={vencimientoForm.hora} onChange={v => setVencimientoForm(f => ({ ...f, hora: v }))} ringColor="focus-within:ring-purple-400" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
                <select value={vencimientoForm.tipo} onChange={(e) => setVencimientoForm(f => ({ ...f, tipo: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="vencimiento">Vencimiento procesal</option>
                  <option value="audiencia">Audiencia</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Expediente</label>
                <ExpedienteSelect expedientes={expedientes} value={vencimientoForm.expediente_id} onChange={id => setVencimientoForm(f => ({ ...f, expediente_id: id }))} ringColor="focus-within:ring-purple-400" />
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

      {/* ════════════════════════════════════════════
           MOBILE  (< lg)
      ════════════════════════════════════════════ */}
      <div className="lg:hidden space-y-4">

        {/* Header: 1 línea */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-ink-900">Agenda</h1>
            <p className="text-sm text-ink-500">
              {totalPendientes} pendiente{totalPendientes !== 1 ? "s" : ""}
              {urgentes > 0 && <span className="ml-1.5 text-red-500 font-semibold">· {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Vista toggle compacto */}
            <div className="flex rounded-lg border border-ink-200 overflow-hidden text-xs font-semibold">
              <button onClick={() => setVista("tablero")} className={`px-2.5 py-1.5 transition ${vista === "tablero" ? "bg-brand-600 text-white" : "bg-white text-ink-500"}`}>Lista</button>
              <button onClick={() => setVista("calendario")} className={`px-2.5 py-1.5 transition ${vista === "calendario" ? "bg-brand-600 text-white" : "bg-white text-ink-500"}`}>Cal.</button>
            </div>
            <CalendarSyncButton variant="compact" />
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/tareas/nueva")}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Tarea
          </button>
          <button
            onClick={() => router.push("/movimientos/nuevo")}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Movimiento
          </button>
        </div>

        {/* Filtros tipo — mobile */}
        {vista === "tablero" && !loading && (
          <div className="space-y-1.5">
            {/* Una sola línea con separador + Paralizadas al final */}
            <div className="bg-ink-50 border border-ink-100 rounded-xl px-2 py-1.5 flex items-center gap-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
              <FilterPillsRow label="MOV" options={[{value:"",label:"Todos"},{value:"vencimiento",label:"Venc. procesal"},{value:"audiencia",label:"Audiencia"},{value:"presentacion",label:"Presentación"},{value:"pericia",label:"Pericia"},{value:"otro",label:"Otro"}]} value={filtroTipoVenc} onChange={setFiltroTipoVenc} activeColor="orange" />
              <div className="w-px h-4 bg-ink-200 flex-shrink-0" />
              <FilterPillsRow label="TAREAS" options={[{value:"",label:"Todos"},{value:"judicial",label:"Judicial"},{value:"extrajudicial",label:"Extrajudicial"},{value:"administrativa",label:"Administrativa"},{value:"operativa",label:"Operativa"}]} value={filtroTipoTarea} onChange={setFiltroTipoTarea} activeColor="blue" />
              <div className="w-px h-4 bg-ink-200 flex-shrink-0" />
              <button
                onClick={() => setFiltroParalizado(p => !p)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${filtroParalizado ? "bg-blue-100 text-blue-600 border-blue-300" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                Paraliz.
              </button>
            </div>
          </div>
        )}

        {/* Vista calendario — mobile */}
        {vista === "calendario" && (
          <CalendarioMensual
            anio={calAnio} mes={calMes} eventos={eventosCalendario} inhabiles={inhabiles}
            onPrevMes={handlePrevMes} onNextMes={handleNextMes}
            onClickDia={handleClickDia}
            onClickEvento={(ev) => ev.tipo === "tarea" ? setMobileDetailTarea(ev.id) : setMobileDetailVenc(ev.id)}
          />
        )}

        {/* Vista lista */}
        {vista === "tablero" && (
          loading ? <Skeleton /> : (
            <div className="space-y-5">
              {Object.keys(itemsCronologicos).length === 0 && (
                <p className="text-sm text-ink-400 text-center py-10">Sin items en este período</p>
              )}
              {Object.entries(itemsCronologicos).map(([fecha, items]) => {
                const esHoy = fecha === todayAR();
                return (
                  <div key={fecha}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wide ${esHoy ? "text-brand-600" : "text-ink-400"}`}>
                        {formatFecha(fecha)}
                      </span>
                      {esHoy && <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-1.5 py-0.5 rounded-full">HOY</span>}
                      <div className="flex-1 h-px bg-ink-100" />
                      <span className="text-xs text-ink-300">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(item => {
                        if (item.tipo === "v") {
                          const v = vFiltradas.find(x => x.id === item.id);
                          if (!v) return null;
                          const exp = expLookup[v.expediente_id];
                          return (
                            <AgendaItemMobile
                              key={item.id}
                              tipo="movimiento"
                              titulo={v.titulo}
                              estado={v.estado === "cumplido" ? "cumplido" : "pendiente"}
                              fecha={v.fecha}
                              hora={v.hora}
                              expediente={exp ? { id: exp.id, numero: exp.numero } : null}
                              urgente={esUrgente(v.fecha) && (v.estado !== "cumplido")}
                              vencido={esVencida(v.fecha) && (v.estado !== "cumplido")}
                              onCycleEstado={(e) => { e.stopPropagation(); toggleVencimiento(v); }}
                              onNavigate={() => setMobileDetailVenc(v.id)}
                            />
                          );
                        }
                        const t = tFiltradas.find(x => x.id === item.id);
                        if (!t) return null;
                        const exp = t.expediente_id ? expLookup[t.expediente_id] : undefined;
                        const CICLO_T: Record<TareaEstado, TareaEstado> = { pendiente: "hecha", en_curso: "hecha", hecha: "pendiente" };
                        return (
                          <AgendaItemMobile
                            key={item.id}
                            tipo="tarea"
                            titulo={t.titulo}
                            estado={t.estado}
                            fecha={t.fecha_limite ?? undefined}
                            hora={t.hora}
                            expediente={exp ? { id: exp.id, numero: exp.numero } : null}
                            urgente={!!t.fecha_limite && esUrgente(t.fecha_limite) && t.estado !== "hecha"}
                            vencido={!!t.fecha_limite && esVencida(t.fecha_limite) && t.estado !== "hecha"}
                            paralizado={t.flag_paralizado && t.estado !== "hecha"}
                            onCycleEstado={(e) => { e.stopPropagation(); handleToggleTarea(t, CICLO_T[t.estado]); }}
                            onNavigate={() => setMobileDetailTarea(t.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Cobros pendientes — mobile */}
        {honorariosProximos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">Cobros pendientes</span>
              <div className="flex-1 h-px bg-emerald-100" />
              <span className="text-xs text-ink-300">{honorariosProximos.length}</span>
            </div>
            {honorariosProximos.map(h => {
              const diff = h.fecha_vencimiento ? (new Date(h.fecha_vencimiento + "T12:00:00").getTime() - Date.now()) / 86400000 : 999;
              const urgent = diff < 0;
              const soon = diff >= 0 && diff <= 7;
              return (
                <div key={h.id} className={`w-full text-left rounded-xl border overflow-hidden bg-white ${urgent ? "border-red-200" : soon ? "border-orange-200" : "border-emerald-100"}`}>
                  <div className="px-3 py-3 flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${urgent ? "bg-red-500" : soon ? "bg-orange-400" : "bg-emerald-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 leading-snug">{h.concepto}</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Saldo: {h.moneda === "ARS" ? "$" : "U$D"} {Number(h.saldo_pendiente).toLocaleString("es-AR")}
                        {h.fecha_vencimiento && ` · Vence ${new Date(h.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                    {urgent && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full flex-shrink-0">VENCIDO</span>}
                    {soon && !urgent && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex-shrink-0">PRÓXIMO</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail sheets — mobile only */}
        {mobileDetailTarea && token && (
          <TareaDetailSheet
            tareaId={mobileDetailTarea}
            token={token}
            onClose={() => setMobileDetailTarea(null)}
            onDeleted={(id) => { setTareas(prev => prev.filter(t => t.id !== id)); setMobileDetailTarea(null); }}
            onUpdated={(updated) => setTareas(prev => prev.map(t => t.id === updated.id ? updated : t))}
          />
        )}
        {mobileDetailVenc && token && (
          <MovimientoDetailSheet
            movimientoId={mobileDetailVenc}
            token={token}
            onClose={() => setMobileDetailVenc(null)}
            onDeleted={(id) => { setVencimientos(prev => prev.filter(v => v.id !== id)); setMobileDetailVenc(null); }}
            onUpdated={(updated) => setVencimientos(prev => prev.map(v => v.id === updated.id ? updated : v))}
          />
        )}

      </div>

      {/* ════════════════════════════════════════════
           DESKTOP  (lg+)
      ════════════════════════════════════════════ */}
      <div className="hidden lg:block space-y-5">

        {/* Row 1: Título + Vista */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-ink-900">Agenda</h1>
              <p className="text-xs text-ink-400 mt-0.5">
                {totalPendientes} pendiente{totalPendientes !== 1 ? "s" : ""}
                {urgentes > 0 && <span className="ml-1.5 text-red-500 font-semibold">· {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>}
              </p>
            </div>
            <div className="flex rounded-lg border border-ink-200 overflow-hidden text-xs font-semibold">
              <button onClick={() => setVista("tablero")} className={`px-3 py-1.5 transition ${vista === "tablero" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}>Tablero</button>
              <button onClick={() => setVista("calendario")} className={`px-3 py-1.5 transition ${vista === "calendario" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"}`}>Calendario</button>
            </div>
          </div>
          {/* Acciones principales */}
          <div className="flex items-center gap-2">
            <Link href="/tareas/nueva" className="flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              + Tarea
            </Link>
            <Link href="/movimientos/nuevo" className="flex items-center gap-1.5 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl transition shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              + Movimiento
            </Link>
            <CalendarSyncButton variant="compact" />
          </div>
        </div>

        {/* Filtros — solo en tablero */}
        {vista === "tablero" && !loading && (
          <div className="space-y-2">
            {/* Row 2: Período + Paralizadas (ícono) */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <PeriodSelector value={periodoValue} onChange={setPeriodoValue} />
              </div>
              <button
                onClick={() => setFiltroParalizado(p => !p)}
                title={filtroParalizado ? "Mostrando paralizadas" : "Mostrar paralizadas"}
                className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${filtroParalizado ? "bg-blue-100 text-blue-600 border-blue-300" : "border-ink-200 text-ink-400 hover:bg-ink-50"}`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                {filtroParalizado && <span>Paralizadas</span>}
              </button>
            </div>
            {/* Row 3: Filtros de tipo en una línea */}
            <div className="bg-ink-50 border border-ink-100 rounded-xl px-3 py-2 flex items-center gap-3 overflow-x-auto" style={{scrollbarWidth:"none"}}>
              <FilterPillsRow label="MOV" options={[{value:"",label:"Todos"},{value:"vencimiento",label:"Venc. procesal"},{value:"audiencia",label:"Audiencia"},{value:"presentacion",label:"Presentación"},{value:"pericia",label:"Pericia"},{value:"otro",label:"Otro"}]} value={filtroTipoVenc} onChange={setFiltroTipoVenc} activeColor="orange" />
              <div className="w-px h-5 bg-ink-200 flex-shrink-0" />
              <FilterPillsRow label="TAREAS" options={[{value:"",label:"Todos"},{value:"judicial",label:"Judicial"},{value:"extrajudicial",label:"Extrajudicial"},{value:"administrativa",label:"Administrativa"},{value:"operativa",label:"Operativa"}]} value={filtroTipoTarea} onChange={setFiltroTipoTarea} activeColor="blue" />
            </div>
          </div>
        )}

        {/* Calendario desktop */}
        {vista === "calendario" && (
          <CalendarioMensual
            anio={calAnio} mes={calMes} eventos={eventosCalendario} inhabiles={inhabiles}
            onPrevMes={handlePrevMes} onNextMes={handleNextMes}
            onClickDia={handleClickDia}
            onClickEvento={(ev) => router.push(`/${ev.tipo === "tarea" ? "tareas" : "vencimientos"}/${ev.id}`)}
          />
        )}

        {/* Tablero desktop */}
        {vista === "tablero" && (
          loading ? (
            <div className="grid grid-cols-2 gap-4">{[1,2].map(i => <div key={i}><Skeleton /></div>)}</div>
          ) : (
            <>
              <AgendaTablero
                vencimientos={vFiltradas} tareas={tFiltradas} expLookup={expLookup} token={token!}
                onToggleVenc={toggleVencimiento} onToggleTarea={handleToggleTarea}
                onEditVenc={setEditingV} onEditTarea={setEditingT}
                onDeleteVenc={deleteVencimiento} onDeleteTarea={deleteTarea}
                onDetailVenc={(v) => router.push(`/movimientos/${v.id}`)}
                onDetailTarea={(t) => router.push(`/tareas/${t.id}`)}
              />
              {honorariosProximos.length > 0 && (
                <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-emerald-50 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Cobros pendientes</span>
                    <span className="text-xs text-ink-400">{honorariosProximos.length}</span>
                  </div>
                  <div className="divide-y divide-ink-50">
                    {honorariosProximos.map(h => {
                      const diff = h.fecha_vencimiento ? (new Date(h.fecha_vencimiento + "T12:00:00").getTime() - Date.now()) / 86400000 : 999;
                      const urgent = diff < 0;
                      const soon = diff >= 0 && diff <= 7;
                      return (
                        <div key={h.id} className="px-4 py-3 flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgent ? "bg-red-500" : soon ? "bg-orange-400" : "bg-emerald-500"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{h.concepto}</p>
                            <p className="text-xs text-ink-400">
                              Saldo: {h.moneda === "ARS" ? "$" : "U$D"} {Number(h.saldo_pendiente).toLocaleString("es-AR")}
                              {h.fecha_vencimiento && ` · Vence ${new Date(h.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`}
                            </p>
                          </div>
                          {urgent && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">VENCIDO</span>}
                          {soon && !urgent && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">PRÓXIMO</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )
        )}

      </div>


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
                <ExpedienteSelect expedientes={expedientes} value={tareaForm.expediente_id} onChange={id => setTareaForm(f => ({ ...f, expediente_id: id }))} placeholder="Sin expediente" ringColor="focus-within:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Fecha límite *</label>
                  <DateInput value={tareaForm.fecha_limite} onChange={v => setTareaForm(f => ({ ...f, fecha_limite: v }))} ringColor="focus-within:ring-blue-400" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1.5">Hora *</label>
                  <TimeInput value={tareaForm.hora} onChange={v => setTareaForm(f => ({ ...f, hora: v }))} ringColor="focus-within:ring-blue-400" required />
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
