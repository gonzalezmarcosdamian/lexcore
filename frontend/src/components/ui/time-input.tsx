"use client";

import { useRef, useState, useEffect } from "react";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  ringColor?: string;
  disabled?: boolean;
}

function applyTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return digits.slice(0, 2) + ":" + digits.slice(2);
  return digits;
}

function isValidTime(val: string): boolean {
  const m = val.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  return parseInt(m[1]) < 24 && parseInt(m[2]) < 60;
}

export function TimeInput({
  value,
  onChange,
  required,
  placeholder = "HH:MM",
  className = "",
  ringColor = "focus-within:ring-brand-400",
  disabled,
}: TimeInputProps) {
  const [textVal, setTextVal] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setTextVal(value);
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyTimeMask(e.target.value);
    setTextVal(masked);
    if (isValidTime(masked)) onChange(masked);
    else if (masked === "") onChange("");
  };

  const handleBlur = () => {
    setFocused(false);
    if (isValidTime(textVal)) {
      onChange(textVal);
    } else if (textVal.replace(/\D/g,"").length > 0) {
      setTextVal(value); // restaurar
    }
  };

  return (
    <div className={`relative flex items-center w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 gap-2 transition focus-within:ring-2 focus-within:border-transparent ${ringColor} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <input
        type="text"
        inputMode="numeric"
        value={textVal}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onChange={handleChange}
        className="flex-1 text-sm bg-transparent outline-none text-ink-900 placeholder:text-ink-400 min-w-0"
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => { onChange(""); setTextVal(""); }}
          className="text-ink-300 hover:text-ink-500 transition flex-shrink-0"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
