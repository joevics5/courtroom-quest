import { useEffect, useState } from 'react';

export const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** True while the browser is reading text aloud (held briefly so sentence gaps don't flicker). */
export function useTtsSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!TTS_SUPPORTED) return;
    let holdUntil = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (window.speechSynthesis.speaking) holdUntil = now + 500;
      setSpeaking(now < holdUntil);
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  return speaking;
}

/** True for a few seconds after `key` changes (no speech available: animate when a message arrives). */
export function useRecentPulse(key: string | null | undefined, ms: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) return;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);
  return on;
}

/** True while the on-screen keyboard is probably open (the visible area shrank a lot). */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const baseline = { h: vv.height };
    const update = () => {
      if (vv.height > baseline.h) baseline.h = vv.height; // rotation or browser bars: keep the tallest
      setOpen(baseline.h - vv.height > 150);
    };
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return open;
}
