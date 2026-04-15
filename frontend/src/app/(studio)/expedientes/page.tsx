"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Expediente, EstadoExpediente } from "@/lib/api";
import { SortButton, SortModal, SortOption } from "@/components/ui/sort-modal";

const ESTADO_LABELS: Record<EstadoExpediente, string> = {
  activo: "Activo",
  archivado: "Archivado",
  cerrado: "Cerrado",
};

const ESTADO_BADGE: Record<EstadoExpediente, string> = {
  activo: "bg-green-50 text-green-700 border-green-100",
  archivado: "bg-ink-100 text-ink-500 border-ink-200",
  cerrado: "bg-red-50 text-red-600 border-red-100",
};

const ESTADO_DOT: Record<EstadoExpediente, string> = {
  activo: "bg-green-500",
  archivado: "bg-ink-300",
  cerrado: "bg-red-400",
};

type SortKey = "numero" | "caratula" | "fuero" | "estado" | "created_at";
type SortDir = "asc" | "desc";

export default function ExpedientesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoExpediente | "">("");
  const [fueroFiltro, setFueroFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sortOpen, setSortOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (search: string) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await api.get<Expediente[]>("/expedientes", token, {
          q: search || undefined,
          estado: estadoFiltro || undefined,
          fuero: fueroFiltro || undefined,
        });
        setExpedientes(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al cargar expedientes");
      } finally {
        setLoading(false);
      }
    },
    [token, estadoFiltro, fueroFiltro]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, load]);

  const fueros = Array.from(new Set(expedientes.map((e) => e.fuero).filter(Boolean))) as string[];

  const stats = {
    total: expedientes.length,
    activos: expedientes.filter((e) => e.estado === "activo").length,
    archivados: expedientes.filter((e) => e.estado === "archivado").length,
    cerrados: expedientes.filter((e) => e.estado === "cerrado").length,
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SORT_OPTIONS: SortOption<SortKey>[] = [
    { key: "created_at", label: "Fecha de alta", icon: "🕐" },
    { key: "numero", label: "Número", icon: "#" },
    { key: "caratula", label: "Carátula", icon: "⚖️" },
    { key: "fuero", label: "Fuero", icon: "🏛️" },
    { key: "estado", label: "Estado", icon: "🔵" },
  ];

  const sorted = [...expedientes].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "created_at") return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const av = (a[sortKey] ?? "") as string;
    const bv = (b[sortKey] ?? "") as string;
    return mul * av.localeCompare(bv, "es");
  });

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex flex-col gap-px opacity-40">
      <svg className={`w-2.5 h-2.5 ${sortKey === col && sortDir === "asc" ? "opacity-100 text-brand-600" : ""}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${sortKey === col && sortDir === "desc" ? "opacity-100 text-brand-600" : ""}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0H10z" />
      </svg>
    </span>
  );

  return (
    <div className="flex gap-6 h-full min-h-0">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 space-y-4">

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Resumen</p>
          <div className="space-y-2">
            {[
              { label: "Total", value: stats.total, color: "text-ink-900" },
              { label: "Activos", value: stats.activos, color: "text-green-700" },
              { label: "Archivados", value: stats.archivados, color: "text-ink-400" },
              { label: "Cerrados", value: stats.cerrados, color: "text-red-600" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-ink-500">{s.label}</span>
                <span className={`text-sm font-bold ${s.color}`}>
                  {loading ? <span className="inline-block w-5 h-4 bg-ink-100 rounded animate-pulse" /> : s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Filtros</p>

          <div>
            <label className="block text-xs text-ink-500 mb-1.5 font-medium">Estado</label>
            <div className="space-y-1">
              {([["", "Todos"], ["activo", "Activos"], ["archivado", "Archivados"], ["cerrado", "Cerrados"]] as [EstadoExpediente | "", string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setEstadoFiltro(val)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition ${
                    estadoFiltro === val
                      ? "bg-brand-50 text-brand-700 font-semibold"
                      : "text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {val && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ESTADO_DOT[val as EstadoExpediente]}`} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {fueros.length > 0 && (
            <div>
              <label className="block text-xs text-ink-500 mb-1.5 font-medium">Fuero</label>
              <div className="space-y-1">
                <button
                  onClick={() => setFueroFiltro("")}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-sm transition ${fueroFiltro === "" ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-600 hover:bg-ink-50"}`}
                >
                  Todos
                </button>
                {fueros.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFueroFiltro(f)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-sm transition truncate ${fueroFiltro === f ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-600 hover:bg-ink-50"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(estadoFiltro || fueroFiltro || q) && (
            <button
              onClick={() => { setEstadoFiltro(""); setFueroFiltro(""); setQ(""); }}
              className="w-full text-xs text-ink-400 hover:text-ink-600 transition pt-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-900">Expedientes</h1>
            {!loading && (
              <span className="text-sm text-ink-400 bg-ink-100 px-2.5 py-0.5 rounded-full font-medium">
                {sorted.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Buscar número, carátula…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-ink-200 rounded-xl text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition w-56 focus:w-72"
              />
            </div>
            <div className="relative">
              <SortButton open={sortOpen} onToggle={() => setSortOpen((o) => !o)} />
              {sortOpen && (
                <SortModal
                  options={SORT_OPTIONS}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onChange={(k, d) => { setSortKey(k); setSortDir(d); }}
                  onClose={() => setSortOpen(false)}
                />
              )}
            </div>
            <Link
              href="/expedientes/nuevo"
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo expediente
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60">
                {([
                  ["numero", "Número", "w-32"],
                  ["caratula", "Carátula", ""],
                  ["fuero", "Fuero", "w-32"],
                  ["estado", "Estado", "w-28"],
                  ["created_at", "Alta", "w-28"],
                ] as [SortKey, string, string][]).map(([key, label, cls]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider cursor-pointer hover:text-ink-800 transition select-none ${cls}`}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th className="w-24 px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider text-right">Equipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 bg-ink-100 rounded w-24" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-ink-100 rounded w-4/5" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-ink-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5"><div className="h-5 bg-ink-100 rounded-full w-20" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-ink-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-5 bg-ink-100 rounded-full w-10 ml-auto" /></td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-ink-500 font-medium">
                        {q || estadoFiltro || fueroFiltro ? "Sin resultados para los filtros aplicados" : "Todavía no hay expedientes"}
                      </p>
                      {!q && !estadoFiltro && !fueroFiltro && (
                        <Link href="/expedientes/nuevo" className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition">
                          Crear primer expediente
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => router.push(`/expedientes/${e.id}`)}
                    className="hover:bg-brand-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-ink-700 group-hover:text-brand-700 transition">
                        {e.numero}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{e.caratula}</p>
                      {e.juzgado && (
                        <p className="text-xs text-ink-400 truncate mt-0.5">{e.juzgado}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-ink-600">{e.fuero ?? <span className="text-ink-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${ESTADO_BADGE[e.estado]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[e.estado]}`} />
                        {ESTADO_LABELS[e.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-ink-400">
                        {new Date(e.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {e.abogados.length > 0 ? (
                        <span className="text-xs bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full font-medium">
                          {e.abogados.length}
                        </span>
                      ) : (
                        <span className="text-ink-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && sorted.length > 0 && (
            <div className="px-4 py-2.5 border-t border-ink-50 bg-ink-50/40 text-xs text-ink-400">
              {sorted.length} expediente{sorted.length !== 1 ? "s" : ""}
              {(estadoFiltro || fueroFiltro || q) && " — filtro activo"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
