"use client";

import { useEffect, useRef, useState } from "react";
import { api, Documento } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ICON: Record<string, string> = {
  "application/pdf": "📄",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "image/jpeg": "🖼",
  "image/png": "🖼",
  "image/gif": "🖼",
};

function fileIcon(ct: string) { return ICON[ct] ?? "📎"; }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props { expedienteId: string; token: string; onCreated?: () => void; }

function PreviewModal({ doc, token, onClose }: { doc: Documento; token: string; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = doc.content_type.startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";

  useEffect(() => {
    fetch(`${API_URL}/documentos/${doc.id}/content?inline=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => onClose())
      .finally(() => setLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-4xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 flex-shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <p className="text-sm font-medium text-ink-900 truncate">{doc.label || doc.nombre}</p>
            {doc.label && <p className="text-xs text-ink-400 truncate">{doc.nombre}</p>}
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <button
                onClick={() => { const a = document.createElement("a"); a.href = blobUrl; a.download = doc.nombre; a.click(); }}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium border border-brand-200 hover:border-brand-300 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-all"
              >
                Descargar
              </button>
            )}
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition p-1 rounded-lg hover:bg-ink-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-ink-50 min-h-[400px] flex items-center justify-center">
          {loading ? (
            <div className="w-8 h-8 border-2 border-ink-200 border-t-brand-500 rounded-full animate-spin" />
          ) : !blobUrl ? null : isPdf ? (
            <iframe src={blobUrl} className="w-full h-full min-h-[500px]" title={doc.nombre} />
          ) : isImage ? (
            <img src={blobUrl} alt={doc.nombre} className="max-w-full max-h-full object-contain p-4" />
          ) : (
            <div className="text-center p-8">
              <p className="text-4xl mb-3">📎</p>
              <p className="text-sm text-ink-600 mb-4">Vista previa no disponible</p>
              <button onClick={() => { const a = document.createElement("a"); a.href = blobUrl; a.download = doc.nombre; a.click(); }} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                Descargar archivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentosTab({ expedienteId, token, onCreated }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Documento[]>("/documentos", token, { expediente_id: expedienteId })
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expedienteId, token]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    const maxOrden = docs.length > 0 ? Math.max(...docs.map(d => d.orden ?? 0)) : -1;
    let nextOrden = maxOrden + 1;

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) { setError(`"${file.name}" supera el límite de 50 MB`); continue; }
      try {
        const formData = new FormData();
        formData.append("expediente_id", expedienteId);
        formData.append("descripcion", "");
        formData.append("file", file);
        const res = await fetch(`${API_URL}/documentos/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? "Error al subir"); }
        const doc: Documento = await res.json();
        // asignar orden al final
        const updated = await api.patch<Documento>(`/documentos/${doc.id}`, { orden: nextOrden }, token);
        nextOrden++;
        setDocs((prev) => [...prev, updated]);
      } catch (e: unknown) { setError(e instanceof Error ? e.message : `Error subiendo "${file.name}"`); }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    onCreated?.();
  }

  async function handleDownload(doc: Documento) {
    try {
      const res = await fetch(`${API_URL}/documentos/${doc.id}/content?inline=false`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al descargar");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.nombre;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch { setError("No se pudo descargar el archivo"); }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      const res = await fetch(`${API_URL}/documentos/merged-pdf?expediente_id=${expedienteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? "Error"); }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      a.download = match ? decodeURIComponent(match[1].replace(/"/g, "")) : "documentos.pdf";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "No se pudo generar el PDF combinado"); }
    finally { setDownloadingAll(false); }
  }

  async function handleDelete(doc: Documento) {
    if (!confirm(`¿Eliminás "${doc.label || doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(doc.id);
    try {
      await fetch(`${API_URL}/documentos/${doc.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const remaining = docs.filter((d) => d.id !== doc.id);
      // renumerar orden
      const renumbered = remaining.map((d, i) => ({ ...d, orden: i }));
      setDocs(renumbered);
      await Promise.all(renumbered.map((d, i) =>
        d.orden !== docs.find(x => x.id === d.id)?.orden
          ? api.patch(`/documentos/${d.id}`, { orden: i }, token)
          : Promise.resolve()
      ));
    } catch { setError("Error al eliminar el documento"); }
    finally { setDeletingId(null); }
  }

  async function moveDoc(index: number, direction: "up" | "down") {
    const newDocs = [...docs];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newDocs.length) return;
    [newDocs[index], newDocs[swapIndex]] = [newDocs[swapIndex], newDocs[index]];
    const updated = newDocs.map((d, i) => ({ ...d, orden: i }));
    setDocs(updated);
    await Promise.all([
      api.patch(`/documentos/${updated[index].id}`, { orden: updated[index].orden }, token),
      api.patch(`/documentos/${updated[swapIndex].id}`, { orden: updated[swapIndex].orden }, token),
    ]);
  }

  async function saveLabel(doc: Documento) {
    const label = labelDraft.trim() || null;
    const updated = await api.patch<Documento>(`/documentos/${doc.id}`, { label }, token);
    setDocs(prev => prev.map(d => d.id === doc.id ? updated : d));
    setEditingLabelId(null);
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); handleFiles(e.dataTransfer.files); }

  const pdfCount = docs.filter(d => d.content_type === "application/pdf").length;

  if (loading) return (
    <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-ink-50 rounded-xl" />)}</div>
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-ink-200 rounded-2xl p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors group"
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <div className="text-2xl mb-1">{uploading ? "⏳" : "📁"}</div>
        <p className="text-sm font-medium text-ink-700 group-hover:text-brand-700">
          {uploading ? "Subiendo archivos..." : "Arrastrá o hacé click para adjuntar"}
        </p>
        <p className="text-xs text-ink-400 mt-0.5">PDF, Word, Excel, imágenes — máx. 50 MB</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}

      {/* Acciones globales */}
      {docs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-400">{docs.length} archivo{docs.length !== 1 ? "s" : ""} · arrastrá los botones ↑↓ para reordenar</p>
          {pdfCount >= 2 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-300 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {downloadingAll ? "Generando…" : `Descargar todo (${pdfCount} PDFs)`}
            </button>
          )}
        </div>
      )}

      {/* Lista de documentos */}
      {docs.length === 0 ? (
        <div className="text-center py-8"><p className="text-sm text-ink-400">Sin documentos adjuntos</p></div>
      ) : (
        <div className="divide-y divide-ink-50 border border-ink-100 rounded-2xl overflow-hidden bg-white">
          {docs.map((doc, index) => (
            <div key={doc.id} className="flex items-center gap-2 px-3 py-3 hover:bg-ink-50/50 transition-colors group">
              {/* Controles de orden */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveDoc(index, "up")}
                  disabled={index === 0}
                  className="w-6 h-6 flex items-center justify-center rounded text-ink-300 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-20 transition"
                  title="Mover arriba"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  onClick={() => moveDoc(index, "down")}
                  disabled={index === docs.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded text-ink-300 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-20 transition"
                  title="Mover abajo"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              <span className="text-xl flex-shrink-0">{fileIcon(doc.content_type)}</span>

              {/* Info + label editable */}
              <div className="flex-1 min-w-0">
                {editingLabelId === doc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={labelDraft}
                      onChange={e => setLabelDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveLabel(doc); if (e.key === "Escape") setEditingLabelId(null); }}
                      placeholder={doc.nombre}
                      className="flex-1 text-sm border border-brand-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <button onClick={() => saveLabel(doc)} className="text-xs text-brand-600 font-medium hover:text-brand-700">Guardar</button>
                    <button onClick={() => setEditingLabelId(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer group/label"
                    onClick={() => { setEditingLabelId(doc.id); setLabelDraft(doc.label ?? ""); }}
                    title="Click para editar etiqueta"
                  >
                    <p className="text-sm font-medium text-ink-900 truncate">
                      {doc.label || doc.nombre}
                      <span className="ml-1.5 opacity-0 group-hover/label:opacity-100 transition text-ink-300 text-xs">✏️</span>
                    </p>
                    {doc.label && <p className="text-xs text-ink-400 truncate">{doc.nombre}</p>}
                    <p className="text-xs text-ink-400">
                      {formatSize(doc.size_bytes)} · {formatDate(doc.created_at)}
                      {doc.tarea_id && <span className="ml-1.5 text-blue-500">• Tarea</span>}
                      {doc.vencimiento_id && <span className="ml-1.5 text-amber-500">• Vencimiento</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button onClick={() => setPreviewDoc(doc)} className="text-xs text-ink-600 hover:text-ink-900 font-medium border border-ink-200 hover:border-ink-300 hover:bg-ink-50 px-2.5 py-1 rounded-lg transition-all">
                  Ver
                </button>
                <button onClick={() => handleDownload(doc)} className="text-xs text-brand-600 hover:text-brand-700 font-medium border border-brand-200 hover:border-brand-300 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-all">
                  Descargar
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 hover:bg-red-50 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                >
                  {deletingId === doc.id ? "..." : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewDoc && <PreviewModal doc={previewDoc} token={token} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}
