"use client";
import { useEffect } from "react";

/**
 * Bloquea el scroll del body mientras el componente está montado y `active` es true.
 * Evita que el fondo se mueva cuando hay un modal o bottom sheet abierto.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
