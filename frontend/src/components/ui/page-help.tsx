"use client";

import { useState, useRef, useEffect } from "react";

export interface HelpItem {
  icon: string;
  title: string;
  description: string;
}

interface PageHelpProps {
  title: string;
  description?: string;
  items: HelpItem[];
  tip?: string;
}

export function PageHelp({ title, description, items, tip }: PageHelpProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ayuda de la pantalla"
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
          ${open
            ? "bg-brand-600 text-white shadow-md"
            : "bg-ink-100 text-ink-400 hover:bg-brand-50 hover:text-brand-600 border border-ink-200"
          }`}
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 bg-white rounded-2xl shadow-xl border border-ink-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="bg-brand-600 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {description && (
              <p className="text-xs text-brand-100 mt-0.5 leading-snug">{description}</p>
            )}
          </div>

          {/* Items */}
          <div className="divide-y divide-ink-50">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-ink-900">{item.title}</p>
                  <p className="text-xs text-ink-500 leading-snug mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tip */}
          {tip && (
            <div className="bg-amber-50 border-t border-amber-100 px-4 py-2.5">
              <p className="text-xs text-amber-700 leading-snug">
                <span className="font-semibold">Tip:</span> {tip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
