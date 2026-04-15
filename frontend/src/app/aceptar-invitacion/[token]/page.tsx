"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface InvitacionData {
  email: string;
  full_name: string;
  rol: string;
  tenant_id: string;
}

export default function AceptarInvitacionPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invitacion, setInvitacion] = useState<InvitacionData | null>(null);
  const [error, setError] = useState("");
  const [loadingInv, setLoadingInv] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API}/invitaciones/aceptar/${token}`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Invitación inválida o expirada");
        return r.json();
      })
      .then(setInvitacion)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingInv(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/auth/register-invited`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.detail ?? "Error al registrar usuario");
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa] px-4">
        <div className="bg-white rounded-2xl border border-[#e8eef4] p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#0f1c2e] mb-2">¡Cuenta creada!</h2>
          <p className="text-sm text-[#6b8aaa]">Redirigiendo al login en unos segundos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fa] px-4">
      <div className="bg-white rounded-2xl border border-[#e8eef4] shadow-sm overflow-hidden w-full max-w-md">
        {/* Header */}
        <div className="bg-[#0f1c2e] px-8 py-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#2b4dd4] rounded-lg flex items-center justify-center">
            <span className="text-white text-base font-bold">⚖</span>
          </div>
          <span className="text-white text-lg font-bold tracking-tight">LexCore</span>
        </div>

        <div className="px-8 py-8">
          {loadingInv ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-2/3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ) : error && !invitacion ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#0f1c2e] mb-1">Invitación inválida</h2>
              <p className="text-sm text-[#6b8aaa]">{error}</p>
              <p className="text-sm text-[#6b8aaa] mt-1">El link puede haber expirado o ya fue utilizado.</p>
            </div>
          ) : invitacion ? (
            <>
              <h2 className="text-xl font-bold text-[#0f1c2e] mb-1">Aceptar invitación</h2>
              <p className="text-sm text-[#6b8aaa] mb-6">
                Vas a unirte como <strong className="text-[#2b4dd4] capitalize">{invitacion.rol}</strong>.
                Elegí una contraseña para tu cuenta.
              </p>

              <div className="bg-[#f4f7fa] rounded-xl p-4 mb-6 space-y-1">
                <p className="text-xs text-[#6b8aaa] uppercase tracking-wide font-medium">Tu cuenta</p>
                <p className="text-sm font-semibold text-[#0f1c2e]">{invitacion.full_name}</p>
                <p className="text-sm text-[#3a5272]">{invitacion.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#3a5272] mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    className="w-full border border-[#e8eef4] rounded-xl px-4 py-2.5 text-sm text-[#0f1c2e] placeholder:text-[#b0c0d0] focus:outline-none focus:ring-2 focus:ring-[#2b4dd4]/20 focus:border-[#2b4dd4]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3a5272] mb-1.5">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetí la contraseña"
                    required
                    className="w-full border border-[#e8eef4] rounded-xl px-4 py-2.5 text-sm text-[#0f1c2e] placeholder:text-[#b0c0d0] focus:outline-none focus:ring-2 focus:ring-[#2b4dd4]/20 focus:border-[#2b4dd4]"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#2b4dd4] hover:bg-[#2440b8] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
                >
                  {submitting ? "Creando cuenta..." : "Crear mi cuenta →"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
