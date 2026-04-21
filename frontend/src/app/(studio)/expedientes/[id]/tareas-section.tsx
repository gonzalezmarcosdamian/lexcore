"use client";

import { useState, useEffect } from "react";
import { api, Tarea, TareaEstado, TareaTipo, StudioUser } from "@/lib/api";
import { AdjuntosInline } from "@/components/ui/adjuntos-inline";

const today = new Date().toISOString().split("T")[0];

const ESTADO_CONFIG: Record<TareaEstado, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  en_curso:  { label: "En curso",  cls: "bg-blue-50 text-blue-700 border-blue-100" },
  hecha:     { label: "Hecha",     cls: "bg-green-50 text-green-700 border-green-100" },
};

function esVencida(fecha: string | null | undefined): boolean {
  if (!fecha) return false;
  return new Date(fecha + "T23:59:59") < new Date();
}

function diasRestantes(fecha: string | null | undefined): string | null {
  if (!fecha) return null;
  const diff = Math.ceil((new Date(fecha + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Vencida";
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `${diff} días`;
}

export function TareasSection({ expedienteId, token, onCreated }: { expedienteId: string; token: string; onCreated?: () => void }) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [miembros, setMiembros] = useState<StudioUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const EMPTY = { titulo: "", descripcion: "", responsable_id: "", tipo: "judicial" as TareaTipo, fecha_limite: "", hora: "", estado: "pendiente" as TareaEstado };
  const [form, setForm] = useState(EMPTY);

  const load = () =>
    api.get<Tarea[]>("/tareas", token, { expediente_id: expedienteId })
      .then(setTareas)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api.get<StudioUser[]>("/users", token).then(setMiembros).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        titulo: form.titulo,
        expediente_id: expedienteId,
        tipo: form.tipo,
        estado: form.estado,
        responsable_id: form.responsable_id || undefined,
        fecha_limite: form.fecha_limite || undefined,
        hora: form.hora || undefined,
        descripcion: form.descripcion || undefined,
      };
      if (editingId) {
        const updated = await api.patch<Tarea>(`/tareas/${editingId}`, payload, token);
        setTareas(prev => prev.map(t => t.id === editingId ? updated : t));
      } else {
        const created = await api.post<Tarea>("/tareas", payload, token);
        setTareas(prev => [created, ...prev]);
        onCreated?.();
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la tarea");
    }
    setSaving(false);
  };

  const toggleEstado = async (tarea: Tarea) => {
    const next: TareaEstado = tarea.estado === "hecha" ? "pendiente" : tarea.estado === "pendiente" ? "en_curso" : "hecha";
    const updated = await api.patch<Tarea>(`/tareas/${tarea.id}`, { estado: next }, token);
    setTareas(prev => prev.map(t => t.id === tarea.id ? updated : t));
  };

  const eliminar = async (id: string) => {
    await api.delete(`/tareas/${id}`, token);
    setTareas(prev => prev.filter(t => t.id !== id));
  };

  const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";

  const pendientes = tareas.filter(t => t.estado !== "hecha");
  const hechas = tareas.filter(t => t.estado === "hecha");

  if (loading) return (
    <div className="space-y-2 p-1">
      {[1,2].map(i => <div key={i} className="h-12 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">
          {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          {hechas.length > 0 && ` · ${hechas.length} hecha${hechas.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(EMPTY); setSaveError(null); }}
          className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-semibold transition"
        >
          {showForm ? "Cancelar" : "+ Nueva tarea"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-ink-50 border border-ink-200 rounded-xl p-4 space-y-3">
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{saveError}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Título *</label>
            <input required value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className={inputCls} placeholder="Ej: Presentar escrito de contestación" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TareaTipo })} className={inputCls}>
              <option value="judicial">⚖️ Judicial</option>
              <option value="extrajudicial">🤝 Extrajudicial</option>
              <option value="administrativa">🏢 Administrativa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Responsable</label>
            <select value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })} className={inputCls}>
              <option value="">Sin asignar</option>
              {miembros.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fecha límite</label>
              <input type="date" value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Hora</label>
              <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} className={inputCls} />
            </div>
          </div>
          {editingId && (
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value as TareaEstado })} className={inputCls}>
                <option value="pendiente">Pendiente</option>
                <option value="en_curso">En curso</option>
                <option value="hecha">Hecha</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className={`${inputCls} resize-none`} rows={2} placeholder="Opcional" />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2 text-sm font-semibold transition disabled:opacity-50">
            {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear tarea"}
          </button>
        </form>
      )}

      {/* Lista pendientes/en_curso */}
      {pendientes.length === 0 && !showForm && (
        <p className="text-sm text-ink-400 text-center py-4">Sin tareas pendientes</p>
      )}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          {pendientes.map(t => {
            const vencida = esVencida(t.fecha_limite) && t.estado !== "hecha";
            const dias = diasRestantes(t.fecha_limite);
            return (
              <div key={t.id} className={`rounded-xl border px-4 py-3 flex items-start gap-3 group ${vencida ? "bg-red-50 border-red-200" : "bg-ink-50 border-ink-100"}`}>
                {/* Toggle estado */}
                <button onClick={() => toggleEstado(t)} className="mt-0.5 flex-shrink-0" title="Cambiar estado">
                  <div className={`w-4 h-4 rounded-full border-2 transition ${t.estado === "en_curso" ? "border-blue-400 bg-blue-100" : "border-ink-300 bg-white hover:border-brand-400"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">{t.titulo}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${ESTADO_CONFIG[t.estado].cls}`}>
                      {ESTADO_CONFIG[t.estado].label}
                    </span>
                    {t.tipo && t.tipo !== "judicial" && (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-ink-50 text-ink-500 border-ink-100">
                        {t.tipo === "administrativa" ? "🏢 Admin" : "🤝 Extrajudicial"}
                      </span>
                    )}
                    {dias && (
                      <span className={`text-xs font-medium ${vencida ? "text-red-600" : dias === "Hoy" || dias === "Mañana" ? "text-amber-600" : "text-ink-400"}`}>
                        {dias}{t.hora && ` · ${t.hora}`}
                      </span>
                    )}
                    {t.responsable_nombre && (
                      <span className="text-xs text-ink-400">{t.responsable_nombre}</span>
                    )}
                  </div>
                  {t.descripcion && <p className="text-xs text-ink-500 mt-1">{t.descripcion}</p>}
                  <AdjuntosInline tareaId={t.id} token={token} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button onClick={() => { setForm({ titulo: t.titulo, descripcion: t.descripcion ?? "", responsable_id: t.responsable_id ?? "", tipo: t.tipo ?? "judicial", fecha_limite: t.fecha_limite ?? "", hora: t.hora ?? "", estado: t.estado }); setEditingId(t.id); setShowForm(true); }} className="text-ink-400 hover:text-ink-700 p-1 rounded transition">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => eliminar(t.id)} className="text-ink-400 hover:text-red-500 p-1 rounded transition">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hechas colapsadas */}
      {hechas.length > 0 && (
        <details className="group">
          <summary className="text-xs text-ink-400 cursor-pointer hover:text-ink-600 transition select-none list-none flex items-center gap-1">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            {hechas.length} tarea{hechas.length !== 1 ? "s" : ""} completada{hechas.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1.5">
            {hechas.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2 bg-green-50 border border-green-100 rounded-xl group">
                <button onClick={() => toggleEstado(t)} className="flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </button>
                <p className="text-xs text-ink-500 line-through flex-1">{t.titulo}</p>
                <button onClick={() => eliminar(t.id)} className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-400 p-1 transition">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
