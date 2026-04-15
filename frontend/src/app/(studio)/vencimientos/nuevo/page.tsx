"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente } from "@/lib/api";

const today = new Date().toISOString().split("T")[0];

export default function NuevoVencimientoPage() {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api
      .get<Expediente[]>("/expedientes", token, { estado: "activo" })
      .then(setExpedientes)
      .catch(() => {});
  }, [token]);

  const expedienteCtx = fromExpediente
    ? expedientes.find((e) => e.id === expedienteIdParam)
    : null;

  const cancelHref = fromExpediente
    ? `/expedientes/${expedienteIdParam}`
    : "/vencimientos";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/vencimientos", form, token);
      router.push(cancelHref);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear vencimiento");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
  const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/vencimientos" className="text-ink-400 hover:text-ink-700 transition">
          Vencimientos
        </Link>
        <svg className="w-4 h-4 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-ink-900 font-medium">Nuevo vencimiento</span>
      </div>

      {/* Context banner */}
      {fromExpediente && (
        <div className="mb-4 flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-2.5 text-sm text-brand-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Creando para:{" "}
          {expedienteCtx
            ? <strong className="ml-1">{expedienteCtx.numero} — {expedienteCtx.caratula}</strong>
            : <span className="ml-1 italic opacity-70">cargando…</span>
          }
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
        <h1 className="text-lg font-bold text-ink-900 mb-5">Nuevo vencimiento</h1>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expediente */}
          <div>
            <label className={labelClass}>
              Expediente <span className="text-red-500">*</span>
            </label>
            <select
              required
              disabled={fromExpediente}
              value={form.expediente_id}
              onChange={(e) => setForm({ ...form, expediente_id: e.target.value })}
              className={`${inputClass} ${fromExpediente ? "opacity-60 cursor-not-allowed bg-ink-50" : ""}`}
            >
              <option value="">Seleccionar expediente…</option>
              {expedientes.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.numero} — {exp.caratula}
                </option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>
              Descripción <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={inputClass}
              placeholder="Ej: Audiencia de vista de causa"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className={labelClass}>
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="date"
              min={today}
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={inputClass}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className={labelClass}>Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className={inputClass}
            >
              <option value="vencimiento">Vencimiento procesal</option>
              <option value="audiencia">Audiencia</option>
              <option value="presentacion">Presentación</option>
              <option value="pericia">Pericia</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link
              href={cancelHref}
              className="flex-1 text-center border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
