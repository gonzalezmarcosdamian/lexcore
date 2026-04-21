"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      router.push(callbackUrl);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl });
  }

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Ingresar</h1>
        <p className="text-sm text-ink-400 mt-1">Bienvenido de vuelta a tu estudio</p>
      </div>

      {/* Google */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white border border-ink-200 rounded-xl py-3 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 hover:border-ink-300 transition-all shadow-sm disabled:opacity-50 mb-5"
      >
        <GoogleIcon />
        Continuar con Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-ink-100" />
        <span className="text-xs text-ink-400 font-medium">o con email</span>
        <div className="flex-1 h-px bg-ink-100" />
      </div>

      {/* Form */}
      <form onSubmit={handleCredentials} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-600 mb-1.5 tracking-wide uppercase">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="vos@estudio.com"
            className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition shadow-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-ink-600 tracking-wide uppercase">
              Contraseña
            </label>
            <Link href="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700 font-medium transition">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full bg-white border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition shadow-sm"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ingresando…
            </span>
          ) : "Ingresar"}
        </button>
      </form>

      <p className="text-center text-sm text-ink-400 mt-6">
        ¿Primera vez?{" "}
        <Link href="/register" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
          Registrá tu estudio
        </Link>
      </p>
      <div className="flex justify-center gap-4 text-xs text-ink-400 mt-2">
        <Link href="/privacidad" className="hover:text-brand-600 transition">Privacidad</Link>
        <Link href="/terminos" className="hover:text-brand-600 transition">Términos</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginPageInner /></Suspense>;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
