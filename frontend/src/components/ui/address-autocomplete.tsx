"use client";

import { useEffect, useRef, useState } from "react";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface AddressValue {
  domicilio: string;
  domicilio_lat: number;
  domicilio_lng: number;
}

interface Props {
  value: string;
  onChange: (val: AddressValue | null, rawText: string) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({ value, onChange, placeholder = "Buscar dirección…", className }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); setSelected(!!value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(text: string) {
    setQuery(text);
    setSelected(false);
    onChange(null, text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 4) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=ar&limit=5&addressdetails=0`;
        const res = await fetch(url, { headers: { "Accept-Language": "es" } });
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function handleSelect(item: NominatimResult) {
    setQuery(item.display_name);
    setSelected(true);
    setOpen(false);
    setSuggestions([]);
    onChange(
      { domicilio: item.display_name, domicilio_lat: parseFloat(item.lat), domicilio_lng: parseFloat(item.lon) },
      item.display_name,
    );
  }

  const inputCls = className ?? "w-full bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`${inputCls} pr-8`}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-ink-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}
        {selected && !loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 text-sm">✓</div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-ink-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map(item => (
            <li
              key={item.place_id}
              onMouseDown={() => handleSelect(item)}
              className="px-3 py-2.5 text-sm text-ink-800 hover:bg-brand-50 hover:text-brand-700 cursor-pointer border-b border-ink-50 last:border-0 leading-snug"
            >
              {item.display_name}
            </li>
          ))}
          <li className="px-3 py-1.5 text-xs text-ink-300 text-right bg-ink-50">
            © OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
