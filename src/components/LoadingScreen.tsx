import { useEffect, useRef, useState } from 'react';
import { HERO_POSTER } from '../lib/heroAssets';

interface LoadingScreenProps {
  /** true once the saved session (if any) has been checked */
  authReady: boolean;
  onDone: () => void;
}

const MIN_SHOW_MS = 1000;
const HARD_TIMEOUT_MS = 4500;

const STATUS_LINES = ['SWEARING IN THE JURY…', 'CALLING THE WITNESSES…', 'ALL RISE…'];

/**
 * Boot screen shown when the site first opens. The bar tracks real work —
 * saved-session check, the home background image, and fonts — with a
 * minimum on-screen time so it never flashes, and a hard timeout so a slow
 * asset can never trap the player here.
 */
export default function LoadingScreen({ authReady, onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState(4);
  const [imageReady, setImageReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const startedAt = useRef(Date.now());
  const finished = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = img.onerror = () => setImageReady(true);
    img.src = HERO_POSTER;

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => setFontsReady(true)).catch(() => setFontsReady(true));
    } else {
      setFontsReady(true);
    }
  }, []);

  const allReady = authReady && imageReady && fontsReady;
  const target = 10 + (authReady ? 30 : 0) + (imageReady ? 30 : 0) + (fontsReady ? 30 : 0);

  useEffect(() => {
    const tick = setInterval(() => {
      setProgress(p => {
        const cap = allReady ? 100 : Math.min(target, 92);
        if (p >= cap) return p;
        return Math.min(cap, p + Math.max(0.6, (cap - p) * 0.12));
      });
    }, 60);
    return () => clearInterval(tick);
  }, [target, allReady]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (!allReady || progress < 99.5) return;
    const wait = Math.max(250, MIN_SHOW_MS - (Date.now() - startedAt.current));
    const t = setTimeout(finish, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady, progress]);

  useEffect(() => {
    const t = setTimeout(finish, HARD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = STATUS_LINES[Math.min(STATUS_LINES.length - 1, Math.floor((progress / 100) * STATUS_LINES.length))];

  return (
    <div className="min-h-[100dvh] bg-[#0b0d14] flex flex-col items-center justify-center px-8">
      <h1 className="font-game text-center leading-[0.9] select-none">
        <span className="logo-gold block text-6xl sm:text-7xl">COURTROOM</span>
        <span className="logo-gold block text-8xl sm:text-9xl">QUEST</span>
      </h1>

      <div className="mt-10 w-full max-w-xs h-3 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-[#F2B705]" style={{ width: `${progress}%`, transition: 'width 120ms linear' }} />
      </div>
      <p className="mt-5 text-xs sm:text-sm font-bold tracking-[0.3em] text-white/45 text-center">{status}</p>
    </div>
  );
}
