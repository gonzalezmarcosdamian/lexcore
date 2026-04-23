"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, TipoCliente } from "@/lib/api";
import { AddressAutocomplete, AddressValue } from "@/components/ui/address-autocomplete";

function formatCuit(valor: string): string {
  const clean = valor.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

function validarDni(valor: string): string | null {
  const clean = valor.replace(/[\s.]/g, "");
  if (!/^\d{7,8}$/.test(clean)) return "DNI: 7 u 8 dígitos numéricos";
  return null;
}

function validarCuit(valor: string): string | null {
  const clean = valor.replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(clean)) return "CUIT: 11 dígitos (ej: 20-12345678-9)";
  return null;
}

function validarTelefono(valor: string): string | null {
  const clean = valor.replace(/[\s\-().]/g, "");
  if (!/^\+?\d{8,15}$/.test(clean)) return "Teléfono inválido. Ej: +54 9 11 1234-5678";
  return null;
}

function validarEmail(valor: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return "Email inválido";
  return null;
}

const inputCls = "w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 transition bg-white text-ink-900 placeholder-ink-400";
const inputErrCls = "w-full border border-red-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 transition bg-red-50 text-ink-900";
const labelCls = "block text-sm font-medium text-ink-700 mb-1.5";

export default function NuevoClientePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [form, setForm] = useState({
    nombre: "",
    tipo: "fisica" as TipoCliente,
    dni: "",
    cuit: "",
    telefono: "",
    email: "",
    domicilio: "",
    domicilio_lat: undefined as number | undefined,
    domicilio_lng: undefined as number | undefined,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const errores = {
    dni: form.dni ? validarDni(form.dni) : null,
    cuit: form.cuit ? validarCuit(form.cuit) : null,
    telefono: form.telefono ? validarTelefono(form.telefono) : null,
    email: form.email ? validarEmail(form.email) : null,
  };

  const hayErrores = Object.values(errores).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ dni: true, cuit: true, telefono: true, email: true });
    if (hayErrores || !token) return;
    setLoading(true);
    setError("");
    try {
      const body = {
        nombre: form.nombre,
        tipo: form.tipo,
        dni: form.dni || undefined,
        cuit: form.cuit || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        domicilio: form.domicilio || undefined,
        domicilio_lat: form.domicilio_lat,
        domicilio_lng: form.domicilio_lng,
      };
      await api.post("/clientes", body, token);
      router.push("/clientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear cliente");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clientes" className="text-ink-400 hover:text-ink-600 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-ink-900">Nuevo cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>
        )}

        <div>
          <label className={labelCls}>Nombre <span className="text-brand-500">*</span></label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className={inputCls}
            placeholder="Nombre completo o razón social"
            autoFocus
          />
        </div>

        <div>
          <label className={labelCls}>Tipo <span className="text-brand-500">*</span></label>
          <div className="flex gap-3">
            {(["fisica", "juridica"] as TipoCliente[]).map((t) => (
              <label key={t} className={`flex items-center gap-2 text-sm cursor-pointer px-4 py-2.5 rounded-xl border transition flex-1 justify-center font-medium ${
                form.tipo === t ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100"
              }`}>
                <input type="radio" name="tipo" value={t} checked={form.tipo === t}
                  onChange={() => setForm({ ...form, tipo: t, dni: "", cuit: "" })}
                  className="sr-only"
                />
                {t === "fisica" ? "👤 Persona física" : "🏢 Persona jurídica"}
              </label>
            ))}
          </div>
        </div>

        {/* Documentos separados */}
        <div className="grid grid-cols-2 gap-3">
          {form.tipo === "fisica" && (
            <div>
              <label className={labelCls}>DNI</label>
              <input
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                onBlur={() => setTouched((t) => ({ ...t, dni: true }))}
                className={touched.dni && errores.dni ? inputErrCls : inputCls}
                placeholder="12345678"
                inputMode="numeric"
              />
              {touched.dni && errores.dni && <p role="alert" className="text-xs text-red-600 mt-1">{errores.dni}</p>}
            </div>
          )}
          <div>
            <label className={labelCls}>CUIT</label>
            <input
              value={form.cuit}
              onChange={(e) => {
                const raw = e.target.value;
                const isDeleting = raw.length < form.cuit.length;
                setForm({ ...form, cuit: isDeleting ? raw : formatCuit(raw) });
              }}
              onBlur={() => setTouched((t) => ({ ...t, cuit: true }))}
              className={touched.cuit && errores.cuit ? inputErrCls : inputCls}
              placeholder={form.tipo === "fisica" ? "20-12345678-9" : "30-12345678-9"}
              inputMode="numeric"
            />
            {touched.cuit && errores.cuit && <p role="alert" className="text-xs text-red-600 mt-1">{errores.cuit}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Teléfono</label>
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, telefono: true }))}
              className={touched.telefono && errores.telefono ? inputErrCls : inputCls}
              placeholder="+54 9 11 1234-5678"
              inputMode="tel"
            />
            {touched.telefono && errores.telefono && <p role="alert" className="text-xs text-red-600 mt-1">{errores.telefono}</p>}
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="text"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className={touched.email && errores.email ? inputErrCls : inputCls}
              placeholder="cliente@ejemplo.com"
              inputMode="email"
            />
            {touched.email && errores.email && <p role="alert" className="text-xs text-red-600 mt-1">{errores.email}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Domicilio</label>
          <AddressAutocomplete
            value={form.domicilio}
            placeholder="Buscar dirección en Argentina…"
            onChange={(val: AddressValue | null, rawText: string) => {
              if (val) {
                setForm(f => ({ ...f, domicilio: val.domicilio, domicilio_lat: val.domicilio_lat, domicilio_lng: val.domicilio_lng }));
              } else {
                setForm(f => ({ ...f, domicilio: rawText, domicilio_lat: undefined, domicilio_lng: undefined }));
              }
            }}
          />
          {form.domicilio_lat && (
            <a
              href={`https://maps.google.com/?q=${form.domicilio_lat},${form.domicilio_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-1.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Ver en mapa
            </a>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/clientes"
            className="flex-1 text-center border border-ink-200 text-ink-600 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-ink-50 transition"
          >
            Cancelar
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-700 active:scale-95 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
