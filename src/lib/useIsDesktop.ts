import { useEffect, useState } from 'react';

/** The width (px) from which screens switch to their wide desktop layout. Matches Tailwind's `lg`. */
export const DESKTOP_MIN_WIDTH = 1024;

const query = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);

/** True on a desktop-sized window. False where it can't be measured (tests, server), so phones and tests get the phone layout. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return desktop;
}
