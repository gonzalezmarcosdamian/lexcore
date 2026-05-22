"use client";
import { useEffect } from "react";

/**
 * Bloquea el scroll del body mientras el componente está montado y `active` es true.
 * Evita que el fondo se mueva cuando hay un modal o bottom sheet abierto.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [active]);
}
