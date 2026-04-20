"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente } from "@/lib/api";

const today = new Date().toISOString().split("T")[0];

const TIPOS = [
  { value: "vencimiento", label: "Vencimiento procesal", icon: "⚖️" },
  { value: "audiencia", label: "Audiencia", icon: "🏛️" },
  { value: "presentacion", label: "Presentación", icon: "📄" },
  { value: "pericia", label: "Pericia", icon: "🔬" },
  { value: "otro", label: "Otro", icon: "📌" },
];

const inputClass =
  "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

function NuevoVencimientoPageInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = session?.user?.backendToken;

  const expedienteIdParam = searchParams.get("expediente_id") ?? "";
  const fromExpediente = Boolean(expedienteIdParam);

  const [form, setForm] = useState({
    expediente_id: expedienteIdParam,
    descripcion: "",
    fecha: "",
    tipo: "vencimiento",
  });
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api
      .get<Expediente[]>("/expedientes", token, { estado: "activo" })
      .then(setExpedientes)
      .catch(() => {})
      .finally(() => setLoadingExp(false));
  }, [token]);

  const expedienteCtx = expedientes.find((e) => e.id === expedienteIdParam) ?? null;
  const cancelHref = fromExpediente ? `/expedientes/${expedienteIdParam}` : "/vencimientos";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/vencimientos", form, token);
      router.push(cancelHref);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear vencimiento");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        {fromExpediente ? (
          <>
            <Link href="/expedientes" className="text-ink-400 hover:text-ink-600 transition">Expedientes</Link>
            <span className="text-ink-300">/</span>
            {expedienteCtx ? (
              <Link href={`/expedientes/${expedienteIdParam}`} className="text-ink-400 hover:text-ink-600 font-mono transition">
                {expedienteCtx.numero}
              </Link>
            ) : (
              <span className="text-ink-300">…</span>
            )}
            <span className="text-ink-300">/</span>
          </>
        ) : (
          <>
            <Link href="/vencimientos" className="text-ink-400 hover:text-ink-600 transition">Vencimientos</Link>
            <span className="text-ink-300">/</span>
          </>
        )}
        <span className="text-ink-700 font-medium">Nuevo vencimiento</span>
      </div>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink-900">Nuevo vencimiento</h1>
        {fromExpediente && expedienteCtx && (
          <p className="text-sm text-ink-500 mt-1">
            Para{" "}
            <span className="font-mono font-semibold text-ink-700">{expedienteCtx.numero}</span>
            {" — "}
            <span className="text-ink-600">{expedienteCtx.caratula}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Expediente — solo si no viene pre-cargado */}
        {!fromExpediente && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <label className={labelClass}>Expediente <span className="text-red-500">*</span></label>
            {loadingExp ? (
              <div className="h-10 bg-ink-100 rounded-xl animate-pulse" />
            ) : (
              <select
                required
                value={form.expediente_id}
                onChange={(e) => setForm({ ...form, expediente_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Seleccionar expediente…</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.numero} — {exp.caratula}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Tipo — botones visuales */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
          <label className={labelClass}>Tipo</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm({ ...form, tipo: t.value })}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition ${
                  form.tipo === t.value
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "bg-white border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción + Fecha */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
          <div>
            <label className={labelClass}>Descripción <span className="text-red-500">*</span></label>
            <input
              required
              autoFocus
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={inputClass}
              placeholder={
                form.tipo === "audiencia" ? "Ej: Audiencia de vista de causa" :
                form.tipo === "presentacion" ? "Ej: Presentación de peritos" :
                form.tipo === "pericia" ? "Ej: Entrega de informe pericial" :
                "Ej: Vence plazo para contestar demanda"
              }
            />
          </div>
          <div>
            <label className={labelClass}>Fecha <span className="text-red-500">*</span></label>
            <input
              required
              type="date"
              min={today}
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={cancelHref}
            className="flex-1 text-center border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar vencimiento"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NuevoVencimientoPage() {
  return <Suspense><NuevoVencimientoPageInner /></Suspense>;
}
