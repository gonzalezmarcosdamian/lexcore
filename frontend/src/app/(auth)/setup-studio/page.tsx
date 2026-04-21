"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function SetupStudioPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ studio_name: "", studio_slug: "" });

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
    if (!session?.user?.backendToken) {
      setError("Sesión inválida. Por favor volvé a iniciar sesión.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ access_token: string; studio_id: string }>(
        "/auth/setup-studio",
        { studio_name: form.studio_name, studio_slug: form.studio_slug },
        session.user.backendToken
      );
      await update({
        backendToken: data.access_token,
        studioId: data.studio_id,
        needsStudio: false,
      });
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear el estudio";
      if (msg.includes("ya tiene un estudio")) {
        // El usuario ya completó el setup — refrescar sesión y redirigir
        await update();
        router.replace("/dashboard");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Crear tu estudio</h1>
        <p className="text-sm text-ink-400 mt-1">Un último paso para empezar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-ink-600 mb-1.5 tracking-wide uppercase">
            Nombre del estudio
          </label>
          <input
            name="studio_name"
            value={form.studio_name}
            onChange={handleChange}
            required
            placeholder="García & Asociados"
            className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition shadow-sm"
          />
        </div>

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

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
        >
          {loading ? "Creando estudio…" : "Crear estudio →"}
        </button>
      </form>
    </div>
  );
}
