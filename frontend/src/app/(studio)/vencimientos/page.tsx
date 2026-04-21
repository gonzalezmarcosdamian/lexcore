"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Vencimiento, Expediente } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_LABELS: Record<string, string> = {
  vencimiento: "Vencimiento",
  audiencia: "Audiencia",
  presentacion: "Presentación",
  pericia: "Pericia",
  otro: "Otro",
};

const TIPO_COLORS: Record<string, string> = {
  vencimiento: "bg-ink-100 text-ink-600",
  audiencia: "bg-brand-50 text-brand-600",
  presentacion: "bg-amber-50 text-amber-700",
  pericia: "bg-purple-50 text-purple-700",
  otro: "bg-ink-100 text-ink-500",
};

function diasHasta(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function urgente(fecha: string): boolean {
  const diff = (new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff <= 48;
}

function mesLabel(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

type Periodo = "7" | "30" | "90" | "todos";
type EstadoFiltro = "pendientes" | "cumplidos";

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditVencimientoModal({
  v,
  token,
  onSaved,
  onClose,
}: {
  v: Vencimiento;
  token: string;
  onSaved: (updated: Vencimiento) => void;
  onClose: () => void;
}) {
  const [descripcion, setDescripcion] = useState(v.descripcion);
  const [fecha, setFecha] = useState(v.fecha);
  const [tipo, setTipo] = useState(v.tipo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { descripcion, fecha, tipo }, token);
      onSaved(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink-900">Editar vencimiento</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="vencimiento">Vencimiento</option>
              <option value="audiencia">Audiencia</option>
              <option value="presentacion">Presentación</option>
              <option value="pericia">Pericia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-ink-200 text-ink-600 rounded-xl py-2.5 text-sm font-medium hover:bg-ink-50 transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function SkeletonVencimiento() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 animate-pulse">
      <div className="w-12 h-14 bg-ink-100 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-ink-100 rounded w-2/3" />
        <div className="h-3 bg-ink-100 rounded w-1/3" />
      </div>
      <div className="w-24 h-8 bg-ink-100 rounded-xl flex-shrink-0" />
    </div>
  );
}

function VencimientoRow({
  v,
  exp,
  onCumplido,
  onEdit,
  onDelete,
  marcando,
  deleting,
}: {
  v: Vencimiento;
  exp?: Expediente;
  onCumplido: (id: string) => void;
  onEdit: (v: Vencimiento) => void;
  onDelete: (id: string) => void;
  marcando: string | null;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dias = diasHasta(v.fecha);
  const esUrgente = urgente(v.fecha) && !v.cumplido;
  const esCercano = !esUrgente && dias >= 0 && dias <= 7 && !v.cumplido;

  const fecha = new Date(v.fecha + "T00:00:00");
  const dia = fecha.getDate();
  const mes = MESES[fecha.getMonth()].slice(0, 3);

  const badgeColor = v.cumplido
    ? "bg-ink-100 text-ink-400"
    : esUrgente
    ? "bg-red-100 text-red-700"
    : esCercano
    ? "bg-amber-100 text-amber-700"
    : "bg-brand-50 text-brand-600";

  return (
    <div className={`group flex items-center gap-4 px-4 py-3.5 ${v.cumplido ? "opacity-60" : ""}`}>
      {/* Date badge */}
      <div className={`flex-shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center ${badgeColor}`}>
        <span className="text-lg font-bold leading-none">{dia}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide leading-none mt-0.5">{mes}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold text-ink-900 truncate ${v.cumplido ? "line-through text-ink-400" : ""}`}>
          {v.descripcion}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[v.tipo] ?? "bg-ink-100 text-ink-500"}`}>
            {TIPO_LABELS[v.tipo] ?? v.tipo}
          </span>
          {exp ? (
            <Link href={`/expedientes/${exp.id}`} className="text-xs text-brand-600 hover:underline font-medium truncate max-w-[180px]">
              {exp.numero}
              {exp.cliente_nombre ? ` · ${exp.cliente_nombre}` : ""}
            </Link>
          ) : (
            <span className="text-xs text-ink-400 font-mono">{v.expediente_id.slice(0, 8).toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button
            onClick={() => { onDelete(v.id); setConfirmDelete(false); }}
            disabled={deleting === v.id}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-semibold transition disabled:opacity-50"
          >
            Sí
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2.5 py-1.5 rounded-lg hover:bg-ink-50 transition">
            No
          </button>
        </div>
      ) : v.cumplido ? (
        <span className="flex-shrink-0 flex items-center gap-1 text-xs text-green-600 font-semibold">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Cumplido
        </span>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Edit */}
          <button
            onClick={() => onEdit(v)}
            title="Editar"
            className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition lg:opacity-0 lg:group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            title="Eliminar"
            className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition lg:opacity-0 lg:group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
          {/* Cumplido */}
          <button
            onClick={() => onCumplido(v.id)}
            disabled={marcando === v.id}
            className="flex items-center gap-1.5 text-xs border border-ink-200 text-ink-600 hover:bg-ink-50 hover:border-ink-300 px-3 py-1.5 rounded-xl transition disabled:opacity-50 ml-1"
          >
            {marcando === v.id ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Cumplido
          </button>
        </div>
      )}
    </div>
  );
}

export default function VencimientosPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("pendientes");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [marcando, setMarcando] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vencimiento | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<{ google_refresh_token?: string | null; google_calendar_id?: string | null }>("/users/me", token)
      .then((p) => setCalendarConnected(Boolean(p.google_refresh_token && p.google_calendar_id)))
      .catch(() => {});
    api.get<Expediente[]>("/expedientes", token)
      .then(setExpedientes).catch(() => {});
  }, [token]);

  const expLookup = useMemo(() => {
    const map: Record<string, Expediente> = {};
    for (const e of expedientes) map[e.id] = e;
    return map;
  }, [expedientes]);

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await api.post<{ synced: number; errors: number }>("/vencimientos/sync-calendar", {}, token);
      setSyncMsg(`✓ ${res.synced} vencimientos sincronizados`);
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        cumplido: estadoFiltro === "cumplidos",
      };
      if (periodo !== "todos") params.proximos = Number(periodo);
      const data = await api.get<Vencimiento[]>("/vencimientos", token, params);
      setVencimientos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar vencimientos");
    } finally {
      setLoading(false);
    }
  }, [token, periodo, estadoFiltro]);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => {
    let lista = vencimientos;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((v) => v.descripcion.toLowerCase().includes(q));
    }
    if (tipoFiltro) {
      lista = lista.filter((v) => v.tipo === tipoFiltro);
    }
    return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [vencimientos, busqueda, tipoFiltro]);

  const urgentes = useMemo(
    () => estadoFiltro === "pendientes" ? filtrados.filter((v) => urgente(v.fecha)) : [],
    [filtrados, estadoFiltro]
  );

  const estaSemana = useMemo(() => {
    return filtrados.filter((v) => {
      const d = diasHasta(v.fecha);
      return d >= 0 && d <= 7;
    }).length;
  }, [filtrados]);

  const agrupados = useMemo(() => {
    const map = new Map<string, Vencimiento[]>();
    for (const v of filtrados) {
      const key = mesLabel(v.fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return map;
  }, [filtrados]);

  const marcarCumplido = async (id: string) => {
    if (!token) return;
    setMarcando(id);
    try {
      await api.patch(`/vencimientos/${id}`, { cumplido: true }, token);
      setVencimientos((prev) => prev.filter((v) => v.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al marcar cumplido");
    } finally {
      setMarcando(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(id);
    try {
      await api.delete(`/vencimientos/${id}`, token);
      setVencimientos((prev) => prev.filter((v) => v.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = (updated: Vencimiento) => {
    setVencimientos((prev) => prev.map((v) => v.id === updated.id ? updated : v));
    setEditing(null);
  };

  return (
    <div>
      {editing && token && (
        <EditVencimientoModal
          v={editing}
          token={token}
          onSaved={handleSaved}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Vencimientos</h1>
          <p className="text-sm text-ink-400 mt-0.5">Fechas y plazos críticos del estudio</p>
        </div>
        <div className="flex items-center gap-2">
          {calendarConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl px-3 py-2.5 text-sm font-medium transition disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {syncing ? "Sincronizando…" : "Sync Calendar"}
              </button>
              {syncMsg && <span className="text-xs text-ink-500">{syncMsg}</span>}
            </div>
          ) : (
            <Link
              href="/perfil"
              title="Conectá tu Google Calendar desde tu perfil"
              className="flex items-center gap-1.5 border border-ink-200 text-ink-400 bg-white hover:border-ink-300 hover:text-ink-600 rounded-xl px-3 py-2.5 text-sm font-medium transition opacity-70"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Sync Calendar
            </Link>
          )}
          <PageHelp
            title="Vencimientos y Agenda"
            description="Control de plazos, audiencias y fechas críticas del estudio"
            items={[
              { icon: "🔴", title: "Urgente (< 48hs)", description: "Los vencimientos en menos de 48 horas aparecen en rojo." },
              { icon: "🟡", title: "Esta semana", description: "Los que vencen en los próximos 7 días se muestran en amarillo." },
              { icon: "✅", title: "Marcar cumplido", description: "Al marcar cumplido desaparece de pendientes y queda en historial." },
              { icon: "✏️", title: "Editar / Eliminar", description: "Pasá el mouse sobre un vencimiento para ver las opciones de editar y eliminar." },
              { icon: "🔍", title: "Filtros", description: "Filtrá por período, tipo o estado." },
            ]}
            tip="Los vencimientos urgentes también aparecen destacados en el Dashboard."
          />
          <Link
            href="/vencimientos/nuevo"
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
          >
            + Nuevo
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Buscar por descripción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full sm:w-52 sm:focus:w-80 bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
        />
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
          className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
        >
          <option value="7">Próximos 7 días</option>
          <option value="30">Próximos 30 días</option>
          <option value="90">Próximos 90 días</option>
          <option value="todos">Todos</option>
        </select>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
        >
          <option value="">Todos los tipos</option>
          <option value="vencimiento">Vencimiento</option>
          <option value="audiencia">Audiencia</option>
          <option value="presentacion">Presentación</option>
          <option value="pericia">Pericia</option>
          <option value="otro">Otro</option>
        </select>
        <div className="flex bg-ink-100 rounded-xl p-1 gap-1">
          {(["pendientes", "cumplidos"] as EstadoFiltro[]).map((e) => (
            <button
              key={e}
              onClick={() => setEstadoFiltro(e)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                estadoFiltro === e
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {e === "pendientes" ? "Pendientes" : "Cumplidos"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {!loading && filtrados.length > 0 && (
        <div className="flex gap-4 mb-5 flex-wrap">
          <div className="bg-white rounded-xl border border-ink-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-ink-900">{filtrados.length}</span>
            <span className="text-sm text-ink-400">total</span>
          </div>
          {estadoFiltro === "pendientes" && urgentes.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-red-600">{urgentes.length}</span>
              <span className="text-sm text-red-500">urgentes</span>
            </div>
          )}
          {estadoFiltro === "pendientes" && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-amber-600">{estaSemana}</span>
              <span className="text-sm text-amber-500">esta semana</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
          {[1, 2, 3, 4].map((i) => <SkeletonVencimiento key={i} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-16 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-ink-600 font-medium">
            {busqueda || tipoFiltro
              ? "Sin resultados para el filtro aplicado"
              : estadoFiltro === "cumplidos"
              ? "No hay vencimientos cumplidos en este período"
              : "No hay vencimientos pendientes en este período"}
          </p>
          {estadoFiltro === "pendientes" && !busqueda && !tipoFiltro && (
            <p className="text-ink-400 text-sm mt-1">
              Probá con otro período o{" "}
              <Link href="/vencimientos/nuevo" className="text-brand-600 hover:underline">
                creá uno nuevo
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {urgentes.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-red-100">
                <span className="text-red-600 font-semibold text-sm">
                  ⚠ {urgentes.length}{" "}
                  {urgentes.length === 1 ? "vencimiento urgente" : "vencimientos urgentes"} (menos de 48hs)
                </span>
              </div>
              <div className="divide-y divide-red-100">
                {urgentes.map((v) => (
                  <VencimientoRow key={v.id} v={v} exp={expLookup[v.expediente_id]} onCumplido={marcarCumplido} onEdit={setEditing} onDelete={handleDelete} marcando={marcando} deleting={deleting} />
                ))}
              </div>
            </div>
          )}

          {Array.from(agrupados.entries()).map(([mes, items]) => (
            <div key={mes}>
              <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1">
                {mes}
              </h2>
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
                {items.map((v) => (
                  <VencimientoRow key={v.id} v={v} exp={expLookup[v.expediente_id]} onCumplido={marcarCumplido} onEdit={setEditing} onDelete={handleDelete} marcando={marcando} deleting={deleting} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
