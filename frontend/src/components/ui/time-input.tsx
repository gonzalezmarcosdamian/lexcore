"use client";

import { useRef } from "react";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  ringColor?: string;
  disabled?: boolean;
}

export function TimeInput({
  value,
  onChange,
  required,
  placeholder = "Sin hora",
  className = "",
  ringColor = "focus-within:ring-brand-400",
  disabled,
}: TimeInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const open = () => {
    if (disabled) return;
    try { ref.current?.showPicker(); } catch { ref.current?.click(); }
  };

  return (
    <div
      className={`relative flex items-center w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 gap-2 cursor-pointer transition hover:border-ink-300 focus-within:ring-2 focus-within:border-transparent ${ringColor} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      onClick={open}
    >
      <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`flex-1 text-sm ${value ? "text-ink-900 font-medium" : "text-ink-400"}`}>
        {value || placeholder}
      </span>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          className="text-ink-300 hover:text-ink-500 transition flex-shrink-0"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <input
        ref={ref}
        type="time"
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}
