import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playGavelTap } from '../lib/soundEffects';
import { HOME_ART } from '../lib/heroAssets';
import { computeArtLayout } from '../lib/homeArt';
import type { ArtLayout } from '../lib/homeArt';
import PlayModePopup, { type PlayMode } from './PlayModePopup';

interface HomePageProps {
  /** Starts play in the chosen mode: signs in as a guest if needed, then opens the right screen */
  onPlay: (mode: PlayMode) => Promise<void>;
  onOpenSettings: () => Promise<void>;
  /** For players who already have an email account */
  onSignIn: () => void;
  /** Hide the "Sign in" link for players already signed in with an account */
  hasAccount: boolean;
  /** Signed in (guest or account): show the Dashboard button */
  signedIn: boolean;
  /** Ongoing games + invitations waiting, shown as a badge on Dashboard */
  waitingCount: number;
  /** Running games + your own challenges/invites still waiting — shown on the Play popup's My games */
  myGamesCount?: number;
  onOpenDashboard: () => void;
}

// Mild dark covering behind the controls: clear at its top edge, then ~30% at PLAY easing to ~60% at the bottom, so the
// artwork stays visible as a background while the text stays readable.
const ACTIONS_SHADE =
  'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.58) 40%, rgba(0,0,0,0.44) 72%, rgba(0,0,0,0.22) 90%, rgba(0,0,0,0) 100%)';

// The picture column never gets wider than this (matches max-w-[560px] below)
const ART_MAX_WIDTH = 560;

const STEPS = ['Pick a case and your side', 'Grill witnesses. Catch the lie.', 'Object, argue, win the verdict'];

