"use client";

import { useEffect, useRef } from "react";

export interface SortOption<K extends string> {
  key: K;
  label: string;
  icon?: string;
}

interface SortModalProps<K extends string> {
  options: SortOption<K>[];
  sortKey: K;
  sortDir: "asc" | "desc";
  onChange: (key: K, dir: "asc" | "desc") => void;
  onClose: () => void;
}

/**
 * Modal de ordenamiento: popover en desktop, pantalla completa en mobile.
 * Se monta sobre el botón en desktop (posición absoluta) y como overlay full en mobile.
 */
export function SortModal<K extends string>({
  options,
  sortKey,
  sortDir,
  onChange,
  onClose,
}: SortModalProps<K>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const select = (key: K) => {
    if (key === sortKey) {
      onChange(key, sortDir === "asc" ? "desc" : "asc");
    } else {
      onChange(key, "desc"); // default: más reciente primero
    }
    onClose();
  };

  return (
    <>
      {/* Mobile: overlay full screen */}
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
        <div
          ref={ref}
          className="bg-white rounded-t-2xl shadow-xl p-5 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-ink-200 rounded-full mx-auto mb-5" />
          <p className="text-base font-semibold text-ink-900 mb-4">Ordenar por</p>
          <div className="space-y-1">
            {options.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => select(opt.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition ${
                    active ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon && <span>{opt.icon}</span>}
                    {opt.label}
                  </span>
                  {active && (
                    <span className="text-xs text-brand-500 font-medium">
                      {sortDir === "desc" ? "↓ Mayor a menor" : "↑ Menor a mayor"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: popover */}
      <div
        ref={ref}
        className="hidden sm:block absolute top-full right-0 mt-1.5 z-50 w-56 bg-white border border-ink-100 rounded-2xl shadow-xl py-2 origin-top-right animate-in fade-in zoom-in-95 duration-100"
      >
        <p className="px-4 py-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">Ordenar por</p>
        <div className="space-y-0.5 px-2">
          {options.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => select(opt.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                  active ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  {opt.icon && <span>{opt.icon}</span>}
                  {opt.label}
                </span>
                {active && (
                  <svg
                    className={`w-3.5 h-3.5 text-brand-500 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Botón que abre el SortModal. Envolver en `relative` el contenedor padre. */
export function SortButton({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border transition ${
        open
          ? "bg-brand-50 text-brand-700 border-brand-200"
          : "bg-white text-ink-600 border-ink-200 hover:border-ink-300 hover:text-ink-800"
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      {label ?? "Ordenar"}
    </button>
  );
}
