import Link from "next/link";

export const metadata = { title: "Términos y Condiciones — LexCore" };

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-ink-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/login" className="text-ink-400 hover:text-ink-600 transition text-sm">
            ← Volver
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 space-y-6 text-sm text-ink-700 leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 mb-1">Términos y Condiciones</h1>
            <p className="text-xs text-ink-400">Última actualización: abril 2026</p>
          </div>

          <p>
            Al crear una cuenta en <strong>LexCore</strong> aceptás los siguientes términos y condiciones de uso.
            Si no estás de acuerdo, no uses el servicio.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">1. Descripción del servicio</h2>
            <p>
              LexCore es una plataforma SaaS (Software as a Service) de gestión para estudios jurídicos que permite
              administrar expedientes, clientes, vencimientos, tareas, documentos y honorarios. El servicio se brinda
              «tal cual» (as-is) con acceso vía navegador web.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">2. Registro y cuenta</h2>
            <ul className="list-disc pl-5 space-y-1 text-ink-600">
              <li>Para usar LexCore debés registrar un estudio con datos verídicos.</li>
              <li>Sos responsable de mantener la confidencialidad de tu contraseña.</li>
              <li>Cada cuenta personal es intransferible.</li>
              <li>Podés invitar miembros a tu estudio; sos responsable de su actividad.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">3. Período de prueba</h2>
            <p>
              Nuevos estudios acceden a un período de prueba gratuito de 30 días con todas las funcionalidades
              habilitadas. Al vencer el trial, el acceso pasa a modo lectura hasta contratar un plan pago. Los datos
              no se eliminan automáticamente.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">4. Uso aceptable</h2>
            <p>Queda prohibido usar LexCore para:</p>
            <ul className="list-disc pl-5 space-y-1 text-ink-600">
              <li>Actividades ilegales o fraudulentas.</li>
              <li>Almacenar información de personas sin base legal o legítimo interés.</li>
              <li>Intentar acceder a datos de otros estudios.</li>
              <li>Realizar ingeniería inversa o extraer datos masivamente sin autorización.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">5. Propiedad de los datos</h2>
            <p>
              Todos los datos ingresados (expedientes, clientes, documentos) son propiedad del estudio que los cargó.
              LexCore no adquiere derechos sobre ellos. Podés exportar o solicitar eliminación de tus datos en cualquier
              momento escribiendo a{" "}
              <a href="mailto:privacidad@lexcore.app" className="text-brand-600 hover:underline">
                privacidad@lexcore.app
              </a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">6. Disponibilidad del servicio</h2>
            <p>
              Nos comprometemos a mantener una disponibilidad razonable del servicio. No garantizamos disponibilidad
              continua del 100%. Realizamos backups diarios para prevenir pérdida de datos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">7. Limitación de responsabilidad</h2>
            <p>
              LexCore es una herramienta de gestión interna. No es responsable de decisiones jurídicas tomadas con base
              en la información gestionada en la plataforma. El usuario es responsable de la exactitud de los datos que
              carga.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">8. Modificaciones</h2>
            <p>
              Podemos modificar estos términos. Notificaremos cambios sustanciales por correo electrónico con al menos
              15 días de anticipación. El uso continuado del servicio implica aceptación.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">9. Jurisdicción</h2>
            <p>
              Estos términos se rigen por las leyes de la República Argentina. Para cualquier controversia las partes
              se someten a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.
            </p>
          </section>

          <div className="pt-4 border-t border-ink-100 flex gap-4 text-xs text-ink-400">
            <Link href="/privacidad" className="hover:text-brand-600 transition">Política de Privacidad</Link>
            <Link href="/login" className="hover:text-brand-600 transition">Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
