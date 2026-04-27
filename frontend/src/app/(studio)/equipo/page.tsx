"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api, Invitacion, StudioUser, UserRole } from "@/lib/api";
import { PageHelp } from "@/components/ui/page-help";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const ROL_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  socio: "Socio",
  asociado: "Asociado",
  pasante: "Pasante",
};

const ROL_COLORS: Record<UserRole, string> = {
  admin: "bg-red-50 text-red-700",
  socio: "bg-brand-50 text-brand-700",
  asociado: "bg-amber-50 text-amber-700",
  pasante: "bg-ink-100 text-ink-600",
};

const ROL_ORDEN: UserRole[] = ["admin", "socio", "asociado", "pasante"];

const ROLES_LEGEND = [
  { rol: "Admin", desc: "Control total del estudio: usuarios, configuración y todos los módulos.", color: "bg-red-50 text-red-700" },
  { rol: "Socio", desc: "Acceso completo. Puede invitar miembros y gestionar expedientes.", color: "bg-brand-50 text-brand-700" },
  { rol: "Asociado", desc: "Gestión de expedientes asignados. Sin acceso a configuración del estudio.", color: "bg-amber-50 text-amber-700" },
  { rol: "Pasante", desc: "Solo lectura y carga de movimientos. No puede crear ni eliminar expedientes.", color: "bg-ink-100 text-ink-600" },
];

