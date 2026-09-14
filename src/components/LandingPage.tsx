import { useEffect, useState } from 'react';
import { Briefcase, FileText, Swords, Settings as SettingsIcon, Gavel, Trophy, Volume2, VolumeX, Scale } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CaseOfTheWeek from './CaseOfTheWeek';
import CrossfadeBackground from './CrossfadeBackground';
import { isSoundEnabled, setSoundEnabled, playGavelTap, playPaperRustle } from '../lib/soundEffects';
import type { UserProfile } from '../types';

const HERO_IMAGES = [
  '/images/hero/witness-stand.jpg',
  '/images/hero/gavel-strike.jpg',
  '/images/hero/jury-box.jpg'
];

interface LandingPageProps {
  userProfile: UserProfile | null;
  onNavigateToCaseBoard: () => void;
  onNavigateToCustomCases: () => void;
  onNavigateToChallengeBoard: () => void;
  onPlayFeaturedCase: (caseId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
}

export default function LandingPage({ userProfile, onNavigateToCaseBoard, onNavigateToCustomCases, onNavigateToChallengeBoard, onPlayFeaturedCase, onOpenSettings, onOpenAdmin }: LandingPageProps) {
  const { signOut } = useAuth();
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    // Play the stamp's gavel tap once it's had time to animate in — this
    // will silently no-op if sound isn't on, or if the browser is
    // blocking audio because there hasn't been a user gesture yet.
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
        <header className="border-b border-[var(--cq-line)] bg-[var(--cq-ink)]/70 backdrop-blur-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-[var(--cq-authority)] to-[var(--cq-authority-dim)] border border-[var(--cq-line)]">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-semibold text-[var(--cq-text)] leading-none">
                  Courtroom <em className="not-italic text-[var(--cq-authority-hi)]">Quest</em>
                </h1>
                <p className="font-case-mono text-[9px] sm:text-[10px] text-[var(--cq-text-dim)] tracking-widest mt-1">EVERY CASE HAS A LOOPHOLE</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {userProfile && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--cq-panel)] border border-[var(--cq-line)] rounded-full">
                  <Trophy className="w-4 h-4 text-[var(--cq-authority-hi)]" />
                  <span className="text-[var(--cq-text)] text-sm font-semibold">{userProfile.wins_count}</span>
                  <span className="text-[var(--cq-text-dim)] text-xs">wins</span>
                  <span className="text-[var(--cq-line)]">·</span>
                  <span className="text-[var(--cq-text-dim)] text-xs font-medium">{userProfile.current_level}</span>
                </div>
              )}
              <button
                onClick={toggleSound}
                className="flex items-center justify-center w-10 h-10 bg-[var(--cq-panel)] hover:bg-[var(--cq-panel-2)] border border-[var(--cq-line)] text-[var(--cq-text-dim)] hover:text-[var(--cq-text)] rounded-lg transition-colors"
                title={soundOn ? 'Mute sound' : 'Enable sound'}
              >
                {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              {onOpenAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="px-3 sm:px-4 py-2 bg-[var(--cq-authority)] hover:bg-[var(--cq-authority-hi)] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Admin
                </button>
              )}
              <button
                onClick={onOpenSettings}
                className="flex items-center justify-center w-10 h-10 bg-[var(--cq-panel)] hover:bg-[var(--cq-panel-2)] border border-[var(--cq-line)] text-[var(--cq-text)] rounded-lg transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="hidden sm:block px-3 sm:px-4 py-2 bg-[var(--cq-panel)] hover:bg-[var(--cq-panel-2)] border border-[var(--cq-line)] text-[var(--cq-text)] rounded-lg transition-colors text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* ============ HERO ============ */}
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 text-center">
            <span className="font-case-mono inline-flex items-center gap-2 px-4 py-1.5 border border-[var(--cq-line)] rounded-full text-[11px] tracking-widest text-[var(--cq-text-dim)] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cq-authority-hi)] shadow-[0_0_0_3px_rgba(76,125,255,0.25)]" />
              A TRIAL IS ALWAYS IN SESSION
            </span>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-[var(--cq-text)] leading-[1.05] tracking-tight mb-6">
              Every case has a loophole.
              <br />
              <span className="italic font-medium text-[var(--cq-authority-hi)]">Find it. Argue it. Win the court.</span>
            </h2>

            <p className="text-[var(--cq-text-dim)] text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10">
              Prosecute or defend against a real opponent, or a judge who won't go easy on either side.
              Cross-examine the witness, catch the contradiction, and build the argument nobody saw coming.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
              <button
                onClick={onNavigateToCaseBoard}
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

          {/* ============ CAPABILITY STRIP ============ */}
          <div className="border-y border-[var(--cq-line)] py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-[var(--cq-text)] font-semibold">AI Judge & Witnesses</p>
                <p className="font-case-mono text-[11px] text-[var(--cq-text-dim)] tracking-wide mt-1">EVERY CASE PLAYABLE SOLO</p>
              </div>
              <div>
                <p className="text-[var(--cq-text)] font-semibold">Live 1v1 or Pass-and-Play</p>
                <p className="font-case-mono text-[11px] text-[var(--cq-text-dim)] tracking-wide mt-1">SAME DEVICE OR ACROSS TOWN</p>
              </div>
              <div>
                <p className="text-[var(--cq-text)] font-semibold">Build Your Own Case</p>
                <p className="font-case-mono text-[11px] text-[var(--cq-text-dim)] tracking-wide mt-1">CUSTOM EVIDENCE & WITNESSES</p>
              </div>
            </div>
          </div>

          {/* ============ HOW IT WORKS ============ */}
          <section id="how-it-works" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <span className="font-case-mono block text-[11px] tracking-widest text-[var(--cq-authority-hi)] mb-3">HOW A TRIAL WORKS</span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cq-text)] mb-3">From case file to verdict in three moves.</h3>
            <p className="text-[var(--cq-text-dim)] mb-10 max-w-xl">Every trial follows the same shape. What you do inside it is what decides who wins.</p>

            <div className="grid sm:grid-cols-3 border border-[var(--cq-line)] rounded overflow-hidden">
              <div className="p-7 border-b sm:border-b-0 sm:border-r border-[var(--cq-line)]">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">01</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Pick your side</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Every case is playable from either chair. Take the side you're handed, or choose the harder one on purpose.</p>
              </div>
              <div className="p-7 border-b sm:border-b-0 sm:border-r border-[var(--cq-line)]">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">02</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Build your case</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Read the file, question the witnesses, and decide which evidence actually wins the argument.</p>
              </div>
              <div className="p-7">
                <span className="font-case-mono text-[var(--cq-authority-hi)] text-sm block mb-4">03</span>
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)] mb-2">Argue it live</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed">Cross-examine, object, and respond in real time. The judge rules on the spot — no waiting for a score to catch up.</p>
              </div>
            </div>
          </section>

          {/* ============ CASE OF THE WEEK ============ */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <span className="font-case-mono block text-[11px] tracking-widest text-[var(--cq-authority-hi)] mb-3">CASE OF THE WEEK</span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cq-text)] mb-3">The file looks airtight. It never is.</h3>
            <p className="text-[var(--cq-text-dim)] mb-8 max-w-xl">A new case takes the spotlight every week — climb its leaderboard before it rotates out.</p>
            <CaseOfTheWeek onPlayCase={onPlayFeaturedCase} />
          </section>

          {/* ============ MODES ============ */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <span className="font-case-mono block text-[11px] tracking-widest text-[var(--cq-authority-hi)] mb-3">CHOOSE YOUR DOCKET</span>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cq-text)] mb-3">Three ways into the courtroom.</h3>
            <p className="text-[var(--cq-text-dim)] mb-10 max-w-xl">Work a real case, build your own, or step in against another player.</p>

            <div className="grid sm:grid-cols-3 gap-4">
              <button
                onClick={onNavigateToCaseBoard}
                onMouseEnter={() => playPaperRustle()}
                className="group text-left bg-[var(--cq-panel)] border border-[var(--cq-line)] hover:border-[var(--cq-authority)] rounded p-6 flex flex-col gap-3 transition-colors"
              >
                <Briefcase className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Case Board</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed flex-1">Take on a real case. Investigate, argue, and see it through to a verdict.</p>
                <span className="font-case-mono text-xs text-[var(--cq-authority-hi)] pt-3 border-t border-[var(--cq-line)]">Browse cases →</span>
              </button>

              <button
                onClick={onNavigateToCustomCases}
                onMouseEnter={() => playPaperRustle()}
                className="group text-left bg-[var(--cq-panel)] border border-[var(--cq-line)] hover:border-[var(--cq-authority)] rounded p-6 flex flex-col gap-3 transition-colors"
              >
                <FileText className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Custom Cases</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed flex-1">Build a trial from scratch — your own evidence, witnesses, and stakes.</p>
                <span className="font-case-mono text-xs text-[var(--cq-authority-hi)] pt-3 border-t border-[var(--cq-line)]">Create a case →</span>
              </button>

              <button
                onClick={onNavigateToChallengeBoard}
                onMouseEnter={() => playPaperRustle()}
                className="group relative text-left bg-[var(--cq-panel)] border border-[var(--cq-line)] hover:border-[var(--cq-authority)] rounded p-6 flex flex-col gap-3 transition-colors"
              >
                <span className="font-case-mono absolute top-4 right-4 text-[9px] tracking-wide text-[var(--cq-alert-hi)] border border-[var(--cq-alert)] rounded-full px-2 py-0.5">LIVE</span>
                <Swords className="w-6 h-6 text-[var(--cq-authority-hi)]" />
                <h4 className="font-display text-lg font-semibold text-[var(--cq-text)]">Challenge Board</h4>
                <p className="text-sm text-[var(--cq-text-dim)] leading-relaxed flex-1">Face a real opponent — no AI counsel. Match a stranger, invite a friend, or pass the device back and forth.</p>
                <span className="font-case-mono text-xs text-[var(--cq-authority-hi)] pt-3 border-t border-[var(--cq-line)]">Enter the docket →</span>
              </button>
            </div>

            <div className="text-center mt-8">
              <a href="/watch" className="font-case-mono text-xs text-[var(--cq-text-dim)] hover:text-[var(--cq-authority-hi)] tracking-wide transition-colors">
                WATCH A LIVE OR RECENT TRIAL →
              </a>
            </div>
          </section>

          {/* ============ CLOSING CTA ============ */}
          <section className="text-center px-4 sm:px-6 py-20 sm:py-24">
            <div className="w-16 h-0.5 bg-[var(--cq-authority)] mx-auto mb-8" />
            <h3 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--cq-text)] mb-4">Court is now in session.</h3>
            <p className="text-[var(--cq-text-dim)] max-w-md mx-auto mb-8">Your first case file is waiting. Every case has a loophole — not even yours is airtight.</p>
            <button
              onClick={onNavigateToCaseBoard}
              onMouseEnter={() => playPaperRustle()}
              className="font-case-mono px-7 py-3.5 bg-[var(--cq-alert)] hover:bg-[var(--cq-alert-hi)] text-white text-sm font-semibold tracking-wide rounded transition-colors"
            >
              Find Your First Loophole
            </button>
          </section>
        </main>

        <footer className="border-t border-[var(--cq-line)] py-8 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <p className="font-case-mono text-xs text-[var(--cq-text-dim)] tracking-wide">
              Courtroom <span className="text-[var(--cq-authority-hi)]">Quest</span> — every case has a loophole.
            </p>
            <div className="flex items-center gap-2 text-[var(--cq-text-dim)]">
              <Gavel className="w-4 h-4" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
