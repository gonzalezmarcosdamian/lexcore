import Link from "next/link";

export const metadata = { title: "Política de Privacidad — LexCore" };

export default function PrivacidadPage() {
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
            <h1 className="text-2xl font-bold text-ink-900 mb-1">Política de Privacidad</h1>
            <p className="text-xs text-ink-400">Última actualización: abril 2026</p>
          </div>

          <p>
            LexCore («nosotros», «la plataforma») opera el servicio de gestión de estudios jurídicos disponible en{" "}
            <strong>lexcore.app</strong>. Esta política describe cómo recopilamos, usamos y protegemos la información
            personal de nuestros usuarios, en cumplimiento de la{" "}
            <strong>Ley N.º 25.326 de Protección de Datos Personales</strong> de la República Argentina y demás
            normativa aplicable.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">1. Responsable del tratamiento</h2>
            <p>
              El responsable del archivo de datos personales es LexCore. Ante cualquier consulta podés escribirnos a{" "}
              <a href="mailto:privacidad@lexcore.app" className="text-brand-600 hover:underline">
                privacidad@lexcore.app
              </a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1 text-ink-600">
              <li><strong>Datos de cuenta:</strong> nombre completo, dirección de correo electrónico y contraseña (almacenada con hash bcrypt).</li>
              <li><strong>Datos del estudio:</strong> nombre del estudio, dirección, teléfono y email de contacto.</li>
              <li><strong>Datos de expedientes y clientes:</strong> información jurídica ingresada por el usuario en el ejercicio de su actividad profesional.</li>
              <li><strong>Datos de uso:</strong> registros de acceso, dirección IP y eventos de navegación para mejora del servicio y seguridad.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">3. Finalidad del tratamiento</h2>
            <ul className="list-disc pl-5 space-y-1 text-ink-600">
              <li>Prestar el servicio de gestión de estudio jurídico.</li>
              <li>Enviar notificaciones operativas (vencimientos, alertas) vinculadas a la cuenta.</li>
              <li>Garantizar la seguridad de la plataforma.</li>
              <li>Mejorar las funcionalidades del producto.</li>
            </ul>
            <p>No utilizamos los datos para publicidad de terceros ni los cedemos a terceros salvo requerimiento legal.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">4. Confidencialidad y seguridad</h2>
            <p>
              Toda la información transmitida entre el navegador y nuestros servidores se cifra mediante TLS. Los datos
              se almacenan en servidores ubicados en la Unión Europea (Railway / Frankfurt) con backups diarios cifrados.
              El acceso a los datos de producción está restringido al equipo técnico autorizado.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">5. Aislamiento de datos (multi-tenant)</h2>
            <p>
              Cada estudio opera en un entorno lógicamente aislado. Ningún usuario de un estudio puede acceder a los
              datos de otro. Este aislamiento se garantiza a nivel de base de datos mediante{" "}
              <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">studio_id</code> en cada registro.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">6. Derechos del titular</h2>
            <p>
              Conforme a la Ley 25.326, el titular de los datos tiene derecho a acceder, rectificar, suprimir y oponerse
              al tratamiento de sus datos personales. Para ejercerlos, escribí a{" "}
              <a href="mailto:privacidad@lexcore.app" className="text-brand-600 hover:underline">
                privacidad@lexcore.app
              </a>{" "}
              indicando tu nombre y el estudio al que pertenecés.
            </p>
            <p className="text-xs text-ink-400">
              La DIRECCIÓN NACIONAL DE PROTECCIÓN DE DATOS PERSONALES, Órgano de Control de la Ley N.º 25.326, tiene la
              atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las
              normas sobre protección de datos personales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">7. Cookies</h2>
            <p>
              Utilizamos únicamente cookies de sesión necesarias para la autenticación. No usamos cookies de rastreo ni
              de publicidad.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink-900">8. Cambios a esta política</h2>
            <p>
              Cualquier modificación sustancial será notificada por correo electrónico con al menos 15 días de
              anticipación.
            </p>
          </section>

          <div className="pt-4 border-t border-ink-100 flex gap-4 text-xs text-ink-400">
            <Link href="/terminos" className="hover:text-brand-600 transition">Términos y Condiciones</Link>
            <Link href="/login" className="hover:text-brand-600 transition">Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
