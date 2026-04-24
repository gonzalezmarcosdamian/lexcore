"use client";

import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente } from "@/lib/api";
import { ExpedienteSelect } from "@/components/ui/expediente-select";

type Moneda = "ARS" | "USD";

const inputClass = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function fmt(n: number, m: Moneda) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(n);
}

function NuevoHonorarioInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const token = session?.user?.backendToken;

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [form, setForm] = useState({
    concepto: "",
    monto_acordado: "",
    moneda: "ARS" as Moneda,
    fecha_acuerdo: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: "",
    expediente_id: params.get("expediente_id") ?? "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cuotas
  const [usarCuotas, setUsarCuotas] = useState(false);
  const [nCuotas, setNCuotas] = useState(3);
  const [intervalo, setIntervalo] = useState<"mensual" | "quincenal" | "semanal">("mensual");

  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token).then(setExpedientes).catch(() => {});
  }, [token]);

  const generarCuotas = () => {
    const total = parseFloat(form.monto_acordado);
    if (!total || !form.fecha_vencimiento || !form.concepto) return [];
    const base = Math.floor((total / nCuotas) * 100) / 100;
    return Array.from({ length: nCuotas }, (_, i) => {
      const f = new Date(form.fecha_vencimiento + "T12:00:00");
      if (intervalo === "mensual") f.setMonth(f.getMonth() + i);
      else if (intervalo === "quincenal") f.setDate(f.getDate() + i * 15);
      else f.setDate(f.getDate() + i * 7);
      return {
        concepto: `${form.concepto} — cuota ${i + 1}/${nCuotas}`,
        monto_acordado: i === nCuotas - 1 ? Math.round((total - base * (nCuotas - 1)) * 100) / 100 : base,
        moneda: form.moneda,
        fecha_acuerdo: form.fecha_acuerdo,
        fecha_vencimiento: f.toISOString().slice(0, 10),
        notas: form.notas,
        expediente_id: form.expediente_id,
      };
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.concepto.trim()) e.concepto = "El concepto es obligatorio";
    else if (form.concepto.trim().length < 3) e.concepto = "Minimo 3 caracteres";
    if (!form.monto_acordado || parseFloat(form.monto_acordado) <= 0) e.monto = "El monto debe ser mayor a cero";
    if (!form.expediente_id) e.expediente = "Selecciona un expediente";
    if (usarCuotas && !form.fecha_vencimiento) e.fecha_venc = "La fecha de la primera cuota es obligatoria";
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
      if (usarCuotas) {
        const cuotas = generarCuotas();
        if (!cuotas.length) { setErrors({ _: "Completá los datos para generar cuotas" }); setSaving(false); return; }
        await Promise.all(cuotas.map(c => api.post("/honorarios", c, token)));
      } else {
        await api.post("/honorarios", { ...form, monto_acordado: parseFloat(form.monto_acordado) }, token);
      }
      router.push(form.expediente_id ? `/expedientes/${form.expediente_id}` : "/expedientes");
    } catch (err: unknown) {
      setErrors({ _: err instanceof Error ? err.message : "Error al guardar" });
      setSaving(false);
    }
  };

  const cuotas = usarCuotas && form.monto_acordado && form.fecha_vencimiento ? generarCuotas() : [];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <Link href={form.expediente_id ? `/expedientes/${form.expediente_id}` : "/expedientes"} className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Nuevo honorario</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">

        {/* Concepto */}
        <div>
          <label className={labelClass}>Concepto *</label>
          <input
            value={form.concepto}
            onChange={e => { setForm(f => ({ ...f, concepto: e.target.value })); setErrors(v => ({ ...v, concepto: "" })); }}
            className={`${inputClass} ${errors.concepto ? "border-red-400 focus:ring-red-400" : ""}`}
            placeholder="Ej: Honorarios por patrocinio letrado"
            autoFocus
          />
          {errors.concepto && <p className="text-xs text-red-500 mt-1">{errors.concepto}</p>}
        </div>

        {/* Monto + Moneda */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Monto acordado *</label>
            <input
              type="number" min="0.01" step="0.01"
              value={form.monto_acordado}
              onChange={e => { setForm(f => ({ ...f, monto_acordado: e.target.value })); setErrors(v => ({ ...v, monto: "" })); }}
              className={`${inputClass} ${errors.monto ? "border-red-400 focus:ring-red-400" : ""}`}
              placeholder="0"
            />
            {errors.monto && <p className="text-xs text-red-500 mt-1">{errors.monto}</p>}
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

        {/* Expediente */}
        <div>
          <label className={labelClass}>Expediente *</label>
          <ExpedienteSelect expedientes={expedientes} value={form.expediente_id}
            onChange={id => { setForm(f => ({ ...f, expediente_id: id })); setErrors(v => ({ ...v, expediente: "" })); }}
            placeholder="Seleccionar expediente" />
          {errors.expediente && <p className="text-xs text-red-500 mt-1">{errors.expediente}</p>}
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha de acuerdo</label>
            <DateInput value={form.fecha_acuerdo} onChange={v => setForm(f => ({ ...f, fecha_acuerdo: v }))} />
          </div>
          <div>
            <label className={labelClass}>{usarCuotas ? "Fecha primera cuota *" : "Fecha de vencimiento"}</label>
            <DateInput value={form.fecha_vencimiento} onChange={v => { setForm(f => ({ ...f, fecha_vencimiento: v })); setErrors(e => ({ ...e, fecha_venc: "" })); }}
              ringColor={errors.fecha_venc ? "focus-within:ring-red-400" : "focus-within:ring-emerald-400"} placeholder="DD/MM/AAAA" />
            {errors.fecha_venc && <p className="text-xs text-red-500 mt-1">{errors.fecha_venc}</p>}
          </div>
        </div>

        {/* Toggle cuotas */}
        <div className="flex items-center gap-3 py-2 border-t border-ink-50">
          <button type="button" onClick={() => setUsarCuotas(p => !p)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${usarCuotas ? "bg-emerald-500" : "bg-ink-200"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${usarCuotas ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className="text-sm text-ink-700 font-medium">Dividir en cuotas</span>
        </div>

        {/* Config cuotas */}
        {usarCuotas && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cantidad de cuotas</label>
                <select value={nCuotas} onChange={e => setNCuotas(Number(e.target.value))} className={inputClass}>
                  {[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} cuotas</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Intervalo</label>
                <select value={intervalo} onChange={e => setIntervalo(e.target.value as any)} className={inputClass}>
                  <option value="mensual">Mensual</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>
            </div>
            {cuotas.length > 0 && (
              <div className="bg-white rounded-xl border border-emerald-200 divide-y divide-emerald-100">
                {cuotas.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-ink-600">Cuota {i + 1}/{nCuotas}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-emerald-700">{fmt(c.monto_acordado, c.moneda)}</span>
                      <span className="text-xs text-ink-400">{new Date(c.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2 bg-emerald-50">
                  <span className="text-xs font-semibold text-emerald-700">Total</span>
                  <span className="text-sm font-bold text-emerald-700">{fmt(parseFloat(form.monto_acordado), form.moneda)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        <div>
          <label className={labelClass}>Notas <span className="text-ink-400 font-normal">(opcional)</span></label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            className={`${inputClass} resize-none`} rows={2}
            placeholder="Porcentaje sobre resultado, condiciones, etc." />
        </div>

        {errors._ && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{errors._}</p>}

        <div className="flex gap-3 pt-2">
          <Link href={form.expediente_id ? `/expedientes/${form.expediente_id}` : "/expedientes"}
            className="flex-1 text-center text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-3 rounded-xl hover:bg-ink-50 transition">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl transition shadow-sm disabled:opacity-50">
            {saving ? "Guardando..." : usarCuotas ? `Crear ${nCuotas} cuotas` : "Guardar honorario"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NuevoHonorarioPage() {
  return <Suspense><NuevoHonorarioInner /></Suspense>;
}
