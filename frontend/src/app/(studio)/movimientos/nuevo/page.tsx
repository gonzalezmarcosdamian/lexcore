"use client";

import { TimeInput } from "@/components/ui/time-input";
import { DateInput } from "@/components/ui/date-input";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente } from "@/lib/api";
import { ExpedienteSelect } from "@/components/ui/expediente-select";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TIPOS = [
  { value: "vencimiento",  label: "Vencimiento procesal", icon: "⚖️" },
  { value: "audiencia",    label: "Audiencia",            icon: "🏛️" },
  { value: "presentacion", label: "Presentacion",         icon: "📄" },
  { value: "pericia",      label: "Pericia",              icon: "🔬" },
  { value: "acto_procesal",   label: "Acto Procesal",           icon: "📋" },
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
    fecha: params.get("fecha") ?? "",
    hora: "",
    descripcion: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [touched, setTouched] = useState(false);

  const validate = (f = form) => {
    const e: Record<string,string> = {};
    if (!f.titulo.trim()) e.titulo = "El titulo es obligatorio";
    else if (f.titulo.trim().length < 3) e.titulo = "Minimo 3 caracteres";
    if (!f.expediente_id) e.expediente_id = "Selecciona un expediente";
    if (!f.fecha) e.fecha = "La fecha es obligatoria";
    if (!f.hora) e.hora = "La hora es obligatoria";
    else if (!/^\d{2}:\d{2}$/.test(f.hora)) e.hora = "Formato HH:MM";
    return e;
  };
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    api.get<Expediente[]>("/expedientes", token).then(setExpedientes).catch(() => {});
  }, [token]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!token) return;
    setTouched(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setErrors({});
    try {
      const created = await api.post<{ id: string }>("/movimientos", {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        expediente_id: form.expediente_id,
        fecha: form.fecha,
        hora: form.hora,
        descripcion: form.descripcion || null,
      }, token);

      // Subir adjuntos (múltiples)
      if (adjuntos.length > 0 && created?.id) {
        await Promise.all(adjuntos.map(file => {
          const fd = new FormData();
          fd.append("movimiento_id", created.id);
          if (form.expediente_id) fd.append("expediente_id", form.expediente_id);
          fd.append("file", file);
          return fetch(`${API_URL}/documentos/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        }));
      }

      router.push(form.expediente_id ? `/expedientes/${form.expediente_id}` : "/agenda");
    } catch (err: unknown) {
      setErrors({ _: err instanceof Error ? err.message : "Error al crear el movimiento" });
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
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
                    ? "bg-orange-600 text-white border-orange-600 shadow-sm"
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
            onChange={e => { setForm(f => ({ ...f, titulo: e.target.value })); if (touched) setErrors(v => ({ ...v, titulo: e.target.value.trim().length < 3 ? "Minimo 3 caracteres" : "" })); }}
            onBlur={() => { if (form.titulo.trim().length < 3) setErrors(v => ({ ...v, titulo: form.titulo.trim() ? "Minimo 3 caracteres" : "El titulo es obligatorio" })); }}
            className={`${inputClass} ${errors.titulo ? "border-red-400 focus:ring-red-400" : ""}`}
            placeholder="Ej: Audiencia de vista de causa"
            autoFocus
          />
          {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo}</p>}
        </div>

        {/* Expediente */}
        <div>
          <label className={labelClass}>Expediente *</label>
          <ExpedienteSelect
            expedientes={expedientes}
            value={form.expediente_id}
            onChange={id => { setForm(f => ({ ...f, expediente_id: id })); if (touched) setErrors(v => ({ ...v, expediente_id: id ? "" : "Selecciona un expediente" })); }}
            placeholder="Seleccionar expediente"
          />
          {errors.expediente_id && <p className="text-xs text-red-500 mt-1">{errors.expediente_id}</p>}
        </div>

        {/* Fecha + Hora */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha *</label>
            <DateInput value={form.fecha} onChange={v => { setForm(f => ({ ...f, fecha: v })); if (touched) setErrors(e => ({ ...e, fecha: v ? "" : "La fecha es obligatoria" })); }} ringColor={errors.fecha ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
            {errors.fecha && <p className="text-xs text-red-500 mt-1">{errors.fecha}</p>}
          </div>
          <div>
            <label className={labelClass}>Hora *</label>
            <TimeInput value={form.hora} onChange={v => { setForm(f => ({ ...f, hora: v })); if (touched) setErrors(e => ({ ...e, hora: v ? "" : "La hora es obligatoria" })); }} ringColor={errors.hora ? "focus-within:ring-red-400" : "focus-within:ring-brand-400"} />
            {errors.hora && <p className="text-xs text-red-500 mt-1">{errors.hora}</p>}
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

        {/* Adjunto */}
        <div>
          <label className={labelClass}>Adjunto <span className="text-ink-400 font-normal">(opcional)</span></label>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => {
            const files = Array.from(e.target.files ?? []);
            setAdjuntos(prev => [...prev, ...files]);
            if (fileRef.current) fileRef.current.value = "";
          }} />
          {adjuntos.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {adjuntos.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-amber-50 border border-orange-200 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  <span className="text-sm text-amber-800 flex-1 truncate">{f.name}</span>
                  <button type="button" onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))} className="text-amber-400 hover:text-red-500 transition text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 border border-dashed border-ink-300 text-ink-500 hover:border-amber-400 hover:text-orange-600 rounded-xl px-4 py-3 text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            {adjuntos.length > 0 ? `+ Agregar otro archivo (${adjuntos.length} seleccionado${adjuntos.length > 1 ? "s" : ""})` : "Adjuntar archivo(s)"}
          </button>
        </div>

        {Object.values(errors).some(Boolean) && touched && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">Corrige los errores antes de continuar</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 text-center text-sm font-semibold border border-ink-200 text-ink-600 px-4 py-3 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl transition shadow-sm disabled:opacity-50"
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
