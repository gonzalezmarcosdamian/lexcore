"use client";

import { TimeInput } from "@/components/ui/time-input";
import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente } from "@/lib/api";
import { ExpedienteSelect } from "@/components/ui/expediente-select";

const TIPOS = [
  { value: "vencimiento",  label: "Vencimiento procesal", icon: "⚖️" },
  { value: "audiencia",    label: "Audiencia",            icon: "🏛️" },
  { value: "presentacion", label: "Presentacion",         icon: "📄" },
  { value: "pericia",      label: "Pericia",              icon: "🔬" },
  { value: "diligencia",   label: "Diligencia",           icon: "📋" },
  { value: "notificacion", label: "Notificacion",         icon: "📬" },
  { value: "otro",         label: "Otro",                 icon: "📌" },
];

const inputClass = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function NuevoMovimientoInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const token = session?.user?.backendToken;

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "vencimiento",
    expediente_id: params.get("expediente_id") ?? "",
    fecha: "",
    hora: "",
    descripcion: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token).then(setExpedientes).catch(() => {});
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.titulo.trim()) { setError("El titulo es obligatorio"); return; }
    if (!form.expediente_id) { setError("El expediente es obligatorio"); return; }
    if (!form.fecha) { setError("La fecha es obligatoria"); return; }
    if (!form.hora) { setError("La hora es obligatoria"); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/movimientos", {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        expediente_id: form.expediente_id,
        fecha: form.fecha,
        hora: form.hora,
        descripcion: form.descripcion || null,
      }, token);
      router.push(form.expediente_id ? `/expedientes/${form.expediente_id}` : "/agenda");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear el movimiento");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <Link href="/agenda" className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Nuevo movimiento procesal</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">
        {/* Tipo */}
        <div>
          <label className={labelClass}>Tipo *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                  form.tipo === t.value
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-white text-ink-600 border-ink-200 hover:bg-ink-50"
                }`}
              >
                <span>{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Titulo */}
        <div>
          <label className={labelClass}>Titulo *</label>
          <input
            value={form.titulo}
            onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            className={inputClass}
            placeholder="Ej: Audiencia de vista de causa"
            autoFocus
          />
        </div>

        {/* Expediente */}
        <div>
          <label className={labelClass}>Expediente *</label>
          <ExpedienteSelect
            expedientes={expedientes}
            value={form.expediente_id}
            onChange={id => setForm(f => ({ ...f, expediente_id: id }))}
            placeholder="Seleccionar expediente"
          />
        </div>

        {/* Fecha + Hora */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha *</label>
            <DateInput value={form.fecha} onChange={v => setForm(f => ({ ...f, fecha: v }))} required />
          </div>
          <div>
            <label className={labelClass}>Hora *</label>
            <TimeInput value={form.hora} onChange={v => setForm(f => ({ ...f, hora: v }))} required />
          </div>
        </div>

        {/* Descripcion */}
        <div>
          <label className={labelClass}>Descripcion <span className="text-ink-400 font-normal">(opcional)</span></label>
          <textarea
            value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Detalles del acto procesal..."
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link href="/agenda" className="flex-1 text-center text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-3 rounded-xl hover:bg-ink-50 transition">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Crear movimiento"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NuevoMovimientoPage() {
  return (
    <Suspense>
      <NuevoMovimientoInner />
    </Suspense>
  );
}
