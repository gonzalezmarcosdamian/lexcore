"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api, Tarea, TareaEstado, TareaTipo, Nota, Expediente } from "@/lib/api";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { DocumentosSection } from "@/components/ui/documentos-section";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { todayAR } from "@/lib/date";

const ESTADO_CFG: Record<TareaEstado, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-700" },
  en_curso:  { label: "En curso",   cls: "bg-blue-100 text-blue-700" },
  hecha:     { label: "✓ Hecha",    cls: "bg-green-100 text-green-700" },
};

const TIPO_LABEL: Record<string, string> = {
  judicial: "⚖️ Judicial", extrajudicial: "🤝 Extrajudicial",
  administrativa: "🏢 Administrativa", operativa: "🔧 Operativa",
};

function formatFecha(f: string) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  tareaId: string;
  token: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (t: Tarea) => void;
}

export function TareaDetailSheet({ tareaId, token, onClose, onDeleted, onUpdated }: Props) {
  useBodyScrollLock(true);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [exp, setExp] = useState<Expediente | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [notaTexto, setNotaTexto] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [deletingNota, setDeletingNota] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ titulo: "", tipo: "judicial" as TareaTipo, fecha_limite: "", hora: "", descripcion: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Tarea>(`/tareas/${tareaId}`, token),
      api.get<Nota[]>(`/tareas/${tareaId}/notas`, token),
    ]).then(([t, ns]) => {
      setTarea(t);
      setNotas(ns);
      if (t.expediente_id) {
        api.get<Expediente>(`/expedientes/${t.expediente_id}`, token).then(setExp).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [tareaId, token]);

  const handleToggleEstado = async () => {
    if (!tarea) return;
    const CICLO: Record<TareaEstado, TareaEstado> = { pendiente: "en_curso", en_curso: "hecha", hecha: "pendiente" };
    const updated = await api.patch<Tarea>(`/tareas/${tareaId}`, { estado: CICLO[tarea.estado] }, token);
    setTarea(updated);
    onUpdated(updated);
  };

  const openEdit = () => {
    if (!tarea) return;
    setEditForm({ titulo: tarea.titulo, tipo: tarea.tipo, fecha_limite: tarea.fecha_limite ?? "", hora: tarea.hora ?? "", descripcion: tarea.descripcion ?? "" });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!tarea) return;
    setSavingEdit(true);
    try {
      const updated = await api.patch<Tarea>(`/tareas/${tareaId}`, {
        titulo: editForm.titulo, tipo: editForm.tipo,
        fecha_limite: editForm.fecha_limite || null,
        hora: editForm.hora || null,
        descripcion: editForm.descripcion || null,
      }, token);
      setTarea(updated);
      onUpdated(updated);
      setEditing(false);
    } finally { setSavingEdit(false); }
  };

  const handleAddNota = async () => {
    if (!notaTexto.trim()) return;
    setSavingNota(true);
    try {
      const n = await api.post<Nota>(`/tareas/${tareaId}/notas`, { texto: notaTexto.trim() }, token);
      setNotas(prev => [...prev, n]);
      setNotaTexto("");
    } finally { setSavingNota(false); }
  };

  const handleDeleteNota = async (notaId: string) => {
    setDeletingNota(notaId);
    try {
      await api.delete(`/tareas/${tareaId}/notas/${notaId}`, token);
      setNotas(prev => prev.filter(n => n.id !== notaId));
    } finally { setDeletingNota(null); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/tareas/${tareaId}`, token);
      onDeleted(tareaId);
      onClose();
    } finally { setDeleting(false); }
  };

  const vencida = tarea?.fecha_limite && tarea.fecha_limite < todayAR() && tarea.estado !== "hecha";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-ink-200" />
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-4 pb-8 space-y-4">
          {loading ? (
            <div className="space-y-3 py-4 animate-pulse">
              <div className="h-4 bg-ink-100 rounded w-1/3" />
              <div className="h-8 bg-ink-100 rounded w-2/3" />
              <div className="h-32 bg-ink-100 rounded-xl" />
            </div>
          ) : !tarea ? (
            <p className="text-sm text-red-500 py-4">No se pudo cargar la tarea.</p>
          ) : (
            <>
              {/* Header card */}
              <div className={`rounded-2xl border overflow-hidden ${tarea.estado === "hecha" ? "bg-green-50/40 border-green-100" : vencida ? "bg-red-50/40 border-red-200" : tarea.estado === "en_curso" ? "bg-blue-50/30 border-blue-100" : "bg-white border-ink-100"}`}>
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={handleToggleEstado} className={`text-xs font-semibold px-2.5 py-1 rounded-full transition active:scale-95 ${ESTADO_CFG[tarea.estado].cls}`}>
                        {ESTADO_CFG[tarea.estado].label}
                      </button>
                      <span className="text-xs text-ink-400">{TIPO_LABEL[tarea.tipo] ?? tarea.tipo}</span>
                      {vencida && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Vencida</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={openEdit} className="p-2 rounded-lg border border-ink-200 text-ink-500 active:bg-ink-100 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg text-ink-400 hover:text-red-500 active:bg-red-50 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                  <h2 className={`text-base font-bold leading-snug ${tarea.estado === "hecha" ? "line-through text-ink-400" : "text-ink-900"}`}>
                    {tarea.titulo}
                  </h2>
                </div>
                <div className="px-4 pb-3 space-y-0 divide-y divide-ink-50 border-t border-ink-50">
                  {tarea.fecha_limite && (
                    <div className="flex justify-between items-start gap-3 py-2.5">
                      <span className="text-sm text-ink-400 flex-shrink-0">Fecha límite</span>
                      <span className={`text-sm font-medium text-right ${vencida ? "text-red-600" : "text-ink-900"}`}>
                        {formatFecha(tarea.fecha_limite)}{tarea.hora ? ` · ${tarea.hora}` : ""}
                      </span>
                    </div>
                  )}
                  {tarea.responsable_nombre && (
                    <div className="flex justify-between items-center gap-3 py-2.5">
                      <span className="text-sm text-ink-400 flex-shrink-0">Responsable</span>
                      <span className="text-sm font-medium text-ink-900">{tarea.responsable_nombre}</span>
                    </div>
                  )}
                  {exp && (
                    <>
                      <div className="flex justify-between items-start gap-3 py-2.5">
                        <span className="text-sm text-ink-400 flex-shrink-0">Expediente</span>
                        <Link href={`/expedientes/${exp.id}`} onClick={onClose} className="text-xs font-medium text-brand-600 text-right leading-snug">
                          {exp.numero}{exp.caratula ? ` · ${exp.caratula}` : ""}
                        </Link>
                      </div>
                      {exp.juzgado && (
                        <div className="flex justify-between items-start gap-3 py-2.5">
                          <span className="text-sm text-ink-400 flex-shrink-0">Tribunal</span>
                          <span className="text-xs text-ink-700 text-right">{exp.juzgado}</span>
                        </div>
                      )}
                      {exp.localidad && (
                        <div className="flex justify-between items-start gap-3 py-2.5">
                          <span className="text-sm text-ink-400 flex-shrink-0">Localidad</span>
                          <span className="text-xs text-ink-700 text-right">{exp.localidad}</span>
                        </div>
                      )}
                    </>
                  )}
                  {tarea.descripcion && (
                    <div className="py-2.5">
                      <span className="text-sm text-ink-400 block mb-1">Descripción</span>
                      <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{tarea.descripcion}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Documentos */}
              <div className="bg-white rounded-2xl border border-ink-100 p-4">
                <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Documentos</h3>
                <DocumentosSection tareaId={tareaId} token={token} />
              </div>

              {/* Notas */}
              <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-50 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Notas</h3>
                  <span className="text-xs text-ink-400">{notas.length} nota{notas.length !== 1 ? "s" : ""}</span>
                </div>
                {notas.length > 0 && (
                  <div className="divide-y divide-ink-50">
                    {notas.map(n => (
                      <div key={n.id} className="px-4 py-3 flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {n.autor_nombre?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-ink-700">{n.autor_nombre ?? "Usuario"}</span>
                            <span className="text-xs text-ink-400">{formatTs(n.created_at)}</span>
                          </div>
                          <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{n.texto}</p>
                        </div>
                        <button onClick={() => handleDeleteNota(n.id)} disabled={deletingNota === n.id} className="p-1.5 rounded text-ink-300 hover:text-red-500 transition flex-shrink-0 disabled:opacity-50">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-4 py-3 bg-ink-50/30 border-t border-ink-50">
                  <textarea
                    ref={textareaRef}
                    value={notaTexto}
                    onChange={e => setNotaTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNota(); }}
                    placeholder="Agregar nota…"
                    rows={2}
                    className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition resize-none"
                  />
                  <button
                    onClick={handleAddNota}
                    disabled={savingNota || !notaTexto.trim()}
                    className="mt-2 w-full text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-40"
                  >
                    {savingNota ? "Guardando…" : "Guardar nota"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar esta tarea?"
          description="Esta acción no se puede deshacer."
          confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl shadow-xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">Editar tarea</h2>
              <button onClick={() => setEditing(false)} className="text-ink-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Título *</label>
              <input autoFocus value={editForm.titulo} onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
              <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value as TareaTipo }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="judicial">⚖️ Judicial</option>
                <option value="extrajudicial">🤝 Extrajudicial</option>
                <option value="administrativa">🏢 Administrativa</option>
                <option value="operativa">🔧 Operativa</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
                <DateInput value={editForm.fecha_limite} onChange={v => setEditForm(f => ({ ...f, fecha_limite: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
                <TimeInput value={editForm.hora} onChange={v => setEditForm(f => ({ ...f, hora: v }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Descripción</label>
              <textarea value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" placeholder="Opcional" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit || !editForm.titulo.trim()} className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">{savingEdit ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
