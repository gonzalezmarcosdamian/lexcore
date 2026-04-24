"use client";

import { useState, useEffect } from "react";
import { todayAR } from "@/lib/date";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { api, Honorario, Moneda } from "@/lib/api";
import { DateInput } from "@/components/ui/date-input";
import Link from "next/link";

const today = todayAR();

function fmt(n: number, moneda: Moneda) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 2,
  }).format(n);
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

export function HonorariosTab({ expedienteId, token, onCreated, sidebarMode }: { expedienteId: string; token: string; onCreated?: () => void; sidebarMode?: boolean }) {
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null);

  const [form, setForm] = useState({
    concepto: "",
    monto_acordado: "",
    moneda: "ARS" as Moneda,
    fecha_acuerdo: today,
    fecha_vencimiento: "",
    notas: "",
  });

  const [pagoForm, setPagoForm] = useState<Record<string, { importe: string; moneda: Moneda; fecha: string; comprobante: string; tipo: "capital" | "interes" }>>({});

  // Cuotas
  const [usarCuotas, setUsarCuotas] = useState(false);
  const [nCuotas, setNCuotas] = useState(3);
  const [intervaloCuotas, setIntervaloCuotas] = useState<"mensual" | "quincenal" | "semanal">("mensual");

  const generarCuotas = () => {
    if (!form.monto_acordado || !form.fecha_vencimiento || !form.concepto) return [];
    const total = parseFloat(form.monto_acordado);
    const base = Math.floor((total / nCuotas) * 100) / 100;
    const cuotas = [];
    for (let i = 0; i < nCuotas; i++) {
      const fecha = new Date(form.fecha_vencimiento + "T12:00:00");
      if (intervaloCuotas === "mensual") fecha.setMonth(fecha.getMonth() + i);
      else if (intervaloCuotas === "quincenal") fecha.setDate(fecha.getDate() + i * 15);
      else fecha.setDate(fecha.getDate() + i * 7);
      const monto = i === nCuotas - 1 ? Math.round((total - base * (nCuotas - 1)) * 100) / 100 : base;
      cuotas.push({
        concepto: `${form.concepto} — cuota ${i + 1}/${nCuotas}`,
        monto_acordado: monto,
        moneda: form.moneda,
        fecha_acuerdo: form.fecha_acuerdo,
        fecha_vencimiento: fecha.toISOString().slice(0, 10),
        notas: form.notas,
      });
    }
    return cuotas;
  };

  const load = () =>
    api.get<Honorario[]>(`/honorarios/expediente/${expedienteId}`, token)
      .then(setHonorarios)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const crearHonorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concepto.trim()) { setError("El concepto es obligatorio"); return; }
    if (!form.monto_acordado || parseFloat(form.monto_acordado) <= 0) { setError("El monto debe ser mayor a cero"); return; }
    setSaving(true);
    setError("");
    try {
      if (usarCuotas) {
        const cuotas = generarCuotas();
        if (cuotas.length === 0) { setError("Completá concepto, monto y fecha de primera cuota"); setSaving(false); return; }
        await Promise.all(cuotas.map(c => api.post("/honorarios", { ...c, expediente_id: expedienteId }, token)));
      } else {
        await api.post("/honorarios", { ...form, expediente_id: expedienteId, monto_acordado: parseFloat(form.monto_acordado) }, token);
      }
      setForm({ concepto: "", monto_acordado: "", moneda: "ARS", fecha_acuerdo: today, fecha_vencimiento: "", notas: "" });
      setUsarCuotas(false);
      setShowForm(false);
      load();
      onCreated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear honorario");
    } finally {
      setSaving(false);
    }
  };

  const eliminarHonorario = async (id: string) => {
    await api.delete(`/honorarios/${id}`, token);
    load();
    onCreated?.();
  };

  const registrarPago = async (honorarioId: string) => {
    const pf = pagoForm[honorarioId];
    if (!pf?.importe) return;
    setSaving(true);
    try {
      const moneda = pf.moneda ?? "ARS";
      const fecha = pf.fecha ?? today;
      const importe = parseFloat(pf.importe);
      const honorario = honorarios.find(h => h.id === honorarioId);
      await api.post(`/honorarios/${honorarioId}/pagos`, {
        importe,
        moneda,
        fecha,
        comprobante: pf.comprobante || undefined,
        tipo: pf.tipo ?? "capital",
      }, token);
      // Auto-crear ingreso contable (solo para pagos de capital)
      if (honorario && (pf.tipo ?? "capital") === "capital") {
        await api.post("/ingresos", {
          descripcion: `Pago honorarios: ${honorario.concepto}`,
          categoria: "honorarios_cobrados",
          monto: importe,
          moneda,
          fecha,
          expediente_id: honorario.expediente_id,
        }, token).catch(() => {});
      }
      setPagoForm(prev => ({ ...prev, [honorarioId]: { importe: "", moneda: "ARS" as Moneda, fecha: today, comprobante: "", tipo: "capital" as const } }));
      load();
      onCreated?.();
    } catch {}
    setSaving(false);
  };

  const eliminarPago = async (honorarioId: string, pagoId: string) => {
    await api.delete(`/honorarios/${honorarioId}/pagos/${pagoId}`, token);
    load();
  };

  const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
  const labelCls = "block text-xs font-medium text-ink-600 mb-1";

  if (loading) return (
    <div className="space-y-3">
      {[1, 2].map(i => <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  );

  // Hero aggregates
  const acordadoARS = honorarios.filter(h => h.moneda === "ARS").reduce((a, h) => a + h.monto_acordado, 0);
  const cobradoARS = honorarios.filter(h => h.moneda === "ARS").reduce((a, h) => a + h.total_capital, 0);
  const interesesARS = honorarios.filter(h => h.moneda === "ARS").reduce((a, h) => a + h.total_intereses, 0);
  const saldoARS = honorarios.filter(h => h.moneda === "ARS").reduce((a, h) => a + h.saldo_pendiente, 0);
  const acordadoUSD = honorarios.filter(h => h.moneda === "USD").reduce((a, h) => a + h.monto_acordado, 0);
  const cobradoUSD = honorarios.filter(h => h.moneda === "USD").reduce((a, h) => a + h.total_capital, 0);
  const saldoUSD = honorarios.filter(h => h.moneda === "USD").reduce((a, h) => a + h.saldo_pendiente, 0);

  return (
    <div className="space-y-4">
      {confirmEliminarId && (
        <ConfirmModal
          title="¿Eliminar honorario?"
          description="Se perderán todos los pagos asociados."
          confirmLabel="Eliminar"
          onConfirm={() => { eliminarHonorario(confirmEliminarId); setConfirmEliminarId(null); }}
          onCancel={() => setConfirmEliminarId(null)}
        />
      )}
      {/* Resumen súper compacto — una línea por moneda */}
      {honorarios.length > 0 && (
        <div className="flex items-center gap-4 px-1">
          {acordadoARS > 0 && (() => {
            const pct = Math.min(100, (cobradoARS / acordadoARS) * 100);
            return (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-500 font-medium">ARS · {Math.round(pct)}% cobrado</span>
                  <span className={saldoARS > 0 ? "text-orange-600 font-bold" : "text-green-600 font-bold"}>
                    {saldoARS > 0 ? `Saldo ${fmt(saldoARS, "ARS")}` : "✓ Saldado"}
                  </span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
          {acordadoUSD > 0 && (() => {
            const pct = Math.min(100, (cobradoUSD / acordadoUSD) * 100);
            return (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-500 font-medium">USD · {Math.round(pct)}% cobrado</span>
                  <span className={saldoUSD > 0 ? "text-orange-600 font-bold" : "text-green-600 font-bold"}>
                    {saldoUSD > 0 ? `Saldo ${fmt(saldoUSD, "USD")}` : "✓ Saldado"}
                  </span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-700">
          {honorarios.length === 0 ? "Sin honorarios" : `${honorarios.length} acuerdo${honorarios.length !== 1 ? "s" : ""}`}
        </h3>
        <Link
          href={`/honorarios/nuevo?expediente_id=${expedienteId}`}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
        >
          + Nuevo honorario
        </Link>
      </div>

      {/* Lista de honorarios */}
      {honorarios.length === 0 ? (
        <div className="text-center py-10 text-ink-400 text-sm">
          <svg className="w-10 h-10 mx-auto mb-3 text-ink-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Sin honorarios acordados</p>
          <p className="text-xs mt-1">Registrá el acuerdo de honorarios para este expediente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {honorarios.map(h => {
            const saldo = h.saldo_pendiente;
            const pct = h.monto_acordado > 0 ? Math.min(100, (h.total_capital / h.monto_acordado) * 100) : 0;
            const isExpanded = expandedId === h.id;
            const pf = pagoForm[h.id] ?? { importe: "", moneda: h.moneda, fecha: today, comprobante: "", tipo: "capital" as const };
            const vencBadge = (() => {
              if (!h.fecha_vencimiento || saldo <= 0) return null;
              const diff = (new Date(h.fecha_vencimiento + "T12:00:00").getTime() - Date.now()) / 86400000;
              if (diff < 0) return { label: "VENCIDO", cls: "bg-red-100 text-red-700" };
              if (diff <= 7) return { label: "PRÓXIMO", cls: "bg-orange-100 text-orange-700" };
              return { label: `Vence ${new Date(h.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`, cls: "bg-emerald-100 text-emerald-700" };
            })();

            // Estado pill
            const estadoPill = saldo <= 0
              ? { label: "SALDADO", cls: "bg-green-100 text-green-700" }
              : pct > 0
              ? { label: "PARCIAL", cls: "bg-amber-100 text-amber-700" }
              : { label: "PENDIENTE", cls: "bg-orange-100 text-orange-700" };

            return (
              <div key={h.id} className={`bg-white border rounded-2xl overflow-hidden transition ${
                vencBadge?.label === "VENCIDO" ? "border-red-200" : vencBadge?.label === "PRÓXIMO" ? "border-orange-200" : "border-ink-100"
              }`}>
                {/* Header — concepto como título principal */}
                <div
                  className="px-4 pt-4 pb-3 cursor-pointer hover:bg-ink-50/50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : h.id)}
                >
                  {/* Fila 1: concepto + moneda + estado + pagar + chevron */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-ink-900 leading-snug">{h.concepto}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoPill.cls}`}>{estadoPill.label}</span>
                        {vencBadge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vencBadge.cls}`}>{vencBadge.label}</span>}
                      </div>
                      <p className="text-xs text-ink-400 mt-0.5">
                        {h.moneda} · {h.fecha_acuerdo ? new Date(h.fecha_acuerdo + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                        {h.fecha_vencimiento ? ` · vence ${new Date(h.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {saldo > 0 && (
                        <Link
                          href={`/honorarios/pago?honorario_id=${h.id}&expediente_id=${expedienteId}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg transition"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          Pagar
                        </Link>
                      )}
                      <svg className={`w-4 h-4 text-ink-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>
                  {/* Fila 2: monto grande + barra + saldo */}
                  <div className="flex items-end justify-between gap-3 mb-1.5">
                    <span className="text-lg font-bold text-ink-900 leading-none">{fmt(h.monto_acordado, h.moneda)}</span>
                    <span className={`text-sm font-bold leading-none ${saldo > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {saldo > 0 ? fmt(saldo, h.moneda) + " pendiente" : "✓ Saldado"}
                    </span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${saldo <= 0 ? "bg-green-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                    <span>{fmt(h.total_capital, h.moneda)} cobrado{h.total_intereses > 0 ? ` + ${fmt(h.total_intereses, h.moneda)} intereses` : ""}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="border-t border-ink-100 px-4 py-3 space-y-3">
                    {h.notas && <p className="text-xs text-ink-500 italic">{h.notas}</p>}

                    {/* Pagos existentes */}
                    {h.pagos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-ink-600">Pagos recibidos</p>
                        {h.pagos.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-ink-50 rounded-lg px-3 py-2">
                            <div>
                              <span className="text-sm font-semibold text-ink-900">{fmt(p.importe, p.moneda)}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ml-2 ${p.tipo === "interes" ? "bg-blue-50 text-blue-600" : "bg-brand-50 text-brand-600"}`}>
                                {p.tipo === "interes" ? "Intereses" : "Pago"}
                              </span>
                              <span className="text-xs text-ink-400 ml-2">{p.fecha ? new Date(p.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                              {p.comprobante && <span className="text-xs text-ink-400 ml-2">— {p.comprobante}</span>}
                            </div>
                            <button onClick={() => eliminarPago(h.id, p.id)} className="text-ink-300 hover:text-red-500 transition ml-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {saldo <= 0 && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        <span className="text-xs text-green-700 font-medium">✓ Saldado</span>
                      </div>
                    )}
                    {saldo > 0 && <div className="space-y-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/honorarios/pago?honorario_id=${h.id}&expediente_id=${expedienteId}`}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          Registrar pago
                        </Link>
                        <button
                          onClick={() => setConfirmEliminarId(h.id)}
                          className="text-xs text-ink-400 hover:text-red-500 border border-ink-200 hover:border-red-200 px-3 py-2 rounded-xl transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>}
                    {saldo <= 0 && pf.tipo !== "interes" && (
                      <button
                        onClick={() => setConfirmEliminarId(h.id)}
                        className="text-xs text-ink-400 hover:text-red-500 border border-ink-200 hover:border-red-200 px-3 py-2 rounded-lg transition w-full"
                      >
                        Eliminar honorario
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
