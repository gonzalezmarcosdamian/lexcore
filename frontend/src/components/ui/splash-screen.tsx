"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const VALUE_PROPS = [
  { icon: "⚖️", title: "Tus expedientes, siempre a mano", desc: "Accedé a cualquier caso, movimiento y documento desde cualquier dispositivo, en segundos." },
  { icon: "🔔", title: "Nunca más perdas un vencimiento", desc: "Alertas automáticas para plazos críticos. Los urgentes aparecen destacados antes de que sea tarde." },
  { icon: "👥", title: "Tu equipo sincronizado", desc: "Invitá colaboradores, asigná roles y llevá el control de quién hace qué en cada expediente." },
  { icon: "💰", title: "Control total de honorarios", desc: "Registrá lo acordado, los pagos recibidos y el saldo pendiente por cada caso." },
];

const SETUP_STEPS = [
  {
    key: "perfil",
    icon: "🏛️",
    title: "Configurá tu estudio",
    desc: "Agregá el nombre del estudio, CUIT y datos de contacto.",
    cta: "Ir a Perfil",
    href: "/perfil",
    skip: "Podés hacerlo después desde Estudio → Perfil en el menú lateral.",
  },
  {
    key: "equipo",
    icon: "👥",
    title: "Invitá a tu equipo",
    desc: "Sumá abogados, asignales roles y empezá a colaborar.",
    cta: "Ir a Equipo",
    href: "/equipo",
    skip: "Podés invitar miembros después desde Estudio → Equipo.",
  },
  {
    key: "cliente",
    icon: "👤",
    title: "Cargá tu primer cliente",
    desc: "Sin clientes no hay expedientes. Empezá por acá.",
    cta: "Nuevo cliente",
    href: "/clientes/nuevo",
    skip: "Podés agregar clientes después desde el módulo Expedientes → Clientes.",
  },
  {
    key: "expediente",
    icon: "📁",
    title: "Creá tu primer expediente",
    desc: "Asociá un cliente, asigná responsables y empezá a gestionar.",
    cta: "Nuevo expediente",
    href: "/expedientes/nuevo",
    skip: "Podés crear expedientes después desde el módulo Expedientes.",
  },
];

const SPLASH_KEY = "lexcore_onboarded";
const WIZARD_KEY = "lexcore_wizard_done";

type Phase = "splash" | "wizard" | "done";

export function SplashScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  const [skippedMsg, setSkippedMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SPLASH_KEY)) {
      setPhase("done");
    } else {
      setPhase("splash");
    }
  }, []);

  function finishSplash() {
    setLeaving(true);
    setTimeout(() => {
      localStorage.setItem(SPLASH_KEY, "1");
      setLeaving(false);
      if (localStorage.getItem(WIZARD_KEY)) {
        setPhase("done");
      } else {
        setPhase("wizard");
      }
    }, 300);
  }

  function handleCta() {
    localStorage.setItem(WIZARD_KEY, "1");
    router.push(SETUP_STEPS[step].href);
  }

  function handleSkip() {
    setSkippedMsg(SETUP_STEPS[step].skip);
    setTimeout(() => {
      setSkippedMsg("");
      if (step < SETUP_STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        localStorage.setItem(WIZARD_KEY, "1");
        setPhase("done");
      }
    }, 2200);
  }

  function handleFinish() {
    localStorage.setItem(WIZARD_KEY, "1");
    setPhase("done");
  }

  if (!phase || phase === "done") return null;

  if (phase === "splash") {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/95 backdrop-blur-sm transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}>
        <div className="w-full max-w-lg mx-4">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">LexCore</span>
          </div>
          <p className="text-center text-ink-300 text-sm mb-8 leading-relaxed">
            La plataforma de gestión para estudios de abogados.<br />Simple, rápida y siempre disponible.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {VALUE_PROPS.map((vp, i) => (
              <div key={i} className="bg-ink-800/80 border border-ink-700 rounded-2xl p-4 flex gap-3">
                <span className="text-2xl flex-shrink-0">{vp.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white leading-snug">{vp.title}</p>
                  <p className="text-xs text-ink-400 mt-1 leading-snug">{vp.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={finishSplash}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base px-10 py-3.5 rounded-2xl shadow-lg transition-all active:scale-95"
            >
              Comenzar →
            </button>
            <p className="text-xs text-ink-600">No volvés a ver esta pantalla</p>
          </div>
        </div>
      </div>
    );
  }

  // Wizard de configuración
  const current = SETUP_STEPS[step];
  const isLast = step === SETUP_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-brand-100 uppercase tracking-wider">
              Paso {step + 1} de {SETUP_STEPS.length}
            </span>
            <button onClick={handleFinish} className="text-brand-200 hover:text-white text-xs transition">
              Saltar todo →
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-brand-500/50 rounded-full h-1.5 mt-2">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-500"
              style={{ width: `${((step + 1) / SETUP_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">{current.title}</h2>
          <p className="text-sm text-ink-500 leading-relaxed mb-6">{current.desc}</p>

          {skippedMsg ? (
            <div className="bg-ink-50 border border-ink-200 rounded-2xl px-4 py-3 text-sm text-ink-600 flex items-start gap-2">
              <span className="text-base">💡</span>
              <span>{skippedMsg}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCta}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95"
              >
                {current.cta}
              </button>
              <button
                onClick={handleSkip}
                className="w-full text-ink-400 hover:text-ink-700 text-sm font-medium py-2 transition"
              >
                {isLast ? "Terminar configuración" : "Dejar para después →"}
              </button>
            </div>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pb-5">
          {SETUP_STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${i === step ? "w-6 h-2 bg-brand-600" : i < step ? "w-2 h-2 bg-brand-300" : "w-2 h-2 bg-ink-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
