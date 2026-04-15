"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Ruta solo para dev — bypass de login para revisar la UI
// URL: http://localhost:3001/dev/autologin
export default function DevAutoLoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [msg, setMsg] = useState("Cerrando sesión anterior…");

  useEffect(() => {
    if (status === "loading") return;

    async function doLogin() {
      // Primero cerramos sesión para limpiar JWT viejo
      if (status === "authenticated") {
        setMsg("Cerrando sesión anterior…");
        await signOut({ redirect: false });
        // signOut actualiza el estado — el efecto se re-ejecuta con status="unauthenticated"
        return;
      }
      // Ahora hacemos signIn con las credenciales del seed
      setMsg("Iniciando sesión con usuario demo…");
      const res = await signIn("credentials", {
        email: "ingonzalezdamian@gmail.com",
        password: "lexcore2026",
        redirect: false,
      });
      if (res?.ok) {
        setMsg("Sesión iniciada — redirigiendo al dashboard…");
        router.push("/dashboard");
      } else {
        setMsg("Error al hacer login. Verificá que el seed corrió: docker compose exec backend python scripts/seed_demo.py");
      }
    }

    doLogin();
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="text-center">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm text-ink-600">{msg}</p>
        <p className="text-xs text-ink-400 mt-2">Ruta de desarrollo — no exponer en prod</p>
      </div>
    </div>
  );
}
