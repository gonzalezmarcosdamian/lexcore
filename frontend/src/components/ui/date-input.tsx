"use client";

import { useRef, useState, useEffect } from "react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  ringColor?: string;
  disabled?: boolean;
}

// Convierte DD/MM/AAAA → YYYY-MM-DD, con validación de rangos
function parseDisplay(display: string): string {
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const day = parseInt(d, 10);
  const month = parseInt(mo, 10);
  const year = parseInt(y, 10);
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > 31) return "";
  if (year < 1900 || year > 2100) return "";
  // Validar que la fecha exista realmente (ej: 31/02 no existe)
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return "";
  return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

// Convierte YYYY-MM-DD → DD/MM/AAAA
function toDisplay(iso: string): string {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

// Aplica máscara automática mientras el usuario escribe
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 2) out = digits.slice(0, 2) + "/" + digits.slice(2);
  if (digits.length > 4) out = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
  return out;
}

export function DateInput({
  value,
  onChange,
  required,
  min,
  max,
  placeholder = "DD/MM/AAAA",
  className = "",
  ringColor = "focus-within:ring-brand-400",
  disabled,
}: DateInputProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [textVal, setTextVal] = useState(toDisplay(value));
  const [focused, setFocused] = useState(false);

  // Sync text when value changes externally
  useEffect(() => {
    if (!focused) setTextVal(toDisplay(value));
  }, [value, focused]);

  const formattedLabel = value
    ? new Date(value + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : "";

  // Desktop: click abre el picker nativo
  const openNative = () => {
    if (disabled) return;
    try { nativeRef.current?.showPicker(); } catch { nativeRef.current?.click(); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyMask(e.target.value);
    setTextVal(masked);
    const iso = parseDisplay(masked);
    if (iso) onChange(iso);
    // No emitir onChange("") mientras el usuario escribe a medias
  };

  const [invalid, setInvalid] = useState(false);

  const handleTextBlur = () => {
    setFocused(false);
    const iso = parseDisplay(textVal);
    if (iso) {
      onChange(iso);
      setTextVal(toDisplay(iso));
      setInvalid(false);
    } else if (textVal.replace(/\D/g, "").length > 0) {
      // Fecha incompleta o inválida — restaurar valor anterior y marcar error
      setTextVal(toDisplay(value));
      setInvalid(true);
    } else {
      setInvalid(false);
    }
  };

  const baseCls = `relative flex items-center w-full bg-white rounded-xl px-3 py-2.5 gap-2 transition focus-within:ring-2 focus-within:border-transparent
    ${invalid ? "border-red-400 ring-1 ring-red-300" : "border border-ink-200"}
    ${invalid ? "focus-within:ring-red-400" : ringColor}
    ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`;

  return (
    <div className={baseCls}>
      <svg className="w-4 h-4 text-ink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      {/* Mobile: texto con máscara */}
      <input
        type="text"
        inputMode="numeric"
        value={focused ? textVal : (formattedLabel || textVal)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onFocus={() => { setFocused(true); setTextVal(toDisplay(value)); }}
        onBlur={handleTextBlur}
        onChange={handleTextChange}
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

      {/* Input nativo oculto para mantener compatibilidad con formularios */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        min={min}
        max={max}
        tabIndex={-1}
        onChange={(e) => { onChange(e.target.value); setTextVal(toDisplay(e.target.value)); }}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
      />
    </div>
  );
}
