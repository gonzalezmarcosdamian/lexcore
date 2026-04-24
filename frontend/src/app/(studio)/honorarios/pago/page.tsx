"use client";

import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Honorario } from "@/lib/api";

type Moneda = "ARS" | "USD";
type TipoPago = "capital" | "interes";

const inputClass = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function fmt(n: number, m: Moneda) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(n);
}

function RegistrarPagoInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const token = session?.user?.backendToken;

  const honorarioId = params.get("honorario_id") ?? "";
  const expedienteId = params.get("expediente_id") ?? "";

  const [honorario, setHonorario] = useState<Honorario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    importe: "",
    moneda: "ARS" as Moneda,
    tipo: "capital" as TipoPago,
    fecha: today,
    comprobante: "",
  });

  useEffect(() => {
    if (!token || !honorarioId) return;
    api.get<Honorario>(`/honorarios/${honorarioId}`, token)
      .then(h => { setHonorario(h); setForm(f => ({ ...f, moneda: h.moneda })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, honorarioId]);

  const saldo = honorario ? Number(honorario.saldo_pendiente) : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.importe || parseFloat(form.importe) <= 0) e.importe = "El importe debe ser mayor a cero";
    if (!form.fecha) e.fecha = "La fecha es obligatoria";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!token) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await api.post(`/honorarios/${honorarioId}/pagos`, {
        importe: parseFloat(form.importe),
        moneda: form.moneda,
        tipo: form.tipo,
        fecha: form.fecha,
        comprobante: form.comprobante || undefined,
      }, token);
      // Auto-crear ingreso contable para capital
      if (form.tipo === "capital" && honorario) {
        await api.post("/ingresos", {
          descripcion: `Pago honorarios: ${honorario.concepto}`,
          categoria: "honorarios_cobrados",
          monto: parseFloat(form.importe),
          moneda: form.moneda,
          fecha: form.fecha,
          expediente_id: honorario.expediente_id,
        }, token).catch(() => {});
      }
      router.push(expedienteId ? `/expedientes/${expedienteId}` : "/expedientes");
    } catch (err: unknown) {
      setErrors({ _: err instanceof Error ? err.message : "Error al registrar pago" });
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-pulse space-y-4">
      <div className="h-4 bg-ink-100 rounded w-1/3" />
      <div className="h-32 bg-ink-100 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <Link href={expedienteId ? `/expedientes/${expedienteId}` : "/expedientes"} className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Registrar pago</h1>
      </div>

      {/* Resumen del honorario */}
      {honorario && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">Honorario</p>
          <p className="text-base font-semibold text-ink-900">{honorario.concepto}</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Acordado</p>
              <p className="text-sm font-bold text-ink-700">{fmt(Number(honorario.monto_acordado), honorario.moneda)}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Cobrado</p>
              <p className="text-sm font-bold text-green-700">{fmt(Number(honorario.total_capital), honorario.moneda)}</p>
            </div>
            <div>
              <p className="text-[10px] text-ink-400 uppercase tracking-wide">Saldo</p>
              <p className={`text-sm font-bold ${saldo > 0 ? "text-orange-600" : "text-green-600"}`}>{fmt(saldo, honorario.moneda)}</p>
            </div>
          </div>
          {Number(honorario.monto_acordado) > 0 && (
            <div className="mt-3 h-2 bg-white rounded-full overflow-hidden border border-emerald-100">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (Number(honorario.total_capital) / Number(honorario.monto_acordado)) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">

        {/* Tipo de pago */}
        <div>
          <label className={labelClass}>Tipo de pago *</label>
          <div className="grid grid-cols-2 gap-3">
            {([["capital", "Honorarios"], ["interes", "Intereses"]] as [TipoPago, string][]).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setForm(f => ({ ...f, tipo: val }))}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition ${
                  form.tipo === val ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                }`}>
                <span>{val === "capital" ? "💰" : "📈"}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Importe + Moneda */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Importe *</label>
            <div className="relative">
              <input
                type="number" min="0.01" step="0.01"
                value={form.importe}
                onChange={e => { setForm(f => ({ ...f, importe: e.target.value })); setErrors(v => ({ ...v, importe: "" })); }}
                className={`${inputClass} ${errors.importe ? "border-red-400 focus:ring-red-400" : ""}`}
                placeholder="0"
              />
              {saldo > 0 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, importe: String(saldo) }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition whitespace-nowrap">
                  Completar saldo
                </button>
              )}
            </div>
            {errors.importe && <p className="text-xs text-red-500 mt-1">{errors.importe}</p>}
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {(["ARS", "USD"] as Moneda[]).map(m => (
                <button key={m} type="button" onClick={() => setForm(f => ({ ...f, moneda: m }))}
                  className={`py-2 rounded-xl border text-sm font-bold transition ${form.moneda === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"}`}>
                  {m === "ARS" ? "$" : "U$D"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className={labelClass}>Fecha del pago *</label>
          <DateInput value={form.fecha} onChange={v => { setForm(f => ({ ...f, fecha: v })); setErrors(e => ({ ...e, fecha: "" })); }}
            ringColor={errors.fecha ? "focus-within:ring-red-400" : "focus-within:ring-emerald-400"} />
          {errors.fecha && <p className="text-xs text-red-500 mt-1">{errors.fecha}</p>}
        </div>

        {/* Comprobante */}
        <div>
          <label className={labelClass}>Nro. comprobante / referencia <span className="text-ink-400 font-normal">(opcional)</span></label>
          <input value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))}
            className={inputClass} placeholder="Ej: Recibo 0001-00000042" />
        </div>

        {errors._ && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{errors._}</p>}

        <div className="flex gap-3 pt-2">
          <Link href={expedienteId ? `/expedientes/${expedienteId}` : "/expedientes"}
            className="flex-1 text-center text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-3 rounded-xl hover:bg-ink-50 transition">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl transition shadow-sm disabled:opacity-50">
            {saving ? "Registrando..." : "Registrar pago"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RegistrarPagoPage() {
  return <Suspense><RegistrarPagoInner /></Suspense>;
}
