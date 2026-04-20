"use client";

import { useRef, useState } from "react";

export type Periodo = "hoy" | "semana" | "mes" | "anio" | "custom";

export interface PeriodoValue {
  periodo: Periodo;
  desde: string;
  hasta: string;
}

const LABELS: Record<Periodo, string> = {
  hoy:    "Hoy",
  semana: "Esta semana",
  mes:    "Este mes",
  anio:   "Este año",
  custom: "Personalizado",
};

function calcDates(p: Periodo): { desde: string; hasta: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const t = fmt(now);
  if (p === "hoy") return { desde: t, hasta: t };
  if (p === "semana") {
    const day = now.getDay() || 7;
    const lunes = new Date(now); lunes.setDate(now.getDate() - day + 1);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { desde: fmt(lunes), hasta: fmt(domingo) };
  }
  if (p === "mes") {
    return {
      desde: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      hasta: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (p === "anio") return { desde: `${now.getFullYear()}-01-01`, hasta: `${now.getFullYear()}-12-31` };
  return { desde: "", hasta: "" };
}

export function getDatesFromValue(v: PeriodoValue): { desde: string; hasta: string } {
  if (v.periodo === "custom") return { desde: v.desde, hasta: v.hasta };
  return calcDates(v.periodo);
}

interface Props {
  value: PeriodoValue;
  onChange: (v: PeriodoValue) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [tempDesde, setTempDesde] = useState(value.desde);
  const [tempHasta, setTempHasta] = useState(value.hasta);
  const panelRef = useRef<HTMLDivElement>(null);

function selectPeriodo(p: Periodo) {
    if (p === "custom") {
      setTempDesde(value.desde || "");
      setTempHasta(value.hasta || "");
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const { desde, hasta } = calcDates(p);
    onChange({ periodo: p, desde, hasta });
  }

  function applyCustom() {
    if (!tempDesde || !tempHasta) return;
    onChange({ periodo: "custom", desde: tempDesde, hasta: tempHasta });
    setShowCustom(false);
  }

  const isCustomActive = value.periodo === "custom";
  const customLabel = isCustomActive && value.desde && value.hasta
    ? `${formatShort(value.desde)} — ${formatShort(value.hasta)}`
    : "Personalizado";

  return (
    <div className="relative">
      {/* Pill row */}
      <div className="flex items-center gap-1 bg-ink-50 rounded-xl p-1 w-full sm:w-fit">
        {(["hoy", "semana", "mes", "anio"] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => selectPeriodo(p)}
            className={`flex-1 sm:flex-none text-xs sm:text-sm px-2 sm:px-3 py-2 rounded-lg font-medium transition-all ${
              value.periodo === p
                ? "bg-white shadow-sm text-ink-900"
                : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {LABELS[p]}
          </button>
        ))}

        {/* Separator */}
        <div className="w-px h-5 bg-ink-200 mx-0.5 flex-shrink-0" />

        {/* Custom button — distinct style */}
        <button
          onClick={() => selectPeriodo("custom")}
          className={`flex items-center gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-2 rounded-lg font-medium transition-all flex-shrink-0 ${
            isCustomActive
              ? "bg-brand-600 text-white shadow-sm"
              : "text-brand-600 hover:bg-brand-50 border border-dashed border-brand-300"
          }`}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">{customLabel}</span>
          <span className="sm:hidden">{isCustomActive ? customLabel : "Custom"}</span>
        </button>
      </div>

      {/* Custom panel — siempre modal centrado con backdrop */}
      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCustom(false); }}>
          <div
            ref={panelRef}
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-5"
            style={{ animation: "slideUp 0.22s cubic-bezier(0.32,0.72,0,1)" }}
          >
            {/* Handle mobile */}
            <div className="w-10 h-1 bg-ink-200 rounded-full mx-auto mb-4 sm:hidden" />

            <p className="text-sm font-semibold text-ink-900 mb-4">Rango personalizado</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={tempDesde}
                  onChange={(e) => setTempDesde(e.target.value)}
                  className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={tempHasta}
                  min={tempDesde}
                  onChange={(e) => setTempHasta(e.target.value)}
                  className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 border border-ink-200 text-ink-600 text-sm font-medium py-2.5 rounded-xl hover:bg-ink-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={applyCustom}
                disabled={!tempDesde || !tempHasta}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 640px) {
          div[style*="slideUp"] { animation: fadeIn 0.15s ease; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function formatShort(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
