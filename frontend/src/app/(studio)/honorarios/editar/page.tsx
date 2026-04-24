"use client";

import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { api, Honorario } from "@/lib/api";

type Moneda = "ARS" | "USD";

const inputClass = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function fmt(n: number, m: Moneda) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: m, maximumFractionDigits: 0 }).format(n);
}

function EditarHonorarioInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const token = session?.user?.backendToken;

  const honorarioId = params.get("id") ?? "";
  const expedienteId = params.get("expediente_id") ?? "";

  const [honorario, setHonorario] = useState<Honorario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    concepto: "",
    monto_acordado: "",
    moneda: "ARS" as Moneda,
    fecha_acuerdo: "",
    fecha_vencimiento: "",
    notas: "",
  });

  useEffect(() => {
    if (!token || !honorarioId) return;
    api.get<Honorario>(`/honorarios/${honorarioId}`, token)
      .then(h => {
        setHonorario(h);
        setForm({
          concepto: h.concepto,
          monto_acordado: String(h.monto_acordado),
          moneda: h.moneda as Moneda,
          fecha_acuerdo: h.fecha_acuerdo,
          fecha_vencimiento: h.fecha_vencimiento ?? "",
          notas: h.notas ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, honorarioId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.concepto.trim()) e.concepto = "El concepto es obligatorio";
    else if (form.concepto.trim().length < 3) e.concepto = "Mínimo 3 caracteres";
    if (!form.monto_acordado || parseFloat(form.monto_acordado) <= 0) e.monto = "El monto debe ser mayor a cero";
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
      await api.patch(`/honorarios/${honorarioId}`, {
        concepto: form.concepto.trim(),
        monto_acordado: parseFloat(form.monto_acordado),
        moneda: form.moneda,
        fecha_acuerdo: form.fecha_acuerdo || undefined,
        fecha_vencimiento: form.fecha_vencimiento || null,
        notas: form.notas || null,
      }, token);
      router.push(expedienteId ? `/expedientes/${expedienteId}` : "/expedientes");
    } catch (err: unknown) {
      setErrors({ _: err instanceof Error ? err.message : "Error al guardar" });
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-pulse space-y-4">
      <div className="h-6 bg-ink-100 rounded w-1/3" />
      <div className="h-48 bg-ink-100 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Editar honorario</h1>
          {honorario && <p className="text-xs text-ink-400 mt-0.5">{fmt(Number(honorario.monto_acordado), honorario.moneda)} acordado</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">
        {/* Concepto */}
        <div>
          <label className={labelClass}>Concepto *</label>
          <input value={form.concepto} onChange={e => { setForm(f => ({ ...f, concepto: e.target.value })); setErrors(v => ({ ...v, concepto: "" })); }}
            className={`${inputClass} ${errors.concepto ? "border-red-400 focus:ring-red-400" : ""}`}
            placeholder="Ej: Honorarios por patrocinio letrado" />
          {errors.concepto && <p className="text-xs text-red-500 mt-1">{errors.concepto}</p>}
        </div>

        {/* Monto + Moneda */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Monto acordado *</label>
            <input type="number" min="0.01" step="0.01" value={form.monto_acordado}
              onChange={e => { setForm(f => ({ ...f, monto_acordado: e.target.value })); setErrors(v => ({ ...v, monto: "" })); }}
              className={`${inputClass} ${errors.monto ? "border-red-400 focus:ring-red-400" : ""}`} placeholder="0" />
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

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha de acuerdo</label>
            <DateInput value={form.fecha_acuerdo} onChange={v => setForm(f => ({ ...f, fecha_acuerdo: v }))} />
          </div>
          <div>
            <label className={labelClass}>Fecha de vencimiento</label>
            <DateInput value={form.fecha_vencimiento} onChange={v => setForm(f => ({ ...f, fecha_vencimiento: v }))} placeholder="DD/MM/AAAA" />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className={labelClass}>Notas <span className="text-ink-400 font-normal">(opcional)</span></label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            className={`${inputClass} resize-none`} rows={2} placeholder="Porcentaje sobre resultado, condiciones, etc." />
        </div>

        {errors._ && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{errors._}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 text-center text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-3 rounded-xl hover:bg-ink-50 transition">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl transition shadow-sm disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditarHonorarioPage() {
  return <Suspense><EditarHonorarioInner /></Suspense>;
}
