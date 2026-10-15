import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's rendered height, so layouts can fill exactly the space the element
 * leaves (e.g. the chat panel stretching down to the input bar instead of leaving a gap).
 * Returns a ref to attach and the current height in px (0 until measured).
 */
export function useElementHeight<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  const measure = useCallback(() => {
    const h = ref.current?.getBoundingClientRect().height ?? 0;
    setHeight(prev => (Math.abs(prev - h) < 0.5 ? prev : Math.round(h)));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return [ref, height];
}
