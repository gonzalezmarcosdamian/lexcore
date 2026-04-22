"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface StudioDetail {
  studio: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    billing_cycle: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    created_at: string;
    email_contacto: string | null;
  };
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
  }[];
  stats: {
    expedientes: number;
    vencimientos: number;
    tareas: number;
    documentos: number;
  };
  subscription_events: {
    event_type: string;
    plan: string | null;
    billing_cycle: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
}

const planBadge: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  estudio: "bg-brand-100 text-brand-700",
  read_only: "bg-ink-100 text-ink-500",
};

const roleBadge: Record<string, string> = {
  admin: "bg-brand-100 text-brand-700",
  socio: "bg-purple-100 text-purple-700",
  asociado: "bg-blue-100 text-blue-700",
  pasante: "bg-ink-100 text-ink-500",
};

export default function StudioDetailPage() {
  const { data: session } = useSession();
  const token = session?.user?.backendToken;
  const params = useParams();
  const router = useRouter();
  const studioId = params.id as string;

  const [detail, setDetail] = useState<StudioDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !studioId) return;
    api.get<StudioDetail>(`/superadmin/studios/${studioId}/detail`, token)
      .then(setDetail)
      .catch((e) => {
        if (e.message?.includes("403")) router.replace("/dashboard");
      })
      .finally(() => setLoading(false));
  }, [token, studioId]);

  const trialDays = detail?.studio.trial_ends_at
    ? Math.ceil((new Date(detail.studio.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/superadmin" className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a estudios
      </Link>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-ink-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : !detail ? (
        <p className="text-ink-400 text-sm">Studio no encontrado.</p>
      ) : (
        <>
          {/* Studio header */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-ink-900">{detail.studio.name}</h1>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadge[detail.studio.plan] ?? "bg-ink-100 text-ink-600"}`}>
                    {detail.studio.plan}
                  </span>
                  {detail.studio.subscription_status && (
                    <span className={`text-xs font-medium ${
                      detail.studio.subscription_status === "active" ? "text-green-600" :
                      detail.studio.subscription_status === "paused" ? "text-amber-600" : "text-red-500"
                    }`}>
                      {detail.studio.subscription_status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-400 mt-1">{detail.studio.slug}</p>
                {detail.studio.email_contacto && (
                  <p className="text-xs text-ink-500 mt-0.5">{detail.studio.email_contacto}</p>
                )}
              </div>
              <div className="text-right text-xs text-ink-400 flex-shrink-0">
                <p>Creado</p>
                <p className="font-medium text-ink-600">
                  {new Date(detail.studio.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
                {trialDays !== null && (
                  <p className={`mt-1 font-semibold ${trialDays <= 0 ? "text-red-500" : trialDays <= 5 ? "text-amber-600" : "text-ink-600"}`}>
                    {trialDays <= 0 ? "Trial vencido" : `Trial: ${trialDays}d`}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-ink-50">
              {[
                { label: "Expedientes", val: detail.stats.expedientes },
                { label: "Vencimientos", val: detail.stats.vencimientos },
                { label: "Tareas", val: detail.stats.tareas },
                { label: "Documentos", val: detail.stats.documentos },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold text-ink-900">{s.val}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-50">
              <h2 className="text-sm font-semibold text-ink-700">Usuarios ({detail.users.length})</h2>
            </div>
            <div className="divide-y divide-ink-50">
              {detail.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-700">
                      {u.name?.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{u.name || "—"}</p>
                    <p className="text-xs text-ink-400 truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${roleBadge[u.role] ?? "bg-ink-100 text-ink-500"}`}>
                    {u.role}
                  </span>
                  <span className="text-xs text-ink-400 flex-shrink-0 hidden sm:block">
                    {new Date(u.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              ))}
              {detail.users.length === 0 && (
                <p className="px-5 py-4 text-sm text-ink-400">Sin usuarios activos.</p>
              )}
            </div>
          </div>

          {/* Subscription events */}
          {detail.subscription_events.length > 0 && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-ink-50">
                <h2 className="text-sm font-semibold text-ink-700">Historial de suscripción</h2>
              </div>
              <div className="divide-y divide-ink-50">
                {detail.subscription_events.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-ink-700">{e.event_type}</span>
                        {e.plan && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${planBadge[e.plan] ?? "bg-ink-100 text-ink-500"}`}>
                            {e.plan}
                          </span>
                        )}
                      </div>
                      {Object.keys(e.metadata).length > 0 && (
                        <p className="text-xs text-ink-400 mt-0.5 font-mono truncate">
                          {JSON.stringify(e.metadata).slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-ink-400 flex-shrink-0">
                      {new Date(e.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
