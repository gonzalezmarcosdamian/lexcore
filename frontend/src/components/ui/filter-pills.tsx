"use client";

import { useRef } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterPillsRowProps {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  activeColor?: "brand" | "purple" | "blue" | "amber" | "red";
}

const COLOR_MAP = {
  brand:  { active: "bg-brand-600 text-white border-brand-600",  hover: "hover:border-brand-300 hover:text-brand-700" },
  purple: { active: "bg-purple-600 text-white border-purple-600", hover: "hover:border-purple-300 hover:text-purple-700" },
  blue:   { active: "bg-blue-600 text-white border-blue-600",     hover: "hover:border-blue-300 hover:text-blue-700" },
  amber:  { active: "bg-amber-600 text-white border-amber-600",   hover: "hover:border-amber-300 hover:text-amber-700" },
  red:    { active: "bg-red-600 text-white border-red-600",       hover: "hover:border-red-300 hover:text-red-700" },
};

export function FilterPillsRow({
  label,
  options,
  value,
  onChange,
  activeColor = "brand",
}: FilterPillsRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { active, hover } = COLOR_MAP[activeColor];

  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && (
        <span className="flex-shrink-0 text-xs font-semibold text-ink-400 uppercase tracking-wide">
          {label}
        </span>
      )}
      {/* Fade hints on edges */}
      <div className="relative flex-1 min-w-0">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", overscrollBehaviorX: "contain" }}
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={`
                  flex-shrink-0 px-3.5 py-2 min-h-[36px] rounded-full border text-xs font-semibold
                  transition-all duration-100 active:scale-95 cursor-pointer whitespace-nowrap
                  ${isActive
                    ? active
                    : `bg-white text-ink-500 border-ink-200 ${hover}`
                  }
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />
      </div>
    </div>
  );
}

// ── Variante compacta para mobile con label dentro de la fila scrolleable ──

interface FilterGroupProps {
  groups: {
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (v: string) => void;
    activeColor?: FilterPillsRowProps["activeColor"];
  }[];
}

export function FilterGroup({ groups }: FilterGroupProps) {
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <FilterPillsRow key={g.label} {...g} />
      ))}
    </div>
  );
}
