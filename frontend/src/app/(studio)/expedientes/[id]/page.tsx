"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Expediente, Movimiento, Vencimiento, EstadoExpediente, RolEnExpediente } from "@/lib/api";
import { HonorariosTab } from "./honorarios-tab";
import { DocumentosTab } from "./documentos-tab";

const ESTADO_BADGE: Record<EstadoExpediente, string> = {
  activo: "bg-green-50 text-green-700",
  archivado: "bg-ink-100 text-ink-500",
  cerrado: "bg-red-50 text-red-600",
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

type Tab = "info" | "movimientos" | "abogados" | "vencimientos" | "honorarios" | "documentos";

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-ink-50 last:border-0">
      <span className="text-sm text-ink-400 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink-900 font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function urgente(fecha: string): boolean {
  const diff = (new Date(fecha).getTime() - Date.now()) / (1000 * 60 * 60);
  return diff >= 0 && diff <= 48;
}

export default function ExpedienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = session?.user?.backendToken;

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    numero: "",
    caratula: "",
    fuero: "",
    juzgado: "",
    estado: "activo" as EstadoExpediente,
    cliente_id: "",
  });
  const [saving, setSaving] = useState(false);

  const [nuevoMov, setNuevoMov] = useState("");
  const [savingMov, setSavingMov] = useState(false);

  const [movLoaded, setMovLoaded] = useState(false);
  const [vencLoaded, setVencLoaded] = useState(false);

  const [newUserId, setNewUserId] = useState("");
  const [newRol, setNewRol] = useState<RolEnExpediente>("colaborador");
  const [savingAbogado, setSavingAbogado] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<Expediente>(`/expedientes/${id}`, token)
      .then((exp) => {
        setExpediente(exp);
        setForm({
          numero: exp.numero,
          caratula: exp.caratula,
          fuero: exp.fuero ?? "",
          juzgado: exp.juzgado ?? "",
          estado: exp.estado,
          cliente_id: exp.cliente_id ?? "",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const loadMovimientos = useCallback(async () => {
    if (!token || movLoaded) return;
    try {
      const movs = await api.get<Movimiento[]>(`/expedientes/${id}/movimientos`, token);
      setMovimientos(movs);
      setMovLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar movimientos");
    }
  }, [token, id, movLoaded]);

  const loadVencimientos = useCallback(async () => {
    if (!token || vencLoaded) return;
    try {
      const vencs = await api.get<Vencimiento[]>("/vencimientos", token, { expediente_id: id });
      setVencimientos(vencs);
      setVencLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar vencimientos");
    }
  }, [token, id, vencLoaded]);

  useEffect(() => {
    if (tab === "movimientos") loadMovimientos();
    if (tab === "vencimientos") loadVencimientos();
  }, [tab, loadMovimientos, loadVencimientos]);

  const handleSaveInfo = async () => {
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Expediente>(
        `/expedientes/${id}`,
        {
          ...form,
          fuero: form.fuero || undefined,
          juzgado: form.juzgado || undefined,
          cliente_id: form.cliente_id || undefined,
        },
        token
      );
      setExpediente(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!expediente) return;
    setForm({
      numero: expediente.numero,
      caratula: expediente.caratula,
      fuero: expediente.fuero ?? "",
      juzgado: expediente.juzgado ?? "",
      estado: expediente.estado,
      cliente_id: expediente.cliente_id ?? "",
    });
    setEditing(false);
  };

  const handleAddMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !nuevoMov.trim()) return;
    setSavingMov(true);
    try {
      const mov = await api.post<Movimiento>(`/expedientes/${id}/movimientos`, { texto: nuevoMov }, token);
      setMovimientos((prev) => [mov, ...prev]);
      setNuevoMov("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al agregar movimiento");
    } finally {
      setSavingMov(false);
    }
  };

  const handleAddAbogado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newUserId.trim()) return;
    setSavingAbogado(true);
    try {
      const updated = await api.post<Expediente>(
        `/expedientes/${id}/abogados`,
        { user_id: newUserId, rol: newRol },
        token
      );
      setExpediente(updated);
      setNewUserId("");
      setNewRol("colaborador");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al agregar abogado");
    } finally {
      setSavingAbogado(false);
    }
  };

  const toggleVencCumplido = async (vencId: string, cumplido: boolean) => {
    if (!token) return;
    try {
      await api.patch(`/vencimientos/${vencId}`, { cumplido }, token);
      setVencimientos((prev) => prev.map((v) => (v.id === vencId ? { ...v, cumplido } : v)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar vencimiento");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-3xl">
        <div className="h-5 bg-ink-100 rounded w-1/3" />
        <div className="h-8 bg-ink-100 rounded w-1/2" />
        <div className="h-64 bg-ink-100 rounded-2xl mt-6" />
      </div>
    );
  }

  if (!expediente) {
    return (
      <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
        {error || "Expediente no encontrado"}
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "movimientos", label: "Movimientos" },
    { key: "abogados", label: "Abogados" },
    { key: "vencimientos", label: "Vencimientos" },
    { key: "honorarios", label: "Honorarios" },
    { key: "documentos", label: "Documentos" },
  ];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm mb-4">
        <Link href="/expedientes" className="text-ink-400 hover:text-ink-600 transition">
          Expedientes
        </Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-700 font-mono font-medium">{expediente.numero}</span>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-ink-900 font-mono">{expediente.numero}</h1>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${ESTADO_BADGE[expediente.estado]}`}
        >
          {ESTADO_LABELS[expediente.estado]}
        </span>
      </div>
      <p className="text-base text-ink-600 mb-6">{expediente.caratula}</p>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b border-ink-100 mb-5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide">
                Datos del expediente
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-xs font-medium transition"
                >
                  Editar
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <InputField
                  label="Número"
                  value={form.numero}
                  onChange={(v) => setForm({ ...form, numero: v })}
                  mono
                />
                <InputField
                  label="Carátula"
                  value={form.caratula}
                  onChange={(v) => setForm({ ...form, caratula: v })}
                />
                <InputField
                  label="Fuero"
                  value={form.fuero}
                  onChange={(v) => setForm({ ...form, fuero: v })}
                />
                <InputField
                  label="Juzgado"
                  value={form.juzgado}
                  onChange={(v) => setForm({ ...form, juzgado: v })}
                />
                <InputField
                  label="ID de cliente"
                  value={form.cliente_id}
                  onChange={(v) => setForm({ ...form, cliente_id: v })}
                />
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoExpediente })}
                    className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                  >
                    <option value="activo">Activo</option>
                    <option value="archivado">Archivado</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-4 py-2.5 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveInfo}
                    disabled={saving}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <FieldRow label="Número" value={expediente.numero} />
                <FieldRow label="Carátula" value={expediente.caratula} />
                <FieldRow label="Fuero" value={expediente.fuero} />
                <FieldRow label="Juzgado" value={expediente.juzgado} />
                <FieldRow label="Estado" value={ESTADO_LABELS[expediente.estado]} />
                {expediente.cliente_id && (
                  <FieldRow label="Cliente ID" value={expediente.cliente_id} />
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 h-fit">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-4">
              Metadatos
            </h2>
            <FieldRow
              label="Creado"
              value={new Date(expediente.created_at).toLocaleDateString("es-AR")}
            />
            <FieldRow
              label="Actualizado"
              value={new Date(expediente.updated_at).toLocaleDateString("es-AR")}
            />
            <FieldRow
              label="Abogados"
              value={`${expediente.abogados.length} asignado${expediente.abogados.length !== 1 ? "s" : ""}`}
            />
          </div>
        </div>
      )}

      {tab === "movimientos" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-3">
              Nuevo movimiento
            </h2>
            <form onSubmit={handleAddMov} className="space-y-3">
              <textarea
                value={nuevoMov}
                onChange={(e) => setNuevoMov(e.target.value)}
                placeholder="Describí el movimiento procesal…"
                rows={3}
                className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingMov || !nuevoMov.trim()}
                  className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {savingMov ? "Agregando…" : "Agregar movimiento"}
                </button>
              </div>
            </form>
          </div>

          {movimientos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-12 flex flex-col items-center gap-2">
              <p className="text-sm text-ink-400">Sin movimientos registrados</p>
            </div>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-6 top-2 bottom-2 w-px bg-ink-100" />
              <div className="space-y-3">
                {movimientos.map((m) => (
                  <div key={m.id} className="relative bg-white rounded-2xl border border-ink-100 shadow-sm px-5 py-4 ml-4">
                    <div className="absolute -left-6 top-4 w-2.5 h-2.5 rounded-full bg-brand-400 border-2 border-white" />
                    <p className="text-sm text-ink-800 whitespace-pre-wrap">{m.texto}</p>
                    <p className="text-xs text-ink-400 mt-2">
                      {new Date(m.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "abogados" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-3">
              Abogados asignados
            </h2>
            {expediente.abogados.length === 0 ? (
              <p className="text-sm text-ink-400 py-2">Sin abogados asignados</p>
            ) : (
              <div className="divide-y divide-ink-50">
                {expediente.abogados.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-mono text-ink-700">{a.user_id}</p>
                    </div>
                    <span className="text-xs bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full font-medium">
                      {ROL_LABELS[a.rol]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-3">
              Agregar abogado
            </h2>
            <form onSubmit={handleAddAbogado} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">ID de usuario</label>
                <input
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="UUID del usuario…"
                  className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Rol</label>
                <select
                  value={newRol}
                  onChange={(e) => setNewRol(e.target.value as RolEnExpediente)}
                  className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                >
                  <option value="responsable">Responsable</option>
                  <option value="colaborador">Colaborador</option>
                  <option value="supervision">Supervisión</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingAbogado || !newUserId.trim()}
                  className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {savingAbogado ? "Agregando…" : "Agregar abogado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "vencimientos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide">
              Vencimientos del expediente
            </h2>
            <Link
              href={`/vencimientos/nuevo?expediente_id=${id}`}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              + Agregar vencimiento
            </Link>
          </div>

          {vencimientos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-12 flex flex-col items-center gap-3">
              <p className="text-sm text-ink-400">Sin vencimientos registrados</p>
              <Link
                href={`/vencimientos/nuevo?expediente_id=${id}`}
                className="text-sm text-brand-600 hover:underline font-medium"
              >
                Agregar el primero
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {vencimientos.map((v) => {
                const esUrgente = urgente(v.fecha) && !v.cumplido;
                return (
                  <div
                    key={v.id}
                    className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-4 ${
                      esUrgente ? "border-red-200" : "border-ink-100"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
                            esUrgente
                              ? "bg-red-50 text-red-600"
                              : v.cumplido
                              ? "bg-green-50 text-green-700"
                              : "bg-ink-50 text-ink-600"
                          }`}
                        >
                          {v.fecha}
                        </span>
                        {esUrgente && (
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                            Urgente
                          </span>
                        )}
                        {v.cumplido && (
                          <span className="text-xs text-green-600 font-medium flex-shrink-0">
                            ✓ Cumplido
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink-800 mt-1">{v.descripcion}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{v.tipo}</p>
                    </div>
                    {!v.cumplido && (
                      <button
                        onClick={() => toggleVencCumplido(v.id, true)}
                        className="border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-xs font-medium transition flex-shrink-0"
                      >
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

      {tab === "honorarios" && token && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide mb-4">Honorarios</h2>
          <HonorariosTab expedienteId={id} token={token} />
        </div>
      )}

      {tab === "documentos" && token && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-600 uppercase tracking-wide">Documentos</h2>
          </div>
          <DocumentosTab expedienteId={id} token={token} />
        </div>
      )}
    </div>
  );
}
