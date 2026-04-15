"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, SearchResult } from "@/lib/api";

interface SearchModalProps {
  token: string;
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ token, open, onClose }: SearchModalProps) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(
    (query: string) => {
      if (query.length < 3) { setResult(null); return; }
      setLoading(true);
      api.get<SearchResult>("/search", token, { q: query })
        .then(setResult)
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [token]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  };

  const navigate = (href: string) => {
    setQ(""); setResult(null); onClose();
    router.push(href);
  };

  // Foco automático al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ(""); setResult(null);
    }
  }, [open]);

  // Escape cierra
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const totalResults = (result?.expedientes.length ?? 0) + (result?.clientes.length ?? 0);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-100">
          {loading ? (
            <svg className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={handleChange}
            placeholder="Buscar expediente o cliente…"
            className="flex-1 text-sm text-ink-900 placeholder-ink-400 outline-none bg-transparent"
          />
          {q && (
            <button onClick={() => { setQ(""); setResult(null); inputRef.current?.focus(); }}
              className="text-ink-300 hover:text-ink-500 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-ink-300 border border-ink-200 rounded px-1.5 py-0.5 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {result && (
          <div className="max-h-80 overflow-y-auto divide-y divide-ink-50">
            {totalResults === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-ink-400">Sin resultados para <span className="font-medium text-ink-600">"{q}"</span></p>
              </div>
            ) : (
              <>
                {result.expedientes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-4 pt-3 pb-1">Expedientes</p>
                    {result.expedientes.map((e) => (
                      <button key={e.id} onClick={() => navigate(`/expedientes/${e.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition flex items-center gap-3">
                        <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-900 font-mono">{e.numero}</p>
                          <p className="text-xs text-ink-400 truncate">{e.caratula}</p>
                        </div>
                        <svg className="w-3.5 h-3.5 text-ink-300 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
                {result.clientes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-4 pt-3 pb-1">Clientes</p>
                    {result.clientes.map((c) => (
                      <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition flex items-center gap-3">
                        <svg className="w-4 h-4 text-ink-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-900 truncate">{c.nombre}</p>
                          {c.cuit_dni && <p className="text-xs text-ink-400">{c.cuit_dni}</p>}
                        </div>
                        <svg className="w-3.5 h-3.5 text-ink-300 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer hint */}
        {!result && (
          <div className="px-4 py-3 text-xs text-ink-400 text-center">
            Mínimo 3 caracteres · Busca en expedientes y clientes
          </div>
        )}
      </div>
    </div>
  );
}
