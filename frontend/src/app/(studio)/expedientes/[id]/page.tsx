"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, Cliente, Expediente, Movimiento, Vencimiento, Honorario, Tarea, Documento, ActividadItem, EstadoExpediente, RolEnExpediente } from "@/lib/api";
import { HonorariosTab } from "./honorarios-tab";
import { DocumentosTab } from "./documentos-tab";
import { TareasSection } from "./tareas-section";
import { ResumenIASection } from "./resumen-ia-section";
import { AdjuntosInline } from "@/components/ui/adjuntos-inline";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function VencimientoCardExpediente({ v, token, onToggle, onUpdated, onDeleted }: {
  v: Vencimiento; token: string;
  onToggle: () => void;
  onUpdated: (v: Vencimiento) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [desc, setDesc] = useState(v.descripcion);
  const [fecha, setFecha] = useState(v.fecha);
  const [tipo, setTipo] = useState(v.tipo ?? "");
  const [saving, setSaving] = useState(false);
  const esUrgente = urgente(v.fecha) && !v.cumplido;

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Vencimiento>(`/vencimientos/${v.id}`, { descripcion: desc, fecha, tipo }, token);
      onUpdated(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const del = async () => {
    await api.delete(`/vencimientos/${v.id}`, token);
    onDeleted();
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-brand-200 px-4 py-3 space-y-3">
        <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            <option value="vencimiento">Vencimiento</option>
            <option value="audiencia">Audiencia</option>
            <option value="presentacion">Presentación</option>
            <option value="pericia">Pericia</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 border border-ink-200 text-ink-600 rounded-lg py-1.5 text-xs font-medium hover:bg-ink-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group bg-ink-50 rounded-xl border px-4 py-3 flex items-center gap-4 ${esUrgente ? "border-red-200 bg-red-50" : "border-ink-100"}`}>
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
        <AdjuntosInline vencimientoId={v.id} token={token} />
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
          <button onClick={del} className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg font-semibold">Sí</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs border border-ink-200 text-ink-600 px-2 py-1 rounded-lg hover:bg-ink-50">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition">
          {v.cumplido ? (
            <button onClick={onToggle} className="text-xs border border-green-200 text-green-700 hover:bg-green-50 rounded-lg px-2.5 py-1.5 font-medium transition">↩ Deshacer</button>
          ) : (
            <button onClick={onToggle} className="text-xs border border-ink-200 text-ink-700 hover:bg-white rounded-lg px-2.5 py-1.5 font-medium transition">Cumplido</button>
          )}
          <button onClick={() => setEditing(true)} title="Editar" className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Eliminar" className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      )}
    </div>
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

const LOCALIDADES_ARG = [
  // Córdoba (provincia)
  "Córdoba, Córdoba",
  "Alta Gracia, Córdoba","Arroyito, Córdoba","Bell Ville, Córdoba","Capilla del Monte, Córdoba",
  "Carlos Paz, Córdoba","Colonia Caroya, Córdoba","Cosquín, Córdoba","Cruz del Eje, Córdoba",
  "Dean Funes, Córdoba","Hernando, Córdoba","Jesús María, Córdoba","La Carlota, Córdoba",
  "La Falda, Córdoba","Laboulaye, Córdoba","Leones, Córdoba","Malagueño, Córdoba",
  "Marcos Juárez, Córdoba","Mendiolaza, Córdoba","Mina Clavero, Córdoba","Monte Cristo, Córdoba",
  "Morteros, Córdoba","Oliva, Córdoba","Oncativo, Córdoba","Pilar, Córdoba","Río Ceballos, Córdoba",
  "Río Cuarto, Córdoba","Río Primero, Córdoba","Río Segundo, Córdoba","Río Tercero, Córdoba",
  "Salsipuedes, Córdoba","San Francisco, Córdoba","San Marcos Sierras, Córdoba",
  "Unquillo, Córdoba","Villa Allende, Córdoba","Villa del Rosario, Córdoba",
  "Villa Dolores, Córdoba","Villa General Belgrano, Córdoba","Villa María, Córdoba",
  // Buenos Aires
  "Buenos Aires, CABA","La Plata, Buenos Aires","Mar del Plata, Buenos Aires",
  "Quilmes, Buenos Aires","Lomas de Zamora, Buenos Aires","Morón, Buenos Aires",
  "San Isidro, Buenos Aires","San Martín, Buenos Aires","Lanús, Buenos Aires",
  "Bahía Blanca, Buenos Aires","Tigre, Buenos Aires","Berazategui, Buenos Aires",
  "Florencio Varela, Buenos Aires","Merlo, Buenos Aires","Moreno, Buenos Aires",
  "Tres de Febrero, Buenos Aires","Vicente López, Buenos Aires","Avellaneda, Buenos Aires",
  "Almirante Brown, Buenos Aires","Esteban Echeverría, Buenos Aires","Tandil, Buenos Aires",
  "Pergamino, Buenos Aires","Junín, Buenos Aires","San Nicolás, Buenos Aires","Zárate, Buenos Aires",
  // Resto del país
  "Rosario, Santa Fe","Santa Fe, Santa Fe","Rafaela, Santa Fe","Venado Tuerto, Santa Fe",
  "Mendoza, Mendoza","San Rafael, Mendoza","Godoy Cruz, Mendoza",
  "Tucumán, Tucumán","Salta, Salta","Resistencia, Chaco","Corrientes, Corrientes",
  "Posadas, Misiones","Neuquén, Neuquén","Cipolletti, Río Negro","Bariloche, Río Negro",
  "Río Gallegos, Santa Cruz","Caleta Olivia, Santa Cruz","Ushuaia, Tierra del Fuego",
  "Rawson, Chubut","Comodoro Rivadavia, Chubut","Trelew, Chubut",
  "Viedma, Río Negro","Santa Rosa, La Pampa","General Pico, La Pampa",
  "San Luis, San Luis","San Juan, San Juan","La Rioja, La Rioja",
  "Catamarca, Catamarca","Santiago del Estero, Santiago del Estero",
  "Jujuy, Jujuy","Formosa, Formosa","Paraná, Entre Ríos","Concordia, Entre Ríos",
];

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

const TZ = "America/Argentina/Buenos_Aires";

function tiempoVida(created_at: string): string {
  const toDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const now = new Date();
  const created = new Date(created_at);
  const dias = Math.round((new Date(toDateStr(now)).getTime() - new Date(toDateStr(created)).getTime()) / (1000 * 60 * 60 * 24));
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

function ClienteRow({ id, nombre, isPrimary, disponibles, onReplace, onRemove }: {
  id: string; nombre: string; isPrimary: boolean;
  disponibles: Cliente[];
  onReplace?: (nuevoId: string) => Promise<void>;
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = disponibles.filter((c) => c.id !== id && (!search || c.nombre.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="py-1">
      {editing ? (
        <div className="relative">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => { setOpen(false); setEditing(false); setSearch(""); }, 150)}
            className="w-full bg-white border border-brand-300 rounded-xl px-3 py-1.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
            placeholder="Cambiar cliente…" autoFocus autoComplete="off"
          />
          {open && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
              {filtered.map((c) => (
                <button key={c.id} type="button"
                  onMouseDown={async () => { await onReplace?.(c.id); setEditing(false); setSearch(""); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-ink-50 transition text-ink-800"
                >{c.nombre}</button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 group">
          <Link href={`/clientes/${id}`} className="text-sm text-ink-800 hover:text-brand-600 transition truncate">{nombre}</Link>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
            {isPrimary && onReplace && (
              <button onClick={() => setEditing(true)} className="text-ink-300 hover:text-brand-500 transition" title="Cambiar">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" /></svg>
              </button>
            )}
            {!isPrimary && onRemove && (
              <button onClick={onRemove} className="text-ink-300 hover:text-red-500 transition" title="Quitar">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
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
  const [form, setForm] = useState({ numero: "", numero_judicial: "", caratula: "", fuero: "", juzgado: "", localidad: "", estado: "activo" as EstadoExpediente, cliente_id: "" });
  const [saving, setSaving] = useState(false);

  // Bitácora — entrada manual
  const [nuevoMov, setNuevoMov] = useState("");
  const [savingMov, setSavingMov] = useState(false);

  // Movimiento edit/delete
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [editingMovTexto, setEditingMovTexto] = useState("");
  const [editingMovFecha, setEditingMovFecha] = useState("");
  const [deletingMovId, setDeletingMovId] = useState<string | null>(null);

  // Equipo colapsable
  const [equipoOpen, setEquipoOpen] = useState(true);

  // Agregar abogado
  const [newUserId, setNewUserId] = useState("");
  const [newRol, setNewRol] = useState<RolEnExpediente>("colaborador");
  const [savingAbogado, setSavingAbogado] = useState(false);
  const [addingAbogado, setAddingAbogado] = useState(false);

  // Clientes (panel lateral)
  const [clientesDisponibles, setClientesDisponibles] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [addingCliente, setAddingCliente] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);

  // Modal edición — cliente + localidad combobox
  const [modalClienteSearch, setModalClienteSearch] = useState("");
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [localidadOpen, setLocalidadOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<Expediente>(`/expedientes/${id}`, token)
      .then((exp) => {
        setExpediente(exp);
        setForm({ numero: exp.numero, numero_judicial: exp.numero_judicial ?? "", caratula: exp.caratula, fuero: exp.fuero ?? "", juzgado: exp.juzgado ?? "", localidad: exp.localidad ?? "", estado: exp.estado, cliente_id: exp.cliente_id ?? "" });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    if (!token) return;
    api.get<Cliente[]>("/clientes", token).then(setClientesDisponibles).catch(() => {});
  }, [token]);

  const loadActividad = useCallback(async () => {
    if (!token) return;
    try {
      const items = await api.get<ActividadItem[]>(`/expedientes/${id}/actividad`, token);
      setActividad(items);
    } catch (e) { console.error("[bitácora]", e); }
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
      const updated = await api.patch<Expediente>(`/expedientes/${id}`, { ...form, numero_judicial: form.numero_judicial || undefined, fuero: form.fuero || undefined, juzgado: form.juzgado || undefined, localidad: form.localidad || undefined, cliente_id: form.cliente_id || undefined }, token);
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

  const handleSaveMov = async (movId: string) => {
    if (!token || !editingMovTexto.trim()) return;
    try {
      await api.patch(`/expedientes/${id}/movimientos/${movId}`, { texto: editingMovTexto, fecha_manual: editingMovFecha || undefined }, token);
      setEditingMovId(null);
      loadActividad();
    } catch { }
  };

  const handleDeleteMov = async (movId: string) => {
    if (!token) return;
    try {
      await api.delete(`/expedientes/${id}/movimientos/${movId}`, token);
      setDeletingMovId(null);
      loadActividad();
    } catch { }
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

  const handleAddCliente = async (clienteId: string) => {
    if (!token) return;
    setSavingCliente(true);
    try {
      const updated = await api.post<Expediente>(`/expedientes/${id}/clientes`, { cliente_id: clienteId }, token);
      setExpediente(updated);
      setClienteSearch("");
      setClienteOpen(false);
      setAddingCliente(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al agregar cliente");
    } finally {
      setSavingCliente(false);
    }
  };

  const handleRemoveCliente = async (clienteId: string) => {
    if (!token || !confirm("¿Quitar este cliente del expediente?")) return;
    try {
      await api.delete(`/expedientes/${id}/clientes/${clienteId}`, token);
      setExpediente((prev) => prev ? { ...prev, clientes_extra: prev.clientes_extra.filter((c) => c.id !== clienteId) } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al quitar cliente");
    }
  };

  const toggleVencCumplido = async (vencId: string, cumplido: boolean) => {
    if (!token) return;
    await api.patch(`/vencimientos/${vencId}`, { cumplido }, token);
    setVencimientos((prev) => prev.map((v) => v.id === vencId ? { ...v, cumplido } : v));
    loadActividad();
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
            {(expediente.juzgado || expediente.localidad || expediente.fuero) && (
              <p className="text-sm text-ink-400 mt-0.5">
                {[expediente.juzgado, expediente.localidad, expediente.fuero].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {!editing && (
            <button onClick={() => {
              setEditing(true);
              setModalClienteSearch(clientesDisponibles.find(c => c.id === expediente.cliente_id)?.nombre ?? "");
            }} className="flex-shrink-0 border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl px-3 py-1.5 text-sm font-medium transition">
              Editar
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
              <h3 className="text-base font-semibold text-ink-900">Editar expediente</h3>
              <button onClick={() => setEditing(false)} className="text-ink-400 hover:text-ink-600 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>N° Interno</label>
                  <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={`${inputCls} font-mono`} placeholder="EXP-2026-0001" />
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
                  <label className={labelCls}>N° de Expediente</label>
                  <input value={form.numero_judicial} onChange={(e) => setForm({ ...form, numero_judicial: e.target.value })} className={inputCls} placeholder="Ej: 13696006" />
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
                <div className="col-span-2 relative">
                  <label className={labelCls}>Localidad</label>
                  <input
                    value={form.localidad}
                    onChange={(e) => { setForm({ ...form, localidad: e.target.value }); setLocalidadOpen(true); }}
                    onFocus={() => setLocalidadOpen(true)}
                    onBlur={() => setTimeout(() => setLocalidadOpen(false), 150)}
                    className={inputCls} placeholder="Escribí para filtrar…" autoComplete="off"
                  />
                  {localidadOpen && form.localidad && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                      {LOCALIDADES_ARG.filter((l) => l.toLowerCase().includes(form.localidad.toLowerCase())).map((l) => (
                        <button key={l} type="button" onMouseDown={() => { setForm({ ...form, localidad: l }); setLocalidadOpen(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 transition text-ink-800">{l}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 relative">
                  <label className={labelCls}>Cliente principal</label>
                  <input
                    value={modalClienteSearch}
                    onChange={(e) => { setModalClienteSearch(e.target.value); setModalClienteOpen(true); if (!e.target.value) setForm({ ...form, cliente_id: "" }); }}
                    onFocus={() => setModalClienteOpen(true)}
                    onBlur={() => setTimeout(() => setModalClienteOpen(false), 150)}
                    className={`${inputCls} ${form.cliente_id ? "border-brand-300 bg-brand-50" : ""}`}
                    placeholder="Buscar cliente…" autoComplete="off"
                  />
                  {modalClienteOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                      {clientesDisponibles
                        .filter((c) => !modalClienteSearch || c.nombre.toLowerCase().includes(modalClienteSearch.toLowerCase()))
                        .map((c) => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { setForm({ ...form, cliente_id: c.id }); setModalClienteSearch(c.nombre); setModalClienteOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50 transition flex items-center justify-between ${form.cliente_id === c.id ? "bg-brand-50 text-brand-700 font-medium" : "text-ink-800"}`}
                          >
                            <span>{c.nombre}</span>
                            {form.cliente_id === c.id && <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        ))}
                      {clientesDisponibles.filter((c) => !modalClienteSearch || c.nombre.toLowerCase().includes(modalClienteSearch.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-sm text-ink-400">Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setEditing(false)} className="flex-1 border border-ink-200 text-ink-600 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
              <button onClick={handleSaveInfo} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            </div>
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
            <FieldRow label="N° Interno" value={expediente.numero} />
            {expediente.numero_judicial && <FieldRow label="N° Expediente" value={expediente.numero_judicial} />}
            <FieldRow label="Fuero" value={expediente.fuero} />
            <FieldRow label="Juzgado" value={expediente.juzgado} />
            {expediente.localidad && <FieldRow label="Localidad" value={expediente.localidad} />}
            <FieldRow label="Estado" value={ESTADO_LABELS[expediente.estado]} />
            <FieldRow label="Alta" value={new Date(expediente.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })} />
            <FieldRow label="Actualizado" value={new Date(expediente.updated_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })} />
          </div>

          {/* Clientes vinculados */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Clientes</p>
              <button onClick={() => { setAddingCliente((o) => !o); setClienteSearch(""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium transition">+ Agregar</button>
            </div>
            <div className="space-y-1">
              {!expediente.cliente_nombre && expediente.clientes_extra.length === 0 && (
                <p className="text-xs text-ink-400">Sin clientes asignados</p>
              )}
              {/* Cliente principal */}
              {expediente.cliente_nombre && (
                <ClienteRow
                  id={expediente.cliente_id!}
                  nombre={expediente.cliente_nombre}
                  isPrimary
                  disponibles={clientesDisponibles}
                  onReplace={async (nuevoId) => {
                    if (!token) return;
                    const updated = await api.patch<Expediente>(`/expedientes/${id}`, { cliente_id: nuevoId }, token);
                    setExpediente(updated);
                  }}
                  onRemove={undefined}
                />
              )}
              {/* Clientes adicionales (junction), excluyendo el principal */}
              {expediente.clientes_extra
                .filter((c) => c.id !== expediente.cliente_id)
                .map((c) => (
                  <ClienteRow
                    key={c.id}
                    id={c.id}
                    nombre={c.nombre}
                    isPrimary={false}
                    disponibles={[]}
                    onReplace={undefined}
                    onRemove={() => handleRemoveCliente(c.id)}
                  />
                ))}
            </div>
            {addingCliente && (
              <div className="mt-3 relative">
                <input
                  value={clienteSearch}
                  onChange={(e) => { setClienteSearch(e.target.value); setClienteOpen(true); }}
                  onFocus={() => setClienteOpen(true)}
                  onBlur={() => setTimeout(() => setClienteOpen(false), 150)}
                  className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                  placeholder="Buscar cliente…" autoFocus autoComplete="off"
                />
                {clienteOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {clientesDisponibles
                      .filter((c) => (!clienteSearch || c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())) && !expediente.clientes_extra.find((x) => x.id === c.id) && c.id !== expediente.cliente_id)
                      .map((c) => (
                        <button key={c.id} type="button" disabled={savingCliente}
                          onMouseDown={() => handleAddCliente(c.id)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50 transition text-ink-800"
                        >{c.nombre}</button>
                      ))}
                  </div>
                )}
              </div>
            )}
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

          {/* ── BITÁCORA (protagonista) ── */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-ink-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-700">Bitácora</h2>
                <p className="text-xs text-ink-400 mt-0.5">Historial completo del expediente</p>
              </div>
              <button
                onClick={loadActividad}
                title="Actualizar bitácora"
                className="text-ink-400 hover:text-brand-600 transition p-1.5 rounded-lg hover:bg-ink-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
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
              {(() => {
                // Agrupar documentos adjuntos dentro de su tarea/vencimiento padre
                type DocMeta = { nombre?: string; label?: string; size_bytes?: number; tarea_id?: string; vencimiento_id?: string };
                const adjuntosPor: Record<string, ActividadItem[]> = {};
                for (const item of actividad) {
                  if (item.tipo === "documento") {
                    const m = item.meta as DocMeta;
                    const parentId = m.tarea_id ?? m.vencimiento_id;
                    if (parentId) {
                      if (!adjuntosPor[parentId]) adjuntosPor[parentId] = [];
                      adjuntosPor[parentId].push(item);
                    }
                  }
                }
                const feedItems = actividad.filter(item => {
                  if (item.tipo !== "documento") return true;
                  const m = item.meta as DocMeta;
                  return !m.tarea_id && !m.vencimiento_id;
                });
                return feedItems.length === 0 ? (
                  <p className="text-sm text-ink-400 text-center py-6">Sin actividad registrada</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[18px] top-3 bottom-3 w-px bg-ink-100" />
                    <div className="space-y-2">
                      {feedItems.map((item) => (
                        <ActividadRow
                          key={`${item.tipo}-${item.id}`}
                          item={item}
                          adjuntos={adjuntosPor[item.id]}
                          editingMovId={editingMovId}
                          editingMovTexto={editingMovTexto}
                          editingMovFecha={editingMovFecha}
                          deletingMovId={deletingMovId}
                          onEditStart={(id, texto, fecha) => { setEditingMovId(id); setEditingMovTexto(texto); setEditingMovFecha(fecha ?? ""); }}
                          onEditSave={handleSaveMov}
                          onEditCancel={() => setEditingMovId(null)}
                          onEditChange={(texto) => setEditingMovTexto(texto)}
                          onFechaChange={(f) => setEditingMovFecha(f)}
                          onDeleteConfirm={() => setDeletingMovId(item.id)}
                          onDeleteCancel={() => setDeletingMovId(null)}
                          onDelete={handleDeleteMov}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Honorarios */}
          <SectionCollapsible
            title="Honorarios"
            count={honorarios.length}
            defaultOpen={false}
            badge={totalHonorariosARS > 0 ? (
              <span className="text-xs text-ink-500 font-normal">
                ${(totalHonorariosARS / 1000).toFixed(0)}k ARS
                {saldoPendienteARS > 0 && <span className="ml-1 text-amber-600 font-medium">· ${(saldoPendienteARS / 1000).toFixed(0)}k pendiente</span>}
              </span>
            ) : undefined}
          >
            {token && <div className="p-4"><HonorariosTab expedienteId={id} token={token} onCreated={loadActividad} /></div>}
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
                  {vencimientos.map((v) => (
                    <VencimientoCardExpediente
                      key={v.id}
                      v={v}
                      token={token!}
                      onToggle={() => toggleVencCumplido(v.id, !v.cumplido)}
                      onUpdated={(updated) => { setVencimientos(prev => prev.map(x => x.id === updated.id ? updated : x)); loadActividad(); }}
                      onDeleted={() => { setVencimientos(prev => prev.filter(x => x.id !== v.id)); loadActividad(); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </SectionCollapsible>

          {/* Tareas */}
          <SectionCollapsible
            title="Tareas"
            count={tareas.length}
            defaultOpen={false}
            badge={pendientasTareas > 0 ? (
              <span className="text-xs text-brand-600 font-medium">{pendientasTareas} pendiente{pendientasTareas !== 1 ? "s" : ""}</span>
            ) : tareas.length > 0 ? <span className="text-xs text-green-600 font-medium">todas hechas</span> : undefined}
          >
            {token && <div className="p-4"><TareasSection expedienteId={id} token={token} onCreated={loadActividad} /></div>}
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
            {token && <div className="p-4"><DocumentosTab expedienteId={id} token={token} onCreated={loadActividad} /></div>}
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

interface ActividadRowProps {
  item: ActividadItem;
  adjuntos?: ActividadItem[];
  editingMovId?: string | null;
  editingMovTexto?: string;
  editingMovFecha?: string;
  deletingMovId?: string | null;
  onEditStart?: (id: string, texto: string, fecha: string | null) => void;
  onEditSave?: (id: string) => void;
  onEditCancel?: () => void;
  onEditChange?: (texto: string) => void;
  onFechaChange?: (fecha: string) => void;
  onDeleteConfirm?: (id: string) => void;
  onDeleteCancel?: () => void;
  onDelete?: (id: string) => void;
}

function ActividadRow({ item, adjuntos, editingMovId, editingMovTexto, editingMovFecha, deletingMovId, onEditStart, onEditSave, onEditCancel, onEditChange, onFechaChange, onDeleteConfirm, onDeleteCancel, onDelete }: ActividadRowProps) {
  const router = useRouter();
  const cfg = ACTIVIDAD_CONFIG[item.tipo] ?? { color: "text-ink-600", bg: "bg-ink-100", icon: "•" };
  const meta = item.meta as Record<string, string | number | boolean | null | undefined>;
  const isEditing = editingMovId === item.id;
  const isDeleting = deletingMovId === item.id;
  const isMovimiento = item.tipo === "movimiento";
  const isNavigable = (item.tipo === "tarea" || item.tipo === "vencimiento") && !isEditing && !isDeleting;

  return (
    <div className="relative flex items-start gap-3 pl-8">
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center text-base flex-shrink-0 z-10`}>
        {cfg.icon}
      </div>
      <div
        onClick={isNavigable ? () => router.push(`/${item.tipo === "tarea" ? "tareas" : "vencimientos"}/${item.id}`) : undefined}
        className={`flex-1 min-w-0 rounded-xl px-4 py-3 border group ${isEditing ? "bg-white border-brand-200 ring-1 ring-brand-300" : "bg-ink-50 border-ink-100"} ${isNavigable ? "cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition" : ""}`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editingMovTexto}
              onChange={(e) => onEditChange?.(e.target.value)}
              className="w-full text-sm text-ink-900 bg-transparent focus:outline-none resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <input type="date" value={editingMovFecha} onChange={(e) => onFechaChange?.(e.target.value)}
                className="text-xs border border-ink-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300 text-ink-600" />
              <div className="flex gap-2 ml-auto">
                <button onClick={onEditCancel} className="text-xs text-ink-500 hover:text-ink-700 transition">Cancelar</button>
                <button onClick={() => onEditSave?.(item.id)} className="text-xs bg-brand-600 text-white px-2.5 py-1 rounded-lg hover:bg-brand-700 transition">Guardar</button>
              </div>
            </div>
          </div>
        ) : isDeleting ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-800">{item.descripcion}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-red-600 font-medium">¿Eliminar este movimiento?</span>
              <button onClick={onDeleteCancel} className="text-xs text-ink-500 hover:text-ink-700 transition ml-auto">No</button>
              <button onClick={() => onDelete?.(item.id)} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 transition">Sí, eliminar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Etiqueta de tipo */}
                {item.tipo !== "movimiento" && (
                  <span className={`inline-block text-[10px] font-bold uppercase tracking-wide mb-1 ${
                    item.tipo === "tarea" ? "text-purple-500" :
                    item.tipo === "vencimiento" ? "text-amber-500" :
                    item.tipo === "documento" ? "text-ink-400" :
                    item.tipo === "honorario" ? "text-emerald-500" :
                    item.tipo === "pago" ? "text-green-500" : "text-ink-400"
                  }`}>
                    {item.tipo === "tarea" ? "Tarea" :
                     item.tipo === "vencimiento" ? "Vencimiento" :
                     item.tipo === "documento" ? "Documento adjunto" :
                     item.tipo === "honorario" ? "Honorario" :
                     item.tipo === "pago" ? "Pago" : item.tipo}
                  </span>
                )}
                <p className="text-sm text-ink-900 font-medium leading-snug">{item.descripcion}</p>

                {/* Detalles por tipo */}
                {item.tipo === "tarea" && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {meta.tipo && (
                      <span className="text-[10px] text-ink-500">
                        {meta.tipo === "judicial" ? "⚖️" : meta.tipo === "extrajudicial" ? "🤝" : meta.tipo === "administrativa" ? "🏢" : "🔧"} {String(meta.tipo)}
                      </span>
                    )}
                    {meta.estado != null && (() => {
                      const e = String(meta.estado);
                      const cls = e === "hecha" ? "bg-green-100 text-green-700" : e === "en_curso" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700";
                      const label = e === "hecha" ? "✓ Hecha" : e === "en_curso" ? "En curso" : "Pendiente";
                      return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
                    })()}
                    {meta.fecha_limite && <span className="text-xs text-ink-400">· vence {new Date(String(meta.fecha_limite) + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>}
                  </div>
                )}
                {item.tipo === "vencimiento" && meta.fecha != null && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-amber-600 font-medium">
                      📅 {new Date(String(meta.fecha) + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      {meta.hora && <span className="ml-1 text-ink-500">· {String(meta.hora)}</span>}
                    </span>
                    {meta.tipo && <span className="text-xs text-ink-400 capitalize">{String(meta.tipo)}</span>}
                    {meta.cumplido && <span className="text-xs text-green-600 font-medium">✓ cumplido</span>}
                  </div>
                )}
                {item.tipo === "documento" && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {meta.adjunto_en && (
                      <span className="text-xs text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">📎 {String(meta.adjunto_en)}</span>
                    )}
                    {meta.size_bytes && (
                      <span className="text-xs text-ink-400">
                        {Number(meta.size_bytes) < 1024 * 1024
                          ? `${Math.round(Number(meta.size_bytes) / 1024)} KB`
                          : `${(Number(meta.size_bytes) / (1024 * 1024)).toFixed(1)} MB`}
                      </span>
                    )}
                  </div>
                )}
                {item.tipo === "honorario" && meta.monto != null && (
                  <p className="text-xs text-emerald-600 font-medium mt-1">{String(meta.moneda)} {Number(meta.monto).toLocaleString("es-AR")}</p>
                )}
                {item.tipo === "pago" && meta.importe != null && (
                  <p className="text-xs text-green-600 font-medium mt-1">{String(meta.moneda)} {Number(meta.importe).toLocaleString("es-AR")} · {String(meta.tipo)}</p>
                )}
              </div>
              {isMovimiento && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button onClick={() => onEditStart?.(item.id, item.descripcion, (meta.fecha_manual as string) ?? null)}
                    className="text-ink-400 hover:text-brand-600 transition p-1 rounded" title="Editar">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => onDeleteConfirm?.(item.id)}
                    className="text-ink-400 hover:text-red-500 transition p-1 rounded" title="Eliminar">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </div>
            {adjuntos && adjuntos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-ink-100">
                {adjuntos.map((doc) => {
                  const dm = doc.meta as Record<string, unknown>;
                  const sizeKb = dm.size_bytes ? Math.round(Number(dm.size_bytes) / 1024) : null;
                  return (
                    <span key={doc.id} className="inline-flex items-center gap-1 text-xs bg-ink-100 text-ink-700 px-2 py-0.5 rounded-full">
                      <svg className="w-3 h-3 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span className="max-w-[160px] truncate">{doc.descripcion}</span>
                      {sizeKb && <span className="text-ink-400 flex-shrink-0">{sizeKb} KB</span>}
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-ink-400 mt-1.5">
              {new Date(item.created_at).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
