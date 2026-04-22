"use client";

import { useState, useEffect } from "react";
import { api, Honorario, Moneda } from "@/lib/api";

const today = new Date().toISOString().split("T")[0];

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

export function HonorariosTab({ expedienteId, token, onCreated }: { expedienteId: string; token: string; onCreated?: () => void }) {
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    concepto: "",
    monto_acordado: "",
    moneda: "ARS" as Moneda,
    fecha_acuerdo: today,
    notas: "",
  });

  const [pagoForm, setPagoForm] = useState<Record<string, { importe: string; moneda: Moneda; fecha: string; comprobante: string; tipo: "capital" | "interes" }>>({});

  const load = () =>
    api.get<Honorario[]>(`/honorarios/expediente/${expedienteId}`, token)
      .then(setHonorarios)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const crearHonorario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/honorarios", { ...form, expediente_id: expedienteId, monto_acordado: parseFloat(form.monto_acordado) }, token);
      setForm({ concepto: "", monto_acordado: "", moneda: "ARS", fecha_acuerdo: today, notas: "" });
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
    if (!confirm("¿Eliminar este honorario? Se perderán todos los pagos asociados.")) return;
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
      {/* Hero summary */}
      {honorarios.length > 0 && (
        <div className="bg-gradient-to-br from-ink-900 to-ink-800 rounded-2xl p-5 text-white">
          <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-3">
            Resumen de honorarios · {honorarios.length} acuerdo{honorarios.length !== 1 ? "s" : ""}
          </p>
          {acordadoARS > 0 && (
            <div className="mb-3">
              <div className="flex items-end justify-between mb-1">
                <span className="text-xs text-ink-400">ARS acordado</span>
                <span className="text-lg font-bold">{fmt(acordadoARS, "ARS")}</span>
              </div>
              {/* barra */}
              <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-400 rounded-full" style={{ width: `${acordadoARS > 0 ? Math.min(100, (cobradoARS / acordadoARS) * 100) : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                <span>Cobrado: {fmt(cobradoARS, "ARS")}{interesesARS > 0 ? ` + ${fmt(interesesARS, "ARS")} int.` : ""}</span>
                <span className={saldoARS > 0 ? "text-amber-400 font-semibold" : "text-green-400 font-semibold"}>
                  {saldoARS > 0 ? `Pendiente: ${fmt(saldoARS, "ARS")}` : "Saldado ✓"}
                </span>
              </div>
            </div>
          )}
          {acordadoUSD > 0 && (
            <div>
              <div className="flex items-end justify-between mb-1">
                <span className="text-xs text-ink-400">USD acordado</span>
                <span className="text-lg font-bold">{fmt(acordadoUSD, "USD")}</span>
              </div>
              <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full" style={{ width: `${acordadoUSD > 0 ? Math.min(100, (cobradoUSD / acordadoUSD) * 100) : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                <span>Cobrado: {fmt(cobradoUSD, "USD")}</span>
                <span className={saldoUSD > 0 ? "text-amber-400 font-semibold" : "text-green-400 font-semibold"}>
                  {saldoUSD > 0 ? `Pendiente: ${fmt(saldoUSD, "USD")}` : "Saldado ✓"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-700">
          {honorarios.length === 0 ? "Sin honorarios registrados" : `${honorarios.length} honorario${honorarios.length !== 1 ? "s" : ""}`}
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
        >
          {showForm ? "Cancelar" : "+ Nuevo honorario"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Form nuevo honorario */}
      {showForm && (
        <form onSubmit={crearHonorario} className="bg-ink-50 border border-ink-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-700 mb-2">Nuevo honorario acordado</p>
          <div>
            <label className={labelCls}>Concepto *</label>
            <input required value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} className={inputCls} placeholder="Ej: Honorarios por patrocinio letrado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto acordado *</label>
              <input required type="number" min="0.01" step="0.01" value={form.monto_acordado} onChange={e => setForm({ ...form, monto_acordado: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value as Moneda })} className={inputCls}>
                <option value="ARS">$ ARS</option>
                <option value="USD">U$D USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fecha de acuerdo *</label>
            <input required type="date" value={form.fecha_acuerdo} onChange={e => setForm({ ...form, fecha_acuerdo: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notas (opcional)</label>
            <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className={`${inputCls} resize-none`} rows={2} placeholder="Porcentaje sobre resultado, cuotas, etc." />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2 text-sm font-semibold transition disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar honorario"}
          </button>
        </form>
      )}

      {/* Lista de honorarios */}
      {honorarios.length === 0 && !showForm ? (
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

            return (
              <div key={h.id} className="bg-white border border-ink-100 rounded-xl overflow-hidden">
                {/* Header honorario */}
                <div
                  className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-ink-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : h.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink-900">{h.concepto}</span>
                      <Badge color={h.moneda === "ARS" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}>
                        {h.moneda}
                      </Badge>
                      {saldo <= 0 && <Badge color="bg-green-50 text-green-700">✓ Saldado</Badge>}
                      {saldo > 0 && pct > 0 && <Badge color="bg-amber-50 text-amber-700">Parcial</Badge>}
                    </div>
                    <p className="text-xs text-ink-400 mt-0.5">Acordado: {fmt(h.monto_acordado, h.moneda)} — {h.fecha_acuerdo}</p>
                    {/* Barra de progreso capital */}
                    <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-0.5">
                      <span className="text-ink-400">Capital cobrado: {fmt(h.total_capital, h.moneda)}</span>
                      <span className={saldo > 0 ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>
                        Saldo capital: {fmt(saldo, h.moneda)}
                      </span>
                    </div>
                    {h.total_intereses > 0 && (
                      <div className="text-[10px] text-blue-600 mt-0.5">
                        Intereses cobrados: {fmt(h.total_intereses, h.moneda)}
                      </div>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
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
                                {p.tipo === "interes" ? "Interés" : "Capital"}
                              </span>
                              <span className="text-xs text-ink-400 ml-2">{p.fecha}</span>
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
                        <span className="text-xs text-green-700 font-medium">✓ Capital saldado</span>
                      </div>
                    )}
                    {saldo > 0 && <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink-600">Registrar pago</p>
                        {saldo > 0 && (
                          <button
                            type="button"
                            onClick={() => setPagoForm(prev => ({ ...prev, [h.id]: { ...pf, importe: String(saldo) } }))}
                            className="text-[10px] text-brand-600 hover:underline"
                          >
                            Completar saldo ({fmt(saldo, h.moneda)})
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number" min="0.01" step="0.01"
                          placeholder="Importe"
                          value={pf.importe}
                          onChange={e => setPagoForm(prev => ({ ...prev, [h.id]: { ...pf, importe: e.target.value } }))}
                          className="flex-1 bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <select
                          value={pf.moneda}
                          onChange={e => setPagoForm(prev => ({ ...prev, [h.id]: { ...pf, moneda: e.target.value as Moneda } }))}
                          className="bg-white border border-ink-200 rounded-lg px-2 py-2 text-sm focus:outline-none"
                        >
                          <option value="ARS">ARS</option>
                          <option value="USD">USD</option>
                        </select>
                        <input
                          type="date"
                          value={pf.fecha}
                          onChange={e => setPagoForm(prev => ({ ...prev, [h.id]: { ...pf, fecha: e.target.value } }))}
                          className="bg-white border border-ink-200 rounded-lg px-2 py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <input
                        placeholder="Comprobante (opcional)"
                        value={pf.comprobante}
                        onChange={e => setPagoForm(prev => ({ ...prev, [h.id]: { ...pf, comprobante: e.target.value } }))}
                        className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => registrarPago(h.id)}
                          disabled={saving || !pf.importe}
                          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-xs font-semibold transition disabled:opacity-40"
                        >
                          Registrar pago
                        </button>
                        <button
                          onClick={() => { if (confirm("¿Eliminar este honorario?")) eliminarHonorario(h.id); }}
                          className="text-xs text-ink-400 hover:text-red-500 border border-ink-200 hover:border-red-200 px-3 py-2 rounded-lg transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>}
                    {saldo <= 0 && pf.tipo !== "interes" && (
                      <button
                        onClick={() => { if (confirm("¿Eliminar este honorario?")) eliminarHonorario(h.id); }}
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
