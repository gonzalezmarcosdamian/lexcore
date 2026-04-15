"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente, Movimiento, Vencimiento, EstadoExpediente, RolEnExpediente } from "@/lib/api";
import { HonorariosTab } from "./honorarios-tab";
import { DocumentosTab } from "./documentos-tab";

// ── Constants ─────────────────────────────────────────────────────────────────

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
const ESTADO_LABELS: Record<EstadoExpediente, string> = {
  activo: "Activo",
  archivado: "Archivado",
  cerrado: "Cerrado",
};
const ROL_LABELS: Record<RolEnExpediente, string> = {
  responsable: "Responsable",
  colaborador: "Colaborador",
  supervision: "Supervisión",
};
const ROL_BADGE: Record<RolEnExpediente, string> = {
  responsable: "bg-brand-50 text-brand-700 border-brand-100",
  colaborador: "bg-ink-100 text-ink-600 border-ink-200",
  supervision: "bg-purple-50 text-purple-700 border-purple-100",
};

type RightTab = "movimientos" | "vencimientos" | "honorarios" | "documentos";

function urgente(fecha: string): boolean {
  const diff = (new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff <= 48;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-ink-50 last:border-0">
      <span className="text-sm text-ink-400 flex-shrink-0 w-24">{label}</span>
      <span className="text-sm text-ink-900 font-medium text-right flex-1">{value || <span className="text-ink-300">—</span>}</span>
    </div>
  );
}

