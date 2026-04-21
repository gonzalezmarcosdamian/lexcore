"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Expediente, EstadoExpediente } from "@/lib/api";
import { SortButton, SortModal, SortOption } from "@/components/ui/sort-modal";
import { PageHelp } from "@/components/ui/page-help";

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

type ColKey = "numero" | "caratula" | "fuero" | "estado" | "created_at" | "cliente" | "equipo";
const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "numero", label: "Número" },
  { key: "caratula", label: "Carátula" },
  { key: "fuero", label: "Fuero" },
  { key: "estado", label: "Estado" },
  { key: "created_at", label: "Alta" },
  { key: "cliente", label: "Cliente" },
  { key: "equipo", label: "Equipo" },
];
const DEFAULT_COLS: ColKey[] = ["numero", "caratula", "fuero", "estado", "created_at", "cliente", "equipo"];
const COLS_STORAGE_KEY = "lexcore_exp_cols";

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
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS);
  const colsRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const saved = localStorage.getItem(COLS_STORAGE_KEY);
    if (saved) { try { setVisibleCols(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      // Siempre mantener al menos numero y caratula
      const safe = next.length === 0 ? ["numero", "caratula"] as ColKey[] : next;
      localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(safe));
      return safe;
    });
  };

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

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex gap-6 h-full min-h-0">

      {/* ── Sidebar mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-56 bg-white lg:bg-transparent shadow-2xl lg:shadow-none flex-shrink-0 space-y-4 overflow-y-auto p-4 lg:p-0 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            {/* Filtros mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 border border-ink-200 rounded-xl text-ink-500 hover:bg-ink-50 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h4" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-ink-900">Expedientes</h1>
            <PageHelp
              title="Expedientes"
              description="Cada expediente representa un caso: judicial o extrajudicial. Desde acá gestionás todo el ciclo de vida."
              items={[
                { icon: "📁", title: "Estados", description: "Activo (en trámite), Archivado (sin movimiento reciente), Cerrado (finalizado). Podés cambiarlos desde el detalle." },
                { icon: "👥", title: "Equipo del caso", description: "Cada expediente tiene abogados asignados. El responsable lidera; los colaboradores participan; supervisión solo monitorea." },
                { icon: "📋", title: "Carátula y fuero", description: "Carátula es el nombre oficial del expediente (ej: 'García c/ Municipalidad'). Fuero es la jurisdicción (civil, laboral, penal, etc.)." },
                { icon: "📜", title: "Bitácora", description: "Registro automático de todos los movimientos: honorarios, vencimientos, tareas, documentos y movimientos procesales registrados." },
                { icon: "⚖️", title: "Número de expediente", description: "El sistema genera automáticamente el número (EXP-AÑO-NNNN). Podés agregar el número judicial externo como referencia." },
              ]}
              tip="Usá los filtros de la barra lateral para encontrar expedientes por estado, abogado o fecha de creación."
            />
            {!loading && (
              <span className="text-sm text-ink-400 bg-ink-100 px-2.5 py-0.5 rounded-full font-medium">
                {sorted.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:flex-none">
              <svg className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Buscar número, carátula…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-ink-200 rounded-xl text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition w-full sm:w-56 sm:focus:w-72"
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
            <div ref={colsRef} className="relative">
              <button
                onClick={() => setColsOpen((o) => !o)}
                title="Columnas"
                className={`flex items-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium transition ${colsOpen ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-ink-200 text-ink-600 hover:border-ink-300"}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span className="hidden sm:inline">Columnas</span>
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-ink-200 rounded-2xl shadow-xl z-50 p-2">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-2 py-1.5">Mostrar columnas</p>
                  {ALL_COLS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleCol(col.key)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-ink-50 transition text-sm text-ink-700"
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center border transition ${visibleCols.includes(col.key) ? "bg-brand-600 border-brand-600" : "border-ink-300"}`}>
                        {visibleCols.includes(col.key) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {col.label}
                    </button>
                  ))}
                </div>
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60">
                {ALL_COLS.filter((c) => visibleCols.includes(c.key)).map((col) => {
                  const isSortable = ["numero","caratula","fuero","estado","created_at"].includes(col.key);
                  const cls = col.key === "numero" ? "w-32" : col.key === "fuero" ? "w-32" : col.key === "estado" ? "w-28" : col.key === "created_at" ? "w-28" : col.key === "equipo" ? "w-24 text-right" : col.key === "cliente" ? "w-36" : "";
                  return (
                    <th
                      key={col.key}
                      onClick={isSortable ? () => handleSort(col.key as SortKey) : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider transition select-none ${cls} ${isSortable ? "cursor-pointer hover:text-ink-800" : ""}`}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        {isSortable && <SortIcon col={col.key as SortKey} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {visibleCols.map((c) => (
                      <td key={c} className="px-4 py-3.5"><div className="h-4 bg-ink-100 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="px-4 py-16 text-center">
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
                    {visibleCols.includes("numero") && (
                      <td className="px-4 py-3.5">
                        {e.numero_judicial
                          ? <>
                              <span className="font-mono text-xs font-bold text-ink-700 group-hover:text-brand-700 transition block">{e.numero_judicial}</span>
                              <span className="font-mono text-[10px] text-ink-400">{e.numero}</span>
                            </>
                          : <span className="font-mono text-xs font-bold text-ink-700 group-hover:text-brand-700 transition">{e.numero}</span>
                        }
                      </td>
                    )}
                    {visibleCols.includes("caratula") && (
                      <td className="px-4 py-3.5 max-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">{e.caratula}</p>
                        {e.juzgado && <p className="text-xs text-ink-400 truncate mt-0.5">{e.juzgado}</p>}
                      </td>
                    )}
                    {visibleCols.includes("fuero") && (
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-ink-600">{e.fuero ?? <span className="text-ink-300">—</span>}</span>
                      </td>
                    )}
                    {visibleCols.includes("estado") && (
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${ESTADO_BADGE[e.estado]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[e.estado]}`} />
                          {ESTADO_LABELS[e.estado]}
                        </span>
                      </td>
                    )}
                    {visibleCols.includes("created_at") && (
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-ink-400">
                          {new Date(e.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })}
                        </span>
                      </td>
                    )}
                    {visibleCols.includes("cliente") && (
                      <td className="px-4 py-3.5 max-w-[160px]">
                        {e.cliente_nombre
                          ? <span className="text-sm text-ink-700 truncate block">{e.cliente_nombre}</span>
                          : <span className="text-ink-300 text-xs">—</span>}
                      </td>
                    )}
                    {visibleCols.includes("equipo") && (
                      <td className="px-4 py-3.5">
                        {e.abogados.length > 0 ? (
                          <div className="flex items-center -space-x-1.5">
                            {e.abogados.slice(0, 3).map((a) => {
                              const initials = (a.full_name ?? "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                              return (
                                <div key={a.id} title={a.full_name ?? ""} className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 border-2 border-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                  {initials}
                                </div>
                              );
                            })}
                            {e.abogados.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-ink-100 text-ink-500 border-2 border-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                +{e.abogados.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-300 text-xs">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          </div>
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
