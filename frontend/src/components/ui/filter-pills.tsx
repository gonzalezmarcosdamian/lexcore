"use client";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterPillsRowProps {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  activeColor?: "brand" | "purple" | "blue" | "amber" | "orange" | "red";
}

const COLOR_MAP = {
  brand:  { active: "bg-brand-600 text-white shadow-sm shadow-brand-600/30",   hover: "hover:bg-brand-50 hover:text-brand-700" },
  purple: { active: "bg-purple-600 text-white shadow-sm shadow-purple-600/30",  hover: "hover:bg-purple-50 hover:text-purple-700" },
  blue:   { active: "bg-blue-600 text-white shadow-sm shadow-blue-600/30",      hover: "hover:bg-blue-50 hover:text-blue-700" },
  amber:  { active: "bg-amber-600 text-white shadow-sm shadow-amber-600/30",    hover: "hover:bg-amber-50 hover:text-amber-700" },
  orange: { active: "bg-orange-600 text-white shadow-sm shadow-orange-600/30",  hover: "hover:bg-orange-50 hover:text-orange-700" },
  red:    { active: "bg-red-600 text-white shadow-sm shadow-red-600/30",        hover: "hover:bg-red-50 hover:text-red-700" },
};

export function FilterPillsRow({
  label,
  options,
  value,
  onChange,
  activeColor = "brand",
}: FilterPillsRowProps) {
  const { active, hover } = COLOR_MAP[activeColor];

  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && (
        <span className="flex-shrink-0 text-[11px] font-bold text-ink-400 uppercase tracking-widest">
          {label}
        </span>
      )}
      <div
        className="flex gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", overscrollBehaviorX: "contain" }}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`
                flex-shrink-0 px-3.5 py-1.5 min-h-[32px] rounded-lg text-xs font-semibold
                transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap
                ${isActive ? active : `bg-transparent text-ink-500 ${hover}`}
              `}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── FilterGroup: mobile = stack, desktop = barra única con separadores ────────

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
    <div className="bg-ink-50 border border-ink-100 rounded-xl px-3 py-2 flex flex-col gap-1.5">
      {groups.map((g) => (
        <FilterPillsRow key={g.label} {...g} />
      ))}
    </div>
  );
}
