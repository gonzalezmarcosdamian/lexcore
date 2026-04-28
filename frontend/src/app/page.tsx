"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { trackBeginRegistration } from "@/lib/analytics";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function IconMoney() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function IconAlertClock() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconDocumentStack() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
  );
}
function IconMoneyQuestion() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}
function IconMapPin() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

// ── Dashboard mockup ──────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-4 bg-brand-500/10 rounded-3xl blur-2xl" />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-ink-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-ink-50 border-b border-ink-100">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="ml-3 flex-1 bg-white rounded-md px-3 py-1 text-[10px] text-ink-400 border border-ink-200">
            app.lexcore.com.ar/dashboard
          </div>
        </div>
        <div className="flex h-64 text-xs">
          <div className="w-36 bg-ink-900 flex flex-col gap-1 p-3 flex-shrink-0">
            <div className="text-white font-bold text-sm mb-3 px-1">LexCore</div>
            {["Inicio", "Expedientes", "Clientes", "Agenda", "Contable"].map((item, i) => (
              <div key={item} className={`px-2 py-1.5 rounded-lg text-[10px] font-medium ${i === 0 ? "bg-brand-600 text-white" : "text-ink-400 hover:text-white"}`}>
                {item}
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 bg-ink-50 overflow-hidden">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Expedientes activos", value: "24", color: "text-brand-600" },
                { label: "Vencimientos esta semana", value: "7", color: "text-amber-600" },
                { label: "Honorarios pendientes", value: "$180K", color: "text-emerald-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg p-2 border border-ink-100">
                  <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[9px] text-ink-400 leading-tight mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-ink-100 p-2 mb-2">
              <div className="text-[9px] font-semibold text-ink-600 mb-1.5 uppercase tracking-wide">Próximos vencimientos</div>
              {[
                { exp: "EXP-2026-0014", desc: "Contestar demanda", fecha: "Hoy", color: "text-red-600 bg-red-50" },
                { exp: "EXP-2026-0009", desc: "Audiencia preliminar", fecha: "Mañana", color: "text-amber-600 bg-amber-50" },
                { exp: "EXP-2026-0021", desc: "Presentar memorial", fecha: "Jue 25", color: "text-ink-600 bg-ink-50" },
              ].map((v) => (
                <div key={v.exp} className="flex items-center justify-between py-1 border-b border-ink-50 last:border-0">
                  <div>
                    <div className="text-[9px] font-medium text-ink-800">{v.desc}</div>
                    <div className="text-[8px] text-ink-400">{v.exp}</div>
                  </div>
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${v.color}`}>{v.fecha}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-ink-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center justify-between px-5 py-4 bg-white hover:bg-ink-50 transition-colors duration-150 cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-ink-900 pr-4">{q}</span>
        <svg
          className={`w-4 h-4 text-ink-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? "max-h-48" : "max-h-0"}`}
      >
        <div className="px-5 pb-4 pt-1 text-sm text-ink-600 bg-white border-t border-ink-100 leading-relaxed">
          {a}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-white text-ink-900"
      style={{ fontFamily: "var(--font-lato), system-ui, sans-serif" }}
    >

      {/* ── NAV ── */}
      <nav className={`sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-ink-100 transition-shadow duration-200 ${scrolled ? "shadow-md" : ""}`}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span
            className="text-lg font-bold text-ink-900 tracking-tight"
            style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
          >
            LexCore
          </span>
          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/login" className="text-sm text-ink-600 hover:text-ink-900 transition-colors px-3 py-1.5 cursor-pointer">
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="flex items-center text-sm font-semibold bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Empezar gratis <IconChevron />
            </Link>
          </div>
          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 text-ink-600 cursor-pointer" aria-label="Menú">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-ink-100 bg-white px-4 py-3 space-y-2">
            <Link href="/login" className="block text-sm text-ink-600 py-2">Iniciar sesión</Link>
            <Link href="/register" className="block text-sm font-semibold bg-amber-700 text-white px-4 py-2.5 rounded-xl text-center">
              Empezar gratis
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          Para estudios de abogados
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink-900 leading-tight max-w-3xl mx-auto mb-5"
          style={{ fontFamily: "var(--font-garamond), Georgia, serif", letterSpacing: "-0.01em" }}
        >
          Organizá, seguí y<br />
          <span className="text-brand-600">cobrá mejor</span> todos tus casos
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-ink-600 max-w-xl mx-auto mb-8 leading-relaxed">
          LexCore es el sistema de gestión que usan estudios jurídicos para no perder ningún vencimiento, tener el equipo alineado y cobrar lo que les corresponde.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <Link
            href="/register"
            onClick={trackBeginRegistration}
            className="flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-amber-700/20 cursor-pointer"
          >
            Empezar prueba gratuita — 30 días
            <IconChevron />
          </Link>
          <Link href="/login" className="flex items-center justify-center text-sm text-ink-600 hover:text-ink-900 border border-ink-200 hover:border-ink-300 px-6 py-3.5 rounded-xl transition-colors cursor-pointer">
            Ya tengo cuenta
          </Link>
        </div>

        {/* Trust pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-ink-500 mb-8">
          {["Sin tarjeta de crédito", "Configurado en 1 hora", "Soporte en español", "Sin contrato"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t}
            </span>
          ))}
        </div>

        {/* Social proof */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-16">
          <span className="text-xs text-ink-400 mr-1">Estudios en:</span>
          {["Buenos Aires", "Córdoba", "Rosario", "Mar del Plata"].map((city) => (
            <span key={city} className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 bg-ink-50 border border-ink-200 px-2.5 py-1 rounded-full">
              <IconMapPin />
              {city}
            </span>
          ))}
        </div>

        {/* Dashboard mockup */}
        <DashboardMockup />
      </section>

      {/* ── DOLOR ── */}
      <section className="bg-ink-50 border-y border-ink-100 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">El problema</p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-ink-900"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              ¿Te suena familiar?
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: <IconAlertClock />,
                iconColor: "bg-red-50 text-red-600",
                title: "Se te vence un plazo mientras estás en audiencia",
                body: "Los vencimientos no esperan. Un olvido puede costar el caso, la relación con el cliente o algo peor.",
              },
              {
                icon: <IconDocumentStack />,
                iconColor: "bg-orange-50 text-orange-600",
                title: "El expediente está en tres lugares distintos",
                body: "Email, WhatsApp, Drive y el bloc de notas. Todos desactualizados. Nadie sabe cuál es la versión final.",
              },
              {
                icon: <IconMoneyQuestion />,
                iconColor: "bg-yellow-50 text-yellow-700",
                title: "Sabés cuánto trabajás pero no cuánto cobrás",
                body: "Los honorarios se diluyen entre pagos parciales y clientes que siempre están por transferir.",
              },
            ].map((pain) => (
              <div key={pain.title} className="bg-white border border-ink-200 rounded-2xl p-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${pain.iconColor}`}>
                  {pain.icon}
                </div>
                <h3 className="text-base font-bold text-ink-900 mb-2 leading-snug">{pain.title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{pain.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUCIÓN ── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">La solución</p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-ink-900 max-w-2xl mx-auto"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              Todo lo que necesita tu estudio, en un solo lugar
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <IconBell />,
                color: "bg-red-50 text-red-600",
                title: "Vencimientos que no se olvidan",
                body: "Cargás el plazo una sola vez. LexCore te manda email automático y sincroniza con Google Calendar con dos alertas: a medianoche y 1 hora antes.",
                stat: "Email + Google Calendar con alertas",
              },
              {
                icon: <IconFolder />,
                color: "bg-blue-50 text-blue-600",
                title: "Expedientes centralizados",
                body: "Cada caso tiene su propia página: movimientos, equipo, documentos, tareas, honorarios y bitácora completa. Con número judicial y número interno.",
                stat: "Bitácora automática de todo lo que pasa",
              },
              {
                icon: <IconCheck />,
                color: "bg-purple-50 text-purple-600",
                title: "Agenda con feriados argentinos",
                body: "Calendario mensual con todos tus vencimientos y tareas. Marca automáticamente los feriados nacionales para que no cometas errores de cómputo.",
                stat: "Feriados AR integrados, sin configurar",
              },
              {
                icon: <IconMoney />,
                color: "bg-emerald-50 text-emerald-600",
                title: "Honorarios y cobros con cuotas",
                body: "Registrá honorarios en cuotas, pagos parciales y saldo en ARS y USD. El sistema te avisa el día que tenés que cobrar, antes de que se te pase.",
                stat: "Alertas de cobro el día del vencimiento",
              },
              {
                icon: <IconUsers />,
                color: "bg-amber-50 text-amber-600",
                title: "Tu estudio en equipo",
                body: "Invitá socios, asociados y pasantes con distintos niveles de acceso. Cada uno ve lo que le corresponde y nada más.",
                stat: "Admin, socio, asociado y pasante",
              },
              {
                icon: <IconChart />,
                color: "bg-indigo-50 text-indigo-600",
                title: "Contable con gráfico histórico",
                body: "Ingresos, egresos y resultado en un feed unificado. Gráfico de evolución de los últimos 3, 6 o 12 meses. Sin hojas de cálculo.",
                stat: "Evolución financiera de un vistazo",
              },
            ].map((feat) => (
              <div key={feat.title} className="border border-ink-100 rounded-2xl p-6 hover:border-brand-200 hover:shadow-sm transition-all duration-150 group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${feat.color}`}>
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-ink-900 mb-2">{feat.title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed mb-3">{feat.body}</p>
                <p className="text-xs font-semibold text-brand-600">{feat.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="bg-ink-900 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-brand-300 uppercase tracking-widest mb-3">Así de simple</p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-white"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              Empezás a usar LexCore en menos de una hora
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Creás tu estudio",
                body: "Te registrás, ponés el nombre del estudio y listo. Sin configuraciones técnicas ni instalación.",
                metric: "Registro en menos de 2 minutos",
              },
              {
                step: "02",
                title: "Cargás tus expedientes",
                body: "Importás o cargás manualmente tus casos activos. El número interno se genera automáticamente.",
                metric: "Primer expediente en 30 segundos",
              },
              {
                step: "03",
                title: "Tu equipo trabaja junto",
                body: "Invitás a tus colegas, asignás roles y empezás a delegar, registrar vencimientos y hacer seguimiento.",
                metric: "Invitación por email, acceso inmediato",
              },
            ].map((step) => (
              <div key={step.step} className="relative">
                <div className="text-5xl font-black text-brand-600/30 mb-3 leading-none">{step.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-ink-400 leading-relaxed mb-3">{step.body}</p>
                <p className="text-xs font-semibold text-brand-400">{step.metric}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRECIOS ── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">Precios</p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-ink-900 mb-3"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              Precio simple. Sin sorpresas.
            </h2>
            <p className="text-ink-500">Un solo plan para todo el estudio. Sin cobrar por usuario.</p>
          </div>
          <div className="max-w-sm mx-auto">
            <div className="border-2 border-amber-600 rounded-2xl overflow-hidden shadow-xl shadow-amber-600/10">
              {/* Header */}
              <div className="bg-amber-700 px-6 py-5 text-center">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Más elegido
                </div>
                <div className="text-white font-bold text-lg mb-1">Prueba gratuita</div>
                <div className="text-amber-100 text-sm">30 días con acceso completo</div>
              </div>
              {/* Features */}
              <div className="bg-white px-6 py-6">
                <ul className="space-y-3 mb-6">
                  {[
                    "Expedientes y clientes ilimitados",
                    "Hasta 2 usuarios en el trial",
                    "Vencimientos + Google Calendar sync",
                    "Agenda con feriados argentinos",
                    "Honorarios con cuotas y alertas de cobro",
                    "Módulo contable con gráfico histórico",
                    "Documentos adjuntos",
                    "Soporte por WhatsApp",
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Empezar gratis — sin tarjeta <IconChevron />
                </Link>
                <p className="text-center text-xs text-ink-400 mt-3">
                  Después del trial, desde <strong>$17.000 ARS/mes</strong> por estudio completo
                </p>
              </div>
            </div>
            {/* Guarantee */}
            <div className="mt-5 text-center">
              <p className="text-sm text-ink-500 flex items-center justify-center gap-1.5">
                <span className="text-emerald-600"><IconShield /></span>
                30 días gratis, sin tarjeta. Si luego suscribís y no quedás conforme, te devolvemos el primer pago.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-ink-50 border-t border-ink-100 py-20">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-3">FAQ</p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold text-ink-900"
              style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
            >
              Preguntas frecuentes
            </h2>
          </div>
          <div className="space-y-3">
            <FAQItem
              q="¿Necesito saber de tecnología para usarlo?"
              a="No. Si usás WhatsApp y Gmail, podés usar LexCore. Está diseñado para abogados, no para ingenieros. En menos de una hora tenés el estudio configurado."
            />
            <FAQItem
              q="¿Qué pasa con mis datos si dejo de usar LexCore?"
              a="Son tuyos. Podés exportar todos tus expedientes, movimientos y documentos en cualquier momento, en formatos estándar."
            />
            <FAQItem
              q="¿Puedo usarlo desde el celular?"
              a="Sí. LexCore está diseñado mobile-first. Funciona perfecto en cualquier dispositivo sin instalar ninguna app."
            />
            <FAQItem
              q="¿Cuántos usuarios puedo tener?"
              a="En el trial podés invitar hasta 2 usuarios. Los planes pagos incluyen desde 2 hasta usuarios ilimitados según el plan. En todos los casos el precio es por estudio, no por persona."
            />
            <FAQItem
              q="¿Es seguro guardar información de mis clientes ahí?"
              a="Sí. Los datos de cada estudio están completamente aislados de los demás. Usamos cifrado en tránsito y en reposo."
            />
            <FAQItem
              q="¿Puedo migrar mis expedientes actuales?"
              a="Sí. Si tenés la información en una planilla o en otro sistema, te ayudamos a migrarla. El onboarding incluye soporte directo por WhatsApp."
            />
            <FAQItem
              q="¿Cómo funciona el Google Calendar?"
              a="Conectás tu cuenta de Google desde tu perfil con un click. Luego podés sincronizar todos tus vencimientos, tareas y cobros de honorarios en el calendario que elijas. Cada evento tiene dos alertas automáticas: a medianoche del día y 1 hora antes."
            />
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-ink-900 mb-4 leading-tight"
            style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
          >
            Dejá de gestionar tu estudio con hojas de cálculo
          </h2>
          <p className="text-lg text-ink-500 mb-8 leading-relaxed">
            El primer mes es gratis. Configurás todo en una hora y empezás a trabajar con claridad desde el primer día.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-xl shadow-amber-700/20 cursor-pointer"
          >
            Empezar prueba gratuita — sin tarjeta <IconChevron />
          </Link>
          <p className="mt-4 text-sm text-ink-400">
            Ya lo usan estudios en Buenos Aires, Córdoba y Rosario
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-ink-100 bg-ink-50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
            <div>
              <div
                className="text-lg font-bold text-ink-900 mb-2"
                style={{ fontFamily: "var(--font-garamond), Georgia, serif" }}
              >
                LexCore
              </div>
              <p className="text-sm text-ink-500 max-w-xs mb-4">Gestión para estudios de abogados. Hecho en Argentina.</p>
              {/* Trust badges */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: <IconLock />, label: "SSL / HTTPS" },
                  { icon: <IconShield />, label: "Datos en Argentina" },
                  { icon: <IconMapPin />, label: "Sin tarjeta para el trial" },
                ].map((badge) => (
                  <span key={badge.label} className="inline-flex items-center gap-1.5 text-xs text-ink-500 bg-white border border-ink-200 px-2.5 py-1 rounded-full">
                    <span className="text-ink-400">{badge.icon}</span>
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-2">
                <div className="font-semibold text-ink-700 mb-3">Producto</div>
                <Link href="/register" className="block text-ink-500 hover:text-ink-800 transition-colors cursor-pointer">Empezar gratis</Link>
                <Link href="/login" className="block text-ink-500 hover:text-ink-800 transition-colors cursor-pointer">Iniciar sesión</Link>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-ink-700 mb-3">Legal</div>
                <Link href="/terminos" className="block text-ink-500 hover:text-ink-800 transition-colors cursor-pointer">Términos de uso</Link>
                <Link href="/privacidad" className="block text-ink-500 hover:text-ink-800 transition-colors cursor-pointer">Privacidad</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-ink-200 text-xs text-ink-400 text-center">
            © 2026 LexCore · Todos los derechos reservados
          </div>
        </div>
      </footer>
    </div>
  );
}
