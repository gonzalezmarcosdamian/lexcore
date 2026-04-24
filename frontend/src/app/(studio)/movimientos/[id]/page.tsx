"use client";

import { TimeInput } from "@/components/ui/time-input";
import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Movimiento, Nota, Expediente } from "@/lib/api";
import { DocumentosSection } from "@/components/ui/documentos-section";

const TIPO_LABEL: Record<string, string> = {
  vencimiento: "Vencimiento", audiencia: "Audiencia",
  presentacion: "Presentacion", pericia: "Pericia",
  acto_procesal: "Acto Procesal", notificacion: "Notificacion", otro: "Otro",
};

function formatFechaLarga(f: string) {
  return new Date(f + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function esVencida(fecha: string, estado: string) { return fecha < new Date().toISOString().slice(0,10) && estado !== "cumplido"; }
function esUrgente(fecha: string, estado: string) { const diff = new Date(fecha).getTime() - Date.now(); return diff >= 0 && diff < 48*3600*1000 && estado !== "cumplido"; }

export default function MovimientoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [mov, setMov] = useState<Movimiento | null>(null);
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
  const [editForm, setEditForm] = useState({ titulo: "", descripcion: "", fecha: "", hora: "", tipo: "vencimiento" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string,string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      router.replace("/agenda");
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<Movimiento>(`/movimientos/${id}`, token),
      api.get<Nota[]>(`/movimientos/${id}/notas`, token),
    ]).then(([m, ns]) => {
      setMov(m);
      setNotas(ns);
      if (m.expediente_id) {
        api.get<Expediente>(`/expedientes/${m.expediente_id}`, token).then(setExp).catch(() => {});
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const openEdit = () => {
    if (!mov) return;
    setEditForm({ titulo: mov.titulo, descripcion: mov.descripcion ?? "", fecha: mov.fecha, hora: mov.hora ?? "", tipo: mov.tipo ?? "vencimiento" });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !mov) return;
    const e: Record<string,string> = {};
    if (!editForm.titulo.trim()) e.titulo = "El titulo es obligatorio";
    else if (editForm.titulo.trim().length < 3) e.titulo = "Minimo 3 caracteres";
    if (!editForm.fecha) e.fecha = "La fecha es obligatoria";
    if (!editForm.hora) e.hora = "La hora es obligatoria";
    setEditErrors(e);
    if (Object.keys(e).length > 0) return;
    setSavingEdit(true);
    try {
      const updated = await api.patch<Movimiento>(`/movimientos/${id}`, {
        titulo: editForm.titulo,
        descripcion: editForm.descripcion || null,
        fecha: editForm.fecha,
        hora: editForm.hora || null,
        tipo: editForm.tipo,
      }, token);
      setMov(updated);
      setEditing(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSavingEdit(false); }
  };

  const handleToggleEstado = async () => {
    if (!token || !mov) return;
    const nuevoEstado = mov.estado === "cumplido" ? "pendiente" : "cumplido";
    const updated = await api.patch<Movimiento>(`/movimientos/${id}`, { estado: nuevoEstado }, token);
    setMov(updated);
  };

  const handleAddNota = async () => {
    if (!token || !notaTexto.trim()) return;
    setSavingNota(true);
    try {
      const n = await api.post<Nota>(`/movimientos/${id}/notas`, { texto: notaTexto.trim() }, token);
      setNotas(prev => [...prev, n]);
      setNotaTexto("");
    } finally { setSavingNota(false); }
  };

  const handleDeleteNota = async (notaId: string) => {
    if (!token) return;
    setDeletingNota(notaId);
    try {
      await api.delete(`/movimientos/${id}/notas/${notaId}`, token);
      setNotas(prev => prev.filter(n => n.id !== notaId));
    } finally { setDeletingNota(null); }
  };

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await api.delete(`/movimientos/${id}`, token);
      router.push(exp ? `/expedientes/${exp.id}` : "/agenda");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto py-6 px-3 animate-pulse space-y-4">
      <div className="h-4 bg-ink-100 rounded w-1/3" />
      <div className="h-8 bg-ink-100 rounded w-2/3" />
      <div className="h-48 bg-ink-100 rounded-2xl" />
    </div>
  );

  if (!mov) return (
    <div className="max-w-3xl mx-auto py-6 px-3">
      <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm border border-red-100">
        {error || "Movimiento no encontrado"}
      </div>
    </div>
  );

  const vencida = esVencida(mov.fecha, mov.estado);
  const urgente = esUrgente(mov.fecha, mov.estado);
  const headerCls = mov.estado === "cumplido" ? "bg-green-50/40" : vencida ? "bg-red-50/40" : urgente ? "bg-amber-50/40" : "";

  return (
    <>
    <div className="max-w-3xl mx-auto py-4 px-3 sm:px-4 sm:py-6 space-y-4 pb-28">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-400">
        {exp ? (
          <>
            <Link href="/expedientes" className="hover:text-ink-600 transition">Expedientes</Link>
            <span>/</span>
            <Link href={`/expedientes/${exp.id}`} className="hover:text-ink-600 transition truncate max-w-[100px]">{exp.numero}</Link>
          </>
        ) : (
          <Link href="/agenda" className="hover:text-ink-600 transition">Agenda</Link>
        )}
        <span>/</span>
        <span className="text-ink-700 font-medium truncate max-w-[120px]">{mov.titulo}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        {editing ? (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Titulo *</label>
              <input value={editForm.titulo} onChange={e => { setEditForm(f => ({ ...f, titulo: e.target.value })); setEditErrors(v => ({ ...v, titulo: "" })); }} className={`w-full border rounded-xl px-3 py-2.5 text-sm ${editErrors.titulo ? "border-red-400" : "border-ink-200"}`} />
              {editErrors.titulo && <p className="text-xs text-red-500 mt-1">{editErrors.titulo}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Descripcion</label>
              <textarea value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Fecha *</label>
                <DateInput value={editForm.fecha} onChange={v => { setEditForm(f => ({ ...f, fecha: v })); setEditErrors(e => ({ ...e, fecha: "" })); }} ringColor={editErrors.fecha ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
                {editErrors.fecha && <p className="text-xs text-red-500 mt-1">{editErrors.fecha}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Hora *</label>
                <TimeInput value={editForm.hora} onChange={v => { setEditForm(f => ({ ...f, hora: v })); setEditErrors(e => ({ ...e, hora: "" })); }} ringColor={editErrors.hora ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
                {editErrors.hora && <p className="text-xs text-red-500 mt-1">{editErrors.hora}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
              <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm">
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-2.5 rounded-xl">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 text-sm font-semibold bg-brand-600 text-white px-4 py-2.5 rounded-xl disabled:opacity-40">
                {savingEdit ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`px-4 py-4 border-b border-ink-50 ${headerCls}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <button
                      onClick={handleToggleEstado}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition active:scale-95 ${
                        mov.estado === "cumplido" ? "bg-green-600 text-white border-green-600 hover:bg-green-700" : "bg-white text-ink-600 border-ink-300 hover:bg-ink-50"
                      }`}
                    >
                      {mov.estado === "cumplido"
                        ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/></svg>
                      }
                      {mov.estado === "cumplido" ? "Cumplido" : "Pendiente"}
                      <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <span className="text-xs text-ink-400 bg-ink-50 px-2 py-1 rounded-md">{TIPO_LABEL[mov.tipo] ?? mov.tipo}</span>
                    {vencida && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-md">VENCIDO</span>}
                    {urgente && !vencida && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">URGENTE</span>}
                  </div>
                  <h1 className={`text-lg font-bold leading-snug ${mov.estado === "cumplido" ? "line-through text-ink-400" : "text-ink-900"}`}>{mov.titulo}</h1>
                  {mov.descripcion && <p className="text-sm text-ink-500 mt-1 leading-relaxed">{mov.descripcion}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={openEdit} className="p-2 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 transition" title="Editar">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg border border-ink-200 text-ink-400 hover:text-red-500 hover:bg-red-50 transition" title="Eliminar">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="px-4 divide-y divide-ink-50">
              <div className="flex justify-between items-start gap-3 py-2.5">
                <span className="text-sm text-ink-400 flex-shrink-0">Fecha</span>
                <span className={`text-sm font-medium text-right ${vencida ? "text-red-600" : "text-ink-900"}`}>
                  {formatFechaLarga(mov.fecha)}{mov.hora ? ` - ${mov.hora}` : ""}
                </span>
              </div>
              {exp && (
                <>
                  <div className="flex justify-between items-start gap-3 py-2.5">
                    <span className="text-sm text-ink-400 flex-shrink-0">Expediente</span>
                    <Link href={`/expedientes/${exp.id}`} className="text-sm font-medium text-brand-600 hover:underline text-right truncate max-w-[200px]">
                      {exp.numero}{exp.caratula ? ` - ${exp.caratula}` : ""}
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
            </div>
          </>
        )}
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Documentos</h2>
        <DocumentosSection movimientoId={id} token={token!} />
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
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {n.autor_nombre ? n.autor_nombre.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-ink-700">{n.autor_nombre ?? "Usuario"}</span>
                    <span className="text-xs text-ink-400">{formatTs(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink-800 whitespace-pre-line leading-relaxed">{n.texto}</p>
                </div>
                <button onClick={() => handleDeleteNota(n.id)} disabled={deletingNota === n.id} className="p-1 rounded text-ink-300 hover:text-red-500 transition flex-shrink-0 disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 py-4 bg-ink-50/30 border-t border-ink-50">
          <textarea
            ref={textareaRef}
            value={notaTexto}
            onChange={e => setNotaTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNota(); }}
            placeholder="Agregar nota... (Ctrl+Enter para guardar)"
            rows={3}
            className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition resize-none"
          />
          <div className="mt-2">
            <button onClick={handleAddNota} disabled={savingNota || !notaTexto.trim()} className="w-full sm:w-auto sm:float-right text-sm font-semibold bg-brand-600 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-40">
              {savingNota ? "Guardando..." : "Guardar nota"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}
    </div>

    {confirmDelete && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setConfirmDelete(false)}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-semibold text-ink-900">Eliminar este movimiento?</p>
          <p className="text-xs text-ink-500">Esta accion no se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-2.5 rounded-xl">Cancelar</button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 text-sm font-semibold bg-red-600 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-50">
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
