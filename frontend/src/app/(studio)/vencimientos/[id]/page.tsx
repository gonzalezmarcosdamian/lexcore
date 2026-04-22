"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Vencimiento, Nota, Expediente } from "@/lib/api";
import { DocumentosSection } from "@/components/ui/documentos-section";

const TIPO_LABEL: Record<string, string> = {
  vencimiento: "Vencimiento", audiencia: "Audiencia",
  presentacion: "Presentación", pericia: "Pericia", otro: "Otro",
};

function formatFechaLarga(f: string) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function esVencida(fecha: string) { return fecha < new Date().toISOString().split("T")[0]; }
function esUrgente(fecha: string) {
  const diff = new Date(fecha).getTime() - Date.now();
  return diff >= 0 && diff < 48 * 3600 * 1000;
}

export default function VencimientoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [venc, setVenc] = useState<Vencimiento | null>(null);
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
  const [editForm, setEditForm] = useState({ descripcion: "", fecha: "", hora: "", tipo: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<Vencimiento>(`/vencimientos/${id}`, token),
      api.get<Nota[]>(`/vencimientos/${id}/notas`, token),
    ]).then(([v, ns]) => {
      setVenc(v);
      setNotas(ns);
      if (v.expediente_id) {
        api.get<Expediente>(`/expedientes/${v.expediente_id}`, token).then(setExp).catch(() => {});
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const openEdit = () => {
    if (!venc) return;
    setEditForm({ descripcion: venc.descripcion, fecha: venc.fecha, hora: venc.hora ?? "", tipo: venc.tipo ?? "vencimiento" });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !venc) return;
    setSavingEdit(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${id}`, {
        descripcion: editForm.descripcion,
        fecha: editForm.fecha,
        hora: editForm.hora || null,
        tipo: editForm.tipo,
      }, token);
      setVenc(updated);
      setEditing(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleCumplido = async () => {
    if (!token || !venc) return;
    const updated = await api.patch<Vencimiento>(`/vencimientos/${id}`, { cumplido: !venc.cumplido }, token);
    setVenc(updated);
  };

  const handleAddNota = async () => {
    if (!token || !notaTexto.trim()) return;
    setSavingNota(true);
    try {
      const n = await api.post<Nota>(`/vencimientos/${id}/notas`, { texto: notaTexto.trim() }, token);
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
      await api.delete(`/vencimientos/${id}/notas/${notaId}`, token);
      setNotas(prev => prev.filter(n => n.id !== notaId));
    } finally {
      setDeletingNota(null);
    }
  };

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await api.delete(`/vencimientos/${id}`, token);
      router.push(exp ? `/expedientes/${exp.id}` : "/vencimientos");
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

  if (!venc) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm border border-red-100">
          {error || "Vencimiento no encontrado"}
        </div>
      </div>
    );
  }

  const vencida = esVencida(venc.fecha) && !venc.cumplido;
  const urgente = esUrgente(venc.fecha) && !venc.cumplido;
  const headerCls = venc.cumplido ? "bg-green-50/40" : vencida ? "bg-red-50/40" : urgente ? "bg-amber-50/40" : "";

  return (
    <>
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-ink-400">
        {exp ? (
          <>
            <Link href="/expedientes" className="hover:text-ink-600 transition">Expedientes</Link>
            <span>/</span>
            <Link href={`/expedientes/${exp.id}`} className="hover:text-ink-600 transition truncate max-w-[160px]">{exp.numero}</Link>
          </>
        ) : (
          <Link href="/vencimientos" className="hover:text-ink-600 transition">Vencimientos</Link>
        )}
        <span>/</span>
        <span className="text-ink-700 font-medium truncate">{venc.descripcion}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className={`px-5 py-4 border-b border-ink-50 ${headerCls}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <button
                  onClick={handleToggleCumplido}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition hover:opacity-80 ${
                    venc.cumplido ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                  }`}
                  title="Cambiar estado"
                >
                  {venc.cumplido ? "✓ Cumplido" : "Pendiente"}
                </button>
                <span className="text-xs text-ink-400">{TIPO_LABEL[venc.tipo] ?? venc.tipo}</span>
                {vencida && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Vencido</span>}
                {urgente && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">⚡ Urgente</span>}
              </div>
              <h1 className={`text-xl font-bold leading-snug ${venc.cumplido ? "line-through text-ink-400" : "text-ink-900"}`}>
                {venc.descripcion}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 text-xs font-semibold border border-ink-200 text-ink-600 hover:bg-ink-50 px-3 py-1.5 rounded-lg transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                Editar
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                  <button onClick={handleDelete} disabled={deleting} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition disabled:opacity-50">Sí</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2.5 py-1.5 rounded-lg hover:bg-ink-50 transition">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-3 divide-y divide-ink-50">
          <div className="flex justify-between items-center first:pt-0">
            <span className="text-sm text-ink-400">Fecha</span>
            <span className={`text-sm font-medium ${vencida ? "text-red-600" : "text-ink-900"}`}>
              {formatFechaLarga(venc.fecha)}{venc.hora ? ` · ${venc.hora}` : ""}
            </span>
          </div>
          {exp && (
            <div className="flex justify-between items-center pt-3">
              <span className="text-sm text-ink-400">Expediente</span>
              <Link href={`/expedientes/${exp.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                {exp.numero}{exp.caratula ? ` · ${exp.caratula}` : ""}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-3">Documentos</h2>
        <DocumentosSection vencimientoId={id} token={token!} />
      </div>

      {/* Notas / Bitácora */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide">Notas</h2>
          <span className="text-xs text-ink-400">{notas.length} nota{notas.length !== 1 ? "s" : ""}</span>
        </div>

        {notas.length > 0 && (
          <div className="divide-y divide-ink-50">
            {notas.map(n => (
              <div key={n.id} className="px-5 py-3.5 flex gap-3 group">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {n.autor_nombre ? n.autor_nombre.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-ink-700">{n.autor_nombre ?? "Usuario"}</span>
                    <span className="text-xs text-ink-400">{formatTs(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{n.texto}</p>
                </div>
                <button
                  onClick={() => handleDeleteNota(n.id)}
                  disabled={deletingNota === n.id}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-300 hover:text-red-500 transition flex-shrink-0 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-4 bg-ink-50/30 border-t border-ink-50">
          <textarea
            ref={textareaRef}
            value={notaTexto}
            onChange={e => setNotaTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNota(); }}
            placeholder="Agregar nota o minuta… (Ctrl+Enter para guardar)"
            rows={3}
            className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddNota}
              disabled={savingNota || !notaTexto.trim()}
              className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl transition disabled:opacity-40"
            >
              {savingNota ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
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
            <h2 className="text-base font-semibold text-ink-900">Editar vencimiento</h2>
            <button onClick={() => setEditing(false)} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción *</label>
            <input autoFocus value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="vencimiento">Vencimiento</option>
              <option value="audiencia">Audiencia</option>
              <option value="presentacion">Presentación</option>
              <option value="pericia">Pericia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
              <input type="date" value={editForm.fecha} onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={editForm.hora} onChange={e => setEditForm(f => ({ ...f, hora: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditing(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">Cancelar</button>
            <button onClick={handleSaveEdit} disabled={savingEdit || !editForm.descripcion.trim() || !editForm.fecha} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">{savingEdit ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
