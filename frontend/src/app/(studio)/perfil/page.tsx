"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface CalendarItem {
  id: string;
  summary: string;
  primary: boolean;
}

interface ProfileData {
  google_refresh_token?: string | null;
  google_calendar_id?: string | null;
}

export default function PerfilPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [success, setSuccess] = useState(searchParams.get("calendar_connected") === "1");
  const [message, setMessage] = useState<string | null>(
    searchParams.get("calendar_connected") === "1" ? "¡Google Calendar conectado! Ahora elegí tu calendario." : null
  );

  useEffect(() => {
    if (!token) return;
    api.get<ProfileData>("/users/me", token).then(setProfile).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!profile?.google_refresh_token) return;
    setLoadingCalendars(true);
    api
      .get<CalendarItem[]>("/auth/google-calendar/calendars", token)
      .then((list) => {
        setCalendars(list);
        if (profile.google_calendar_id) setSelectedCalendar(profile.google_calendar_id);
        else {
          const primary = list.find((c) => c.primary);
          if (primary) setSelectedCalendar(primary.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCalendars(false));
  }, [profile, token]);

  const handleConnect = async () => {
    if (!token) return;
    setLoadingConnect(true);
    try {
      const data = await api.get<{ url: string }>("/auth/google-calendar/connect", token);
      window.location.href = data.url;
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Error al conectar");
    } finally {
      setLoadingConnect(false);
    }
  };

  const handleSaveCalendar = async () => {
    if (!token || !selectedCalendar) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/auth/google-calendar/select-calendar?calendar_id=${encodeURIComponent(selectedCalendar)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, google_calendar_id: selectedCalendar } : prev);
        setMessage("Calendario guardado correctamente");
      }
    } catch {
      setMessage("Error al guardar el calendario");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!token) return;
    setDisconnecting(true);
    try {
      await api.delete("/auth/google-calendar/disconnect", token);
      setProfile((prev) => prev ? { ...prev, google_refresh_token: null, google_calendar_id: null } : prev);
      setCalendars([]);
      setSelectedCalendar("");
      setMessage("Google Calendar desconectado");
    } catch {
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = Boolean(profile?.google_refresh_token);
  const hasCalendarSelected = Boolean(profile?.google_calendar_id);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Mi perfil</h1>
        <p className="text-sm text-ink-400 mt-0.5">Configuración personal y conectores</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${success ? "bg-green-50 border border-green-100 text-green-700" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
          {success && (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {message}
        </div>
      )}

      {/* Datos personales */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="text-sm font-semibold text-ink-900">Datos personales</h2>
        </div>
        <div className="divide-y divide-ink-50">
          <div className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm text-ink-500 w-28 flex-shrink-0">Nombre</span>
            <span className="text-sm font-medium text-ink-900">{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm text-ink-500 w-28 flex-shrink-0">Email</span>
            <span className="text-sm font-medium text-ink-900">{session?.user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm text-ink-500 w-28 flex-shrink-0">Rol</span>
            <span className="inline-flex items-center text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {(session?.user as { role?: string })?.role ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3">
          <svg className="w-5 h-5 text-ink-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM4.5 7.5V4.5h2.25V6h1.5V4.5h7.5V6h1.5V4.5H19.5V7.5h-15z" />
          </svg>
          <h2 className="text-sm font-semibold text-ink-900">Google Calendar</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          {!isConnected ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-ink-600 leading-relaxed">
                Conectá tu Google Calendar para sincronizar los vencimientos automáticamente. No se requiere iniciar sesión con Google.
              </p>
              <button
                onClick={handleConnect}
                disabled={loadingConnect}
                className="flex items-center gap-2 bg-white border border-ink-200 hover:border-ink-300 text-ink-700 hover:text-ink-900 rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
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
              ) : calendars.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink-700">Calendario de sincronización</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCalendar}
                      onChange={(e) => setSelectedCalendar(e.target.value)}
                      className="flex-1 bg-white border border-ink-200 rounded-xl px-4 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
                    >
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}{c.primary ? " (principal)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveCalendar}
                      disabled={saving || selectedCalendar === profile?.google_calendar_id}
                      className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50"
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                  {hasCalendarSelected && (
                    <p className="text-xs text-ink-400">
                      Calendario actual: {calendars.find((c) => c.id === profile?.google_calendar_id)?.summary ?? profile?.google_calendar_id}
                    </p>
                  )}
                </div>
              ) : null}

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-sm text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50"
              >
                {disconnecting ? "Desconectando…" : "Desconectar Google Calendar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
