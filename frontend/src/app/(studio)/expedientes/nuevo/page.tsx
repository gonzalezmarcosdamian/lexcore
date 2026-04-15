"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Cliente, EstadoExpediente } from "@/lib/api";

export default function NuevoExpedientePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [form, setForm] = useState({
    numero: "",
    caratula: "",
    fuero: "",
    juzgado: "",
    estado: "activo" as EstadoExpediente,
    cliente_id: "",
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<Cliente[]>("/clientes", token).then(setClientes).catch(() => {});
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/expedientes", {
        ...form,
        fuero: form.fuero || undefined,
        juzgado: form.juzgado || undefined,
        cliente_id: form.cliente_id || undefined,
      }, token);
      router.push("/expedientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear expediente");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/expedientes" className="text-gray-400 hover:text-gray-600 text-sm">← Expedientes</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Nuevo expediente</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
          <input
            required
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="EXP-2026-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Carátula *</label>
          <input
            required
            value={form.caratula}
            onChange={(e) => setForm({ ...form, caratula: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="Apellido c/ Empresa S.A."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuero</label>
          <input
            value={form.fuero}
            onChange={(e) => setForm({ ...form, fuero: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="Civil, Laboral, Penal…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Juzgado</label>
          <input
            value={form.juzgado}
            onChange={(e) => setForm({ ...form, juzgado: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="Juzgado N° 5 Civil"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoExpediente })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="activo">Activo</option>
            <option value="archivado">Archivado</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <select
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/expedientes" className="flex-1 text-center border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {loading ? "Guardando…" : "Guardar expediente"}
          </button>
        </div>
      </form>
    </div>
  );
}
