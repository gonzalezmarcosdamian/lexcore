"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface ResumenOut {
  id: string;
  expediente_id: string;
  contenido: string;
  generado_en: string;
  desactualizado: boolean;
  regeneraciones_hoy: number;
}

interface ResumenStatus {
  tiene_resumen: boolean;
  desactualizado: boolean;
  regeneraciones_hoy: number;
  limite_diario: number;
}

const LIMITE_DIARIO = 5;

export function ResumenIASection({ expedienteId, token }: { expedienteId: string; token: string }) {
  const [resumen, setResumen] = useState<ResumenOut | null>(null);
  const [status, setStatus] = useState<ResumenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [noDisponible, setNoDisponible] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.get<ResumenStatus>(`/expedientes/${expedienteId}/resumen/status`, token);
      setStatus(s);
      if (s.tiene_resumen) {
        const r = await api.get<ResumenOut>(`/expedientes/${expedienteId}/resumen`, token);
        setResumen(r);
      }
    } catch {
      // no resumen aún, ok
    } finally {
      setLoading(false);
    }
  }, [expedienteId, token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleGenerar = async () => {
    setGenerando(true);
    setError("");
    try {
      const r = await api.post<ResumenOut>(`/expedientes/${expedienteId}/resumen/generar`, {}, token);
      setResumen(r);
      setStatus((s) => s ? { ...s, tiene_resumen: true, desactualizado: false, regeneraciones_hoy: r.regeneraciones_hoy } : s);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("no configurado") || msg.includes("503")) {
        setNoDisponible(true);
      } else {
        setError(msg || "Error al generar resumen");
      }
    } finally {
      setGenerando(false);
    }
  };

  const regeneracionesHoy = resumen?.regeneraciones_hoy ?? status?.regeneraciones_hoy ?? 0;
  const limitAlcanzado = regeneracionesHoy >= LIMITE_DIARIO;
  const desactualizado = resumen?.desactualizado ?? status?.desactualizado ?? false;

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-ink-100 rounded w-3/4" />
          <div className="h-4 bg-ink-100 rounded w-1/2" />
          <div className="h-4 bg-ink-100 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (noDisponible) {
    return (
      <div className="p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-ink-50 border border-ink-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-700">Resumen IA — Próximamente</p>
          <p className="text-xs text-ink-400 mt-1 max-w-xs">
            Esta función generará un resumen ejecutivo del expediente analizando movimientos, vencimientos y honorarios.
          </p>
        </div>
        <span className="text-xs bg-ink-100 text-ink-500 px-2.5 py-1 rounded-full font-medium">En configuración</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {desactualizado && resumen && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Desactualizado
            </span>
          )}
          {resumen && (
            <span className="text-xs text-ink-400">
              Generado {new Date(resumen.generado_en).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!limitAlcanzado && (
            <span className="text-xs text-ink-400">{regeneracionesHoy}/{LIMITE_DIARIO} hoy</span>
          )}
          <button
            onClick={handleGenerar}
            disabled={generando || limitAlcanzado}
            className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            {generando ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {resumen ? (desactualizado ? "Actualizar" : "Regenerar") : "Generar resumen"}
              </>
            )}
          </button>
        </div>
      </div>

      {limitAlcanzado && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Límite diario de {LIMITE_DIARIO} regeneraciones alcanzado. Volvé mañana.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {resumen ? (
        <div className="bg-ink-50 rounded-xl border border-ink-100 px-4 py-3">
          <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">{resumen.contenido}</p>
        </div>
      ) : (
        !generando && (
          <div className="text-center py-6 text-ink-400">
            <svg className="w-8 h-8 mx-auto mb-2 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-sm">Generá un resumen IA del expediente</p>
            <p className="text-xs mt-1">Analiza movimientos, vencimientos, tareas y honorarios</p>
          </div>
        )
      )}
    </div>
  );
}