export default function HomePage({ onPlay, onOpenSettings, onSignIn, hasAccount, signedIn, waitingCount, myGamesCount = 0, onOpenDashboard }: HomePageProps) {
  const [soundOn, setSoundOn] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [busy, setBusy] = useState<'play' | 'settings' | null>(null);
  const [artLoaded, setArtLoaded] = useState(false);
  const artRef = useRef<HTMLImageElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const [artLayout, setArtLayout] = useState<ArtLayout | null>(null);

  // Size and place the picture for this screen: lawyers under the tagline, judge, gavel and desk top above PLAY (see lib/homeArt).
  useLayoutEffect(() => {
    const measure = () => {
      const page = pageRef.current, play = playRef.current, tagline = taglineRef.current;
      if (!page || !play || !tagline) return;
      const pr = page.getBoundingClientRect();
      if (!pr.width || !pr.height) return;
      const next = computeArtLayout({
        columnWidth: Math.min(pr.width, ART_MAX_WIDTH),
        pageHeight: pr.height,
        controlsTop: play.getBoundingClientRect().top - pr.top,
        taglineBottom: tagline.getBoundingClientRect().bottom - pr.top,
      });
      setArtLayout(prev => (prev && next && prev.scale === next.scale && prev.top === next.top && prev.left === next.left ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && pageRef.current) ro.observe(pageRef.current);
    document.fonts?.ready.then(measure).catch(() => undefined); // text height can change once the logo font arrives
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [signedIn, hasAccount]);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  // The image is usually already cached (preloaded during the splash), in which case onLoad has already fired.
  useEffect(() => {
    if (artRef.current?.complete && artRef.current.naturalWidth > 0) setArtLoaded(true);
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playGavelTap();
  };

  const run = async (kind: 'play' | 'settings', fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={pageRef} className="relative min-h-[100dvh] overflow-hidden bg-[#05060a]">
      {/* The artwork fills the whole screen: clear at the top, then dimmed behind the buttons (see the Actions gradient) */}
      <div aria-hidden="true" className="absolute inset-0 flex justify-center">
        <div className="relative h-full w-full max-w-[560px]">
          {/* The picture is sized and placed by computeArtLayout (before it is measured it simply covers the column) */}
          <div
            className="absolute"
            style={{
              ...(artLayout
                ? { left: artLayout.left, top: artLayout.top, width: artLayout.width, height: artLayout.height }
                : { left: 0, top: 0, width: '100%', height: '100%' }),
              backgroundImage: `url(${HOME_ART.lqip})`,
              backgroundSize: '100% 100%',
            }}
          >
            <picture>
              <source srcSet={HOME_ART.webp} type="image/webp" />
              <img
                src={HOME_ART.jpg}
                alt=""
                width={HOME_ART.width}
                height={HOME_ART.height}
                ref={artRef}
                onLoad={() => setArtLoaded(true)}
                decoding="async"
                draggable={false}
                className={`absolute inset-0 w-full h-full object-cover object-top select-none transition-opacity duration-500 ${artLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </picture>
          </div>
          {/* soft shade at the very top so the logo and sound button always read */}
          <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 to-transparent" />
        </div>
      </div>

      <div className="relative z-10 min-h-[100dvh] flex flex-col">
        {/* Sound toggle floats over the top-right corner so it doesn't use up a row */}
        <button
          onClick={toggleSound}
          aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
          className="absolute right-5 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          style={{ top: 'max(env(safe-area-inset-top), 16px)' }}
        >
          {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {/* Logo */}
        <div className="px-5 flex flex-col items-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <h1 className="font-game leading-[0.9] select-none text-center">
            <span className="logo-gold block text-4xl sm:text-5xl">COURTROOM</span>
            <span className="logo-gold block text-6xl sm:text-7xl">QUEST</span>
          </h1>
          <p ref={taglineRef} className="mt-2.5 rounded-full bg-black/60 border border-[#F2B705]/60 px-4 py-1 text-[11px] sm:text-xs font-bold tracking-[0.2em] text-white backdrop-blur-sm">
            EVERY CASE HAS A LOOPHOLE
          </p>
        </div>

        {/* The picture shows through here */}
        <div className="flex-1 min-h-[120px]" />

        {/* Actions: sit on a dark covering that starts just above PLAY, so the artwork becomes a quiet background behind the text */}
        <div className="px-5 pt-8" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)', background: ACTIONS_SHADE }}>
        <div className="w-full max-w-sm mx-auto space-y-2.5">
          <button
            ref={playRef}
            onClick={() => {
              playGavelTap();
              setShowModes(true);
            }}
            disabled={busy !== null}
            className="w-full rounded-2xl bg-[#FFD43B] text-black font-game text-4xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-70"
          >
            {busy === 'play' ? 'ONE SEC…' : 'PLAY'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            {signedIn ? (
              <button
                onClick={onOpenDashboard}
                className="relative rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2 active:translate-y-0.5 transition-transform"
              >
                {waitingCount > 0 && (
                  <span className="absolute -top-2 -right-1 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-black">
                    {waitingCount}
                  </span>
                )}
                <span className="block font-game text-2xl text-white leading-none">DASHBOARD</span>
                <span className="block mt-1 text-[10px] font-bold tracking-[0.2em] text-[#FFD43B]">GAMES & INVITES</span>
              </button>
            ) : (
              <button
                onClick={() => setShowLearnMore(true)}
                className="rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2 active:translate-y-0.5 transition-transform"
              >
                <span className="block font-game text-2xl text-white leading-none">LEARN MORE</span>
                <span className="block mt-1 text-[10px] font-bold tracking-[0.2em] text-[#FFD43B]">HOW IT WORKS</span>
              </button>
            )}
            <button
              onClick={() => run('settings', onOpenSettings)}
              disabled={busy !== null}
              className="rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2 active:translate-y-0.5 transition-transform disabled:opacity-70"
            >
              <span className="block font-game text-2xl text-white leading-none">{busy === 'settings' ? '…' : 'SETTINGS'}</span>
              <span className="block mt-1 text-[10px] font-bold tracking-[0.2em] text-[#FFD43B]">DIFFICULTY</span>
            </button>
          </div>

          <ol className="flex flex-col items-center gap-1 pt-1 [@media(max-height:700px)]:hidden">
            {STEPS.map((text, i) => (
              <li key={text} className="flex items-center gap-3 rounded-full bg-black/60 border border-white/15 pl-1.5 pr-5 py-0.5 backdrop-blur-sm">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FFD43B] text-black font-black text-sm">{i + 1}</span>
                <span className="text-white font-semibold text-[14px]">{text}</span>
              </li>
            ))}
          </ol>

          {(signedIn || !hasAccount) && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1">
              {signedIn && (
                <button onClick={() => setShowLearnMore(true)} className="whitespace-nowrap text-[11px] font-bold tracking-[0.15em] text-white/70 underline underline-offset-4">
                  HOW IT WORKS
                </button>
              )}
              {!hasAccount && (
                <button onClick={onSignIn} className="whitespace-nowrap text-[11px] font-bold tracking-[0.15em] text-white/70 underline underline-offset-4">
                  HAVE AN ACCOUNT? SIGN IN
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {showModes && (
        <PlayModePopup
          showMyGames={signedIn}
          myGamesCount={myGamesCount}
          onClose={() => setShowModes(false)}
          onSelect={mode => {
            setShowModes(false);
            run('play', () => onPlay(mode));
          }}
        />
      )}
      {showLearnMore && <LearnMore onClose={() => setShowLearnMore(false)} />}
    </div>
  );
}

function LearnMore({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 p-6 text-white"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20">
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-game text-3xl text-[#FFD43B] mb-1">HOW IT WORKS</h2>
        <p className="text-white/60 text-sm mb-5">Play a full trial, from case file to verdict.</p>

        <div className="space-y-4">
          <Item n="1" title="Read the case file">
            Review the evidence and witnesses — the loophole is in there somewhere.
          </Item>
          <Item n="2" title="Pick your side">
            Prosecute or defend. Same case, completely different game depending on your side.
          </Item>
          <Item n="3" title="Argue it out">
            Object, examine witnesses, and convince the court before your opponent does.
          </Item>
        </div>

        <h3 className="mt-7 mb-3 text-xs font-bold tracking-[0.25em] text-white/50">WAYS TO PLAY</h3>
        <div className="space-y-3 text-sm text-white/80 leading-relaxed">
          <p><span className="font-bold text-white">Full AI courtroom.</span> A real judge rules on your objections, witnesses answer based on their actual testimony, and opposing counsel argues back — all reactive to what you actually say.</p>
          <p><span className="font-bold text-white">Face a real opponent.</span> Open a live challenge, pick your side, and argue the case against another player — no AI counsel, just the two of you.</p>
          <p><span className="font-bold text-white">Your own case.</span> Build a custom case with your own evidence and witnesses.</p>
        </div>

        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-[#FFD43B] text-black font-game text-2xl py-2.5">
          GOT IT
        </button>
      </div>
    </div>
  );
}

function Item({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B] text-black font-black text-sm">{n}</span>
      <div>
        <h4 className="font-bold">{title}</h4>
        <p className="text-sm text-white/70 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
