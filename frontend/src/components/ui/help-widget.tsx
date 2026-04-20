"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// ── FAQs ─────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    modulo: "Expedientes",
    preguntas: [
      {
        q: "¿Cómo creo un nuevo expediente?",
        a: "Desde el menú lateral andá a Expedientes y hacé clic en el botón \"+ Nuevo expediente\" (arriba a la derecha). El formulario tiene 2 pasos: primero completás carátula y fuero, después los datos del juzgado y el cliente.",
        link: { href: "/expedientes/nuevo", label: "Ir a Nuevo expediente" },
      },
      {
        q: "¿Qué diferencia hay entre Vencimiento y Tarea?",
        a: "Un Vencimiento es un plazo procesal con fecha fija (audiencia, presentación, pericia). Una Tarea es trabajo interno del estudio: redactar un escrito, llamar al cliente, preparar documentación. Los vencimientos aparecen en la agenda y generan alertas automáticas; las tareas tienen responsable y estado.",
      },
      {
        q: "¿Puedo cambiar el estado de un expediente a cerrado?",
        a: "Sí. Desde el detalle del expediente usá el selector de estado (activo / archivado / cerrado). Un expediente cerrado sigue siendo visible pero no aparece en búsquedas por defecto.",
      },
      {
        q: "¿Cómo busco un expediente rápido?",
        a: "Usá la búsqueda global con Cmd+K (Mac) o Ctrl+K (Windows). También hay un botón de lupa en el header. Podés buscar por número de expediente o por carátula con mínimo 3 caracteres.",
      },
    ],
  },
  {
    modulo: "Vencimientos",
    preguntas: [
      {
        q: "¿Cómo agrego un vencimiento a un expediente?",
        a: "Desde el detalle del expediente, abrí la sección Vencimientos y hacé clic en \"+\". El expediente ya viene pre-seleccionado. Elegí el tipo (audiencia, presentación, etc.), la descripción y la fecha.",
      },
      {
        q: "¿Cuándo se marca un vencimiento como urgente?",
        a: "Automáticamente: todo vencimiento con menos de 48 horas hasta su fecha se muestra en rojo y aparece en el badge de alertas del header. También recibís un email de alerta.",
      },
      {
        q: "¿Puedo sincronizar con Google Calendar?",
        a: "Sí, desde tu Perfil podés conectar tu Google Calendar. Una vez conectado, el botón \"Sync Calendar\" en Vencimientos sincroniza todos tus vencimientos pendientes al calendario que elijas.",
        link: { href: "/perfil", label: "Ir a Perfil" },
      },
    ],
  },
  {
    modulo: "Honorarios",
    preguntas: [
      {
        q: "¿Cómo registro un pago de honorarios?",
        a: "En el detalle del expediente, abrí la pestaña Honorarios. Primero creá el honorario (monto acordado, moneda, cuotas). Después usá el botón \"Registrar pago\" para cargar cada cobro recibido.",
      },
      {
        q: "¿Cómo veo todos los honorarios pendientes de cobro?",
        a: "En el dashboard tenés el widget de Honorarios pendientes. También podés ir a Contable → Ingresos para ver el resumen de honorarios cobrados vs. pendientes del período.",
        link: { href: "/gastos", label: "Ir a Contable" },
      },
    ],
  },
  {
    modulo: "Equipo",
    preguntas: [
      {
        q: "¿Cómo invito a un colega al estudio?",
        a: "Desde Equipo hacé clic en \"Invitar miembro\". Ingresá el email, nombre y rol (socio, asociado, pasante). El sistema envía un email con el link de activación.",
        link: { href: "/equipo", label: "Ir a Equipo" },
      },
      {
        q: "¿Qué puede hacer cada rol?",
        a: "Admin: acceso total, puede invitar y configurar el estudio. Socio: acceso total excepto configuración de billing. Asociado: gestión de sus expedientes asignados. Pasante: lectura y carga de movimientos.",
      },
    ],
  },
  {
    modulo: "Contable",
    preguntas: [
      {
        q: "¿Cómo registro un gasto del estudio?",
        a: "Desde Contable → Gastos, hacé clic en \"Nuevo gasto\". Podés registrarlo como puntual o recurrente (mensual, trimestral, anual), y asociarlo opcionalmente a un expediente.",
        link: { href: "/gastos", label: "Ir a Contable" },
      },
    ],
  },
  {
    modulo: "General",
    preguntas: [
      {
        q: "¿Cómo cambio mi contraseña?",
        a: "Desde tu Perfil (clic en tu nombre arriba a la derecha) → sección \"Mis datos\" → campo \"Nueva contraseña\".",
        link: { href: "/perfil", label: "Ir a Perfil" },
      },
      {
        q: "¿Puedo usar LexCore desde el celular?",
        a: "Sí. LexCore está diseñado mobile-first. Funciona completo en el navegador del celular en 375px. En móvil tenés la barra de navegación inferior con las secciones principales.",
      },
      {
        q: "¿Cómo exporto información?",
        a: "La exportación de datos (PDF, CSV) está en desarrollo. Por ahora podés ver toda la información en pantalla y los documentos adjuntos se descargan individualmente desde la pestaña Documentos de cada expediente.",
      },
    ],
  },
];

