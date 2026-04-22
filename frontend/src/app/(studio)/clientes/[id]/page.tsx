"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Cliente, Expediente, TipoCliente, EstadoExpediente, Tarea, Vencimiento } from "@/lib/api";
import { AddressAutocomplete, AddressValue } from "@/components/ui/address-autocomplete";

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
  const [vencPorExp, setVencPorExp] = useState<Record<string, Vencimiento[]>>({});
  const [tareasCliente, setTareasCliente] = useState<Tarea[]>([]);
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
            Promise.all(exps.map(e => api.get<Vencimiento[]>("/vencimientos", token!, { expediente_id: e.id }))),
          ] : []),
        ];
        const results = await Promise.all(fetchPromises);
        setTareasCliente(results[0] as Tarea[]);
        if (exps.length > 0) {
          const tareasArr = results[1] as Tarea[][];
          const vencArr = results[2] as Vencimiento[][];
          const tMap: Record<string, Tarea[]> = {};
          const vMap: Record<string, Vencimiento[]> = {};
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
    if (!token || !confirm("¿Confirmar archivar este cliente? Esta acción se puede revertir.")) return;
    try {
      await api.delete(`/clientes/${id}`, token);
      router.push("/clientes");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al archivar");
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
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm mb-4">
        <Link href="/clientes" className="text-ink-400 hover:text-ink-600 transition">
          Clientes
        </Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-700 font-medium truncate">{cliente.nombre}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-ink-900 truncate">{cliente.nombre}</h1>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
            cliente.archivado
              ? "bg-ink-100 text-ink-500"
              : "bg-green-50 text-green-700"
          }`}
        >
          {cliente.archivado ? "Archivado" : "Activo"}
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            <svg className="w-4 h-4 inline-block mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
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
                    <div className="text-right">
                      <p className="text-sm text-ink-900 font-medium">{cliente.domicilio}</p>
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
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-600 mb-3 uppercase tracking-wide">
              Expedientes vinculados
            </h2>
            {expedientes.length === 0 ? (
              <p className="text-xs text-ink-400 py-2">Sin expedientes asociados</p>
            ) : (
              <div className="space-y-3">
                {expedientes.map((exp) => {
                  const vencsPend = (vencPorExp[exp.id] ?? []).filter(v => !v.cumplido);
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
                            <button key={v.id} onClick={() => router.push(`/vencimientos/${v.id}`)} className="w-full flex items-center gap-2 text-left hover:text-brand-600 transition group/item">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                              <span className="text-xs text-ink-600 truncate group-hover/item:text-brand-600">{v.descripcion}</span>
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
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-ink-600 mb-3 uppercase tracking-wide">Tareas</h2>
              <div className="space-y-1.5">
                {tareasCliente.map(t => {
                  const exp = t.expediente_id ? expLookup[t.expediente_id] : undefined;
                  const vencida = t.fecha_limite && t.fecha_limite < new Date().toISOString().split("T")[0];
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

          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-ink-600 mb-3 uppercase tracking-wide">
              Acciones
            </h2>
            <div className="space-y-2">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="w-full border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-4 py-2.5 text-sm font-medium transition text-left"
                >
                  Editar cliente
                </button>
              )}
              {!cliente.archivado && (
                <button
                  onClick={handleArchivar}
                  className="w-full border border-red-100 text-red-600 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm font-medium transition text-left"
                >
                  Archivar cliente
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
