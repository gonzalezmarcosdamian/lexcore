"use client";
import { useState, useRef, useEffect } from "react";

export interface ExpedienteOption {
  id: string;
  numero?: string;
  numero_judicial?: string | null;
  caratula?: string;
  cliente_nombre?: string;
}

interface Props {
  expedientes: ExpedienteOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  ringColor?: string;
}

export function ExpedienteSelect({ expedientes, value, onChange, placeholder = "— Sin expediente —", className = "", ringColor = "focus-within:ring-brand-400" }: Props) {
  const selected = expedientes.find(e => e.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? expedientes.filter(e => {
        const q = query.toLowerCase();
        return (
          (e.numero_judicial ?? "").toLowerCase().includes(q) ||
          (e.numero ?? "").toLowerCase().includes(q) ||
          (e.caratula ?? "").toLowerCase().includes(q) ||
          (e.cliente_nombre ?? "").toLowerCase().includes(q)
        );
      })
    : expedientes;

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  // Mostrar numero_judicial si existe (el que ingresa el abogado), sino el interno
  const displayNumero = (e: ExpedienteOption) => e.numero_judicial || e.numero || "";

  const label = selected
    ? `${displayNumero(selected) ? displayNumero(selected) + " · " : ""}${selected.cliente_nombre ?? selected.caratula ?? ""}`
    : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between bg-white focus:outline-none focus:ring-2 ${ringColor} transition ${!selected ? "text-ink-400" : "text-ink-900"}`}
      >
        <span className="truncate">{label}</span>
        <svg className={`w-4 h-4 text-ink-300 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-ink-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-ink-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por número, carátula o cliente…"
              className="w-full text-sm px-3 py-2 border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            <li
              onClick={() => select("")}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-ink-50 transition ${!value ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-500"}`}
            >
              {placeholder}
            </li>
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink-400 text-center">Sin resultados</li>
            )}
            {filtered.map(e => (
              <li
                key={e.id}
                onClick={() => select(e.id)}
                className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-ink-50 transition ${value === e.id ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-900"}`}
              >
                <span className="font-medium text-ink-700 mr-1">{displayNumero(e)}</span>
                <span className="text-ink-500">{e.cliente_nombre ?? e.caratula}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
