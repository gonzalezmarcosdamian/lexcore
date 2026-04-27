"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { api } from "@/lib/api";

interface MesHistorico {
  mes: number;
  anio: number;
  label: string;
  egresos_ars: number;
  ingresos_ars: number;
  resultado_ars: number;
}

interface ContableHeroProps {
  token: string;
}

const PERIODOS = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "12M", value: 12 },
] as const;

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const ingresos = payload.find((p: any) => p.dataKey === "ingresos_ars")?.value ?? 0;
  const egresos = payload.find((p: any) => p.dataKey === "egresos_ars")?.value ?? 0;
  const resultado = ingresos - egresos;
  return (
    <div className="bg-white border border-ink-100 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[150px]">
      <p className="font-semibold text-ink-700 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-green-600">↑ Ingresos</span>
          <span className="font-semibold text-ink-900">{fmt(ingresos)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-500">↓ Egresos</span>
          <span className="font-semibold text-ink-900">{fmt(egresos)}</span>
        </div>
        <div className="border-t border-ink-100 pt-1 mt-1 flex justify-between gap-4">
          <span className={resultado >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
            {resultado >= 0 ? "Resultado" : "Déficit"}
          </span>
          <span className={`font-bold ${resultado >= 0 ? "text-green-700" : "text-red-600"}`}>
            {resultado >= 0 ? "" : "-"}{fmt(resultado)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ContableHero({ token }: ContableHeroProps) {
  const [periodo, setPeriodo] = useState<3 | 6 | 12>(6);
  const [datos, setDatos] = useState<MesHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (meses: number) => {
    setLoading(true);
    try {
      const data = await api.get<MesHistorico[]>("/gastos/historico", token, { meses });
      setDatos(data);
    } catch {
      // silencioso — el hero es informativo, no bloquea la página
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(periodo); }, [periodo, cargar]);

  const totalIngresos = datos.reduce((s, d) => s + d.ingresos_ars, 0);
  const totalEgresos = datos.reduce((s, d) => s + d.egresos_ars, 0);
  const resultado = totalIngresos - totalEgresos;

  const mesMaxEgreso = datos.length
    ? datos.reduce((a, b) => (b.egresos_ars > a.egresos_ars ? b : a))
    : null;

  const tendencia = (() => {
    if (datos.length < 2) return null;
    const ultimo = datos[datos.length - 1].resultado_ars;
    const anterior = datos[datos.length - 2].resultado_ars;
    if (anterior === 0) return null;
    const pct = ((ultimo - anterior) / Math.abs(anterior)) * 100;
    return { pct: Math.abs(pct).toFixed(0), sube: ultimo >= anterior };
  })();

  // Mes actual resaltado
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  return (
    <div className="bg-white border border-ink-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header con chips */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-ink-700">Evolución financiera</h2>
        <div className="flex gap-1 bg-ink-100 rounded-lg p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value as 3 | 6 | 12)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                periodo === p.value
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-400 hover:text-ink-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div className="px-2 pt-1 pb-2">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 rounded-t-md bg-ink-100 animate-pulse"
                  style={{ height: `${40 + i * 20}px`, alignSelf: "flex-end" }}
                />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={datos} barCategoryGap="30%" barGap={3} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="ingresos_ars" name="Ingresos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {datos.map((d) => (
                  <Cell
                    key={`ing-${d.mes}-${d.anio}`}
                    fill={d.mes === mesActual && d.anio === anioActual ? "#16a34a" : "#86efac"}
                  />
                ))}
              </Bar>
              <Bar dataKey="egresos_ars" name="Egresos" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {datos.map((d) => (
                  <Cell
                    key={`egr-${d.mes}-${d.anio}`}
                    fill={d.mes === mesActual && d.anio === anioActual ? "#ef4444" : "#fca5a5"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 border-t border-ink-100 divide-x divide-ink-100">
        <div className="px-4 py-3">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-0.5">
            Resultado {periodo}M
          </p>
          {loading ? (
            <div className="h-5 w-20 bg-ink-100 rounded animate-pulse" />
          ) : (
            <p className={`text-base font-bold ${resultado >= 0 ? "text-green-700" : "text-red-600"}`}>
              {resultado >= 0 ? "+" : "-"}{fmt(resultado)}
            </p>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-0.5">Mayor egreso</p>
          {loading ? (
            <div className="h-5 w-16 bg-ink-100 rounded animate-pulse" />
          ) : mesMaxEgreso && mesMaxEgreso.egresos_ars > 0 ? (
            <p className="text-base font-bold text-ink-900">
              {mesMaxEgreso.label}
              <span className="text-xs font-normal text-ink-400 ml-1">{fmt(mesMaxEgreso.egresos_ars)}</span>
            </p>
          ) : (
            <p className="text-sm text-ink-400">—</p>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-0.5">vs mes anterior</p>
          {loading ? (
            <div className="h-5 w-14 bg-ink-100 rounded animate-pulse" />
          ) : tendencia ? (
            <p className={`text-base font-bold ${tendencia.sube ? "text-green-700" : "text-red-600"}`}>
              {tendencia.sube ? "↑" : "↓"} {tendencia.pct}%
            </p>
          ) : (
            <p className="text-sm text-ink-400">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
