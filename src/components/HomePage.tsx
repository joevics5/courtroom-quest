import { useEffect, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playGavelTap } from '../lib/soundEffects';
import HeroBackground from './HeroBackground';
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
  onOpenDashboard: () => void;
}

const STEPS = ['Pick a case and your side', 'Grill witnesses. Catch the lie.', 'Object, argue, win the verdict'];

export default function HomePage({ onPlay, onOpenSettings, onSignIn, hasAccount, signedIn, waitingCount, onOpenDashboard }: HomePageProps) {
  const [soundOn, setSoundOn] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [busy, setBusy] = useState<'play' | 'settings' | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
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
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/65 via-black/15 to-black/85" />

      <div className="relative z-10 min-h-[100dvh] flex flex-col px-5" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        {/* Top bar */}
        <div className="flex justify-end">
          <button
            onClick={toggleSound}
            aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          >
            {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Logo */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="font-game leading-[0.9] select-none">
            <span className="logo-gold block text-6xl sm:text-7xl">COURTROOM</span>
            <span className="logo-gold block text-8xl sm:text-9xl">QUEST</span>
          </h1>
          <div className="mt-4 h-1.5 w-60 rounded-full bg-[#F2B705]" />
          <p className="mt-4 rounded-full bg-black/60 border border-[#F2B705]/60 px-5 py-1.5 text-[12px] sm:text-sm font-bold tracking-[0.22em] text-white backdrop-blur-sm">
            EVERY CASE HAS A LOOPHOLE
          </p>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm mx-auto space-y-3">
          <button
            onClick={() => {
              playGavelTap();
              setShowModes(true);
            }}
            disabled={busy !== null}
            className="w-full rounded-2xl bg-[#FFD43B] text-black font-game text-4xl py-3.5 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-70"
          >
            {busy === 'play' ? 'ONE SEC…' : 'PLAY'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            {signedIn ? (
              <button
                onClick={onOpenDashboard}
                className="relative rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2.5 active:translate-y-0.5 transition-transform"
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
                className="rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2.5 active:translate-y-0.5 transition-transform"
              >
                <span className="block font-game text-2xl text-white leading-none">LEARN MORE</span>
                <span className="block mt-1 text-[10px] font-bold tracking-[0.2em] text-[#FFD43B]">HOW IT WORKS</span>
              </button>
            )}
            <button
              onClick={() => run('settings', onOpenSettings)}
              disabled={busy !== null}
              className="rounded-xl bg-[#1d1b18]/90 border border-white/15 py-2.5 active:translate-y-0.5 transition-transform disabled:opacity-70"
            >
              <span className="block font-game text-2xl text-white leading-none">{busy === 'settings' ? '…' : 'SETTINGS'}</span>
              <span className="block mt-1 text-[10px] font-bold tracking-[0.2em] text-[#FFD43B]">DIFFICULTY</span>
            </button>
          </div>

          <ol className="flex flex-col items-center gap-2 pt-2">
            {STEPS.map((text, i) => (
              <li key={text} className="flex items-center gap-3 rounded-full bg-black/60 border border-white/15 pl-1.5 pr-5 py-1.5 backdrop-blur-sm">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B] text-black font-black text-sm">{i + 1}</span>
                <span className="text-white font-semibold text-[15px]">{text}</span>
              </li>
            ))}
          </ol>

          {(signedIn || !hasAccount) && (
            <div className="flex items-center justify-center gap-5 pt-1">
              {signedIn && (
                <button onClick={() => setShowLearnMore(true)} className="text-[11px] font-bold tracking-[0.2em] text-white/60 underline underline-offset-4">
                  HOW IT WORKS
                </button>
              )}
              {!hasAccount && (
                <button onClick={onSignIn} className="text-[11px] font-bold tracking-[0.2em] text-white/60 underline underline-offset-4">
                  HAVE AN ACCOUNT? SIGN IN
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showModes && (
        <PlayModePopup
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
