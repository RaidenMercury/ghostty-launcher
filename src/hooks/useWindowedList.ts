import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ventana de filas para listas largas: solo se montan las visibles (± overscan).
 * Evita que WebKit pinte y cachee tiles de 75-300 filas al scrollear.
 */
export function useWindowedList(count: number, rowHeight: number, overscan = 6) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setViewport(el.clientHeight || 600);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(viewport / rowHeight) + overscan * 2;
  const end = Math.min(count, start + visible);

  return {
    ref,
    onScroll,
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  };
}
