"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Expediente, EstadoExpediente } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";
import { SkeletonRow } from "@/components/ui/skeletons";

const ESTADO_LABELS: Record<EstadoExpediente, string> = {
  activo: "Activo",
  archivado: "Archivado",
  cerrado: "Cerrado",
};

const ESTADO_DOT: Record<EstadoExpediente, string> = {
  activo: "bg-green-500",
  archivado: "bg-ink-300",
  cerrado: "bg-red-400",
};

const ESTADO_BADGE: Record<EstadoExpediente, string> = {
  activo: "bg-green-50 text-green-700",
  archivado: "bg-ink-100 text-ink-500",
  cerrado: "bg-red-50 text-red-600",
};


export default function ExpedientesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoExpediente | "">("");
  const [fuero, setFuero] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (search: string) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await api.get<Expediente[]>("/expedientes", token, {
          q: search || undefined,
          estado: estado || undefined,
          fuero: fuero || undefined,
        });
        setExpedientes(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar expedientes");
      } finally {
        setLoading(false);
      }
    },
    [token, estado, fuero]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, load]);

  const fueros = Array.from(new Set(expedientes.map((e) => e.fuero).filter(Boolean))) as string[];

  const activos = expedientes.filter((e) => e.estado === "activo").length;
  const archivados = expedientes.filter((e) => e.estado === "archivado").length;
  const cerrados = expedientes.filter((e) => e.estado === "cerrado").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Expedientes</h1>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Gestión de Expedientes"
            description="Centro de control de todos los casos judiciales y extrajudiciales"
            items={[
              { icon: "⚖️", title: "Carátula y número", description: "Cada expediente tiene un número interno (EXP-YYYY-NNN) y una carátula que identifica el caso." },
              { icon: "🏛️", title: "Fuero y juzgado", description: "Clasificá el expediente por fuero (civil, laboral, penal…) y juzgado interviniente." },
              { icon: "👨‍⚖️", title: "Equipo asignado", description: "Cada expediente tiene un responsable y puede tener colaboradores o supervisores." },
              { icon: "📅", title: "Vencimientos", description: "Dentro del expediente podés cargar audiencias, presentaciones y plazos con alertas automáticas." },
              { icon: "📎", title: "Documentos", description: "Adjuntá escritos, pericias, poderes y cualquier archivo directamente al expediente." },
              { icon: "💰", title: "Honorarios", description: "Registrá los honorarios acordados y los pagos recibidos para cada expediente." },
            ]}
            tip="Filtrá por estado y fuero para encontrar rápidamente lo que buscás. El estado 'Activo' son los casos en curso."
          />
          <Link
            href="/expedientes/nuevo"
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Nuevo
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Buscar por número o carátula…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-52 sm:focus:w-80 bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoExpediente | "")}
          className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
        >
          <option value="">Todos los estados</option>
          {(["activo", "archivado", "cerrado"] as EstadoExpediente[]).map((s) => (
            <option key={s} value={s}>
              {ESTADO_LABELS[s]}
            </option>
          ))}
        </select>
        {fueros.length > 0 && (
          <select
            value={fuero}
            onChange={(e) => setFuero(e.target.value)}
            className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
          >
            <option value="">Todos los fueros</option>
            {fueros.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </div>

      {!loading && !error && (
        <div className="flex gap-4 mb-5">
          {[
            { label: "Activos", value: activos, color: "text-green-700" },
            { label: "Archivados", value: archivados, color: "text-ink-500" },
            { label: "Cerrados", value: cerrados, color: "text-red-600" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-ink-100 shadow-sm px-4 py-3 flex flex-col min-w-[90px]"
            >
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
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
      ) : expedientes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center text-ink-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink-600">
            {q || estado || fuero
              ? "Sin resultados para los filtros aplicados"
              : "Todavía no hay expedientes registrados"}
          </p>
          {!q && !estado && !fuero && (
            <Link
              href="/expedientes/nuevo"
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              Crear primer expediente
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
          {expedientes.map((e) => (
            <div
              key={e.id}
              onClick={() => router.push(`/expedientes/${e.id}`)}
              className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink-50 transition-colors cursor-pointer"
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ESTADO_DOT[e.estado]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-mono font-bold text-ink-900">{e.numero}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_BADGE[e.estado]}`}
                  >
                    {ESTADO_LABELS[e.estado]}
                  </span>
                </div>
                <p className="text-sm text-ink-700 mt-0.5 truncate">{e.caratula}</p>
                {(e.fuero || e.juzgado) && (
                  <p className="text-xs text-ink-400 mt-0.5 truncate">
                    {[e.fuero, e.juzgado].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {e.abogados.length > 0 && (
                  <span className="text-xs bg-ink-50 text-ink-500 border border-ink-100 px-2 py-0.5 rounded-full">
                    {e.abogados.length} abogado{e.abogados.length !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-xs text-ink-400 hidden sm:block">
                  {new Date(e.created_at).toLocaleDateString("es-AR")}
                </span>
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
