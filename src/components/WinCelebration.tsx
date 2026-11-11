import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import CoinIcon from './CoinIcon';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';

const BALLOON_COLORS = ['#FFD43B', '#FF4D5A', '#2EC4B6', '#4DA3FF', '#B26BFF', '#FF8A3D'];
const CONFETTI_COLORS = ['#FFD43B', '#FF4D5A', '#2EC4B6', '#4DA3FF', '#B26BFF', '#FFFFFF'];
const BURST_PARTICLES = 8;
/** The balloons and confetti are gone from the page after this long. */
const SHOW_MS = 5500;
/** The "You earned" pop stays this long. */
const TOAST_MS = 3800;

type Vars = CSSProperties & Record<`--${string}`, string | number>;

interface Balloon { id: number; x: number; color: string; rise: number; dur: number; delay: number; }
interface Confetti { id: number; x: number; color: string; dur: number; delay: number; drift: number; }

// Spread across the screen without randomness, so it looks the same every time and tests are stable.
function makeBalloons(): Balloon[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i,
    x: 6 + ((i * 37) % 86),
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    rise: 38 + ((i * 17) % 34),   // how high it gets before popping, as % of the screen height
    dur: 1.5 + ((i * 7) % 8) / 10,
    delay: ((i * 13) % 12) / 10
  }));
}

function makeConfetti(): Confetti[] {
  return Array.from({ length: 34 }, (_, i) => ({
    id: i,
    x: (i * 29) % 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dur: 2.2 + ((i * 11) % 14) / 10,
    delay: ((i * 7) % 16) / 10,
    drift: ((i * 19) % 60) - 30
  }));
}

function BalloonGraphic({ color }: { color: string }) {
  return (
    <svg width="46" height="74" viewBox="0 0 40 64" aria-hidden="true">
      <path d="M20 43 l-3.6 5.2 h7.2z" fill={color} />
      <path d="M20 48 q-5 6 0 11 t0 8" stroke="rgba(255,255,255,0.55)" strokeWidth="1" fill="none" />
      <ellipse cx="20" cy="22" rx="17" ry="21" fill={color} />
      <ellipse cx="13" cy="13" rx="4" ry="7" fill="#fff" fillOpacity="0.38" transform="rotate(25 13 13)" />
    </svg>
  );
}

/**
 * Shown when the player wins: balloons float up and pop in bursts, confetti falls, and a small
 * "You earned N coins" pops in. Pure decoration (the verdict screen still shows everything) and it never
 * blocks taps. With reduced motion there are no balloons or confetti, just the coin message fading in.
 */
export default function WinCelebration({ coins }: { coins: number | null }) {
  const reduced = usePrefersReducedMotion();
  const balloons = useMemo(makeBalloons, []);
  const confetti = useMemo(makeConfetti, []);
  const [showGraphics, setShowGraphics] = useState(true);
  const [showToast, setShowToast] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowGraphics(false), SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  const hasCoins = coins !== null && coins > 0;
  useEffect(() => {
    if (!hasCoins) return;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [hasCoins, coins]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" data-testid="win-celebration">
      {!reduced && showGraphics && (
        <div aria-hidden="true">
          {confetti.map(c => (
            <span
              key={c.id}
              data-testid="confetti"
              className="celebrate-confetti"
              style={{ left: `${c.x}%`, background: c.color, '--dur': `${c.dur}s`, '--delay': `${c.delay}s`, '--drift': `${c.drift}px` } as Vars}
            />
          ))}
          {balloons.map(b => {
            const popAt = b.delay + b.dur;
            return (
              <div
                key={b.id}
                data-testid="balloon"
                className="celebrate-balloon"
                style={{ left: `${b.x}%`, '--rise': `-${b.rise}vh`, '--dur': `${b.dur}s`, '--delay': `${b.delay}s` } as Vars}
              >
                <div className="celebrate-balloon-body" style={{ '--pop-at': `${popAt}s` } as Vars}>
                  <BalloonGraphic color={b.color} />
                </div>
                {Array.from({ length: BURST_PARTICLES }, (_, p) => (
                  <span
                    key={p}
                    className="celebrate-burst"
                    style={{
                      background: BALLOON_COLORS[(b.id + p) % BALLOON_COLORS.length],
                      '--pop-at': `${popAt}s`,
                      '--angle': `${(360 / BURST_PARTICLES) * p}deg`
                    } as Vars}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {hasCoins && showToast && (
        <div className="absolute inset-x-0 flex justify-center" style={{ top: 'max(calc(env(safe-area-inset-top) + 64px), 80px)' }}>
          <div
            role="status"
            className="celebrate-toast inline-flex items-center gap-2 rounded-full border border-[#FFD43B]/70 bg-black/85 px-5 py-2 text-xl font-black text-white shadow-[0_0_28px_rgba(255,212,59,0.45)]"
          >
            <span>You earned</span>
            <span className="text-[#FFD43B]">{coins}</span>
            <CoinIcon size={22} />
          </div>
        </div>
      )}
    </div>
  );
}
