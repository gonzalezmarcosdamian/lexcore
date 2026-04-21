"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente, Movimiento, Vencimiento, Honorario, Tarea, Documento, ActividadItem, EstadoExpediente, RolEnExpediente } from "@/lib/api";
import { HonorariosTab } from "./honorarios-tab";
import { DocumentosTab } from "./documentos-tab";
import { TareasSection } from "./tareas-section";
import { ResumenIASection } from "./resumen-ia-section";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SectionCollapsible({ title, count, badge, children, defaultOpen = false, disabled = false }: {
  title: string; count?: number; badge?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen && !disabled);
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${disabled ? "bg-ink-50 border-ink-100 opacity-60" : "bg-white border-ink-100"}`}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition ${disabled ? "cursor-not-allowed" : "hover:bg-ink-50"}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${disabled ? "text-ink-400" : "text-ink-700"}`}>{title}</span>
          {count !== undefined && <span className="text-xs bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5 font-medium">{count}</span>}
          {badge}
        </div>
        {!disabled && <ChevronIcon open={open} />}
        {disabled && (
          <span className="text-[10px] font-medium text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">Próximamente</span>
        )}
      </button>
      {open && !disabled && <div className="border-t border-ink-50">{children}</div>}
    </div>
  );
}

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

function tiempoVida(created_at: string): string {
  const ms = Date.now() - new Date(created_at).getTime();
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (dias < 30) return `${dias} día${dias !== 1 ? "s" : ""}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} mes${meses !== 1 ? "es" : ""}`;
  const anios = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  return mesesRest > 0 ? `${anios} año${anios !== 1 ? "s" : ""} y ${mesesRest} mes${mesesRest !== 1 ? "es" : ""}` : `${anios} año${anios !== 1 ? "s" : ""}`;
}

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
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [actividad, setActividad] = useState<ActividadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ numero: "", caratula: "", fuero: "", juzgado: "", estado: "activo" as EstadoExpediente, cliente_id: "" });
  const [saving, setSaving] = useState(false);

  // Bitácora — entrada manual
  const [nuevoMov, setNuevoMov] = useState("");
  const [savingMov, setSavingMov] = useState(false);

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

  const loadActividad = useCallback(async () => {
    if (!token) return;
    const items = await api.get<ActividadItem[]>(`/expedientes/${id}/actividad`, token);
    setActividad(items);
  }, [token, id]);

  const loadVencimientos = useCallback(async () => {
    if (!token) return;
    const vencs = await api.get<Vencimiento[]>("/vencimientos", token, { expediente_id: id });
    setVencimientos(vencs);
  }, [token, id]);

  const loadSummaryData = useCallback(async () => {
    if (!token) return;
    const [movs, hons, tars, docs] = await Promise.all([
      api.get<Movimiento[]>(`/expedientes/${id}/movimientos`, token),
      api.get<Honorario[]>("/honorarios", token, { expediente_id: id }).catch(() => [] as Honorario[]),
      api.get<Tarea[]>("/tareas", token, { expediente_id: id }).catch(() => [] as Tarea[]),
      api.get<Documento[]>("/documentos", token, { expediente_id: id }).catch(() => [] as Documento[]),
    ]);
    setMovimientos(movs);
    setHonorarios(hons);
    setTareas(tars);
    setDocumentos(docs);
  }, [token, id]);

  useEffect(() => {
    loadActividad();
    loadVencimientos();
    loadSummaryData();
  }, [loadActividad, loadVencimientos, loadSummaryData]);

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
      await api.post<Movimiento>(`/expedientes/${id}/movimientos`, { texto: nuevoMov }, token);
      setNuevoMov("");
      loadActividad();
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
  const pendientasTareas = tareas.filter((t) => t.estado !== "hecha").length;
  const totalHonorariosARS = honorarios.filter(h => h.moneda === "ARS").reduce((s, h) => s + h.monto_acordado, 0);
  const saldoPendienteARS = honorarios.filter(h => h.moneda === "ARS").reduce((s, h) => s + h.saldo_pendiente, 0);
  const proximoVenc = vencimientos.filter(v => !v.cumplido).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

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
              <span className="inline-flex items-center gap-1 text-xs text-ink-400 bg-ink-50 border border-ink-100 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {tiempoVida(expediente.created_at)}
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

        {/* ── Columna derecha ── */}
        <div className="min-w-0 space-y-3">

          {/* ── BITÁCORA (protagonista) ── */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-ink-50">
              <h2 className="text-sm font-semibold text-ink-700">Bitácora</h2>
              <p className="text-xs text-ink-400 mt-0.5">Historial completo del expediente</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Entrada manual */}
              <form onSubmit={handleAddMov} className="flex gap-2">
                <textarea
                  value={nuevoMov}
                  onChange={(e) => setNuevoMov(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (nuevoMov.trim()) handleAddMov(e as unknown as React.FormEvent); } }}
                  placeholder="Registrá un movimiento procesal… (Enter para guardar)"
                  rows={2}
                  className="flex-1 bg-ink-50 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition resize-none border-0"
                />
                <button type="submit" disabled={savingMov || !nuevoMov.trim()} className="self-end bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50 flex-shrink-0">
                  {savingMov ? "…" : "Registrar"}
                </button>
              </form>

              {/* Feed */}
              {actividad.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-6">Sin actividad registrada</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-3 bottom-3 w-px bg-ink-100" />
                  <div className="space-y-2">
                    {actividad.map((item) => (
                      <ActividadRow key={`${item.tipo}-${item.id}`} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Honorarios */}
          <SectionCollapsible
            title="Honorarios"
            defaultOpen={false}
            badge={totalHonorariosARS > 0 ? (
              <span className="text-xs text-ink-500 font-normal">
                ${(totalHonorariosARS / 1000).toFixed(0)}k ARS
                {saldoPendienteARS > 0 && <span className="ml-1 text-amber-600 font-medium">· ${(saldoPendienteARS / 1000).toFixed(0)}k pendiente</span>}
              </span>
            ) : undefined}
          >
            {token && <div className="p-4"><HonorariosTab expedienteId={id} token={token} /></div>}
          </SectionCollapsible>

          {/* Vencimientos */}
          <SectionCollapsible
            title="Vencimientos"
            count={vencimientos.length}
            defaultOpen={false}
            badge={pendientesVenc > 0 ? (
              <span className="text-xs text-amber-600 font-medium">
                {pendientesVenc} pendiente{pendientesVenc !== 1 ? "s" : ""}
                {proximoVenc && <span className="text-ink-400 font-normal"> · próximo {new Date(proximoVenc.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>}
              </span>
            ) : <span className="text-xs text-green-600 font-medium">al día</span>}
          >
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <Link href={`/vencimientos/nuevo?expediente_id=${id}`} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm">
                  + Agregar
                </Link>
              </div>
              {vencimientos.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-4">Sin vencimientos registrados</p>
              ) : (
                <div className="space-y-2">
                  {vencimientos.map((v) => {
                    const esUrgente = urgente(v.fecha) && !v.cumplido;
                    return (
                      <div key={v.id} className={`bg-ink-50 rounded-xl border px-4 py-3 flex items-center gap-4 ${esUrgente ? "border-red-200 bg-red-50" : "border-ink-100"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${esUrgente ? "bg-red-100 text-red-600" : v.cumplido ? "bg-green-100 text-green-700" : "bg-ink-100 text-ink-600"}`}>
                              {new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            {esUrgente && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium border border-red-100">Urgente</span>}
                            {v.cumplido && <span className="text-xs text-green-600 font-medium">✓ Cumplido</span>}
                          </div>
                          <p className="text-sm text-ink-800">{v.descripcion}</p>
                          <p className="text-xs text-ink-400 mt-0.5">{v.tipo}</p>
                        </div>
                        {!v.cumplido && (
                          <button onClick={() => toggleVencCumplido(v.id, true)} className="border border-ink-200 text-ink-700 hover:bg-white rounded-xl px-3 py-1.5 text-xs font-medium transition flex-shrink-0">
                            Cumplido
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCollapsible>

          {/* Tareas */}
          <SectionCollapsible
            title="Tareas"
            defaultOpen={false}
            badge={pendientasTareas > 0 ? (
              <span className="text-xs text-brand-600 font-medium">{pendientasTareas} pendiente{pendientasTareas !== 1 ? "s" : ""}</span>
            ) : tareas.length > 0 ? <span className="text-xs text-green-600 font-medium">todas hechas</span> : undefined}
          >
            {token && <div className="p-4"><TareasSection expedienteId={id} token={token} /></div>}
          </SectionCollapsible>

          {/* Documentos */}
          <SectionCollapsible
            title="Documentos"
            count={documentos.length}
            defaultOpen={false}
            badge={documentos.length > 0 ? (
              <span className="text-xs text-ink-400">{documentos.filter(d => d.content_type === "application/pdf").length} PDF{documentos.filter(d => d.content_type === "application/pdf").length !== 1 ? "s" : ""}</span>
            ) : undefined}
          >
            {token && <div className="p-4"><DocumentosTab expedienteId={id} token={token} /></div>}
          </SectionCollapsible>

          {/* Resumen IA */}
          <SectionCollapsible
            title="Resumen IA"
            badge={
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-ink-100 text-ink-400 border border-ink-200 px-1.5 py-0.5 rounded-full">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                Beta
              </span>
            }
            defaultOpen={false}
            disabled={true}
          >
            {token && <ResumenIASection expedienteId={id} token={token} />}
          </SectionCollapsible>

        </div>
      </div>
    </div>
  );
}

// ── Fila de actividad ─────────────────────────────────────────────────────────

const ACTIVIDAD_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  movimiento: { color: "text-brand-600", bg: "bg-brand-100", icon: "📝" },
  honorario:  { color: "text-emerald-600", bg: "bg-emerald-100", icon: "💼" },
  pago:       { color: "text-green-600", bg: "bg-green-100", icon: "💵" },
  vencimiento:{ color: "text-amber-600", bg: "bg-amber-100", icon: "📅" },
  tarea:      { color: "text-purple-600", bg: "bg-purple-100", icon: "✅" },
  documento:  { color: "text-ink-600", bg: "bg-ink-100", icon: "📄" },
};

function ActividadRow({ item }: { item: ActividadItem }) {
  const cfg = ACTIVIDAD_CONFIG[item.tipo] ?? { color: "text-ink-600", bg: "bg-ink-100", icon: "•" };
  const meta = item.meta as Record<string, unknown>;
  return (
    <div className="relative flex items-start gap-3 pl-8">
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center text-base flex-shrink-0 z-10`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0 bg-ink-50 rounded-xl px-4 py-3 border border-ink-100">
        <p className="text-sm text-ink-800">{item.descripcion}</p>
        {item.tipo === "honorario" && meta.monto != null && (
          <p className="text-xs text-emerald-600 font-medium mt-0.5">{String(meta.moneda)} {Number(meta.monto).toLocaleString("es-AR")}</p>
        )}
        {item.tipo === "vencimiento" && meta.fecha != null && (
          <p className="text-xs text-amber-600 font-medium mt-0.5">
            {new Date(String(meta.fecha) + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
            {meta.cumplido ? " · ✓ cumplido" : ""}
          </p>
        )}
        {item.tipo === "tarea" && meta.estado != null && (
          <p className="text-xs text-ink-400 mt-0.5 capitalize">{String(meta.estado).replace("_", " ")}</p>
        )}
        <p className="text-xs text-ink-400 mt-1.5">
          {new Date(item.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
        </p>
      </div>
    </div>
  );
}