const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelCls = "block text-xs font-medium text-ink-500 mb-1";

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("movimientos");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ numero: "", caratula: "", fuero: "", juzgado: "", estado: "activo" as EstadoExpediente, cliente_id: "" });
  const [saving, setSaving] = useState(false);

  // Movimientos
  const [nuevoMov, setNuevoMov] = useState("");
  const [savingMov, setSavingMov] = useState(false);
  const [movLoaded, setMovLoaded] = useState(false);

  // Vencimientos
  const [vencLoaded, setVencLoaded] = useState(false);

  // Equipo colapsable
  const [equipoOpen, setEquipoOpen] = useState(true);

  // Agregar abogado
  const [newUserId, setNewUserId] = useState("");
  const [newRol, setNewRol] = useState<RolEnExpediente>("colaborador");
  const [savingAbogado, setSavingAbogado] = useState(false);
  const [addingAbogado, setAddingAbogado] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<Expediente>(`/expedientes/${id}`, token)
      .then((exp) => {
        setExpediente(exp);
        setForm({ numero: exp.numero, caratula: exp.caratula, fuero: exp.fuero ?? "", juzgado: exp.juzgado ?? "", estado: exp.estado, cliente_id: exp.cliente_id ?? "" });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const loadMovimientos = useCallback(async () => {
    if (!token || movLoaded) return;
    const movs = await api.get<Movimiento[]>(`/expedientes/${id}/movimientos`, token);
    setMovimientos(movs);
    setMovLoaded(true);
  }, [token, id, movLoaded]);

  const loadVencimientos = useCallback(async () => {
    if (!token || vencLoaded) return;
    const vencs = await api.get<Vencimiento[]>("/vencimientos", token, { expediente_id: id });
    setVencimientos(vencs);
    setVencLoaded(true);
  }, [token, id, vencLoaded]);

  useEffect(() => {
    if (rightTab === "movimientos") loadMovimientos();
    if (rightTab === "vencimientos") loadVencimientos();
  }, [rightTab, loadMovimientos, loadVencimientos]);

  const handleSaveInfo = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.patch<Expediente>(`/expedientes/${id}`, { ...form, fuero: form.fuero || undefined, juzgado: form.juzgado || undefined, cliente_id: form.cliente_id || undefined }, token);
      setExpediente(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !nuevoMov.trim()) return;
    setSavingMov(true);
    try {
      const mov = await api.post<Movimiento>(`/expedientes/${id}/movimientos`, { texto: nuevoMov }, token);
      setMovimientos((prev) => [mov, ...prev]);
      setNuevoMov("");
    } catch { } finally { setSavingMov(false); }
  };

  const handleAddAbogado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newUserId.trim()) return;
    setSavingAbogado(true);
    try {
      const updated = await api.post<Expediente>(`/expedientes/${id}/abogados`, { user_id: newUserId, rol: newRol }, token);
      setExpediente(updated);
      setNewUserId("");
      setAddingAbogado(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al agregar abogado");
    } finally { setSavingAbogado(false); }
  };

  const handleRemoveAbogado = async (userId: string) => {
    if (!token) return;
    try {
      await api.delete(`/expedientes/${id}/abogados/${userId}`, token);
      setExpediente((prev) => prev ? { ...prev, abogados: prev.abogados.filter((a) => a.user_id !== userId) } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al quitar abogado");
    }
  };

  const toggleVencCumplido = async (vencId: string, cumplido: boolean) => {
    if (!token) return;
    await api.patch(`/vencimientos/${vencId}`, { cumplido }, token);
    setVencimientos((prev) => prev.map((v) => v.id === vencId ? { ...v, cumplido } : v));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-5 bg-ink-100 rounded w-48" />
        <div className="h-8 bg-ink-100 rounded w-96 mt-2" />
        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="col-span-1 h-64 bg-ink-100 rounded-2xl" />
          <div className="col-span-2 h-64 bg-ink-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!expediente) {
    return <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error || "Expediente no encontrado"}</div>;
  }

  const pendientesVenc = vencimientos.filter((v) => !v.cumplido).length;

  const RIGHT_TABS: { key: RightTab; label: string; count?: number }[] = [
    { key: "movimientos", label: "Movimientos", count: movimientos.length || undefined },
    { key: "vencimientos", label: "Vencimientos", count: pendientesVenc || undefined },
    { key: "honorarios", label: "Honorarios" },
    { key: "documentos", label: "Documentos" },
  ];

  return (
    <div className="space-y-4 pb-10">

      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/expedientes" className="text-ink-400 hover:text-ink-600 transition">Expedientes</Link>
          <span className="text-ink-300">/</span>
          <span className="text-ink-600 font-mono font-medium">{expediente.numero}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-ink-900 font-mono">{expediente.numero}</h1>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${ESTADO_BADGE[expediente.estado]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[expediente.estado]}`} />
                {ESTADO_LABELS[expediente.estado]}
              </span>
            </div>
            <p className="text-base text-ink-600 mt-1">{expediente.caratula}</p>
            {(expediente.fuero || expediente.juzgado) && (
              <p className="text-sm text-ink-400 mt-0.5">
                {[expediente.fuero, expediente.juzgado].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex-shrink-0 border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-sm font-medium transition">
              Editar
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}

      {/* Formulario de edición (inline sobre el header) */}
      {editing && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 max-w-2xl space-y-3">
          <h3 className="text-sm font-semibold text-ink-700 mb-1">Editar expediente</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Número</label>
              <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoExpediente })} className={inputCls}>
                <option value="activo">Activo</option>
                <option value="archivado">Archivado</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Carátula</label>
              <input value={form.caratula} onChange={(e) => setForm({ ...form, caratula: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fuero</label>
              <input value={form.fuero} onChange={(e) => setForm({ ...form, fuero: e.target.value })} className={inputCls} placeholder="Civil, Laboral…" />
            </div>
            <div>
              <label className={labelCls}>Juzgado</label>
              <input value={form.juzgado} onChange={(e) => setForm({ ...form, juzgado: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setEditing(false); }} className="flex-1 border border-ink-200 text-ink-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
            <button onClick={handleSaveInfo} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      )}

      {/* Layout principal: 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

        {/* ── Columna izquierda: datos + equipo ── */}
        <div className="space-y-4">

          {/* Datos del expediente */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Datos</p>
            <FieldRow label="Número" value={expediente.numero} />
            <FieldRow label="Fuero" value={expediente.fuero} />
            <FieldRow label="Juzgado" value={expediente.juzgado} />
            <FieldRow label="Estado" value={ESTADO_LABELS[expediente.estado]} />
            <FieldRow label="Alta" value={new Date(expediente.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })} />
            <FieldRow label="Actualizado" value={new Date(expediente.updated_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })} />
          </div>

          {/* Equipo colapsable */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setEquipoOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-ink-50 transition"
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Equipo</p>
                <span className="text-xs bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5 font-medium">
                  {expediente.abogados.length}
                </span>
              </div>
              <svg className={`w-4 h-4 text-ink-400 transition-transform ${equipoOpen ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {equipoOpen && (
              <div className="border-t border-ink-50">
                {expediente.abogados.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-ink-400">Sin abogados asignados</p>
                ) : (
                  <div className="divide-y divide-ink-50">
                    {expediente.abogados.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3 group">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
                            {(a.full_name ?? a.user_id).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-800 truncate">
                              {a.full_name ?? <span className="font-mono text-xs text-ink-400">{a.user_id.slice(0, 8)}…</span>}
                            </p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${ROL_BADGE[a.rol]}`}>
                              {ROL_LABELS[a.rol]}
                            </span>
                          </div>
                        </div>
                        {a.rol !== "responsable" && (
                          <button
                            onClick={() => handleRemoveAbogado(a.user_id)}
                            className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500 transition p-1 rounded"
                            title="Quitar del equipo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar abogado */}
                {addingAbogado ? (
                  <form onSubmit={handleAddAbogado} className="border-t border-ink-50 px-5 py-3 space-y-2">
                    <div>
                      <label className={labelCls}>ID de usuario</label>
                      <input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} className={`${inputCls} font-mono text-xs`} placeholder="UUID del usuario…" autoFocus />
                    </div>
                    <div>
                      <label className={labelCls}>Rol</label>
                      <select value={newRol} onChange={(e) => setNewRol(e.target.value as RolEnExpediente)} className={inputCls}>
                        <option value="colaborador">Colaborador</option>
                        <option value="supervision">Supervisión</option>
                        <option value="responsable">Responsable</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAddingAbogado(false)} className="flex-1 text-xs border border-ink-200 text-ink-600 rounded-lg py-1.5 hover:bg-ink-50 transition">Cancelar</button>
                      <button type="submit" disabled={savingAbogado || !newUserId.trim()} className="flex-1 text-xs bg-brand-600 text-white rounded-lg py-1.5 disabled:opacity-50 hover:bg-brand-700 transition">{savingAbogado ? "…" : "Agregar"}</button>
                    </div>
                  </form>
                ) : (
                  <div className="border-t border-ink-50 px-5 py-2.5">
                    <button onClick={() => setAddingAbogado(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium transition">
                      + Agregar al equipo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: tabs de actividad ── */}
        <div className="min-w-0">

          {/* Tabs horizontales */}
          <div className="flex gap-0 border-b border-ink-100 mb-4 overflow-x-auto">
            {RIGHT_TABS.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setRightTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  rightTab === key
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-400 hover:text-ink-700"
                }`}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${rightTab === key ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Movimientos ── */}
          {rightTab === "movimientos" && (
            <div className="space-y-4">
              <form onSubmit={handleAddMov} className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4">
                <textarea
                  value={nuevoMov}
                  onChange={(e) => setNuevoMov(e.target.value)}
                  placeholder="Describí el movimiento procesal…"
                  rows={3}
                  className="w-full bg-ink-50 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition resize-none border-0"
                />
                <div className="flex justify-end mt-3">
                  <button type="submit" disabled={savingMov || !nuevoMov.trim()} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm disabled:opacity-50">
                    {savingMov ? "Agregando…" : "Registrar movimiento"}
                  </button>
                </div>
              </form>

              {movimientos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-12 text-center">
                  <p className="text-sm text-ink-400">Sin movimientos registrados</p>
                </div>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-7 top-2 bottom-2 w-px bg-ink-100" />
                  <div className="space-y-3">
                    {movimientos.map((m) => (
                      <div key={m.id} className="relative bg-white rounded-2xl border border-ink-100 shadow-sm px-5 py-4 ml-4">
                        <div className="absolute -left-6 top-4 w-2.5 h-2.5 rounded-full bg-brand-400 border-2 border-white" />
                        <p className="text-sm text-ink-800 whitespace-pre-wrap">{m.texto}</p>
                        <p className="text-xs text-ink-400 mt-2">
                          {new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Vencimientos ── */}
          {rightTab === "vencimientos" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Link href={`/vencimientos/nuevo?expediente_id=${id}`} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm">
                  + Agregar vencimiento
                </Link>
              </div>

              {vencimientos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-12 text-center">
                  <p className="text-sm text-ink-400">Sin vencimientos registrados</p>
                  <Link href={`/vencimientos/nuevo?expediente_id=${id}`} className="text-sm text-brand-600 hover:underline font-medium mt-2 inline-block">
                    Agregar el primero
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {vencimientos.map((v) => {
                    const esUrgente = urgente(v.fecha) && !v.cumplido;
                    return (
                      <div key={v.id} className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-4 ${esUrgente ? "border-red-200" : "border-ink-100"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${esUrgente ? "bg-red-50 text-red-600" : v.cumplido ? "bg-green-50 text-green-700" : "bg-ink-50 text-ink-600"}`}>
                              {new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            {esUrgente && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">Urgente</span>}
                            {v.cumplido && <span className="text-xs text-green-600 font-medium">✓ Cumplido</span>}
                          </div>
                          <p className="text-sm text-ink-800">{v.descripcion}</p>
                          <p className="text-xs text-ink-400 mt-0.5">{v.tipo}</p>
                        </div>
                        {!v.cumplido && (
                          <button onClick={() => toggleVencCumplido(v.id, true)} className="border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-xs font-medium transition flex-shrink-0">
                            Marcar cumplido
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Honorarios ── */}
          {rightTab === "honorarios" && token && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <HonorariosTab expedienteId={id} token={token} />
            </div>
          )}

          {/* ── Documentos ── */}
          {rightTab === "documentos" && token && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <DocumentosTab expedienteId={id} token={token} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
