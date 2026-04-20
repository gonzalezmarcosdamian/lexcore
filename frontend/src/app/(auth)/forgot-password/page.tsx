"use client";

import { useState, Suspense } from "react";
import Link from "next/link";

function ForgotPasswordInner() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Error al enviar el email. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">LexCore</span>
        </div>

        <div className="bg-ink-800 rounded-2xl border border-ink-700 p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-white font-bold text-xl mb-2">Revisá tu email</h2>
              <p className="text-ink-400 text-sm mb-6">
                Si el email está registrado, vas a recibir un link para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link href="/login" className="text-brand-400 hover:text-brand-300 text-sm font-medium transition">
                ← Volver al login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-white font-bold text-xl mb-1">Olvidé mi contraseña</h2>
              <p className="text-ink-400 text-sm mb-6">Ingresá tu email y te enviamos un link para restablecerla.</p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-ink-100 placeholder-ink-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl transition text-sm"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-ink-500">
                <Link href="/login" className="text-ink-400 hover:text-ink-200 transition">
                  ← Volver al login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordInner /></Suspense>;
}
