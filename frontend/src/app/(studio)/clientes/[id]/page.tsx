"use client";

import { useState, useEffect } from "react";
import { todayAR } from "@/lib/date";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Cliente, Expediente, TipoCliente, EstadoExpediente, Tarea, Movimiento, CuentaCorriente } from "@/lib/api";
import { AddressAutocomplete, AddressValue } from "@/components/ui/address-autocomplete";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const ESTADO_EXP_COLORS: Record<EstadoExpediente, string> = {
  activo: "bg-green-50 text-green-700",
  archivado: "bg-ink-100 text-ink-500",
  cerrado: "bg-red-50 text-red-600",
};

const ESTADO_EXP_LABELS: Record<EstadoExpediente, string> = {
  activo: "Activo",
  archivado: "Archivado",
  cerrado: "Cerrado",
};

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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
      />
    </div>
  );
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.backendToken;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [tareasPorExp, setTareasPorExp] = useState<Record<string, Tarea[]>>({});
  const [vencPorExp, setVencPorExp] = useState<Record<string, Movimiento[]>>({});
  const [tareasCliente, setTareasCliente] = useState<Tarea[]>([]);
  const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorriente | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "fisica" as TipoCliente,
    cuit_dni: "",  // legacy
    dni: "",
    cuit: "",
    telefono: "",
    email: "",
    domicilio: "",
    domicilio_lat: undefined as number | undefined,
    domicilio_lng: undefined as number | undefined,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmArchivar, setConfirmArchivar] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<Cliente>(`/clientes/${id}`, token),
      api.get<Expediente[]>("/expedientes", token, { cliente_id: id }),
    ])
      .then(async ([c, exps]) => {
        setCliente(c);
        setExpedientes(exps);
        // Fetch tareas del cliente (sin expediente) + tareas/vencimientos por expediente
        const fetchPromises: [Promise<Tarea[]>, ...Promise<unknown>[]] = [
          api.get<Tarea[]>("/tareas", token!, { cliente_id: id }),
          ...(exps.length > 0 ? [
            Promise.all(exps.map(e => api.get<Tarea[]>("/tareas", token!, { expediente_id: e.id }))),
            Promise.all(exps.map(e => api.get<Movimiento[]>("/vencimientos", token!, { expediente_id: e.id }))),
          ] : []),
        ];
        const results = await Promise.all(fetchPromises);
        setTareasCliente(results[0] as Tarea[]);
        if (exps.length > 0) {
          const tareasArr = results[1] as Tarea[][];
          const vencArr = results[2] as Movimiento[][];
          const tMap: Record<string, Tarea[]> = {};
          const vMap: Record<string, Movimiento[]> = {};
          exps.forEach((e, i) => { tMap[e.id] = tareasArr[i]; vMap[e.id] = vencArr[i]; });
          setTareasPorExp(tMap);
          setVencPorExp(vMap);
        }
        setForm({
          nombre: c.nombre,
          tipo: c.tipo,
          cuit_dni: c.cuit_dni ?? "",
          dni: c.dni ?? "",
          cuit: c.cuit ?? "",
          telefono: c.telefono ?? "",
          email: c.email ?? "",
          domicilio: c.domicilio ?? "",
          domicilio_lat: c.domicilio_lat ?? undefined,
          domicilio_lng: c.domicilio_lng ?? undefined,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    api.get<CuentaCorriente>(`/clientes/${id}/cuenta-corriente`, token)
      .then(setCuentaCorriente)
      .catch(() => {});
  }, [id, token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Cliente>(
        `/clientes/${id}`,
        {
          nombre: form.nombre,
          tipo: form.tipo,
          dni: form.dni || undefined,
          cuit: form.cuit || undefined,
          telefono: form.telefono || undefined,
          email: form.email || undefined,
          domicilio: form.domicilio || undefined,
          domicilio_lat: form.domicilio_lat,
          domicilio_lng: form.domicilio_lng,
        },
        token
      );
      setCliente(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleArchivar = async () => {
    if (!token) return;
    try {
      await api.delete(`/clientes/${id}`, token);
      router.push("/clientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al archivar");
    }
  };

  const handleEliminar = async () => {
    if (!token) return;
    setEliminando(true);
    try {
      await api.delete(`/clientes/${id}/eliminar`, token);
      router.push("/clientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setEliminando(false);
    }
  };

  const handleCancelEdit = () => {
    if (!cliente) return;
    setForm({
      nombre: cliente.nombre,
      tipo: cliente.tipo,
      cuit_dni: cliente.cuit_dni ?? "",
      dni: cliente.dni ?? "",
      cuit: cliente.cuit ?? "",
      telefono: cliente.telefono ?? "",
      email: cliente.email ?? "",
      domicilio: cliente.domicilio ?? "",
      domicilio_lat: cliente.domicilio_lat ?? undefined,
      domicilio_lng: cliente.domicilio_lng ?? undefined,
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-4xl">
        <div className="h-5 bg-ink-100 rounded w-1/4" />
        <div className="h-8 bg-ink-100 rounded w-1/2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 bg-ink-100 rounded-2xl h-64" />
          <div className="bg-ink-100 rounded-2xl h-40" />
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
        {error || "Cliente no encontrado"}
      </div>
    );
  }

  const expLookup = Object.fromEntries(expedientes.map(e => [e.id, e]));

  return (
    <div className="max-w-4xl pb-28 lg:pb-6">
      {confirmArchivar && (
        <ConfirmModal
          title="¿Archivar este cliente?"
          description="Podés revertirlo después desde la lista de clientes archivados."
          confirmLabel="Archivar"
          onConfirm={() => { setConfirmArchivar(false); handleArchivar(); }}
          onCancel={() => setConfirmArchivar(false)}
        />
      )}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">Eliminar cliente permanentemente</p>
                <p className="text-xs text-ink-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            {expedientes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠️ Este cliente tiene <strong>{expedientes.length} expediente{expedientes.length > 1 ? "s" : ""}</strong>. Los expedientes se conservan pero quedarán sin cliente asociado.
                </p>
              </div>
            )}
            <p className="text-sm text-ink-600">¿Seguro que querés eliminar a <strong>{cliente?.nombre}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEliminar(false)} className="flex-1 border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
              <button onClick={() => { setConfirmEliminar(false); handleEliminar(); }} disabled={eliminando} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs mb-3">
        <Link href="/clientes" className="text-ink-400 hover:text-ink-600 transition">Clientes</Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-600 font-medium truncate">{cliente.nombre}</span>
      </div>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 truncate">{cliente.nombre}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${cliente.archivado ? "bg-ink-100 text-ink-500" : "bg-green-50 text-green-700"}`}>
                {cliente.archivado ? "Archivado" : "Activo"}
              </span>
            </div>
            {(cliente.telefono || cliente.email) && (
              <p className="text-sm text-ink-400 mt-0.5 truncate">
                {[cliente.telefono, cliente.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setEditing(true)} className="border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-sm font-medium transition flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                <span className="hidden sm:inline">Editar</span>
              </button>
              {!cliente.archivado && (<>
                <button onClick={() => setConfirmEliminar(true)} className="border border-red-200 text-red-700 hover:bg-red-50 rounded-xl px-3 py-1.5 text-sm font-medium transition hidden sm:block">
                  Eliminar
                </button>
                <button onClick={() => setConfirmArchivar(true)} className="border border-ink-200 text-ink-600 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-sm font-medium transition hidden sm:block">
                  Archivar
                </button>
              </>)}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-ink-600 mb-4 uppercase tracking-wide">
              Información del cliente
            </h2>

            {editing ? (
              <div className="space-y-4">
                <InputField
                  label="Nombre"
                  value={form.nombre}
                  onChange={(v) => setForm({ ...form, nombre: v })}
                />
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-2">Tipo de persona</label>
                  <div className="flex gap-6">
                    {(["fisica", "juridica"] as TipoCliente[]).map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm cursor-pointer text-ink-700">
                        <input
                          type="radio"
                          name="tipo"
                          value={t}
                          checked={form.tipo === t}
                          onChange={() => setForm({ ...form, tipo: t })}
                          className="text-brand-600"
                        />
                        {t === "fisica" ? "Persona física" : "Persona jurídica"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="DNI"
                    value={form.dni}
                    onChange={(v) => setForm({ ...form, dni: v })}
                  />
                  <InputField
                    label="CUIT"
                    value={form.cuit}
                    onChange={(v) => setForm({ ...form, cuit: v })}
                  />
                </div>
                <InputField
                  label="Teléfono"
                  value={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Domicilio</label>
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
                    <a href={`https://maps.google.com/?q=${form.domicilio_lat},${form.domicilio_lng}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Ver en mapa
                    </a>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-4 py-2.5 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <FieldRow
                  label="Tipo"
                  value={cliente.tipo === "fisica" ? "Persona física" : "Persona jurídica"}
                />
                <FieldRow label="DNI" value={cliente.dni ?? cliente.cuit_dni} />
                <FieldRow label="CUIT" value={cliente.cuit} />
                <FieldRow label="Teléfono" value={cliente.telefono} />
                <FieldRow label="Email" value={cliente.email} />
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-ink-50 last:border-0">
                  <span className="text-sm text-ink-400 flex-shrink-0">Domicilio</span>
                  {cliente.domicilio ? (
                    <div className="text-right max-w-[60%]">
                      <p className="text-sm text-ink-900 font-medium line-clamp-2" title={cliente.domicilio}>{formatDomicilio(cliente.domicilio)}</p>
                      {cliente.domicilio_lat && (
                        <a href={`https://maps.google.com/?q=${cliente.domicilio_lat},${cliente.domicilio_lng}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          Ver en mapa
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-ink-900 font-medium">—</span>
                  )}
                </div>
                <FieldRow
                  label="Alta"
                  value={new Date(cliente.created_at).toLocaleDateString("es-AR")}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink-600 mb-3 uppercase tracking-wide">
              Expedientes vinculados
            </h2>
            {expedientes.length === 0 ? (
              <p className="text-xs text-ink-400 py-2">Sin expedientes asociados</p>
            ) : (
              <div className="space-y-3">
                {expedientes.map((exp) => {
                  const vencsPend = (vencPorExp[exp.id] ?? []).filter(v => v.estado !== "cumplido");
                  const tareasPend = (tareasPorExp[exp.id] ?? []).filter(t => t.estado !== "hecha");
                  return (
                    <div key={exp.id} className="rounded-xl border border-ink-100 overflow-hidden">
                      <Link href={`/expedientes/${exp.id}`} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-ink-50 transition group">
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-medium text-ink-800 group-hover:text-brand-600 transition truncate">{exp.numero}</p>
                          <p className="text-xs text-ink-400 truncate">{exp.caratula}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_EXP_COLORS[exp.estado]}`}>
                          {ESTADO_EXP_LABELS[exp.estado]}
                        </span>
                      </Link>
                      {(vencsPend.length > 0 || tareasPend.length > 0) && (
                        <div className="border-t border-ink-50 px-3 py-2 space-y-1 bg-ink-50/30">
                          {vencsPend.slice(0, 3).map(v => (
                            <button key={v.id} onClick={() => router.push(`/movimientos/${v.id}`)} className="w-full flex items-center gap-2 text-left hover:text-brand-600 transition group/item">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                              <span className="text-xs text-ink-600 truncate group-hover/item:text-brand-600">{v.titulo}</span>
                              <span className="text-[10px] text-ink-400 flex-shrink-0 ml-auto">{new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
                            </button>
                          ))}
                          {tareasPend.slice(0, 3).map(t => (
                            <button key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="w-full flex items-center gap-2 text-left hover:text-brand-600 transition group/item">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="text-xs text-ink-600 truncate group-hover/item:text-brand-600">{t.titulo}</span>
                              {t.fecha_limite && <span className="text-[10px] text-ink-400 flex-shrink-0 ml-auto">{new Date(t.fecha_limite + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {tareasCliente.length > 0 && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-ink-600 mb-3 uppercase tracking-wide">Tareas</h2>
              <div className="space-y-1.5">
                {tareasCliente.map(t => {
                  const exp = t.expediente_id ? expLookup[t.expediente_id] : undefined;
                  const vencida = t.fecha_limite && t.fecha_limite < todayAR();
                  return (
                    <button key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-ink-50 transition group/t">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.estado === "hecha" ? "bg-green-400" : t.estado === "en_curso" ? "bg-blue-400" : "bg-ink-300"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate group-hover/t:text-brand-600 transition ${t.estado === "hecha" ? "line-through text-ink-400" : "text-ink-800"}`}>{t.titulo}</p>
                        {exp && <p className="text-[10px] text-ink-400 truncate">{exp.numero}</p>}
                      </div>
                      {t.fecha_limite && (
                        <span className={`text-[10px] flex-shrink-0 font-medium ${vencida && t.estado !== "hecha" ? "text-red-500" : "text-ink-400"}`}>
                          {new Date(t.fecha_limite + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Cuenta Corriente ── */}
      {cuentaCorriente && (cuentaCorriente.expedientes.some(e => e.honorarios.length > 0 || e.ingresos.length > 0) || cuentaCorriente.ingresos_directos.length > 0) && (
        <div className="mt-6">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-700 uppercase tracking-wide">Cuenta Corriente</h2>
            </div>

            {/* KPIs globales */}
            {(() => {
              const g = cuentaCorriente.totales_globales;
              const tieneARS = g.ARS.acordado > 0 || g.ARS.cobrado > 0;
              const tieneUSD = g.USD.acordado > 0 || g.USD.cobrado > 0;
              return (tieneARS || tieneUSD) ? (
                <div className={`grid grid-cols-1 ${tieneARS && tieneUSD ? "sm:grid-cols-2" : ""} gap-px bg-ink-100`}>
                  {tieneARS && <KpiMoneda moneda="ARS" t={g.ARS} />}
                  {tieneUSD && <KpiMoneda moneda="USD" t={g.USD} />}
                </div>
              ) : null;
            })()}

            {/* Por expediente */}
            {cuentaCorriente.expedientes.filter(e => e.honorarios.length > 0 || e.ingresos.length > 0).map(exp => (
              <ExpedienteCuentaRow key={exp.id} exp={exp} />
            ))}

            {/* Ingresos directos sin expediente */}
            {cuentaCorriente.ingresos_directos.length > 0 && (
              <div className="border-t border-ink-100">
                <div className="px-5 py-3 bg-ink-50/40">
                  <p className="text-xs font-semibold text-ink-600">Ingresos sin expediente</p>
                </div>
                <div className="divide-y divide-ink-50">
                  {cuentaCorriente.ingresos_directos.map(ing => (
                    <IngresoRow key={ing.id} ing={ing} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes Cuenta Corriente ──────────────────────────────────────────

function fmt(n: number, moneda: string) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + (moneda === "USD" ? " USD" : "");
}

function KpiMoneda({ moneda, t }: { moneda: string; t: { acordado: number; cobrado: number; saldo: number } }) {
  const pct = t.acordado > 0 ? Math.min(100, Math.round((t.cobrado / t.acordado) * 100)) : 0;
  return (
    <div className="bg-white px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">{moneda}</span>
        {t.saldo > 0
          ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Saldo ${fmt(t.saldo, moneda)}</span>
          : t.acordado > 0 && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Al día</span>
        }
      </div>
      {/* Filas verticales en mobile — más legibles que 3 cols */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-400">Acordado</span>
          <span className="text-sm font-bold text-ink-800">${fmt(t.acordado, moneda)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-400">Cobrado</span>
          <span className="text-sm font-bold text-green-700">${fmt(t.cobrado, moneda)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-400">Pendiente</span>
          <span className={`text-sm font-bold ${t.saldo > 0 ? "text-red-600" : "text-ink-400"}`}>${fmt(t.saldo, moneda)}</span>
        </div>
      </div>
      {t.acordado > 0 && (
        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function ExpedienteCuentaRow({ exp }: { exp: import("@/lib/api").ExpedienteCuenta }) {
  const [open, setOpen] = useState(true);
  const tieneDeuda = exp.totales.ARS.saldo > 0 || exp.totales.USD.saldo > 0;

  return (
    <div className="border-t border-ink-100">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50/50 transition text-left">
        <svg className={`w-4 h-4 text-ink-400 transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-800 font-mono">{exp.numero}</p>
          <p className="text-xs text-ink-400 truncate">{exp.caratula}</p>
        </div>
        {tieneDeuda
          ? <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">Con deuda</span>
          : <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">Al día</span>
        }
      </button>

      {open && (
        <div className="pb-2 space-y-2">
          {exp.honorarios.map(h => (
            <div key={h.id} className="mx-3 rounded-xl border border-ink-100 overflow-hidden">
              {/* Header honorario */}
              <div className="px-3 py-2.5 bg-ink-50/40 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-700 flex-1 min-w-0">{h.concepto}</p>
                  {Number(h.saldo_pendiente) > 0
                    ? <span className="text-xs font-bold text-red-600 flex-shrink-0">Saldo ${fmt(Number(h.saldo_pendiente), h.moneda)}</span>
                    : <span className="text-xs font-bold text-green-600 flex-shrink-0">✓ Pagado</span>
                  }
                </div>
                <p className="text-[10px] text-ink-400">{h.fecha_acuerdo} · Acordado <span className="font-semibold text-ink-600">${fmt(Number(h.monto_acordado), h.moneda)} {h.moneda}</span></p>
              </div>
              {/* Pagos */}
              {h.pagos.length > 0 && (
                <div className="divide-y divide-ink-50">
                  {h.pagos.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-ink-600 capitalize">{p.tipo}</span>
                        {p.comprobante && <span className="text-[10px] text-ink-400 ml-1.5 truncate">{p.comprobante}</span>}
                      </div>
                      <span className="text-[10px] text-ink-400 flex-shrink-0">{p.fecha}</span>
                      <span className="text-xs font-semibold text-green-700 flex-shrink-0">${fmt(Number(p.importe), p.moneda)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {exp.ingresos.map(ing => (
            <div key={ing.id} className="mx-3">
              <IngresoRow ing={ing} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDomicilio(domicilio: string): string {
  const parts = domicilio.split(",").map(p => p.trim()).filter(Boolean);
  const filtered = parts.filter(p =>
    !/(municipio|pedanía|pedania|departamento|partido de|argentina)/i.test(p)
  );
  return filtered.slice(0, 4).join(", ");
}

function IngresoRow({ ing }: { ing: import("@/lib/api").Ingreso }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-ink-100 bg-blue-50/30">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink-700 truncate">{ing.descripcion}</p>
        <p className="text-[10px] text-ink-400">{ing.fecha} · <span className="capitalize">{ing.categoria.replace(/_/g, " ")}</span></p>
      </div>
      <span className="text-xs font-semibold text-blue-700 flex-shrink-0">${fmt(Number(ing.monto), ing.moneda)}</span>
    </div>
  );
}