const MODULOS = [
  { value: "expedientes", label: "Expedientes" },
  { value: "vencimientos", label: "Vencimientos" },
  { value: "tareas", label: "Tareas" },
  { value: "honorarios", label: "Honorarios" },
  { value: "contable", label: "Contable" },
  { value: "equipo", label: "Equipo" },
  { value: "busqueda", label: "Búsqueda" },
  { value: "perfil", label: "Perfil / Configuración" },
  { value: "whatsapp", label: "WhatsApp Business" },
  { value: "otro", label: "Otro" },
];

// ── Sub-componentes ───────────────────────────────────────────────────────────

function FaqItem({ q, a, link }: { q: string; a: string; link?: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 py-3 text-left group"
      >
        <span className="text-sm text-ink-800 font-medium group-hover:text-ink-900 transition leading-snug">{q}</span>
        <svg
          className={`w-4 h-4 text-ink-400 flex-shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pb-3 space-y-2">
          <p className="text-sm text-ink-600 leading-relaxed">{a}</p>
          {link && (
            <Link
              href={link.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition"
            >
              {link.label}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab Ayuda ─────────────────────────────────────────────────────────────────

function TabAyuda({ onReportar }: { onReportar: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtradas = busqueda.trim().length < 2
    ? FAQS
    : FAQS.map((grupo) => ({
        ...grupo,
        preguntas: grupo.preguntas.filter(
          (p) =>
            p.q.toLowerCase().includes(busqueda.toLowerCase()) ||
            p.a.toLowerCase().includes(busqueda.toLowerCase())
        ),
      })).filter((g) => g.preguntas.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Buscador */}
      <div className="px-4 py-3 border-b border-ink-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en preguntas frecuentes…"
            className="w-full bg-ink-50 border border-ink-200 rounded-xl pl-8 pr-3 py-2 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lista FAQs */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtradas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-ink-500">Sin resultados para &ldquo;{busqueda}&rdquo;</p>
          </div>
        ) : (
          filtradas.map((grupo) => (
            <div key={grupo.modulo} className="mb-4">
              <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">{grupo.modulo}</p>
              <div className="bg-white rounded-xl border border-ink-100 px-3 divide-y divide-ink-50">
                {grupo.preguntas.map((item, i) => (
                  <FaqItem key={i} {...item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-ink-100 bg-ink-50/50">
        <p className="text-xs text-ink-500 text-center">
          ¿No encontraste lo que buscabas?{" "}
          <button onClick={onReportar} className="text-brand-600 hover:text-brand-700 font-semibold transition">
            Reportar un problema
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Tab Reportar ──────────────────────────────────────────────────────────────

function TabReportar({ token, onSuccess }: { token: string; onSuccess: (numero: number) => void }) {
  const pathname = usePathname();
  const [form, setForm] = useState({
    modulo: "",
    descripcion: "",
    urgente: false,
  });
  const [captura, setCaptura] = useState<File | null>(null);
  const [capturaPreview, setCapturaPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) { setError("La imagen no puede superar 5MB"); return; }
    if (!file.type.startsWith("image/")) { setError("Solo se aceptan imágenes (PNG, JPG)"); return; }
    setCaptura(file);
    setCapturaPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modulo) { setError("Seleccioná el módulo donde ocurrió el problema"); return; }
    if (!form.descripcion.trim()) { setError("Describí el problema"); return; }
    setSaving(true);
    setError("");

    try {
      let captura_url: string | undefined;

      // Upload de captura si existe
      if (captura) {
        const fd = new FormData();
        fd.append("file", captura);
        const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const uploadRes = await fetch(`${API}/soporte/upload-captura`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          captura_url = data.url;
        }
      }

      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${API}/soporte/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modulo: form.modulo,
          descripcion: form.descripcion,
          urgente: form.urgente,
          captura_url,
          url_origen: pathname,
          browser_info: navigator.userAgent.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error("Error al enviar el reporte");
      const data = await res.json();
      onSuccess(data.numero);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Módulo */}
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1.5">
            ¿En qué módulo ocurrió el problema? <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {MODULOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setForm({ ...form, modulo: m.value })}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition ${
                  form.modulo === m.value
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "bg-white border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1.5">
            Describí el problema <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            rows={4}
            maxLength={1000}
            placeholder="¿Qué estabas haciendo cuando ocurrió? ¿Qué esperabas que pasara? ¿Qué pasó en cambio?"
            className="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition resize-none"
          />
          <p className="text-[10px] text-ink-400 mt-1 text-right">{form.descripcion.length}/1000</p>
        </div>

        {/* Captura */}
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1.5">Captura de pantalla (opcional)</label>
          {capturaPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-ink-200">
              <img src={capturaPreview} alt="Captura" className="w-full max-h-40 object-cover" />
              <button
                type="button"
                onClick={() => { setCaptura(null); setCapturaPreview(null); }}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1 shadow-sm transition"
              >
                <svg className="w-3.5 h-3.5 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-ink-200 rounded-xl py-4 text-center hover:border-brand-300 hover:bg-brand-50/30 transition-colors group"
            >
              <svg className="w-5 h-5 text-ink-400 group-hover:text-brand-500 mx-auto mb-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-ink-500 group-hover:text-brand-600">Subir imagen</p>
              <p className="text-[10px] text-ink-400">PNG o JPG, máx. 5 MB</p>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
        </div>

        {/* Urgente */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={form.urgente}
              onChange={(e) => setForm({ ...form, urgente: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${form.urgente ? "bg-red-500 border-red-500" : "border-ink-300 bg-white"}`}>
              {form.urgente && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-800 group-hover:text-ink-900 transition">Marcar como urgente</p>
            <p className="text-xs text-ink-500">El problema impide el uso del sistema o afecta datos reales</p>
          </div>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-3 py-2.5">{error}</div>
        )}
      </div>

      {/* Footer con botón */}
      <div className="px-4 py-3 border-t border-ink-100 flex-shrink-0">
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando…
            </>
          ) : "Enviar reporte"}
        </button>
        <p className="text-[10px] text-ink-400 text-center mt-2">
          Se adjunta automáticamente: módulo actual, navegador y dispositivo.
        </p>
      </div>
    </form>
  );
}

