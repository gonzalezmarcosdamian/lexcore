export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-[480px] flex-shrink-0 bg-ink-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decoración geométrica */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-600/10 rounded-full blur-2xl" />
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-400/10 to-transparent" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">LexCore</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug">
              Gestioná tu estudio<br />con precisión.
            </h2>
            <p className="text-ink-200 mt-3 text-base leading-relaxed">
              Expedientes, vencimientos, clientes y equipo — todo en un solo lugar, sin papeles.
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-3">
            {[
              "Alertas de vencimientos en tiempo real",
              "Multi-usuario con roles por expediente",
              "Integración con Google Calendar",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-ink-200">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-ink-400">© 2026 LexCore · Plataforma para estudios jurídicos</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-ink-50 min-h-screen">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 justify-center mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <span className="font-bold text-ink-900 text-lg">LexCore</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
