"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { api, SearchResult } from "@/lib/api";
import { SkeletonText, SkeletonAvatar } from "@/components/ui/skeletons";
import { SearchModal } from "@/components/ui/search-modal";

const NAV_SIDEBAR = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/expedientes",
    label: "Expedientes",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: "/vencimientos",
    label: "Vencimientos",
    badge: true, // se rellena dinámicamente con urgentes
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/gastos",
    label: "Contable",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: "/equipo",
    label: "Equipo",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Mi perfil",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const NAV_MOBILE = NAV_SIDEBAR.slice(0, 4);

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
  const pathname = usePathname();
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const [urgentesList, setUrgentesList] = useState<{ id: string; fecha: string; descripcion: string; tipo: string; expediente_id?: string }[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const urgentes = urgentesList.length;

  const initial = session?.user?.name?.charAt(0)?.toUpperCase() ?? "?";
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
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">LexCore</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV_SIDEBAR.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const showBadge = item.badge && urgentes > 0;

            return (
              <Link
                key={item.href}
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
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-ink-800 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            {!session ? (
              <>
                <SkeletonAvatar size="sm" />
                <SkeletonText lines={2} className="flex-1" />
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-white">{initial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{session.user?.name ?? "Usuario"}</p>
                  <p className="text-xs text-ink-400 truncate capitalize">{session.user?.role ?? ""}</p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-400 hover:text-ink-100 hover:bg-ink-800/50 transition-all"
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
                {NAV_SIDEBAR.find((n) => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label ?? "Inicio"}
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
                <div ref={notifRef} className="hidden lg:block relative">
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold hover:bg-red-100 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {urgentes} urgente{urgentes !== 1 ? "s" : ""}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-ink-100 shadow-xl z-50 overflow-hidden">
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
                          </Link>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 border-t border-ink-100">
                        <Link href="/vencimientos" onClick={() => setNotifOpen(false)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                          Ver todos los vencimientos →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="hidden lg:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">{initial}</span>
                </div>
                <span className="text-sm text-ink-600 font-medium max-w-[140px] truncate">{session?.user?.name}</span>
              </div>
              {/* Mobile: salir */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="lg:hidden text-xs text-ink-400 hover:text-ink-700 border border-ink-200 hover:border-ink-300 px-3 py-1.5 rounded-lg transition-all"
              >
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 lg:px-6 py-6">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-ink-100 flex z-20">
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
      </nav>
    </div>
  );
}