// ── Confirmación enviado ───────────────────────────────────────────────────────

function TicketEnviado({ numero, onClose }: { numero: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-5">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold text-ink-900 mb-1">Reporte enviado</p>
        <p className="text-sm text-ink-500">
          Ticket <span className="font-mono font-semibold text-ink-700">#{String(numero).padStart(3, "0")}</span> creado.<br />
          Lo revisamos pronto y te respondemos por email.
        </p>
      </div>
      <button
        onClick={onClose}
        className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition"
      >
        Cerrar
      </button>
    </div>
  );
}

// ── Widget principal ──────────────────────────────────────────────────────────

export function HelpWidget({ token }: { token: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ayuda" | "reportar">("ayuda");
  const [ticketNumero, setTicketNumero] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(() => { setTab("ayuda"); setTicketNumero(null); }, 300);
  }, []);

  const handleSuccess = useCallback((numero: number) => {
    setTicketNumero(numero);
  }, []);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Ayuda y soporte"
        className={`fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[9999] w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-ink-800 text-white scale-95"
            : "bg-brand-600 text-white hover:bg-brand-700 hover:scale-105"
        }`}
        aria-label="Ayuda y soporte"
      >
        {open ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Overlay + Panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent"
            onClick={handleClose}
          />
          <div
            ref={panelRef}
            className="fixed z-50 flex flex-col bg-white shadow-2xl
              /* Mobile: full screen con bordes redondeados arriba */
              inset-x-0 bottom-0 rounded-t-2xl h-[90vh]
              /* Desktop: panel anclado a la derecha */
              lg:inset-auto lg:bottom-20 lg:right-6 lg:w-[400px] lg:h-[600px] lg:rounded-2xl lg:border lg:border-ink-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-ink-100 flex-shrink-0">
              {/* Drag handle mobile */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-ink-200 rounded-full lg:hidden" />
              <div>
                <p className="text-sm font-bold text-ink-900">Centro de ayuda</p>
                <p className="text-xs text-ink-400">LexCore</p>
              </div>
              <button onClick={handleClose} className="text-ink-400 hover:text-ink-700 transition p-1 rounded-lg hover:bg-ink-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            {!ticketNumero && (
              <div className="flex border-b border-ink-100 flex-shrink-0">
                {[
                  { key: "ayuda", label: "Preguntas frecuentes" },
                  { key: "reportar", label: "Reportar problema" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key as "ayuda" | "reportar")}
                    className={`flex-1 py-2.5 text-xs font-semibold transition border-b-2 ${
                      tab === t.key
                        ? "border-brand-600 text-brand-700"
                        : "border-transparent text-ink-500 hover:text-ink-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Contenido */}
            <div className="flex-1 overflow-hidden">
              {ticketNumero ? (
                <TicketEnviado numero={ticketNumero} onClose={handleClose} />
              ) : tab === "ayuda" ? (
                <TabAyuda onReportar={() => setTab("reportar")} />
              ) : (
                <TabReportar token={token ?? ""} onSuccess={handleSuccess} />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
