"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { api, SearchResult, StudioMe } from "@/lib/api";
import { SkeletonText, SkeletonAvatar } from "@/components/ui/skeletons";
import { SearchModal } from "@/components/ui/search-modal";
import { ToastProvider } from "@/components/ui/toast";
import { HelpWidget } from "@/components/ui/help-widget";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: boolean;
  section?: string;
  children?: { href: string; label: string }[];
};

const NAV_SIDEBAR: NavItem[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  // ── Trabajo ──────────────────────────────────────────
  {
    href: "/expedientes",
    label: "Expedientes",
    section: "Trabajo",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    children: [
      { href: "/clientes", label: "Clientes" },
    ],
  },
  {
    href: "/agenda",
    label: "Agenda",
    badge: true, // badge urgentes de vencimientos
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  // ── Finanzas ──────────────────────────────────────────
  {
    href: "/gastos",
    label: "Contable",
    section: "Finanzas",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  // ── Estudio ───────────────────────────────────────────
  {
    href: "/equipo",
    label: "Equipo",
    section: "Estudio",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

// Mobile: Inicio, Expedientes, Clientes, Agenda + botón "Más"
const NAV_MOBILE = [NAV_SIDEBAR[0], NAV_SIDEBAR[1], NAV_SIDEBAR[2]];

const NAV_MORE: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/clientes", label: "Clientes", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { href: "/tareas", label: "Tareas", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { href: "/vencimientos", label: "Vencimientos", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { href: "/gastos", label: "Contable", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { href: "/equipo", label: "Equipo", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
  { href: "/perfil", label: "Perfil", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
];

// ── Búsqueda global ───────────────────────────────────────────────────────────

function SearchPanel({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(
    (query: string) => {
      if (query.length < 3) { setResult(null); setOpen(false); return; }
      setLoading(true);
      api.get<SearchResult>("/search", token, { q: query })
        .then(r => { setResult(r); setOpen(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [token]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  };

  const navigate = (href: string) => {
    setQ(""); setResult(null); setOpen(false);
    router.push(href);
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setQ(""); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const totalResults = (result?.expedientes.length ?? 0) + (result?.clientes.length ?? 0);

  return (
    <div ref={panelRef} className="px-3 py-2 relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={q}
          onChange={handleChange}
          onFocus={() => result && setOpen(true)}
          placeholder="Buscar expediente o cliente…"
          className="w-full bg-ink-800 border border-ink-700 rounded-lg pl-8 pr-3 py-2 text-xs text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 transition"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-ink-500 border-t-brand-400 rounded-full animate-spin" />
        )}
      </div>

      {open && result && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-ink-800 border border-ink-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {totalResults === 0 ? (
            <p className="text-xs text-ink-500 px-4 py-3">Sin resultados para "{q}"</p>
          ) : (
            <>
              {result.expedientes.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider px-3 pt-2 pb-1">Expedientes</p>
                  {result.expedientes.map(e => (
                    <button key={e.id} onClick={() => navigate(`/expedientes/${e.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-ink-700 transition flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink-100 font-mono truncate">{e.numero}</p>
                        <p className="text-[10px] text-ink-400 truncate">{e.caratula}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {result.clientes.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider px-3 pt-2 pb-1">Clientes</p>
                  {result.clientes.map(c => (
                    <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-ink-700 transition flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink-100 truncate">{c.nombre}</p>
                        {c.cuit_dni && <p className="text-[10px] text-ink-400">{c.cuit_dni}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider><StudioLayoutInner>{children}</StudioLayoutInner></ToastProvider>;
}

function StudioLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const [urgentesList, setUrgentesList] = useState<{ id: string; fecha: string; descripcion: string; tipo: string; expediente_id?: string }[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [studioConfigured, setStudioConfigured] = useState<boolean | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [studioLogoUrl, setStudioLogoUrl] = useState<string | null>(null);
  const [studioForm, setStudioForm] = useState({ name: "", email_contacto: "" });
  const [studioSaving, setStudioSaving] = useState(false);
  const [studioError, setStudioError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  // Verificar si el estudio tiene perfil completo (email_contacto requerido)
  useEffect(() => {
    if (!token) return;
    api.get<StudioMe>("/studios/me", token)
      .then((s) => {
        setStudioConfigured(!!s.email_contacto);
        setStudioLogoUrl(s.logo_url ?? null);
        // Pre-cargar formulario con datos existentes o defaults de la sesión
        setStudioForm({
          name: s.name || "",
          email_contacto: s.email_contacto || (session?.user?.email ?? ""),
        });
        if (s.trial_ends_at) {
          const diff = new Date(s.trial_ends_at).getTime() - Date.now();
          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
          setTrialDaysLeft(days > 0 ? days : 0);
        }
      })
      .catch(() => setStudioConfigured(true)); // en caso de error, no bloquear
    api.get<{ is_superadmin: boolean; studio_access_level: string }>("/users/me", token)
      .then((u) => { if (u.is_superadmin) setIsSuperadmin(true); })
      .catch(() => {});
  }, [token, session?.user?.email]);
  const urgentes = urgentesList.length;

  const userName = (session?.user?.name ?? "") as string;
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("") || "?";
  const avatarColors = ["bg-brand-600", "bg-purple-600", "bg-teal-600", "bg-orange-500", "bg-pink-600", "bg-indigo-600"];
  let nameHash = 0;
  for (const c of userName) nameHash = (nameHash * 31 + c.charCodeAt(0)) & 0xffffffff;
  const avatarColor = avatarColors[Math.abs(nameHash) % avatarColors.length];
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  // Cmd+K / Ctrl+K abre el buscador
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (token) setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [token]);

  // Badge urgentes: consulta vencimientos < 48hs al cargar
  useEffect(() => {
    if (!token) return;
    api.get<{ id: string; fecha: string; descripcion: string; tipo: string; cumplido: boolean; expediente_id?: string }[]>("/vencimientos", token, { dias: 2 })
      .then(data => {
        const now = Date.now();
        setUrgentesList(data.filter(v => {
          if (v.cumplido) return false;
          const diff = new Date(v.fecha).getTime() - now;
          return diff >= 0 && diff <= 48 * 3600 * 1000;
        }));
      })
      .catch(() => {});
  }, [token]);

  // Cerrar dropdown notificaciones al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-h-screen flex bg-ink-50">
      {token && <SearchModal token={token} open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {/* Sidebar — hidden on mobile, shown on lg+ */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-ink-900 z-20">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 flex-shrink-0">
          {studioLogoUrl ? (
            <img src={studioLogoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
          )}
          <span className="text-white font-bold text-lg tracking-tight">LexCore</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {NAV_SIDEBAR.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const showBadge = item.badge && urgentes > 0;

            return (
              <div key={item.href}>
                {/* Separador de sección */}
                {item.section && (
                  <p className="text-[10px] font-semibold text-ink-600 uppercase tracking-widest px-3 pt-4 pb-1">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-ink-800 border-l-2 border-brand-400 text-white pl-[10px]"
                      : "text-ink-400 hover:text-ink-100 hover:bg-ink-800/50"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex-shrink-0 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {urgentes > 99 ? "99+" : urgentes}
                    </span>
                  )}
                </Link>
                {/* Sub-items */}
                {item.children && (
                  <div className="ml-4 pl-3 border-l border-ink-800 mt-0.5 mb-0.5 space-y-0.5">
                    {item.children.map(child => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                            childActive
                              ? "bg-ink-800 text-white"
                              : "text-white/50 hover:text-white hover:bg-ink-800/50"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Superadmin link */}
        {isSuperadmin && (
          <div className="px-3 pb-2">
            <Link
              href="/superadmin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                pathname.startsWith("/superadmin")
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Superadmin
            </Link>
          </div>
        )}

        {/* User section */}
        <div className="px-3 py-4 border-t border-ink-800 flex-shrink-0">
          <Link href="/perfil" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ink-800/50 transition-all group">
            {!session ? (
              <>
                <SkeletonAvatar size="sm" />
                <SkeletonText lines={2} className="flex-1" />
              </>
            ) : (
              <>
                <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}>
                  <span className="text-sm font-semibold text-white">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{session.user?.name ?? "Usuario"}</p>
                  <p className="text-xs text-ink-400 truncate capitalize">{(session.user as { role?: string })?.role ?? ""}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-ink-600 group-hover:text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-400 hover:text-ink-100 hover:bg-ink-800/50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Salir
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:ml-60 min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-ink-100 sticky top-0 z-10 shadow-sm">
          <div className="h-14 px-4 lg:px-6 flex items-center justify-between">
            {/* Mobile logo */}
            <Link href="/dashboard" className="flex lg:hidden items-center gap-2">
              <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <span className="font-bold text-ink-900 text-base">LexCore</span>
            </Link>

            {/* Desktop: módulo actual */}
            <div className="hidden lg:block">
              <span className="text-sm text-ink-400">
                {(() => {
                  if (pathname.startsWith("/clientes")) return "Clientes";
                  if (pathname.startsWith("/tareas")) return "Tareas";
                  if (pathname.startsWith("/vencimientos")) return "Vencimientos";
                  return NAV_SIDEBAR.find((n) => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label ?? "Inicio";
                })()}
              </span>
            </div>

            {/* Right: urgentes pill + search + user */}
            <div className="flex items-center gap-3">
              {token && (
                <button
                  onClick={() => setSearchOpen(true)}
                  title="Buscar (Cmd+K)"
                  className="flex items-center gap-2 border border-ink-200 hover:border-ink-300 text-ink-400 hover:text-ink-600 bg-white rounded-xl px-3 py-1.5 text-xs font-medium transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden sm:inline">Buscar</span>
                  <kbd className="hidden lg:flex items-center gap-0.5 text-[10px] text-ink-300 border border-ink-200 rounded px-1 font-mono">{shortcutLabel}</kbd>
                </button>
              )}
              {urgentes > 0 && (
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="hidden sm:inline">{urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>
                    <span className="sm:hidden">{urgentes}</span>
                  </button>

                  {/* Desktop dropdown */}
                  {notifOpen && (
                    <>
                      {/* Overlay mobile → bottom sheet */}
                      <div
                        className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                        onClick={() => setNotifOpen(false)}
                      />
                      {/* Bottom sheet (mobile) */}
                      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-900">Vencimientos urgentes</span>
                          <button onClick={() => { setUrgentesList([]); setNotifOpen(false); }} className="text-xs text-ink-400 hover:text-ink-700 transition">Marcar vistas</button>
                        </div>
                        <div className="divide-y divide-ink-50 max-h-64 overflow-y-auto">
                          {urgentesList.map((v) => (
                            <Link
                              key={v.id}
                              href={v.expediente_id ? `/expedientes/${v.expediente_id}` : `/vencimientos`}
                              onClick={() => setNotifOpen(false)}
                              className="flex items-start gap-3 px-4 py-3.5 hover:bg-ink-50 transition"
                            >
                              <span className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-ink-900 font-medium truncate">{v.descripcion}</p>
                                <p className="text-xs text-ink-400 mt-0.5">
                                  {new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} · {v.tipo}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          ))}
                        </div>
                        <div className="px-4 py-3 border-t border-ink-100 pb-safe">
                          <Link href="/vencimientos" onClick={() => setNotifOpen(false)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            Ver todos los vencimientos →
                          </Link>
                        </div>
                      </div>
                      {/* Desktop dropdown */}
                      <div className="hidden lg:block absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-ink-100 shadow-xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-900">Vencimientos urgentes</span>
                          <button onClick={() => { setUrgentesList([]); setNotifOpen(false); }} className="text-xs text-ink-400 hover:text-ink-700 transition">Marcar vistas</button>
                        </div>
                        <div className="divide-y divide-ink-50 max-h-72 overflow-y-auto">
                          {urgentesList.map((v) => (
                            <Link
                              key={v.id}
                              href={v.expediente_id ? `/expedientes/${v.expediente_id}` : `/vencimientos`}
                              onClick={() => setNotifOpen(false)}
                              className="flex items-start gap-3 px-4 py-3 hover:bg-ink-50 transition"
                            >
                              <span className="mt-0.5 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-ink-900 font-medium truncate">{v.descripcion}</p>
                                <p className="text-xs text-ink-400 mt-0.5">
                                  {new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} · {v.tipo}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          ))}
                        </div>
                        <div className="px-4 py-2.5 border-t border-ink-100">
                          <Link href="/vencimientos" onClick={() => setNotifOpen(false)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            Ver todos los vencimientos →
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <Link
                href="/perfil"
                className="hidden lg:flex items-center gap-2 hover:bg-ink-50 rounded-xl px-2 py-1 transition group"
                title="Mi perfil"
              >
                <div className={`w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-xs font-semibold text-white">{initials}</span>
                </div>
                <span className="text-sm text-ink-600 font-medium max-w-[140px] truncate group-hover:text-ink-900 transition">{session?.user?.name}</span>
              </Link>
              {/* Mobile: avatar → perfil */}
              <Link href="/perfil" className="lg:hidden">
                <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center`}>
                  <span className="text-xs font-semibold text-white">{initials}</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Trial warning banner */}
        {trialDaysLeft !== null && trialDaysLeft <= 5 && (
          <div className={`px-4 py-2.5 text-center text-xs font-medium ${trialDaysLeft === 0 ? "bg-red-600 text-white" : "bg-amber-50 text-amber-800 border-b border-amber-200"}`}>
            {trialDaysLeft === 0
              ? "Tu período de prueba venció. Contactanos para continuar usando LexCore."
              : `Tu prueba gratuita vence en ${trialDaysLeft} día${trialDaysLeft !== 1 ? "s" : ""}. Contactanos para continuar.`}
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 px-4 lg:px-6 py-6">{children}</main>
      </div>

      {/* Help widget — floating, siempre presente cuando hay sesión */}
      {session && <HelpWidget token={token ?? ""} />}

      {/* Mandatory studio config modal — formulario inline */}
      {studioConfigured === false && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-md mx-0 sm:mx-4 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-brand-600 px-6 py-5">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Configurá tu estudio</h2>
              <p className="text-sm text-brand-100 mt-1">Confirmá los datos del estudio para continuar.</p>
            </div>
            <form
              className="px-6 py-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token) return;
                setStudioSaving(true);
                setStudioError("");
                try {
                  await api.patch("/studios/me", {
                    name: studioForm.name || undefined,
                    email_contacto: studioForm.email_contacto,
                  }, token);
                  setStudioConfigured(true);
                } catch (err) {
                  setStudioError(err instanceof Error ? err.message : "Error al guardar");
                } finally {
                  setStudioSaving(false);
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Nombre del estudio</label>
                <input
                  value={studioForm.name}
                  onChange={(e) => setStudioForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Estudio Jurídico García & Asociados"
                  className="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Email de contacto <span className="text-red-500">*</span></label>
                <input
                  required
                  type="email"
                  value={studioForm.email_contacto}
                  onChange={(e) => setStudioForm((f) => ({ ...f, email_contacto: e.target.value }))}
                  placeholder="contacto@tuestudio.com"
                  className="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                />
                <p className="text-xs text-ink-400 mt-1">Para notificaciones y contacto de clientes</p>
              </div>
              {studioError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{studioError}</p>
              )}
              <button
                type="submit"
                disabled={studioSaving || !studioForm.email_contacto}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95"
              >
                {studioSaving ? "Guardando…" : "Confirmar y continuar →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-ink-100 flex z-20 pb-[env(safe-area-inset-bottom)]">
        {NAV_MOBILE.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const showBadge = item.badge && urgentes > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative ${
                active ? "text-brand-600 border-t-2 border-brand-600 bg-brand-50/50 -mt-px" : "text-ink-400"
              }`}
            >
              {item.icon}
              {item.label}
              {showBadge && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {urgentes > 9 ? "9+" : urgentes}
                </span>
              )}
            </Link>
          );
        })}
        {/* Botón Más */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${moreOpen ? "text-brand-600" : "text-ink-400"}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Más
        </button>
      </nav>

      {/* Drawer "Más" mobile */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="w-10 h-1 bg-ink-200 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {NAV_MORE.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${active ? "bg-brand-50 text-brand-600" : "text-ink-600 hover:bg-ink-50"}`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
