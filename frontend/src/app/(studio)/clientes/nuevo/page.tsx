"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, TipoCliente } from "@/lib/api";

// CUIT: XX-XXXXXXXX-X (con o sin guiones). DNI: 7-8 dígitos.
function validarCuitDni(valor: string, tipo: TipoCliente): string | null {
  const clean = valor.replace(/[-\s]/g, "");
  if (tipo === "fisica") {
    if (!/^\d{7,8}$/.test(clean) && !/^\d{11}$/.test(clean)) {
      return "DNI: 7-8 dígitos. CUIT: 11 dígitos (ej: 20-12345678-9)";
    }
  } else {
    if (!/^\d{11}$/.test(clean)) {
      return "CUIT debe tener 11 dígitos (ej: 30-12345678-9)";
    }
    if (!["30", "33", "34"].includes(clean.slice(0, 2))) {
      return "CUIT de persona jurídica debe comenzar con 30, 33 o 34";
    }
  }
  return null;
}

function validarTelefono(valor: string): string | null {
  const clean = valor.replace(/[\s\-().]/g, "");
  if (!/^\+?\d{8,15}$/.test(clean)) {
    return "Teléfono inválido. Ej: +54 9 11 1234-5678";
  }
  return null;
}

function validarEmail(valor: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    return "Email inválido";
  }
  return null;
}

function formatCuit(valor: string): string {
  const clean = valor.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const errores = {
    cuit_dni: form.cuit_dni ? validarCuitDni(form.cuit_dni, form.tipo) : null,
    telefono: form.telefono ? validarTelefono(form.telefono) : null,
    email: form.email ? validarEmail(form.email) : null,
  };

  const hayErrores = Object.values(errores).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ cuit_dni: true, telefono: true, email: true });
    if (hayErrores || !token) return;
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

  const fieldClass = (campo: keyof typeof errores) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition ${
      touched[campo] && errores[campo]
        ? "border-red-300 focus:ring-red-200 bg-red-50"
        : "border-gray-200 focus:ring-brand-300"
    }`;

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
                  onChange={() => setForm({ ...form, tipo: t, cuit_dni: "" })}
                />
                {t === "fisica" ? "Persona física" : "Persona jurídica"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {form.tipo === "fisica" ? "DNI / CUIT" : "CUIT"}
          </label>
          <input
            value={form.cuit_dni}
            onChange={(e) => {
              const raw = e.target.value;
              const isDeleting = raw.length < form.cuit_dni.length;
              setForm({ ...form, cuit_dni: isDeleting ? raw : formatCuit(raw) });
            }}
            onBlur={() => setTouched((t) => ({ ...t, cuit_dni: true }))}
            className={fieldClass("cuit_dni")}
            placeholder={form.tipo === "fisica" ? "12345678 o 20-12345678-9" : "30-12345678-9"}
          />
          {touched.cuit_dni && errores.cuit_dni && (
            <p className="text-xs text-red-600 mt-1">{errores.cuit_dni}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, telefono: true }))}
            className={fieldClass("telefono")}
            placeholder="+54 9 11 1234-5678"
          />
          {touched.telefono && errores.telefono && (
            <p className="text-xs text-red-600 mt-1">{errores.telefono}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="text"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            className={fieldClass("email")}
            placeholder="cliente@ejemplo.com"
          />
          {touched.email && errores.email && (
            <p className="text-xs text-red-600 mt-1">{errores.email}</p>
          )}
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
