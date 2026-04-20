"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  auth_provider: string;
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
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function getAvatarColor(name: string): string {
  const colors = ["bg-brand-600", "bg-purple-600", "bg-teal-600", "bg-orange-500", "bg-pink-600", "bg-indigo-600"];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls = "w-full bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
const labelCls = "block text-xs font-medium text-ink-500 mb-1";

function SectionCard({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 border-b border-ink-100 flex items-center justify-between hover:bg-ink-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-ink-400">{icon}</span>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        </div>
        <svg
          className={`w-4 h-4 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 py-5">{children}</div>}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <p className={`text-xs px-3 py-2 rounded-lg border ${
      type === "ok" ? "text-green-700 bg-green-50 border-green-100" : "text-red-600 bg-red-50 border-red-100"
    }`}>{msg}</p>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function PerfilPageInner() {
  const { data: session, update: updateSession } = useSession();
  const token = session?.user?.backendToken;
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [studio, setStudio] = useState<StudioData | null>(null);

  // Mis datos
  const [fullName, setFullName] = useState("");
  const [editingUser, setEditingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  // Cambiar contraseña
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Mi estudio
  const [editingStudio, setEditingStudio] = useState(false);
  const [studioForm, setStudioForm] = useState({ name: "", direccion: "", telefono: "", email_contacto: "" });
  const [studioMsg, setStudioMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [studioSaving, setStudioSaving] = useState(false);

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Google Calendar
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<{ text: string; type: "ok" | "err" } | null>(
    searchParams.get("calendar_connected") === "1"
      ? { text: "¡Google Calendar conectado! Elegí un calendario y guardá.", type: "ok" }
      : null
  );

  // WhatsApp
  const [waForm, setWaForm] = useState({ phone_id: "", token: "", verify_token: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waMsg, setWaMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [waActive, setWaActive] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<ProfileData>("/users/me", token)
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name ?? "");
      })
      .catch(() => {
        // fallback from session
        setFullName(session?.user?.name ?? "");
      });
    api.get<StudioData>("/studios/me", token)
      .then((s) => {
        setStudio(s);
        setStudioForm({
          name: s.name,
          direccion: s.direccion ?? "",
          telefono: s.telefono ?? "",
          email_contacto: s.email_contacto ?? "",
        });
        setLogoPreview(s.logo_url ?? null);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!profile?.google_refresh_token) return;
    setLoadingCalendars(true);
    api.get<CalendarItem[]>("/auth/google-calendar/calendars", token)
      .then((list) => {
        setCalendars(list);
        const cur = profile.google_calendar_id;
        if (cur) setSelectedCalendar(cur);
        else {
          const primary = list.find((c) => c.primary);
          if (primary) setSelectedCalendar(primary.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCalendars(false));
  }, [profile, token]);

  useEffect(() => {
    if (!studio) return;
    setWaActive(Boolean(studio.whatsapp_active));
    if (studio.whatsapp_phone_id) setWaForm((f) => ({ ...f, phone_id: studio.whatsapp_phone_id ?? "" }));
  }, [studio]);

  const isGoogleUser = profile?.auth_provider === "google";
  const isCalendarConnected = Boolean(profile?.google_refresh_token);
  const initials = getInitials(profile?.full_name ?? session?.user?.name ?? "?");
  const avatarColor = getAvatarColor(profile?.full_name ?? session?.user?.name ?? "");
  const email = profile?.email ?? session?.user?.email ?? "";
  const mapsUrl = studioForm.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioForm.direccion)}`
    : null;
  const webhookUrl = studio
    ? `${API_URL}/whatsapp/webhook/${studio.slug}`
    : "";

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setUserSaving(true);
    setUserMsg(null);
    try {
      const updated = await api.patch<ProfileData>("/users/me", { full_name: fullName }, token);
      setProfile(updated);
      setEditingUser(false);
      setUserMsg({ text: "Nombre actualizado", type: "ok" });
      await updateSession();
    } catch (err: unknown) {
      setUserMsg({ text: err instanceof Error ? err.message : "Error al guardar", type: "err" });
    } finally {
      setUserSaving(false);
    }
  };

  const handleSavePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw1.length < 8) { setPwMsg({ text: "Mínimo 8 caracteres", type: "err" }); return; }
    if (pw1 !== pw2) { setPwMsg({ text: "Las contraseñas no coinciden", type: "err" }); return; }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.patch("/users/me", { password: pw1 }, token);
      setPw1(""); setPw2("");
      setPwMsg({ text: "Contraseña actualizada", type: "ok" });
    } catch (err: unknown) {
      setPwMsg({ text: err instanceof Error ? err.message : "Error al guardar", type: "err" });
    } finally {
      setPwSaving(false);
    }
  };

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStudioSaving(true);
    setStudioMsg(null);
    try {
      const updated = await api.patch<StudioData>("/studios/me", {
        name: studioForm.name,
        direccion: studioForm.direccion || null,
        telefono: studioForm.telefono || null,
        email_contacto: studioForm.email_contacto || null,
      }, token);
      setStudio(updated);
      setEditingStudio(false);
      setStudioMsg({ text: "Estudio actualizado", type: "ok" });
    } catch (err: unknown) {
      setStudioMsg({ text: err instanceof Error ? err.message : "Error al guardar", type: "err" });
    } finally {
      setStudioSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setLogoMsg(null);
    // preview inmediato
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // upload
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/studios/me/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error al subir" }));
        throw new Error(err.detail);
      }
      const updated: StudioData = await res.json();
      setStudio(updated);
      setLogoPreview(updated.logo_url ?? null);
      setLogoMsg({ text: "Logo actualizado", type: "ok" });
    } catch (err: unknown) {
      setLogoMsg({ text: err instanceof Error ? err.message : "Error al subir", type: "err" });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!token) return;
    setLoadingConnect(true);
    setCalendarMsg(null);
    try {
      const data = await api.get<{ url: string }>("/auth/google-calendar/connect", token);
      window.location.href = data.url;
    } catch (err: unknown) {
      setCalendarMsg({ text: err instanceof Error ? err.message : "Error al conectar", type: "err" });
    } finally { setLoadingConnect(false); }
  };

  const handleSaveCalendar = async () => {
    if (!token || !selectedCalendar) return;
    setCalendarSaving(true);
    setCalendarMsg(null);
    try {
      const res = await fetch(
        `${API_URL}/auth/google-calendar/select-calendar?calendar_id=${encodeURIComponent(selectedCalendar)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Error al guardar");
      setProfile((p) => p ? { ...p, google_calendar_id: selectedCalendar } : p);
      setCalendarMsg({ text: "Calendario guardado. Ya podés sincronizar.", type: "ok" });
    } catch (err: unknown) {
      setCalendarMsg({ text: err instanceof Error ? err.message : "Error", type: "err" });
    } finally { setCalendarSaving(false); }
  };

  const handleSyncCalendar = async () => {
    if (!token) return;
    setSyncing(true);
    setCalendarMsg(null);
    try {
      const res = await api.post<{ synced: number; errors: number }>("/vencimientos/sync-calendar", {}, token);
      setCalendarMsg({
        text: `${res.synced} vencimiento${res.synced !== 1 ? "s" : ""} sincronizado${res.synced !== 1 ? "s" : ""}${res.errors > 0 ? ` (${res.errors} con error)` : ""}`,
        type: "ok",
      });
    } catch (err: unknown) {
      setCalendarMsg({ text: err instanceof Error ? err.message : "Error al sincronizar", type: "err" });
    } finally { setSyncing(false); }
  };

  const handleDisconnectCalendar = async () => {
    if (!token) return;
    setDisconnecting(true);
    try {
      await api.delete("/auth/google-calendar/disconnect", token);
      setProfile((p) => p ? { ...p, google_refresh_token: null, google_calendar_id: null } : p);
      setCalendars([]);
      setSelectedCalendar("");
      setCalendarMsg({ text: "Google Calendar desconectado", type: "ok" });
    } catch { } finally { setDisconnecting(false); }
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setWaSaving(true);
    setWaMsg(null);
    try {
      await api.post("/studios/me/whatsapp", { phone_id: waForm.phone_id, token: waForm.token, verify_token: waForm.verify_token }, token);
      setWaActive(true);
      setWaForm((f) => ({ ...f, token: "", verify_token: "" }));
      setWaMsg({ text: "WhatsApp Business configurado y activo.", type: "ok" });
    } catch (err: unknown) {
      setWaMsg({ text: err instanceof Error ? err.message : "Error al guardar", type: "err" });
    } finally { setWaSaving(false); }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!token) return;
    setWaDisconnecting(true);
    try {
      await api.delete("/studios/me/whatsapp", token);
      setWaActive(false);
      setWaForm({ phone_id: "", token: "", verify_token: "" });
      setWaMsg({ text: "WhatsApp desconectado", type: "ok" });
    } catch { } finally { setWaDisconnecting(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 lg:pb-8">

      {/* ── Header de perfil ── */}
      <div className="flex items-center gap-4 pt-1">
        <div className={`w-14 h-14 rounded-2xl ${avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <span className="text-xl font-bold text-white">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">
            {profile?.full_name ?? session?.user?.name ?? "Mi perfil"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm text-ink-400">{email}</span>
            {profile?.role && (
              <span className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 rounded-full font-medium capitalize">
                {profile.role}
              </span>
            )}
            {isGoogleUser && (
              <span className="text-xs bg-ink-50 text-ink-500 border border-ink-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Mis datos ── */}
      <SectionCard
        title="Mis datos"
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
      >
        {!editingUser ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-ink-400">Nombre</p>
                <p className="text-sm font-medium text-ink-900">{fullName || <span className="text-ink-300">—</span>}</p>
              </div>
              <button type="button" onClick={() => { setEditingUser(true); setUserMsg(null); }}
                className="text-sm border border-ink-200 text-ink-600 hover:bg-ink-50 px-3 py-1.5 rounded-xl transition">
                Editar
              </button>
            </div>
            <div>
              <p className="text-xs text-ink-400">Email</p>
              <p className="text-sm text-ink-600">{email}</p>
              <p className="text-xs text-ink-300 mt-0.5">{isGoogleUser ? "Cuenta vinculada con Google · no se puede cambiar" : "No se puede cambiar"}</p>
            </div>
            {userMsg && <Toast msg={userMsg.text} type={userMsg.type} />}
          </div>
        ) : (
          <form onSubmit={handleSaveName} className="space-y-3">
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Tu nombre" required autoFocus />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input value={email} disabled className={`${inputCls} bg-ink-50 text-ink-400 cursor-not-allowed`} />
            </div>
            {userMsg && <Toast msg={userMsg.text} type={userMsg.type} />}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingUser(false)} className="border border-ink-200 text-ink-600 text-sm px-4 py-2 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
              <button type="submit" disabled={userSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
                {userSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* ── Cambiar contraseña — solo para usuarios con email/password ── */}
      {!isGoogleUser && (
        <SectionCard
          title="Cambiar contraseña"
          defaultOpen={false}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
        >
          <form onSubmit={handleSavePw} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} className={inputCls} placeholder="Mín. 8 caracteres" minLength={8} required />
              </div>
              <div>
                <label className={labelCls}>Confirmar contraseña</label>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} placeholder="Repetir" required />
              </div>
            </div>
            {pwMsg && <Toast msg={pwMsg.text} type={pwMsg.type} />}
            <div className="flex justify-end">
              <button type="submit" disabled={pwSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
                {pwSaving ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* ── Mi estudio ── */}
      <SectionCard
        title="Mi estudio"
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
      >
        {/* Logo upload */}
        <div className="flex items-start gap-4 mb-5 pb-5 border-b border-ink-50">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-ink-50 border-2 border-dashed border-ink-200 hover:border-brand-300 flex items-center justify-center cursor-pointer flex-shrink-0 transition overflow-hidden"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-6 h-6 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-800 mb-1">Logo del estudio</p>
            <p className="text-xs text-ink-400 mb-2">JPG, PNG o WebP · Máx. 2 MB · 200×200 px recomendado</p>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="text-xs border border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-600 rounded-lg px-3 py-1.5 transition disabled:opacity-50"
            >
              {logoUploading ? "Subiendo…" : logoPreview ? "Cambiar logo" : "Subir logo"}
            </button>
            {logoMsg && <p className={`text-xs mt-1.5 ${logoMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{logoMsg.text}</p>}
          </div>
          <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoChange} />
        </div>

        {/* Datos del estudio */}
        {!editingStudio ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div>
                  <p className="text-xs text-ink-400">Nombre</p>
                  <p className="text-sm font-medium text-ink-900">{studioForm.name || <span className="text-ink-300">—</span>}</p>
                </div>
                {studioForm.direccion && (
                  <div>
                    <p className="text-xs text-ink-400">Dirección</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-ink-700">{studioForm.direccion}</p>
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700 transition" title="Ver en Maps">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-6">
                  {studioForm.telefono && <div><p className="text-xs text-ink-400">Teléfono</p><p className="text-sm text-ink-700">{studioForm.telefono}</p></div>}
                  {studioForm.email_contacto && <div><p className="text-xs text-ink-400">Email</p><p className="text-sm text-ink-700">{studioForm.email_contacto}</p></div>}
                </div>
              </div>
              <button type="button" onClick={() => { setEditingStudio(true); setStudioMsg(null); }}
                className="ml-4 flex-shrink-0 text-sm border border-ink-200 text-ink-600 hover:bg-ink-50 px-3 py-1.5 rounded-xl transition">
                Editar
              </button>
            </div>
            {studioMsg && <Toast msg={studioMsg.text} type={studioMsg.type} />}
          </div>
        ) : (
          <form onSubmit={handleSaveStudio} className="space-y-3">
            <div>
              <label className={labelCls}>Nombre del estudio <span className="text-red-400">*</span></label>
              <input value={studioForm.name} onChange={(e) => setStudioForm({ ...studioForm, name: e.target.value })} className={inputCls} placeholder="Estudio Jurídico García & Asociados" required autoFocus />
            </div>
            <div>
              <label className={labelCls}>Dirección</label>
              <div className="relative">
                <input value={studioForm.direccion} onChange={(e) => setStudioForm({ ...studioForm, direccion: e.target.value })} className={`${inputCls} pr-10`} placeholder="Av. Corrientes 1234, CABA" />
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-brand-500 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input type="tel" value={studioForm.telefono} onChange={(e) => setStudioForm({ ...studioForm, telefono: e.target.value })} className={inputCls} placeholder="+54 11 4000-0000" pattern="^[+\d\s\-()]{6,20}$" title="Ingresá un teléfono válido" />
              </div>
              <div>
                <label className={labelCls}>Email de contacto</label>
                <input type="email" value={studioForm.email_contacto} onChange={(e) => setStudioForm({ ...studioForm, email_contacto: e.target.value })} className={inputCls} placeholder="contacto@estudio.com" />
              </div>
            </div>
            {studioMsg && <Toast msg={studioMsg.text} type={studioMsg.type} />}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setEditingStudio(false)} className="border border-ink-200 text-ink-600 text-sm px-4 py-2 rounded-xl hover:bg-ink-50 transition">Cancelar</button>
              <button type="submit" disabled={studioSaving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
                {studioSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* ── Mi plan ── */}
      <SectionCard
        title="Mi plan"
        defaultOpen={false}
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-900">Plan Trial</span>
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">30 días gratis</span>
            </div>
            <p className="text-xs text-ink-400 mt-1">Acceso completo. Planes pago próximamente.</p>
          </div>
          <button disabled className="text-sm border border-ink-200 text-ink-400 px-4 py-2 rounded-xl cursor-not-allowed opacity-60">
            Ver planes
          </button>
        </div>
      </SectionCard>

      {/* ── Google Calendar ── */}
      <SectionCard
        title="Google Calendar"
        defaultOpen={false}
        icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM4.5 7.5V4.5h2.25V6h1.5V4.5h7.5V6h1.5V4.5H19.5V7.5h-15z" /></svg>}
      >
        {calendarMsg && <div className="mb-4"><Toast msg={calendarMsg.text} type={calendarMsg.type} /></div>}

        {!isCalendarConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">Conectá tu Google Calendar para sincronizar vencimientos y tareas automáticamente.</p>
            <button
              onClick={handleConnectCalendar}
              disabled={loadingConnect}
              className="flex items-center gap-2 bg-white border border-ink-200 hover:border-ink-300 text-ink-700 rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loadingConnect ? "Redirigiendo…" : "Conectar Google Calendar"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Google Calendar conectado
            </div>

            {loadingCalendars ? (
              <div className="h-10 bg-ink-100 rounded-xl animate-pulse" />
            ) : calendars.length > 0 && (
              <div className="space-y-2">
                <label className={labelCls}>Calendario de sincronización</label>
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

            {profile?.google_calendar_id && (
              <button
                onClick={handleSyncCalendar}
                disabled={syncing}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? "Sincronizando…" : "Sincronizar vencimientos"}
              </button>
            )}

            <button
              onClick={handleDisconnectCalendar}
              disabled={disconnecting}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50 block"
            >
              {disconnecting ? "Desconectando…" : "Desconectar Google Calendar"}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── WhatsApp Business — próximamente ── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden opacity-60">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <h2 className="text-sm font-semibold text-ink-400">WhatsApp Business</h2>
          </div>
          <span className="text-[10px] font-medium text-ink-400 bg-ink-100 px-2 py-0.5 rounded-full">Próximamente</span>
        </div>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  return <Suspense><PerfilPageInner /></Suspense>;
}
