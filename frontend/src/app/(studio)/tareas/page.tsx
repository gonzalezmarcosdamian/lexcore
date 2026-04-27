"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Tarea, TareaEstado, StudioUser } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esVencida(fecha: string | null | undefined, estado: TareaEstado): boolean {
  if (!fecha || estado === "hecha") return false;
  return new Date(fecha + "T23:59:59") < new Date();
}

function diasRestantes(fecha: string | null | undefined): { label: string; urgente: boolean } | null {
  if (!fecha) return null;
  const diff = Math.ceil((new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "Vencida", urgente: true };
  if (diff === 0) return { label: "Hoy", urgente: true };
  if (diff === 1) return { label: "Mañana", urgente: true };
  return { label: `${diff} días`, urgente: false };
}

const ESTADO_ORDER: TareaEstado[] = ["pendiente", "hecha"];

function nextEstado(e: TareaEstado): TareaEstado {
  const idx = ESTADO_ORDER.indexOf(e);
  return ESTADO_ORDER[(idx + 1) % ESTADO_ORDER.length];
}

// ── Componente TareaCard ──────────────────────────────────────────────────────

function TareaCard({ tarea, onToggle, onDetail }: { tarea: Tarea; onToggle: (t: Tarea) => void; onDetail: (t: Tarea) => void; }) {
  const vencida = esVencida(tarea.fecha_limite, tarea.estado);
  const dias = diasRestantes(tarea.fecha_limite);
  const hecha = tarea.estado === "hecha";
  const enCurso = tarea.estado === "en_curso";

  return (
    <div
      className={`
        group flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all
        ${hecha ? "bg-green-50/60 border-green-100 opacity-70" : vencida ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-white border-ink-100 hover:border-ink-200 hover:bg-ink-50 hover:shadow-sm"}
      `}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(tarea)}
        className="mt-0.5 flex-shrink-0 focus:outline-none"
        title={`Marcar como ${nextEstado(tarea.estado)}`}
      >
        {hecha ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : enCurso ? (
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 bg-blue-100 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-ink-300 bg-white group-hover:border-brand-400 transition" />
        )}
      </button>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <button onClick={() => onDetail(tarea)} className={`text-sm font-medium leading-snug text-left hover:text-brand-600 transition ${hecha ? "line-through text-ink-400" : "text-ink-900"}`}>
            {tarea.titulo}
          </button>
          {/* Badge estado */}
          <span className={`
            inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
            ${hecha ? "bg-green-100 text-green-700" : enCurso ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${hecha ? "bg-green-500" : enCurso ? "bg-blue-500" : "bg-yellow-500"}`} />
            {hecha ? "Hecha" : "Pendiente"}
          </span>
        </div>

        {tarea.descripcion && (
          <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{tarea.descripcion}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {dias && (
            <span className={`text-xs font-medium flex items-center gap-1 ${dias.urgente ? "text-red-600" : "text-ink-400"}`}>
              {dias.urgente && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {dias.label}
            </span>
          )}
          {tarea.responsable_nombre && (
            <span className="text-xs text-ink-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {tarea.responsable_nombre}
            </span>
          )}
          <Link
            href={`/expedientes/${tarea.expediente_id}`}
            className="text-xs text-brand-600 hover:text-brand-700 hover:underline ml-auto"
          >
            Ver expediente →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function TareasEmptyState({ hayFiltros }: { hayFiltros: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      {hayFiltros ? (
        <>
          <p className="text-base font-semibold text-ink-800 mb-1">Sin resultados</p>
          <p className="text-sm text-ink-400 max-w-xs">
            No hay tareas para los filtros aplicados. Probá con otros criterios.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-ink-800 mb-1">Sin tareas todavía</p>
          <p className="text-sm text-ink-400 max-w-xs mb-6">
            Las tareas se crean desde el detalle de cada expediente o con el botón <strong>+ Nueva tarea</strong> de arriba. Cada tarea tiene un responsable, fecha límite y estado.
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Link
              href="/expedientes"
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              Ver expedientes
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TareasSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 bg-ink-50 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TareasPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const router = useRouter();

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [miembros, setMiembros] = useState<StudioUser[]>([]);

  const [filtroEstado, setFiltroEstado] = useState<TareaEstado | "">("");
  const [filtroResponsable, setFiltroResponsable] = useState("");

  const fetchTareas = useCallback(() => {
    if (!token) return;
    const params: Record<string, string> = {};
    if (filtroEstado) params.estado = filtroEstado;
    if (filtroResponsable) params.responsable_id = filtroResponsable;
    setLoading(true);
    api.get<Tarea[]>("/tareas", token, params)
      .then(setTareas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, filtroEstado, filtroResponsable]);

  useEffect(() => { fetchTareas(); }, [fetchTareas]);

  // Re-fetch al volver a la página (visibilitychange)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchTareas(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchTareas]);

  useEffect(() => {
    if (!token) return;
    api.get<StudioUser[]>("/users", token).then(setMiembros).catch(() => {});
  }, [token]);

  const toggleEstado = async (tarea: Tarea) => {
    if (!token) return;
    const next = nextEstado(tarea.estado);
    const updated = await api.patch<Tarea>(`/tareas/${tarea.id}`, { estado: next }, token);
    setTareas(prev => prev.map(t => t.id === tarea.id ? updated : t));
  };

  const pendientes = tareas.filter(t => t.estado === "pendiente");
  const enCurso = tareas.filter(t => t.estado === "en_curso");
  const hechas = tareas.filter(t => t.estado === "hecha");
  const activas = [...pendientes, ...enCurso];
  const hayFiltros = !!(filtroEstado || filtroResponsable);
  const vencidas = activas.filter(t => esVencida(t.fecha_limite, t.estado)).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Tareas</h1>
          <p className="text-sm text-ink-400 mt-0.5">Todas las tareas activas del estudio</p>
        </div>
        <PageHelp
          title="Tareas"
          description="Las tareas son trabajo interno del estudio: redactar un escrito, llamar a un cliente, preparar una audiencia. Distintas de los vencimientos, que son plazos procesales."
          items={[
            { icon: "🟡", title: "Pendiente", description: "Tarea creada pero no iniciada. Aparece en el dashboard." },
            { icon: "🔵", title: "En curso", description: "El responsable ya la empezó. Clic en el círculo para avanzar el estado." },
            { icon: "✅", title: "Hecha", description: "Completada. Desaparece del dashboard pero queda en el historial." },
            { icon: "👤", title: "Responsable", description: "Miembro del equipo asignado a la tarea. Cualquier miembro del estudio puede cambiar el estado." },
            { icon: "❄️", title: "Paralizar tarea", description: "Marcá una tarea como paralizada cuando está bloqueada por factores externos. Queda visible con efecto visual congelado y filtro propio en la agenda." },
            { icon: "⚠️", title: "Diferencia con vencimientos", description: "Vencimiento = plazo procesal externo (audiencia, presentación, fecha fija). Tarea = trabajo interno del estudio (asignable, sin fecha obligatoria)." },
          ]}
          tip="Las tareas con fecha límite vencida aparecen marcadas en rojo. Podés filtrar por responsable para ver solo las tuyas."
        />
      </div>

      {/* Stats pills */}
      {!loading && tareas.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </span>
          {enCurso.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {enCurso.length} en curso
            </span>
          )}
          {hechas.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-100 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {hechas.length} hecha{hechas.length !== 1 ? "s" : ""}
            </span>
          )}
          {vencidas > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {vencidas} vencida{vencidas !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2.5 flex-wrap">
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as TareaEstado | "")}
          className="text-sm border border-ink-200 rounded-xl px-3 py-1.5 bg-white text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
                    <option value="hecha">Hecha</option>
        </select>
        <select
          value={filtroResponsable}
          onChange={e => setFiltroResponsable(e.target.value)}
          className="text-sm border border-ink-200 rounded-xl px-3 py-1.5 bg-white text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
        >
          <option value="">Todos los responsables</option>
          {miembros.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        {hayFiltros && (
          <button
            onClick={() => { setFiltroEstado(""); setFiltroResponsable(""); }}
            className="text-xs text-ink-400 hover:text-ink-600 px-2 transition"
          >
            Limpiar filtros ×
          </button>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <TareasSkeleton />
      ) : tareas.length === 0 ? (
        <TareasEmptyState hayFiltros={hayFiltros} />
      ) : (
        <div className="space-y-2">

          {/* Activas */}
          {activas.map(t => (
            <TareaCard key={t.id} tarea={t} onToggle={toggleEstado} onDetail={(t) => router.push(`/tareas/${t.id}`)} />
          ))}

          {/* Completadas */}
          {hechas.length > 0 && (
            <details className="group mt-2">
              <summary className="flex items-center gap-2 text-xs font-medium text-ink-400 cursor-pointer hover:text-ink-600 transition select-none list-none py-2">
                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {hechas.length} completada{hechas.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-2 space-y-2">
                {hechas.map(t => (
                  <TareaCard key={t.id} tarea={t} onToggle={toggleEstado} onDetail={(t) => router.push(`/tareas/${t.id}`)} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
