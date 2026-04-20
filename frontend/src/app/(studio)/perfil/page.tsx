"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  google_refresh_token?: string | null;
  google_calendar_id?: string | null;
}

interface StudioData {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email_contacto?: string | null;
  whatsapp_phone_id?: string | null;
  whatsapp_active?: boolean;
}

interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-brand-600", "bg-purple-600", "bg-teal-600",
    "bg-orange-500", "bg-pink-600", "bg-indigo-600",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
const labelCls = "block text-xs font-medium text-ink-500 mb-1";

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-2.5">
        <span className="text-ink-400">{icon}</span>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function PerfilPageInner() {
  const { data: session, update: updateSession } = useSession();
  const token = session?.user?.backendToken;
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [studio, setStudio] = useState<StudioData | null>(null);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(
    searchParams.get("calendar_connected") === "1" ? "¡Google Calendar conectado!" : null
  );

  // Mis datos
  const [userForm, setUserForm] = useState({ full_name: "", password: "", password2: "" });
  const [userSaving, setUserSaving] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [userError, setUserError] = useState("");

  // Mi estudio
  const [studioForm, setStudioForm] = useState({ name: "", logo_url: "", direccion: "", telefono: "", email_contacto: "" });
  const [studioSaving, setStudioSaving] = useState(false);
  const [studioMsg, setStudioMsg] = useState("");
  const [studioError, setStudioError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get<ProfileData>("/users/me", token).then((p) => {
      setProfile(p);
      setUserForm({ full_name: p.full_name, password: "", password2: "" });
    }).catch(() => {});
    api.get<StudioData>("/studios/me", token).then((s) => {
      setStudio(s);
      setStudioForm({
        name: s.name,
        logo_url: s.logo_url ?? "",
        direccion: s.direccion ?? "",
        telefono: s.telefono ?? "",
        email_contacto: s.email_contacto ?? "",
      });
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!profile?.google_refresh_token) return;
    setLoadingCalendars(true);
    api.get<CalendarItem[]>("/auth/google-calendar/calendars", token)
      .then((list) => {
        setCalendars(list);
        const current = profile.google_calendar_id;
        if (current) setSelectedCalendar(current);
        else {
          const primary = list.find((c) => c.primary);
          if (primary) setSelectedCalendar(primary.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCalendars(false));
  }, [profile, token]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setUserError("");
    if (userForm.password && userForm.password !== userForm.password2) {
      setUserError("Las contraseñas no coinciden");
      return;
    }
    setUserSaving(true);
    try {
      const body: Record<string, string> = {};
      if (userForm.full_name !== profile?.full_name) body.full_name = userForm.full_name;
      if (userForm.password) body.password = userForm.password;
      if (Object.keys(body).length === 0) { setUserMsg("Sin cambios"); return; }
      const updated = await api.patch<ProfileData>("/users/me", body, token);
      setProfile(updated);
      setUserForm({ full_name: updated.full_name, password: "", password2: "" });
      setUserMsg("Datos actualizados");
      await updateSession();
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setUserSaving(false);
    }
  };

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStudioError("");
    setStudioSaving(true);
    try {
      const body: Record<string, string | null> = {
        name: studioForm.name,
        logo_url: studioForm.logo_url || null,
        direccion: studioForm.direccion || null,
        telefono: studioForm.telefono || null,
        email_contacto: studioForm.email_contacto || null,
      };
      const updated = await api.patch<StudioData>("/studios/me", body, token);
      setStudio(updated);
      setStudioMsg("Estudio actualizado");
    } catch (err: unknown) {
      setStudioError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setStudioSaving(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!token) return;
    setLoadingConnect(true);
    try {
      const data = await api.get<{ url: string }>("/auth/google-calendar/connect", token);
      window.location.href = data.url;
    } catch { } finally { setLoadingConnect(false); }
  };

  const handleSaveCalendar = async () => {
    if (!token || !selectedCalendar) return;
    setCalendarSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/auth/google-calendar/select-calendar?calendar_id=${encodeURIComponent(selectedCalendar)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setProfile((p) => p ? { ...p, google_calendar_id: selectedCalendar } : p);
        setCalendarMsg("Calendario guardado");
      }
    } catch { } finally { setCalendarSaving(false); }
  };

  const handleDisconnectCalendar = async () => {
    if (!token) return;
    setDisconnecting(true);
    try {
      await api.delete("/auth/google-calendar/disconnect", token);
      setProfile((p) => p ? { ...p, google_refresh_token: null, google_calendar_id: null } : p);
      setCalendars([]);
      setSelectedCalendar("");
      setCalendarMsg("Google Calendar desconectado");
    } catch { } finally { setDisconnecting(false); }
  };

  // WhatsApp
  const [waForm, setWaForm] = useState({ phone_id: "", token: "", verify_token: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waMsg, setWaMsg] = useState("");
  const [waError, setWaError] = useState("");
  const [waActive, setWaActive] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  useEffect(() => {
    if (!studio) return;
    setWaActive(Boolean(studio.whatsapp_active));
    if (studio.whatsapp_phone_id) setWaForm((f) => ({ ...f, phone_id: studio.whatsapp_phone_id ?? "" }));
  }, [studio]);

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setWaError("");
    setWaSaving(true);
    try {
      await api.post("/studios/me/whatsapp", {
        phone_id: waForm.phone_id,
        token: waForm.token,
        verify_token: waForm.verify_token,
      }, token);
      setWaActive(true);
      setWaMsg("WhatsApp Business configurado. El bot ya puede recibir mensajes.");
      setWaForm((f) => ({ ...f, token: "", verify_token: "" }));
    } catch (err: unknown) {
      setWaError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setWaSaving(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!token) return;
    setWaDisconnecting(true);
    try {
      await api.delete("/studios/me/whatsapp", token);
      setWaActive(false);
      setWaForm({ phone_id: "", token: "", verify_token: "" });
      setWaMsg("WhatsApp desconectado");
    } catch { } finally { setWaDisconnecting(false); }
  };

  const webhookUrl = studio
    ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/whatsapp/webhook/${studio.slug}`
    : "";

  const isCalendarConnected = Boolean(profile?.google_refresh_token);
  const initials = getInitials(profile?.full_name ?? session?.user?.name ?? "?");
  const avatarColor = getAvatarColor(profile?.full_name ?? session?.user?.name ?? "");
  const mapsUrl = studio?.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studio.direccion)}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 pt-1">
        <div className={`w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <span className="text-xl font-bold text-white">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">{profile?.full_name ?? session?.user?.name ?? "Mi perfil"}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-ink-400">{profile?.email ?? session?.user?.email}</span>
            {profile?.role && (
              <span className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 rounded-full font-medium capitalize">
                {profile.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sección: Mis datos ── */}
      <SectionCard
        title="Mis datos"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
        <form onSubmit={handleSaveUser} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className={inputCls}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input value={profile?.email ?? ""} disabled className={`${inputCls} bg-ink-50 text-ink-400 cursor-not-allowed`} />
            <p className="text-xs text-ink-400 mt-1">El email no se puede cambiar</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nueva contraseña</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className={inputCls}
                placeholder="Mín. 8 caracteres"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmar contraseña</label>
              <input
                type="password"
                value={userForm.password2}
                onChange={(e) => setUserForm({ ...userForm, password2: e.target.value })}
                className={inputCls}
                placeholder="Repetir contraseña"
              />
            </div>
          </div>
          {userError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{userError}</p>}
          {userMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{userMsg}</p>}
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={userSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
              {userSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Sección: Mi estudio ── */}
      <SectionCard
        title="Mi estudio"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      >
        <form onSubmit={handleSaveStudio} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre del estudio</label>
            <input
              value={studioForm.name}
              onChange={(e) => setStudioForm({ ...studioForm, name: e.target.value })}
              className={inputCls}
              placeholder="Estudio Jurídico García & Asociados"
              required
            />
          </div>
          <div>
            <label className={labelCls}>URL del logo</label>
            <input
              value={studioForm.logo_url}
              onChange={(e) => setStudioForm({ ...studioForm, logo_url: e.target.value })}
              className={inputCls}
              placeholder="https://…/logo.png"
              type="url"
            />
            <p className="text-xs text-ink-400 mt-1">PNG o JPG, recomendado 200×200px. Upload de archivo próximamente.</p>
          </div>
          <div className="relative">
            <label className={labelCls}>Dirección</label>
            <input
              value={studioForm.direccion}
              onChange={(e) => setStudioForm({ ...studioForm, direccion: e.target.value })}
              className={inputCls}
              placeholder="Av. Corrientes 1234, CABA"
            />
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-3 top-7 text-brand-500 hover:text-brand-700"
                title="Ver en Google Maps"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input
                value={studioForm.telefono}
                onChange={(e) => setStudioForm({ ...studioForm, telefono: e.target.value })}
                className={inputCls}
                placeholder="+54 11 4000-0000"
              />
            </div>
            <div>
              <label className={labelCls}>Email de contacto</label>
              <input
                value={studioForm.email_contacto}
                onChange={(e) => setStudioForm({ ...studioForm, email_contacto: e.target.value })}
                className={inputCls}
                placeholder="contacto@estudio.com"
                type="email"
              />
            </div>
          </div>
          {studioError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{studioError}</p>}
          {studioMsg && <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{studioMsg}</p>}
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={studioSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
              {studioSaving ? "Guardando…" : "Guardar estudio"}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* ── Sección: Mi plan ── */}
      <SectionCard
        title="Mi plan"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-900">Plan Trial</span>
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">30 días gratis</span>
            </div>
            <p className="text-xs text-ink-400 mt-1">Acceso completo a todas las funcionalidades. Próximamente planes pago.</p>
          </div>
          <button disabled className="text-sm border border-ink-200 text-ink-400 px-4 py-2 rounded-xl cursor-not-allowed opacity-60">
            Ver planes
          </button>
        </div>
      </SectionCard>

      {/* ── Sección: WhatsApp Business ── */}
      <SectionCard
        title="WhatsApp Business"
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        }
      >
        {waMsg && (
          <div className="mb-4 text-xs bg-green-50 border border-green-100 text-green-700 px-3 py-2 rounded-lg">{waMsg}</div>
        )}

        {waActive ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Bot de WhatsApp activo
            </div>
            <div>
              <label className={labelCls}>URL del webhook (registrar en Meta Developers)</label>
              <div className="flex gap-2">
                <input value={webhookUrl} readOnly className={`${inputCls} bg-ink-50 text-ink-500 font-mono text-xs`} />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  className="flex-shrink-0 border border-ink-200 hover:border-ink-300 text-ink-500 hover:text-ink-700 px-3 py-2 rounded-xl text-xs transition"
                >
                  Copiar
                </button>
              </div>
            </div>
            <button
              onClick={handleDisconnectWhatsApp}
              disabled={waDisconnecting}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50"
            >
              {waDisconnecting ? "Desconectando…" : "Desconectar WhatsApp"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveWhatsApp} className="space-y-3">
            <p className="text-sm text-ink-600">
              Conectá tu número de WhatsApp Business para que los clientes puedan consultar el estado de sus expedientes por mensaje.{" "}
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                Cómo obtener las credenciales →
              </a>
            </p>
            <div>
              <label className={labelCls}>Phone Number ID <span className="text-red-400">*</span></label>
              <input
                required
                value={waForm.phone_id}
                onChange={(e) => setWaForm({ ...waForm, phone_id: e.target.value })}
                className={inputCls}
                placeholder="Ej: 123456789012345"
              />
            </div>
            <div>
              <label className={labelCls}>Token de acceso permanente <span className="text-red-400">*</span></label>
              <input
                required
                type="password"
                value={waForm.token}
                onChange={(e) => setWaForm({ ...waForm, token: e.target.value })}
                className={inputCls}
                placeholder="EAA…"
              />
            </div>
            <div>
              <label className={labelCls}>Token de verificación del webhook <span className="text-red-400">*</span></label>
              <input
                required
                value={waForm.verify_token}
                onChange={(e) => setWaForm({ ...waForm, verify_token: e.target.value })}
                className={inputCls}
                placeholder="Cualquier string secreto que elijas"
              />
              <p className="text-xs text-ink-400 mt-1">Lo usás al registrar el webhook en Meta Developers. Guardalo en un lugar seguro.</p>
            </div>
            {waError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{waError}</p>}
            <div className="flex justify-end pt-1">
              <button type="submit" disabled={waSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
                {waSaving ? "Guardando…" : "Activar WhatsApp"}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* ── Sección: Google Calendar ── */}
      <SectionCard
        title="Google Calendar"
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM4.5 7.5V4.5h2.25V6h1.5V4.5h7.5V6h1.5V4.5H19.5V7.5h-15z" />
          </svg>
        }
      >
        {calendarMsg && (
          <div className="mb-4 text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-2 rounded-lg">{calendarMsg}</div>
        )}

        {!isCalendarConnected ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-600">Conectá tu Google Calendar para sincronizar vencimientos automáticamente.</p>
            <button
              onClick={handleConnectCalendar}
              disabled={loadingConnect}
              className="self-start flex items-center gap-2 bg-white border border-ink-200 hover:border-ink-300 text-ink-700 rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loadingConnect ? "Conectando…" : "Conectar Google Calendar"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Google Calendar conectado
            </div>
            {loadingCalendars ? (
              <div className="h-10 bg-ink-100 rounded-xl animate-pulse" />
            ) : calendars.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-ink-500">Calendario de sincronización</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCalendar}
                    onChange={(e) => setSelectedCalendar(e.target.value)}
                    className="flex-1 bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>{c.summary}{c.primary ? " (principal)" : ""}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveCalendar}
                    disabled={calendarSaving || selectedCalendar === profile?.google_calendar_id}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {calendarSaving ? "…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleDisconnectCalendar}
              disabled={disconnecting}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50"
            >
              {disconnecting ? "Desconectando…" : "Desconectar Google Calendar"}
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function PerfilPage() {
  return <Suspense><PerfilPageInner /></Suspense>;
}
