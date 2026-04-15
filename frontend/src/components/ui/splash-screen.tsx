"use client";

import { useEffect, useState } from "react";

const VALUE_PROPS = [
  {
    icon: "⚖️",
    title: "Tus expedientes, siempre a mano",
    desc: "Accedé a cualquier caso, movimiento y documento desde cualquier dispositivo, en segundos.",
  },
  {
    icon: "🔔",
    title: "Nunca más perdas un vencimiento",
    desc: "Alertas automáticas para plazos críticos. Los urgentes aparecen destacados antes de que sea tarde.",
  },
  {
    icon: "👥",
    title: "Tu equipo sincronizado",
    desc: "Invitá colaboradores, asigná roles y llevá el control de quién hace qué en cada expediente.",
  },
  {
    icon: "💰",
    title: "Control total de honorarios",
    desc: "Registrá lo acordado, los pagos recibidos y el saldo pendiente por cada caso.",
  },
];

const STORAGE_KEY = "lexcore_onboarded";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // DEV: siempre visible para testear — restaurar con localStorage check antes de prod
    setVisible(true);
  }, []);

  const handleStart = () => {
    setLeaving(true);
    setTimeout(() => {
      // DEV: no guardar en localStorage para que reaparezca siempre
      // localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    }, 350);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/95 backdrop-blur-sm transition-opacity duration-350 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-full max-w-lg mx-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">LexCore</span>
        </div>

        <p className="text-center text-ink-300 text-sm mb-8 leading-relaxed">
          La plataforma de gestión para estudios de abogados.<br />
          Simple, rápida y siempre disponible.
        </p>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {VALUE_PROPS.map((vp, i) => (
            <div
              key={i}
              className="bg-ink-800/80 border border-ink-700 rounded-2xl p-4 flex gap-3"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-2xl flex-shrink-0">{vp.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white leading-snug">{vp.title}</p>
                <p className="text-xs text-ink-400 mt-1 leading-snug">{vp.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleStart}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base px-10 py-3.5 rounded-2xl shadow-lg transition-all hover:shadow-brand-600/30 hover:shadow-xl active:scale-95"
          >
            Comenzar →
          </button>
          <p className="text-xs text-ink-600">No volvés a ver esta pantalla</p>
        </div>
      </div>
    </div>
  );
}
