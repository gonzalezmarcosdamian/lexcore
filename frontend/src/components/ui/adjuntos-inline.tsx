"use client";

import { useEffect, useRef, useState } from "react";
import { Documento } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Props {
  tareaId?: string;
  vencimientoId?: string;
  token: string;
}

export function AdjuntosInline({ tareaId, vencimientoId, token }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryParam: Record<string, string> = tareaId
    ? { tarea_id: tareaId }
    : { vencimiento_id: vencimientoId! };

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(queryParam);
    fetch(`${API_URL}/documentos?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setDocs)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      if (tareaId) fd.append("tarea_id", tareaId);
      if (vencimientoId) fd.append("vencimiento_id", vencimientoId);
      fd.append("file", file);
      try {
        const res = await fetch(`${API_URL}/documentos/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) { const doc: Documento = await res.json(); setDocs(p => [...p, doc]); }
      } catch { /* silent */ }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(doc: Documento) {
    await fetch(`${API_URL}/documentos/${doc.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setDocs(p => p.filter(d => d.id !== doc.id));
  }

  async function handleDownload(doc: Documento) {
    const res = await fetch(`${API_URL}/documentos/${doc.id}/content?inline=false`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = doc.nombre; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 transition"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Adjuntos {docs.length > 0 && !open && `(${docs.length})`}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 text-xs text-ink-600 bg-white border border-ink-100 rounded-lg px-2 py-1.5">
              <span className="flex-1 truncate">{doc.label || doc.nombre}</span>
              <button onClick={() => handleDownload(doc)} className="text-brand-600 hover:text-brand-700 font-medium" title="Descargar">↓</button>
              <button onClick={() => handleDelete(doc)} className="text-red-400 hover:text-red-600" title="Eliminar">✕</button>
            </div>
          ))}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 border border-dashed border-brand-200 rounded-lg px-2 py-1 w-full justify-center transition disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : "+ Adjuntar archivo"}
          </button>
        </div>
      )}
    </div>
  );
}
