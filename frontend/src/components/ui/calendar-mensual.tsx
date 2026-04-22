"use client";

import { useMemo } from "react";
import Link from "next/link";

export type CalEvent = {
  id: string;
  tipo: "tarea" | "vencimiento";
  titulo: string;
  hora?: string | null;
  estado?: string;
  cumplido?: boolean;
  expediente_id?: string | null;
  color: "blue" | "purple" | "red" | "amber";
};

export type DiaInhabil = {
  fecha: string;
  nombre: string;
  tipo: string; // "nacional" | "judicial"
  origen: string;
};

interface Props {
  anio: number;
  mes: number; // 1-12
  eventos: CalEvent[];
  inhabiles: DiaInhabil[];
  onPrevMes: () => void;
  onNextMes: () => void;
  onClickDia: (fecha: string) => void;
  onClickEvento?: (ev: CalEvent) => void;
}

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function pad(n: number) { return String(n).padStart(2, "0"); }

export function CalendarioMensual({ anio, mes, eventos, inhabiles, onPrevMes, onNextMes, onClickDia, onClickEvento }: Props) {
  const hoy = new Date().toISOString().split("T")[0];

  const { semanas, primerDia } = useMemo(() => {
    const primer = new Date(anio, mes - 1, 1);
    const ultimo = new Date(anio, mes, 0).getDate();
    const primerDiaSemana = primer.getDay(); // 0=Dom

    const dias: (string | null)[] = Array(primerDiaSemana).fill(null);
    for (let d = 1; d <= ultimo; d++) {
      dias.push(`${anio}-${pad(mes)}-${pad(d)}`);
    }
    while (dias.length % 7 !== 0) dias.push(null);

    const sem: (string | null)[][] = [];
    for (let i = 0; i < dias.length; i += 7) sem.push(dias.slice(i, i + 7));
    return { semanas: sem, primerDia: primer };
  }, [anio, mes]);

  const eventosPorFecha = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of eventos) {
      const f = e.tipo === "tarea" ? (e as any).fecha_limite : (e as any).fecha;
      if (!f) continue;
      if (!map[f]) map[f] = [];
      map[f].push(e);
    }
    return map;
  }, [eventos]);

  const inhabilesPorFecha = useMemo(() => {
    const set = new Set<string>();
    for (const d of inhabiles) set.add(d.fecha);
    return set;
  }, [inhabiles]);

  const COLOR_CLS: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800",
    purple: "bg-purple-100 text-purple-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
      {/* Header navegación */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
        <button onClick={onPrevMes} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 hover:text-ink-800 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-sm font-semibold text-ink-900">{MESES[mes - 1]} {anio}</h2>
        <button onClick={onNextMes} className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500 hover:text-ink-800 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Cabecera días */}
      <div className="grid grid-cols-7 border-b border-ink-100">
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-2 ${i === 0 || i === 6 ? "text-ink-300" : "text-ink-500"}`}>{d}</div>
        ))}
      </div>

      {/* Grid de días */}
      <div>
        {semanas.map((semana, si) => (
          <div key={si} className="grid grid-cols-7 border-b border-ink-50 last:border-b-0">
            {semana.map((fecha, di) => {
              const esHoy = fecha === hoy;
              const esInhabil = fecha ? inhabilesPorFecha.has(fecha) : false;
              const esFinDeSemana = di === 0 || di === 6;
              const evs = fecha ? (eventosPorFecha[fecha] ?? []) : [];
              const MAX_VISIBLE = 3;

              return (
                <div
                  key={di}
                  onClick={() => fecha && onClickDia(fecha)}
                  className={`
                    min-h-[80px] p-1.5 border-r border-ink-50 last:border-r-0 relative transition
                    ${fecha ? "cursor-pointer hover:bg-brand-50/30" : ""}
                    ${!fecha ? "bg-ink-50/30" : ""}
                    ${esInhabil && fecha ? "bg-red-50/40" : ""}
                    ${esFinDeSemana && fecha && !esInhabil ? "bg-ink-50/20" : ""}
                  `}
                >
                  {fecha && (
                    <>
                      {/* Número del día */}
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1
                        ${esHoy ? "bg-brand-600 text-white" : esInhabil ? "text-red-400" : esFinDeSemana ? "text-ink-400" : "text-ink-700"}
                      `}>
                        {parseInt(fecha.slice(8))}
                      </div>

                      {/* Chips de eventos */}
                      <div className="space-y-0.5">
                        {evs.slice(0, MAX_VISIBLE).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onClickEvento) onClickEvento(ev);
                              else if (ev.expediente_id) window.location.href = `/expedientes/${ev.expediente_id}`;
                            }}
                            title={ev.titulo + (ev.hora ? ` · ${ev.hora}` : "")}
                            className={`
                              truncate text-[10px] font-medium px-1 py-0.5 rounded cursor-pointer
                              ${ev.estado === "hecha" || ev.cumplido ? "line-through opacity-50 bg-ink-100 text-ink-500" : COLOR_CLS[ev.color]}
                            `}
                          >
                            {ev.hora && <span className="mr-0.5 opacity-70">{ev.hora}</span>}
                            {ev.titulo}
                          </div>
                        ))}
                        {evs.length > MAX_VISIBLE && (
                          <div className="text-[9px] text-ink-400 font-medium pl-1">+{evs.length - MAX_VISIBLE} más</div>
                        )}
                      </div>

                      {/* Dot inhábil */}
                      {esInhabil && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-300" title="Día inhábil" />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-ink-50 bg-ink-50/30">
        <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
          <div className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200" />Tarea
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
          <div className="w-2.5 h-2.5 rounded bg-purple-100 border border-purple-200" />Vencimiento
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
          <div className="w-2.5 h-2.5 rounded-full bg-red-300" />Inhábil
        </div>
      </div>
    </div>
  );
}