function Avatar({ name, role }: { name: string; role: UserRole }) {
  const colors: Record<UserRole, string> = {
    admin: "bg-red-100 text-red-700",
    socio: "bg-brand-100 text-brand-700",
    asociado: "bg-amber-100 text-amber-700",
    pasante: "bg-ink-100 text-ink-600",
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colors[role]}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function AvatarInv({ name, rol }: { name: string; rol: UserRole }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-ink-100 text-ink-400 border-2 border-dashed border-ink-300">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

const inputClass = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-ink-700 mb-1.5";

export default function EquipoPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const myRole = session?.user?.role as UserRole | undefined;
  const canManage = myRole === "admin" || myRole === "socio";

  const [usuarios, setUsuarios] = useState<StudioUser[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", rol: "asociado" as "socio" | "asociado" | "pasante" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [users, invs] = await Promise.all([
        api.get<StudioUser[]>("/users", token),
        api.get<Invitacion[]>("/invitaciones", token),
      ]);
      setUsuarios(users);
      setInvitaciones(invs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar el equipo");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError("");
    try {
      await api.post("/invitaciones", form, token);
      setForm({ email: "", full_name: "", rol: "asociado" });
      setShowForm(false);
      setSuccessMsg(`Invitación enviada a ${form.email}`);
      setTimeout(() => setSuccessMsg(""), 5000);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al enviar invitación");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!token) return;
    setChangingRole(userId);
    try {
      const updated = await api.patch<StudioUser>(`/users/${userId}/role`, { role: newRole }, token);
      setUsuarios((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSuccessMsg("Rol actualizado");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cambiar rol");
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!token) return;
    setRemovingId(userId);
    try {
      await api.delete(`/users/${userId}`, token);
      setUsuarios((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg(`${name} fue eliminado del estudio`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar usuario");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!token) return;
    setRevokingId(id);
    try {
      await api.delete(`/invitaciones/${id}`, token);
      setInvitaciones((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al revocar");
    } finally {
      setRevokingId(null);
    }
  };

  const pendientes = invitaciones.filter((i) => !i.usado);

  return (
    <div className="max-w-4xl">
      {confirmRemove && (
        <ConfirmModal
          title={`¿Eliminar a ${confirmRemove.name}?`}
          description="Perderá acceso al estudio inmediatamente."
          confirmLabel="Eliminar"
          onConfirm={() => { handleRemove(confirmRemove.id); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Equipo</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {loading ? "Cargando…" : `${usuarios.length} miembro${usuarios.length !== 1 ? "s" : ""} · ${pendientes.length} invitación${pendientes.length !== 1 ? "es" : ""} pendiente${pendientes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Equipo del estudio"
            description="Gestioná los miembros del estudio y sus permisos. Los roles determinan qué puede hacer cada persona en toda la plataforma."
            items={[
              { icon: "🔴", title: "Admin", description: "Control total: invita miembros, cambia roles, configura el estudio y accede a todo. Solo hay un admin por estudio." },
              { icon: "🔵", title: "Socio", description: "Acceso completo a expedientes, clientes, honorarios y contable. Puede gestionar el equipo pero no cambiar datos del estudio." },
              { icon: "🟡", title: "Asociado", description: "Trabaja sobre los expedientes en que está asignado. Puede crear y editar, pero no eliminar ni cambiar configuración." },
              { icon: "⚪", title: "Pasante", description: "Rol de solo lectura + carga de movimientos. No puede crear expedientes, clientes ni gestionar honorarios." },
              { icon: "✉️", title: "Invitación por email", description: "El invitado recibe un link válido por 7 días. Al aceptar, crea su contraseña y accede directamente al estudio." },
              { icon: "📁", title: "Rol en expediente vs rol global", description: "El rol global define permisos de plataforma. Dentro de cada expediente el abogado puede ser Responsable, Colaborador o Supervisión — eso es independiente." },
            ]}
            tip="Podés cambiar el rol de cualquier miembro con el selector al lado de su nombre. El cambio aplica de inmediato."
          />
          {canManage && (
            <button
              onClick={() => { setShowForm((s) => !s); setFormError(""); }}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm"
            >
              {showForm ? "Cancelar" : "Invitar miembro"}
            </button>
          )}
        </div>
      </div>

      {/* Banners */}
      {successMsg && (
        <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Form invitación */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 mb-6">
          <h2 className="text-base font-semibold text-ink-900 mb-4">Nueva invitación</h2>
          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{formError}</div>
          )}
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="nombre@estudio.com" />
              </div>
              <div>
                <label className={labelClass}>Nombre completo <span className="text-red-500">*</span></label>
                <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} placeholder="Ej: María García" />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label className={labelClass}>Rol</label>
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as "socio" | "asociado" | "pasante" })} className={inputClass}>
                <option value="socio">Socio</option>
                <option value="asociado">Asociado</option>
                <option value="pasante">Pasante</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="border border-ink-200 text-ink-600 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
              <button type="submit" disabled={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50">
                {submitting ? "Enviando…" : "Enviar invitación"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Miembros activos */}
          <div>
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1">
              Miembros activos ({usuarios.length})
            </h2>
            {loading ? (
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                    <div className="w-10 h-10 bg-ink-100 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-ink-100 rounded w-1/3" />
                      <div className="h-3 bg-ink-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
                {usuarios.sort((a, b) => ROL_ORDEN.indexOf(a.role) - ROL_ORDEN.indexOf(b.role)).map((u) => {
                  const isMe = u.id === myId;
                  return (
                    <div key={u.id} className="flex items-center gap-4 px-4 py-3.5">
                      <Avatar name={u.full_name} role={u.role} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-ink-900 truncate">{u.full_name}</p>
                          {isMe && (
                            <span className="text-xs bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full">Vos</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLORS[u.role]}`}>
                            {ROL_LABELS[u.role]}
                          </span>
                        </div>
                        <p className="text-xs text-ink-400 mt-0.5 truncate">{u.email}</p>
                        <p className="text-xs text-ink-300 mt-0.5">Desde {formatDate(u.created_at)}</p>
                      </div>

                      {/* Acciones — solo si puede gestionar y no es el propio usuario */}
                      {canManage && !isMe && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={u.role}
                            disabled={changingRole === u.id}
                            onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                            className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 text-ink-700 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="socio">Socio</option>
                            <option value="asociado">Asociado</option>
                            <option value="pasante">Pasante</option>
                          </select>
                          <button
                            onClick={() => setConfirmRemove({ id: u.id, name: u.full_name })}
                            disabled={removingId === u.id}
                            className="text-xs border border-red-100 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {removingId === u.id ? "…" : "Quitar"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invitaciones pendientes */}
          {(pendientes.length > 0 || canManage) && (
            <div>
              <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1">
                Invitaciones pendientes ({pendientes.length})
              </h2>
              {pendientes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm py-8 text-center">
                  <p className="text-sm text-ink-400">Sin invitaciones pendientes</p>
                  {canManage && (
                    <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-brand-600 hover:underline font-medium">
                      Invitar un miembro
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-50">
                  {pendientes.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-4 px-4 py-3.5">
                      <AvatarInv name={inv.full_name} rol={inv.rol} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-ink-700 truncate">{inv.full_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLORS[inv.rol]}`}>
                            {ROL_LABELS[inv.rol]}
                          </span>
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                        </div>
                        <p className="text-xs text-ink-400 mt-0.5">{inv.email}</p>
                        <p className="text-xs text-ink-300 mt-0.5">Vence {formatDate(inv.expires_at)}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                          className="flex-shrink-0 text-xs border border-red-100 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                        >
                          {revokingId === inv.id ? "…" : "Revocar"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Roles legend */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1">Roles</h2>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-4">
              {ROLES_LEGEND.map(({ rol, desc, color }) => (
                <div key={rol}>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mb-1 ${color}`}>{rol}</span>
                  <p className="text-xs text-ink-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1">Accesos rápidos</h2>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-2">
              <button
                onClick={() => setShowForm(true)}
                disabled={!canManage}
                className="w-full text-left text-sm text-brand-600 hover:text-brand-700 font-medium disabled:text-ink-300 disabled:cursor-not-allowed"
              >
                + Invitar miembro
              </button>
              <p className="text-xs text-ink-400">El invitado recibirá un email con un link para crear su cuenta.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
