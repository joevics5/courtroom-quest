import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lock, Scale, Users } from 'lucide-react';
import HeroBackground from './HeroBackground';
import UpgradePrompt from './UpgradePrompt';
import { db } from '../lib/database';
import { adviceFor, creditCostLabel, creditsLeftLabel, isLocked, type CreditStatus, type StartTrialResult, type StartTrialAdvice } from '../lib/credits';
import type { TrialType, TrialDuration } from '../types';

interface Props {
  /**
   * Starts the trial. Return the server's answer: when it was refused (out of credits, a Pro length...) the
   * picker explains why instead of moving on.
   */
  onSelect: (type: TrialType, duration: TrialDuration) => void | StartTrialResult | Promise<void | StartTrialResult>;
  onCancel: () => void;
  /** A guest who needs a free account to carry on. */
  onCreateAccount?: () => void;
}

const COURTS: Array<{
  type: TrialType;
  icon: typeof Scale;
  iconBg: string;
  title: string;
  tagline: string;
  perks: string[];
}> = [
  {
    type: 'judge',
    icon: Scale,
    iconBg: 'bg-blue-600',
    title: 'BENCH TRIAL',
    tagline: 'The judge alone decides the verdict.',
    perks: ['Faster', 'Legal expertise', 'Simpler']
  },
  {
    type: 'jury',
    icon: Users,
    iconBg: 'bg-purple-600',
    title: 'JURY TRIAL',
    tagline: 'You pick 6 jurors. 12 citizens decide.',
    perks: ['Pick your jurors', 'Persuade people', 'More realistic']
  }
];

// 15 and 60 are retired: they no longer appear here, but games already started with them still play out.
const LENGTHS: Array<{ value: TrialDuration; big: string; unit: string; label: string }> = [
  { value: 5, big: '5', unit: 'MIN', label: 'Lightning' },
  { value: 10, big: '10', unit: 'MIN', label: 'Quick Play' },
  { value: 20, big: '20', unit: 'MIN', label: 'Short' },
  { value: 30, big: '30', unit: 'MIN', label: 'Standard' }
];

/**
 * One screen, no scrolling: pick the court, pick how long, confirm.
 * The confirm button is always on screen at the bottom.
 */
