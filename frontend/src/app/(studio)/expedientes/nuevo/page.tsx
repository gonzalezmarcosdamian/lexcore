"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Cliente } from "@/lib/api";

const FUEROS = ["Civil", "Laboral", "Penal", "Comercial", "Contencioso administrativo", "Familia", "Otro"];

const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelCls = "block text-sm font-medium text-ink-700 mb-1.5";

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {[1, 2].map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
            step === s ? "bg-brand-600 text-white shadow-sm shadow-brand-200" :
            step > s ? "bg-brand-100 text-brand-700" :
            "bg-ink-100 text-ink-400"
          }`}>
            {step > s ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : s}
          </div>
          <span className={`ml-2 text-sm font-medium transition-colors ${step >= s ? "text-ink-800" : "text-ink-400"}`}>
            {s === 1 ? "Datos del caso" : "Partes y juzgado"}
          </span>
          {i < 1 && (
            <div className={`flex-1 h-px mx-4 transition-colors ${step > s ? "bg-brand-300" : "bg-ink-100"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NuevoExpedientePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    caratula: "",
    fuero: "",
    fueroCustom: "",
    juzgado: "",
    cliente_id: "",
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [clienteError, setClienteError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<Cliente[]>("/clientes", token).then(setClientes).catch(() => {});
  }, [token]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setClienteOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNext = () => {
    if (!form.caratula.trim()) {
      setStep1Error("La carátula es obligatoria");
      return;
    }
    setStep1Error("");
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.cliente_id) {
      setClienteError("El cliente es obligatorio");
      return;
    }
    setClienteError("");
    setLoading(true);
    setError("");
    const fueroFinal = form.fuero === "Otro" ? form.fueroCustom : form.fuero;
    try {
      await api.post("/expedientes", {
        caratula: form.caratula,
        fuero: fueroFinal || undefined,
        juzgado: form.juzgado || undefined,
        cliente_id: form.cliente_id,
      }, token);
      router.push("/expedientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear expediente");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/expedientes" className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Nuevo expediente</h1>
      </div>

      <Stepper step={step} />

      <form onSubmit={handleSubmit}>

        {/* ── Paso 1: Datos del caso ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
              <div>
                <label className={labelCls}>
                  Carátula <span className="text-brand-500">*</span>
                </label>
                <input
                  value={form.caratula}
                  onChange={(e) => { setForm({ ...form, caratula: e.target.value }); setStep1Error(""); }}
                  className={`${inputCls} ${step1Error ? "border-red-300 focus:ring-red-300" : ""}`}
                  placeholder="García c/ Empresa SA sobre daños"
                  autoFocus
                />
                {step1Error && <p className="text-xs text-red-500 mt-1.5">{step1Error}</p>}
                <p className="text-xs text-ink-400 mt-1.5">
                  Identificá el caso: partes y tipo de acción
                </p>
              </div>

              <div>
                <label className={labelCls}>Fuero</label>
                <div className="grid grid-cols-2 gap-2">
                  {FUEROS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForm({ ...form, fuero: f })}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition text-left ${
                        form.fuero === f
                          ? "bg-brand-50 border-brand-300 text-brand-700"
                          : "bg-ink-50 border-ink-100 text-ink-600 hover:bg-ink-100"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {form.fuero === "Otro" && (
                  <input
                    value={form.fueroCustom}
                    onChange={(e) => setForm({ ...form, fueroCustom: e.target.value })}
                    className={`${inputCls} mt-2`}
                    placeholder="Especificá el fuero…"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition shadow-sm text-base"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ── Paso 2: Partes y juzgado ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">

              {/* Resumen paso 1 */}
              <div className="bg-ink-50 rounded-xl px-4 py-3 border border-ink-100">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1">Carátula</p>
                <p className="text-sm text-ink-800 font-medium">{form.caratula}</p>
                {(form.fuero && form.fuero !== "Otro") && (
                  <p className="text-xs text-ink-400 mt-0.5">{form.fuero}</p>
                )}
                {form.fuero === "Otro" && form.fueroCustom && (
                  <p className="text-xs text-ink-400 mt-0.5">{form.fueroCustom}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Juzgado</label>
                <input
                  value={form.juzgado}
                  onChange={(e) => setForm({ ...form, juzgado: e.target.value })}
                  className={inputCls}
                  placeholder="Juzgado Civil N° 5 — Sec. 10"
                  autoFocus
                />
              </div>

              <div ref={clienteRef}>
                <label className={labelCls}>Cliente <span className="text-brand-500">*</span></label>
                <div className="relative">
                  <input
                    value={clienteSearch}
                    onChange={(e) => {
                      setClienteSearch(e.target.value);
                      setForm({ ...form, cliente_id: "" });
                      setClienteOpen(true);
                      setClienteError("");
                    }}
                    onFocus={() => setClienteOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setClienteOpen(false), 150);
                      if (!form.cliente_id) setClienteSearch("");
                    }}
                    className={`${inputCls} ${clienteError ? "border-red-300 focus:ring-red-300" : form.cliente_id ? "border-brand-300 bg-brand-50" : ""}`}
                    placeholder="Buscar cliente…"
                    autoComplete="off"
                  />
                  {clienteOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
                      {clientes
                        .filter((c) => !clienteSearch || c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()))
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => {
                              setForm({ ...form, cliente_id: c.id });
                              setClienteSearch(c.nombre);
                              setClienteOpen(false);
                              setClienteError("");
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50 transition flex items-center justify-between ${form.cliente_id === c.id ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-800"}`}
                          >
                            <span>{c.nombre}</span>
                            {form.cliente_id === c.id && (
                              <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      {clientes.filter((c) => !clienteSearch || c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-sm text-ink-400">Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
                {clienteError && <p className="text-xs text-red-500 mt-1.5">{clienteError}</p>}
                {clientes.length === 0 && (
                  <p className="text-xs text-ink-400 mt-1.5">
                    No hay clientes creados.{" "}
                    <Link href="/clientes/nuevo" className="text-brand-600 underline">Crear uno</Link>
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
                  {error}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="border border-ink-200 text-ink-700 hover:bg-ink-50 font-medium py-3.5 rounded-xl transition text-sm"
              >
                ← Atrás
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition shadow-sm disabled:opacity-50 text-sm"
              >
                {loading ? "Creando…" : "Crear expediente"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
