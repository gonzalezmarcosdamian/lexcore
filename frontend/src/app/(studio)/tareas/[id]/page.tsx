"use client";

import { TimeInput } from "@/components/ui/time-input";
import { todayAR } from "@/lib/date";

import { DateInput } from "@/components/ui/date-input";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Tarea, TareaEstado, Nota, Expediente, TareaTipo } from "@/lib/api";
import { DocumentosSection } from "@/components/ui/documentos-section";

const ESTADO_CFG: Record<TareaEstado, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-700" },
  en_curso:  { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-700" },
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

export default function TareaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [exp, setExp] = useState<Expediente | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [notaTexto, setNotaTexto] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [deletingNota, setDeletingNota] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ titulo: "", tipo: "judicial" as TareaTipo, fecha_limite: "", hora: "", descripcion: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<Tarea>(`/tareas/${id}`, token),
      api.get<Nota[]>(`/tareas/${id}/notas`, token),
    ]).then(([t, ns]) => {
      setTarea(t);
      setNotas(ns);
      if (t.expediente_id) {
        api.get<Expediente>(`/expedientes/${t.expediente_id}`, token).then(setExp).catch(() => {});
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const openEdit = () => {
    if (!tarea) return;
    setEditForm({ titulo: tarea.titulo, tipo: tarea.tipo, fecha_limite: tarea.fecha_limite ?? "", hora: tarea.hora ?? "", descripcion: tarea.descripcion ?? "" });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !tarea) return;
    setSavingEdit(true);
    try {
      const updated = await api.patch<Tarea>(`/tareas/${id}`, {
        titulo: editForm.titulo,
        tipo: editForm.tipo,
        fecha_limite: editForm.fecha_limite || null,
        hora: editForm.hora || null,
        descripcion: editForm.descripcion || null,
      }, token);
      setTarea(updated);
      setEditing(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleEstado = async () => {
    if (!token || !tarea) return;
    const next: TareaEstado = tarea.estado === "hecha" ? "pendiente" : "hecha";
    const updated = await api.patch<Tarea>(`/tareas/${id}`, { estado: next }, token);
    setTarea(updated);
  };

  const handleAddNota = async () => {
    if (!token || !notaTexto.trim()) return;
    setSavingNota(true);
    try {
      const n = await api.post<Nota>(`/tareas/${id}/notas`, { texto: notaTexto.trim() }, token);
      setNotas(prev => [...prev, n]);
      setNotaTexto("");
    } finally {
      setSavingNota(false);
    }
  };

  const handleDeleteNota = async (notaId: string) => {
    if (!token) return;
    setDeletingNota(notaId);
    try {
      await api.delete(`/tareas/${id}/notas/${notaId}`, token);
      setNotas(prev => prev.filter(n => n.id !== notaId));
    } finally {
      setDeletingNota(null);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await api.delete(`/tareas/${id}`, token);
      router.push(exp ? `/expedientes/${exp.id}` : "/tareas");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 animate-pulse space-y-4">
        <div className="h-4 bg-ink-100 rounded w-1/3" />
        <div className="h-8 bg-ink-100 rounded w-2/3" />
        <div className="h-48 bg-ink-100 rounded-2xl" />
      </div>
    );
  }

  if (!tarea) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm border border-red-100">
          {error || "Tarea no encontrada"}
        </div>
      </div>
    );
  }

  const cfg = ESTADO_CFG[tarea.estado];
  const vencida = tarea.fecha_limite && tarea.fecha_limite < todayAR() && tarea.estado !== "hecha";

  return (
    <>
    <div className="max-w-3xl mx-auto py-4 px-3 sm:px-4 sm:py-6 space-y-4 pb-28">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-400 flex-wrap">
        {exp ? (
          <>
            <Link href="/expedientes" className="hover:text-ink-600 transition">Expedientes</Link>
            <span>/</span>
            <Link href={`/expedientes/${exp.id}`} className="hover:text-ink-600 transition truncate max-w-[120px]">{exp.numero}</Link>
          </>
        ) : (
          <Link href="/tareas" className="hover:text-ink-600 transition">Tareas</Link>
        )}
        <span>/</span>
        <span className="text-ink-700 font-medium truncate max-w-[160px]">{tarea.titulo}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className={`px-4 py-4 border-b border-ink-50 ${tarea.estado === "hecha" ? "bg-green-50/40" : vencida ? "bg-red-50/40" : ""}`}>
          {/* Badges + acciones en una fila */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Estado — botón interactivo con chevron */}
              <button
                onClick={handleToggleEstado}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition active:scale-95 ${
                  tarea.estado === "hecha"
                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700"

                    : "bg-white text-ink-600 border-ink-300 hover:bg-ink-50"
                }`}
              >
                {tarea.estado === "hecha"
                  ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>

                  : <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/></svg>
                }
                {cfg.label.replace("✓ ", "")}
                <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              {/* Tipo */}
              <span className="text-xs text-ink-400 bg-ink-50 px-2 py-1 rounded-md">{TIPO_LABEL[tarea.tipo] ?? tarea.tipo}</span>
              {/* Alerta — solo visual */}
              {vencida && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                  VENCIDA
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={openEdit} className="p-2 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 active:bg-ink-100 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          <h1 className={`text-lg font-bold leading-snug ${tarea.estado === "hecha" ? "line-through text-ink-400" : "text-ink-900"}`}>
            {tarea.titulo}
          </h1>
        </div>

        {/* Fields */}
        <div className="px-4 py-3 space-y-0 divide-y divide-ink-50">
          {tarea.fecha_limite && (
            <div className="flex justify-between items-start gap-3 py-2.5 first:pt-0">
              <span className="text-sm text-ink-400 flex-shrink-0">Fecha límite</span>
              <span className={`text-sm font-medium text-right ${vencida ? "text-red-600" : "text-ink-900"}`}>
                {formatFecha(tarea.fecha_limite)}{tarea.hora ? ` · ${tarea.hora}` : ""}
              </span>
            </div>
          )}
          {tarea.responsable_nombre && (
            <div className="flex justify-between items-center gap-3 py-2.5">
              <span className="text-sm text-ink-400 flex-shrink-0">Responsable</span>
              <span className="text-sm font-medium text-ink-900 text-right">{tarea.responsable_nombre}</span>
            </div>
          )}
          {exp && (
            <div className="flex justify-between items-start gap-3 py-2.5">
              <span className="text-sm text-ink-400 flex-shrink-0">Expediente</span>
              <Link href={`/expedientes/${exp.id}`} className="text-sm font-medium text-brand-600 text-right leading-snug">
                {exp.numero}{exp.caratula ? ` · ${exp.caratula}` : ""}
              </Link>
            </div>
          )}
          {exp && (
            <div className="flex justify-between items-start gap-3 py-2.5">
              <span className="text-sm text-ink-400 flex-shrink-0">Tribunal</span>
              <span className="text-xs text-ink-700 text-right">{exp.juzgado || "—"}</span>
            </div>
          )}
          {exp && (
            <div className="flex justify-between items-start gap-3 py-2.5">
              <span className="text-sm text-ink-400 flex-shrink-0">Localidad</span>
              <span className="text-xs text-ink-700 text-right">{exp.localidad || "—"}</span>
            </div>
          )}
          {tarea.cliente_nombre && (
            <div className="flex justify-between items-center gap-3 py-2.5">
              <span className="text-sm text-ink-400 flex-shrink-0">Cliente</span>
              <span className="text-sm font-medium text-ink-900 text-right">{tarea.cliente_nombre}</span>
            </div>
          )}
          {tarea.descripcion && (
            <div className="py-2.5">
              <span className="text-sm text-ink-400 block mb-1">Descripción</span>
              <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{tarea.descripcion}</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-ink-900">¿Eliminar esta tarea?</p>
            <p className="text-xs text-ink-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">{deleting ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Documentos */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Documentos</h2>
        <DocumentosSection tareaId={id} token={token!} />
      </div>

      {/* Notas */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-ink-50 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Notas</h2>
          <span className="text-xs text-ink-400">{notas.length} nota{notas.length !== 1 ? "s" : ""}</span>
        </div>

        {notas.length > 0 && (
          <div className="divide-y divide-ink-50">
            {notas.map(n => (
              <div key={n.id} className="px-4 py-3 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {n.autor_nombre ? n.autor_nombre.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-ink-700">{n.autor_nombre ?? "Usuario"}</span>
                    <span className="text-xs text-ink-400">{formatTs(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{n.texto}</p>
                </div>
                <button onClick={() => handleDeleteNota(n.id)} disabled={deletingNota === n.id} className="p-1.5 rounded text-ink-300 hover:text-red-500 active:text-red-600 transition flex-shrink-0 disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3.5 bg-ink-50/30 border-t border-ink-50">
          <textarea
            ref={textareaRef}
            value={notaTexto}
            onChange={e => setNotaTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNota(); }}
            placeholder="Agregar nota o minuta…"
            rows={3}
            className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition resize-none"
          />
          <button
            onClick={handleAddNota}
            disabled={savingNota || !notaTexto.trim()}
            className="mt-2 w-full sm:w-auto sm:float-right text-sm font-semibold bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-40"
          >
            {savingNota ? "Guardando…" : "Guardar nota"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>
      )}
    </div>
    {/* Modal editar */}
    {editing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">Editar tarea</h2>
            <button onClick={() => setEditing(false)} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
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
            <button onClick={() => setEditing(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
            <button onClick={handleSaveEdit} disabled={savingEdit || !editForm.titulo.trim()} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{savingEdit ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
