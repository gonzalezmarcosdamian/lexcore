"use client";

import { useEffect, useRef, useState } from "react";
import { api, Documento } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

function fileIcon(ct: string) {
  return ICON[ct] ?? "📎";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

interface Props {
  expedienteId: string;
  token: string;
}

function PreviewModal({ doc, token, onClose }: { doc: Documento; token: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = doc.content_type.startsWith("image/");
  const isPdf = doc.content_type === "application/pdf";

  useEffect(() => {
    api.get<{ download_url: string; expires_in_seconds: number }>(
      `/documentos/${doc.id}/download-url`, token
    ).then(({ download_url }) => setUrl(download_url))
      .catch(() => onClose())
      .finally(() => setLoading(false));
  }, [doc.id, token, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-4xl w-full max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 flex-shrink-0">
          <p className="text-sm font-medium text-ink-900 truncate flex-1 mr-4">{doc.nombre}</p>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                download={doc.nombre}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium border border-brand-200 hover:border-brand-300 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-all"
              >
                Descargar
              </a>
            )}
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition p-1 rounded-lg hover:bg-ink-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-ink-50 min-h-[400px] flex items-center justify-center">
          {loading ? (
            <div className="w-8 h-8 border-2 border-ink-200 border-t-brand-500 rounded-full animate-spin" />
          ) : !url ? null : isPdf ? (
            <iframe src={url} className="w-full h-full min-h-[500px]" title={doc.nombre} />
          ) : isImage ? (
            <img src={url} alt={doc.nombre} className="max-w-full max-h-full object-contain p-4" />
          ) : (
            <div className="text-center p-8">
              <p className="text-4xl mb-3">📎</p>
              <p className="text-sm text-ink-600 mb-4">Vista previa no disponible para este tipo de archivo</p>
              <a
                href={url}
                download={doc.nombre}
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
              >
                Descargar archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentosTab({ expedienteId, token }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
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

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`"${file.name}" supera el límite de 50 MB`);
        continue;
      }
      try {
        const formData = new FormData();
        formData.append("expediente_id", expedienteId);
        formData.append("descripcion", "");
        formData.append("file", file);

        const res = await fetch(`${API}/documentos/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? "Error al subir el archivo");
        }
        const doc: Documento = await res.json();
        setDocs((prev) => [doc, ...prev]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : `Error subiendo "${file.name}"`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDownload(doc: Documento) {
    try {
      const { download_url } = await api.get<{ download_url: string; expires_in_seconds: number }>(
        `/documentos/${doc.id}/download-url`,
        token
      );
      const a = document.createElement("a");
      a.href = download_url;
      a.download = doc.nombre;
      a.click();
    } catch {
      setError("No se pudo generar el link de descarga");
    }
  }

  async function handleDelete(doc: Documento) {
    if (!confirm(`¿Eliminás "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(doc.id);
    try {
      await fetch(`${API}/documentos/${doc.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      setError("Error al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-ink-50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-ink-200 rounded-2xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors group"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-3xl mb-2">{uploading ? "⏳" : "📁"}</div>
        <p className="text-sm font-medium text-ink-700 group-hover:text-brand-700">
          {uploading ? "Subiendo archivos..." : "Arrastrá archivos o hacé click para seleccionar"}
        </p>
        <p className="text-xs text-ink-400 mt-1">PDF, Word, Excel, imágenes — máx. 50 MB por archivo</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      {/* Lista de documentos */}
      {docs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-ink-400">Sin documentos adjuntos</p>
        </div>
      ) : (
        <div className="divide-y divide-ink-50 border border-ink-100 rounded-2xl overflow-hidden bg-white">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 transition-colors">
              <span className="text-2xl flex-shrink-0">{fileIcon(doc.content_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{doc.nombre}</p>
                <p className="text-xs text-ink-400">
                  {formatSize(doc.size_bytes)} · {formatDate(doc.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="text-xs text-ink-600 hover:text-ink-900 font-medium border border-ink-200 hover:border-ink-300 hover:bg-ink-50 px-2.5 py-1 rounded-lg transition-all"
                >
                  Ver
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium border border-brand-200 hover:border-brand-300 hover:bg-brand-50 px-2.5 py-1 rounded-lg transition-all"
                >
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

      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          token={token}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
