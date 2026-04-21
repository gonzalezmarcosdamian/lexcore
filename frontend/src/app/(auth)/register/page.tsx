"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    studio_name: "",
    studio_slug: "",
    full_name: "",
    email: "",
    password: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "studio_name") {
        next.studio_slug = value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", form);
      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (res?.error) throw new Error("Error al iniciar sesión");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar el estudio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Crear estudio</h1>
        <p className="text-sm text-ink-400 mt-1">Configurá tu espacio de trabajo en minutos</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Datos del estudio */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Tu estudio</p>
          <Field
            label="Nombre del estudio"
            name="studio_name"
            value={form.studio_name}
            onChange={handleChange}
            placeholder="García & Asociados"
          />
          <div>
            <label className="block text-xs font-semibold text-ink-600 mb-1.5 tracking-wide uppercase">
              Slug (URL)
            </label>
            <div className="flex items-center bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-brand-400 focus-within:border-transparent transition">
              <span className="px-3 py-3 text-xs text-ink-400 bg-ink-50 border-r border-ink-100 select-none whitespace-nowrap">
                lexcore.app/
              </span>
              <input
                name="studio_slug"
                value={form.studio_slug}
                onChange={handleChange}
                required
                placeholder="garcia-asociados"
                className="flex-1 px-3 py-3 text-sm text-ink-900 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Datos del admin */}
        <div className="space-y-4 pt-2">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Tu cuenta</p>
          <Field label="Nombre completo" name="full_name" value={form.full_name} onChange={handleChange} placeholder="Dra. María García" />
          <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="maria@estudio.com" />
          <Field label="Contraseña" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mínimo 8 caracteres" />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
          />
          <span className="text-xs text-ink-600 leading-relaxed">
            Leí y acepto los{" "}
            <Link href="/terminos" target="_blank" className="text-brand-600 hover:underline font-medium">Términos y Condiciones</Link>
            {" "}y la{" "}
            <Link href="/privacidad" target="_blank" className="text-brand-600 hover:underline font-medium">Política de Privacidad</Link>
            {" "}de LexCore.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !acceptedTerms}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creando estudio…
            </span>
          ) : "Crear estudio"}
        </button>
      </form>

      <p className="text-center text-sm text-ink-400 mt-6">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
          Ingresá acá
        </Link>
      </p>
    </div>
  );
}

function Field({
  label, name, value, onChange, placeholder, type = "text",
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-600 mb-1.5 tracking-wide uppercase">
        {label}
      </label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        required placeholder={placeholder}
        className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition shadow-sm"
      />
    </div>
  );
}