export default function TrialTypeSelector({ onSelect, onCancel, onCreateAccount }: Props) {
  const [selectedType, setSelectedType] = useState<TrialType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<TrialDuration>(30);
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [advice, setAdvice] = useState<StartTrialAdvice | null>(null);
  const [starting, setStarting] = useState(false);

  // What this plan may start and how many credits are left. If it can't be read, nothing is locked here and the
  // server decides when the trial starts.
  useEffect(() => {
    let cancelled = false;
    db.credits.getStatus().then(s => { if (!cancelled && s) setStatus(s); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // A free player's best default is the longest trial they can have.
  useEffect(() => {
    if (status && !status.allowed_minutes.includes(selectedDuration)) {
      setSelectedDuration(Math.max(...status.allowed_minutes) as TrialDuration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const showLock = (type?: TrialType, minutes?: number) => {
    const error = type === 'jury' ? 'jury_locked' : 'duration_locked';
    setAdvice(adviceFor({ ok: false, error, upgrade_required: true, tier: status?.tier }));
    void minutes;
  };

  const pickCourt = (type: TrialType) => {
    if (isLocked(status, { mode: type })) { showLock(type); return; }
    setSelectedType(type);
  };

  const pickLength = (minutes: TrialDuration) => {
    if (isLocked(status, { minutes })) { showLock(undefined, minutes); return; }
    setSelectedDuration(minutes);
  };

  const confirm = async () => {
    if (!selectedType || starting) return;
    setStarting(true);
    try {
      const result = await onSelect(selectedType, selectedDuration);
      const refusal = result ? adviceFor(result) : null;
      if (refusal) {
        setAdvice(refusal);
        // The plan may have changed (credits spent elsewhere, an upgrade): look again.
        db.credits.getStatus().then(s => { if (s) setStatus(s); }).catch(() => undefined);
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />

      <div
        className="relative z-10 h-full flex flex-col px-4 max-w-lg lg:max-w-4xl mx-auto"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <header className="flex-none flex items-center gap-3">
          <button
            onClick={onCancel}
            aria-label="Back"
            className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="logo-gold font-game text-4xl leading-none truncate">CHOOSE YOUR COURT</h1>
            <p className="text-white/60 text-xs mt-1">Who decides the outcome, and for how long?</p>
            {status?.enforced && <p className="text-[#FFD43B] text-xs font-bold mt-0.5" data-testid="credits-left">{creditsLeftLabel(status)}</p>}
          </div>
        </header>

        {/* Court + length share the space; on very short phones this region scrolls rather than clipping */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-3 py-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:content-center">
          {COURTS.map(court => {
            const Icon = court.icon;
            const selected = selectedType === court.type;
            return (
              <button
                key={court.type}
                onClick={() => pickCourt(court.type)}
                aria-pressed={selected}
                className={`relative flex items-center gap-4 rounded-3xl border-2 border-b-[6px] p-4 text-left transition-all active:translate-y-0.5 active:border-b-2 ${
                  selected ? 'border-[#FFD43B] bg-[#FFD43B]/10' : 'border-white/15 bg-black/60 backdrop-blur-sm'
                }`}
              >
                {selected && (
                  <span className="absolute -top-2.5 -right-1.5 flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B] text-black">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                )}
                <span className={`flex-none flex items-center justify-center w-16 h-16 rounded-2xl ${court.iconBg}`}>
                  <Icon className="w-8 h-8 text-white" />
                </span>
                {isLocked(status, { mode: court.type }) && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-[#FFD43B] px-2 py-0.5 text-[11px] font-black text-black">
                    <Lock className="w-3 h-3" aria-hidden="true" />PRO
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block font-game text-3xl text-white leading-none">{court.title}</span>
                  <span className="block mt-1 text-sm text-white/70 leading-snug">{court.tagline}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {court.perks.map(perk => (
                      <span key={perk} className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                        {perk}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            );
          })}

          {/* No backdrop blur and no animated colour change here: some phone browsers stop painting the text of
              tiles that change colour inside a blurred panel, which left the 15 and 30 tiles looking empty. */}
          <div className="rounded-3xl bg-black/75 border border-white/15 p-3 lg:col-span-2">
            <h2 className="font-game text-2xl text-white/90 leading-none mb-2.5 px-1">HOW LONG?</h2>
            <div className="grid grid-cols-4 gap-2">
              {LENGTHS.map(len => {
                const selected = selectedDuration === len.value;
                return (
                  <button
                    key={len.value}
                    type="button"
                    onClick={() => pickLength(len.value)}
                    aria-pressed={selected}
                    data-testid={`length-${len.value}`}
                    className={`relative rounded-2xl border-2 py-2 px-0.5 text-center active:translate-y-0.5 ${
                      selected ? 'border-[#FFD43B] bg-[#FFD43B]' : 'border-white/20 bg-[#1b1e2b]'
                    } ${isLocked(status, { minutes: len.value }) ? 'opacity-70' : ''}`}
                  >
                    {isLocked(status, { minutes: len.value }) && (
                      <span className="absolute -top-2 -right-1 flex items-center gap-0.5 rounded-full bg-[#FFD43B] px-1.5 py-px text-[10px] font-black text-black">
                        <Lock className="w-2.5 h-2.5" aria-hidden="true" />PRO
                      </span>
                    )}
                    <span className={`block font-game text-4xl leading-none ${selected ? 'text-black' : 'text-white'}`}>{len.big}</span>
                    <span className={`block text-[11px] font-black tracking-widest ${selected ? 'text-black' : 'text-white'}`}>{len.unit}</span>
                    <span className={`block text-[11px] font-semibold whitespace-nowrap ${selected ? 'text-black/75' : 'text-white/70'}`}>{len.label}</span>
                    <span className={`block text-[10px] font-bold whitespace-nowrap ${selected ? 'text-black/80' : 'text-[#FFD43B]'}`}>{status?.enforced ? creditCostLabel(len.value) : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={!selectedType || starting}
          className="flex-none w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale"
        >
          {selectedType === 'jury' ? 'PICK YOUR JURY' : selectedType === 'judge' ? 'TO THE COURTROOM' : 'PICK A COURT'}
          {selectedType && <ArrowRight className="w-6 h-6" />}
        </button>
      </div>

      {advice && (
        <UpgradePrompt
          title={advice.title}
          message={advice.message}
          canUpgrade={advice.canUpgrade}
          needsAccount={advice.needsAccount}
          onCreateAccount={() => { setAdvice(null); onCreateAccount?.(); }}
          onClose={() => setAdvice(null)}
        />
      )}
    </div>
  );
}
