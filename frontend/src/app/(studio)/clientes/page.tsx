"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Cliente, TipoCliente } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";
import { SkeletonRow, SkeletonStat } from "@/components/ui/skeletons";

function Avatar({ nombre, tipo }: { nombre: string; tipo: TipoCliente }) {
  const letter = nombre.charAt(0).toUpperCase();
  const cls =
    tipo === "fisica"
      ? "bg-blue-100 text-blue-700"
      : "bg-purple-100 text-purple-700";
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${cls}`}
    >
      {letter}
    </div>
  );
}


export default function ClientesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoCliente | "">("");
  const [archivado, setArchivado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (search: string) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await api.get<Cliente[]>("/clientes", token, {
          q: search || undefined,
          tipo: tipo || undefined,
          archivado,
        });
        setClientes(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar clientes");
      } finally {
        setLoading(false);
      }
    },
    [token, tipo, archivado]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, load]);

  const total = clientes.length;
  const fisicaCount = clientes.filter((c) => c.tipo === "fisica").length;
  const juridicaCount = clientes.filter((c) => c.tipo === "juridica").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Clientes</h1>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Clientes"
            description="Todo expediente necesita un cliente. Podés ser persona física (individuo) o jurídica (empresa/sociedad)."
            items={[
              { icon: "👤", title: "Persona física", description: "Individuos identificados por DNI. Campos clave: nombre completo, DNI, email y teléfono de contacto." },
              { icon: "🏢", title: "Persona jurídica", description: "Empresas, sociedades, cooperativas. Identificadas por CUIT. El nombre de fantasía va en el campo 'nombre'." },
              { icon: "🔍", title: "Búsqueda por nombre o CUIT/DNI", description: "El buscador filtra en tiempo real por nombre completo o por número de documento. Útil para encontrar clientes rápido al crear expedientes." },
              { icon: "📋", title: "Expedientes del cliente", description: "En el perfil de cada cliente ves todos sus expedientes: activos, archivados y cerrados. Ideal para ver el historial completo de la relación." },
              { icon: "📁", title: "Archivar vs eliminar", description: "Archivar oculta al cliente de la lista activa pero conserva todo su historial. Solo podés eliminar un cliente sin expedientes asociados." },
            ]}
            tip="Creá el cliente antes de crear el expediente — el formulario de nuevo expediente requiere seleccionar un cliente existente."
          />
          <Link
            href="/clientes/nuevo"
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Nuevo cliente
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Buscar por nombre o CUIT/DNI…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-52 sm:focus:w-80 bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCliente | "")}
          className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
        >
          <option value="">Todos los tipos</option>
          <option value="fisica">Persona física</option>
          <option value="juridica">Persona jurídica</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer px-1">
          <input
            type="checkbox"
            checked={archivado}
            onChange={(e) => setArchivado(e.target.checked)}
            className="rounded border-ink-300"
          />
          Ver archivados
        </label>
      </div>

      {loading && (
        <div className="flex gap-4 mb-5">
          {[1, 2, 3].map((i) => <SkeletonStat key={i} />)}
        </div>
      )}

      {!loading && !error && (
        <div className="flex gap-4 mb-5">
          {[
            { label: "Total", value: total },
            { label: "Personas físicas", value: fisicaCount },
            { label: "Personas jurídicas", value: juridicaCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-ink-100 shadow-sm px-4 py-3 flex flex-col min-w-[90px]"
            >
              <span className="text-2xl font-bold text-ink-900">{stat.value}</span>
              <span className="text-xs text-ink-400 mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center text-ink-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink-600">
            {q || tipo ? "Sin resultados para los filtros aplicados" : "Todavía no hay clientes registrados"}
          </p>
          {!q && !tipo && (
            <Link
              href="/clientes/nuevo"
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              Crear primer cliente
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
          {clientes.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/clientes/${c.id}`)}
              className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink-50 transition-colors cursor-pointer"
            >
              <Avatar nombre={c.nombre} tipo={c.tipo} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-ink-900 truncate">{c.nombre}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      c.tipo === "fisica"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {c.tipo === "fisica" ? "Persona física" : "Persona jurídica"}
                  </span>
                  {c.archivado && (
                    <span className="text-xs bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      Archivado
                    </span>
                  )}
                </div>
                {(c.dni || c.cuit || c.cuit_dni) && (
                  <p className="text-xs text-ink-400 mt-0.5">
                    {[c.dni && `DNI ${c.dni}`, c.cuit && `CUIT ${c.cuit}`, !c.dni && !c.cuit && c.cuit_dni && `Doc. ${c.cuit_dni}`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {c.email && (
                  <svg className="w-4 h-4 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {c.telefono && (
                  <svg className="w-4 h-4 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                )}
                <svg className="w-4 h-4 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
