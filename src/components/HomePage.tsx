import { useEffect, useState } from 'react';
import { Scale, Gavel, Briefcase, FileText, Swords } from 'lucide-react';
import CrossfadeBackground from './CrossfadeBackground';
import { isSoundEnabled, setSoundEnabled, playGavelTap, playPaperRustle } from '../lib/soundEffects';

const HERO_IMAGES = [
  '/images/hero/witness-stand.jpg',
  '/images/hero/gavel-strike.jpg',
  '/images/hero/jury-box.jpg'
];

interface HomePageProps {
  onSignIn: () => void;
}

export default function HomePage({ onSignIn }: HomePageProps) {
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    // Silently no-ops if sound is off, or if the browser is blocking
    // audio because there hasn't been a user gesture yet — no need to
    // special-case that here.
    const timer = setTimeout(() => playGavelTap(), 850);
    return () => clearTimeout(timer);
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) playGavelTap();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--cq-ink)]">
      <CrossfadeBackground images={HERO_IMAGES} />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--cq-ink)]/92 via-[var(--cq-ink)]/90 to-[var(--cq-ink)]/97" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--cq-authority-dim)]/25 via-transparent to-transparent" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ============ NAV ============ */}
        <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          <nav className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[var(--cq-authority)] to-[var(--cq-authority-dim)] border border-[var(--cq-line)]">
                <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-[var(--cq-text)]">
                Courtroom <em className="not-italic text-[var(--cq-authority-hi)]">Quest</em>
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleSound}
                className="flex items-center justify-center w-10 h-10 bg-[var(--cq-panel)] hover:bg-[var(--cq-panel-2)] border border-[var(--cq-line)] text-[var(--cq-text-dim)] hover:text-[var(--cq-text)] rounded-lg transition-colors text-lg"
                title={soundOn ? 'Mute sound' : 'Enable sound'}
                aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
              >
                {soundOn ? '🔊' : '🔇'}
              </button>
              <button
                onClick={onSignIn}
                className="font-case-mono px-4 py-2.5 sm:px-6 sm:py-3 bg-[var(--cq-authority)] hover:bg-[var(--cq-authority-hi)] text-white rounded-lg text-sm font-semibold tracking-wide transition-colors"
              >
                Sign In
              </button>
            </div>
          </nav>
        </header>

        {/* ============ HERO ============ */}
        <main className="flex-1">
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 text-center">
            <span className="font-case-mono inline-flex items-center gap-2 px-4 py-1.5 border border-[var(--cq-line)] rounded-full text-[11px] tracking-widest text-[var(--cq-text-dim)] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cq-authority-hi)] shadow-[0_0_0_3px_rgba(76,125,255,0.25)]" />
              EVERY CASE HAS A LOOPHOLE. CAN YOU FIND IT?
            </span>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-[var(--cq-text)] leading-[1.05] tracking-tight mb-6">
              No side gets an
              <br />
              <span className="italic font-medium text-[var(--cq-authority-hi)]">easy win.</span>
            </h2>

            <p className="text-[var(--cq-text-dim)] text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10">
              Prosecute or defend. Question witnesses, exploit contradictions, find the argument
              nobody saw coming. The same case plays completely differently depending on your side.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <button
                onClick={onSignIn}
                onMouseEnter={() => playPaperRustle()}
                className="font-case-mono px-7 py-3.5 bg-[var(--cq-alert)] hover:bg-[var(--cq-alert-hi)] text-white text-sm font-semibold tracking-wide rounded transition-colors"
              >
                Find Your First Loophole
              </button>
              <a
                href="#how-it-works"
                className="font-case-mono px-7 py-3.5 border border-[var(--cq-line)] hover:border-[var(--cq-authority)] text-[var(--cq-text-dim)] hover:text-[var(--cq-text)] text-sm tracking-wide rounded transition-colors"
              >
                See How a Trial Works
              </a>
            </div>
            <p className="font-case-mono text-[11px] text-[var(--cq-text-dim)] opacity-75 mb-16">
              No account needed to watch a live trial
            </p>

            {/* ============ TRANSCRIPT MOCKUP — the one bold hero moment ============ */}
            <div className="relative max-w-lg mx-auto">
              <div className="font-case-mono animate-stamp-slam absolute -top-4 -right-3 sm:-right-6 border-[3px] border-[var(--cq-alert-hi)] text-[var(--cq-alert-hi)] text-xs sm:text-base font-semibold tracking-wide px-3 py-1.5 sm:px-4 sm:py-2 rounded rotate-[-9deg] bg-[var(--cq-alert)]/10">
                SUSTAINED
              </div>
              <div className="bg-[var(--cq-panel)] border border-[var(--cq-line)] rounded text-left overflow-hidden shadow-2xl">
                <div className="font-case-mono flex items-center justify-between px-5 py-3 border-b border-[var(--cq-line)] text-[10px] sm:text-xs text-[var(--cq-text-dim)] tracking-wide">
                  <span className="text-[var(--cq-authority-hi)]">THE MIDNIGHT BURGLARY</span>
                  <span>LIVE · CROSS-EXAMINATION</span>
                </div>
                <div className="px-5 py-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1 max-w-[88%]">
                    <span className="font-case-mono text-[10px] tracking-widest text-[var(--cq-authority-hi)]">DEFENSE — YOU</span>
                    <span className="bg-[var(--cq-panel-2)] border border-[var(--cq-line)] rounded px-3.5 py-2.5 text-sm text-[var(--cq-text)]">
                      You told the officer you saw my client at 2:30 AM — but the porch light in your own photo shows it was still off.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-[88%] self-end items-end text-right">
                    <span className="font-case-mono text-[10px] tracking-widest text-[var(--cq-text-dim)]">PROSECUTION</span>
                    <span className="bg-[var(--cq-panel-2)] border border-[var(--cq-line)] rounded px-3.5 py-2.5 text-sm text-[var(--cq-text)]">
                      Objection — the witness is testifying from memory, not the photo timestamp.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-[88%]">
                    <span className="font-case-mono text-[10px] tracking-widest text-[var(--cq-authority-hi)]">DEFENSE — YOU</span>
                    <span className="bg-[var(--cq-panel-2)] border border-[var(--cq-line)] rounded px-3.5 py-2.5 text-sm text-[var(--cq-text)]">
                      Then I'd like to enter the photo into evidence, Your Honor.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============ HOW IT WORKS ============ */}
          <section id="how-it-works" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <span className="font-case-mono block text-[11px] tracking-widest text-[var(--cq-authority-hi)] mb-3">HOW A TRIAL WORKS</span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cq-text)] mb-3">From case file to verdict in three moves.</h3>
            <p className="text-[var(--cq-text-dim)] mb-10 max-w-xl">Every trial follows the same shape. What you do inside it is what decides who wins.</p>

            <div className="grid sm:grid-cols-3 border border-[var(--cq-line)] rounded overflow-hidden">
              <div className="p-7 border-b sm:border-b-0 sm:border-r border-[var(--cq-line)]">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">01</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Read the case file</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Review the evidence and witnesses — the loophole is in there somewhere.</p>
              </div>
              <div className="p-7 border-b sm:border-b-0 sm:border-r border-[var(--cq-line)]">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">02</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Pick prosecution or defense</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Same case, completely different game depending on your side.</p>
              </div>
              <div className="p-7">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">03</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Argue it out</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Object, examine witnesses, and convince the court before your opponent does.</p>
              </div>
            </div>
          </section>

          {/* ============ FEATURES ============ */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <span className="font-case-mono block text-[11px] tracking-widest text-[var(--cq-authority-hi)] mb-3">WHAT'S WAITING INSIDE</span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cq-text)] mb-10">Three ways into the courtroom.</h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <div
                onMouseEnter={() => playPaperRustle()}
                className="bg-[var(--cq-panel)] border border-[var(--cq-line)] rounded p-6 flex flex-col gap-3"
              >
                <Briefcase className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Pick Your Side</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Prosecute or defend the same case — each side has a real argument to make, and neither one is the "correct" answer.</p>
              </div>

              <div
                onMouseEnter={() => playPaperRustle()}
                className="bg-[var(--cq-panel)] border border-[var(--cq-line)] rounded p-6 flex flex-col gap-3"
              >
                <FileText className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Full AI Courtroom</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">A real judge rules on your objections, witnesses answer based on their actual testimony, and opposing counsel argues back — all reactive to what you actually say.</p>
              </div>

              <div
                onMouseEnter={() => playPaperRustle()}
                className="relative bg-[var(--cq-panel)] border border-[var(--cq-line)] rounded p-6 flex flex-col gap-3"
              >
                <span className="font-case-mono absolute top-4 right-4 text-[9px] tracking-wide text-[var(--cq-alert-hi)] border border-[var(--cq-alert)] rounded-full px-2 py-0.5">LIVE</span>
                <Swords className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Face a Real Opponent</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Open a live challenge, pick your side, and argue the case against another player — no AI counsel, just the two of you.</p>
              </div>
            </div>

            <div className="text-center mt-10">
              <a href="/watch" className="font-case-mono text-xs text-[var(--cq-text-dim)] hover:text-[var(--cq-authority-hi)] tracking-wide transition-colors">
                WATCH A LIVE OR RECENT TRIAL →
              </a>
            </div>
          </section>

          {/* ============ CLOSING CTA ============ */}
          <section className="text-center px-4 sm:px-6 py-20 sm:py-24">
            <div className="w-16 h-0.5 bg-[var(--cq-authority)] mx-auto mb-8" />
            <h3 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--cq-text)] mb-4">Court is now in session.</h3>
            <p className="text-[var(--cq-text-dim)] max-w-md mx-auto mb-8">Your first case file is waiting. No side gets an easy win — not even you.</p>
            <button
              onClick={onSignIn}
              onMouseEnter={() => playPaperRustle()}
              className="font-case-mono px-7 py-3.5 bg-[var(--cq-alert)] hover:bg-[var(--cq-alert-hi)] text-white text-sm font-semibold tracking-wide rounded transition-colors"
            >
              Find Your First Loophole
            </button>
          </section>
        </main>

        {/* ============ FOOTER ============ */}
        <footer className="border-t border-[var(--cq-line)] py-6 sm:py-8 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Gavel className="w-4 h-4 text-[var(--cq-authority-hi)]" />
              <span className="font-case-mono text-xs text-[var(--cq-text-dim)] tracking-wide">Courtroom Quest — every case has a loophole.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-[var(--cq-text-dim)]">
              <a href="#" className="hover:text-[var(--cq-text)] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[var(--cq-text)] transition-colors">Terms</a>
              <a href="#" className="hover:text-[var(--cq-text)] transition-colors">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
