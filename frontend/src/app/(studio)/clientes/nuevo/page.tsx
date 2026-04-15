"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, TipoCliente } from "@/lib/api";

export default function NuevoClientePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [form, setForm] = useState({
    nombre: "",
    tipo: "fisica" as TipoCliente,
    cuit_dni: "",
    telefono: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const body = {
        ...form,
        cuit_dni: form.cuit_dni || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
      };
      await api.post("/clientes", body, token);
      router.push("/clientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear cliente");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Clientes
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Nuevo cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="Nombre completo o razón social"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
          <div className="flex gap-3">
            {(["fisica", "juridica"] as TipoCliente[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={form.tipo === t}
                  onChange={() => setForm({ ...form, tipo: t })}
                />
                {t === "fisica" ? "Persona física" : "Persona jurídica"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CUIT / DNI</label>
          <input
            value={form.cuit_dni}
            onChange={(e) => setForm({ ...form, cuit_dni: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="20-12345678-9"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="cliente@ejemplo.com"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/clientes"
            className="flex-1 text-center border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
