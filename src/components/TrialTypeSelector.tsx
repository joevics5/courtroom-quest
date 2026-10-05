import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Scale, Users } from 'lucide-react';
import HeroBackground from './HeroBackground';
import type { TrialType, TrialDuration } from '../types';

interface Props {
  onSelect: (type: TrialType, duration: TrialDuration) => void;
  onCancel: () => void;
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

const LENGTHS: Array<{ value: TrialDuration; big: string; unit: string; label: string }> = [
  { value: 15, big: '15', unit: 'MIN', label: 'Quick' },
  { value: 30, big: '30', unit: 'MIN', label: 'Standard' },
  { value: 60, big: '1', unit: 'HOUR', label: 'Full trial' }
];

/**
 * One screen, no scrolling: pick the court, pick how long, confirm.
 * The confirm button is always on screen at the bottom.
 */
export default function TrialTypeSelector({ onSelect, onCancel }: Props) {
  const [selectedType, setSelectedType] = useState<TrialType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<TrialDuration>(30);

  const confirm = () => {
    if (selectedType) onSelect(selectedType, selectedDuration);
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />

      <div
        className="relative z-10 h-full flex flex-col px-4 max-w-lg mx-auto"
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
          </div>
        </header>

        {/* Court + length share the space; on very short phones this region scrolls rather than clipping */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-3 py-3">
          {COURTS.map(court => {
            const Icon = court.icon;
            const selected = selectedType === court.type;
            return (
              <button
                key={court.type}
                onClick={() => setSelectedType(court.type)}
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

          <div className="rounded-3xl bg-black/60 backdrop-blur-sm border border-white/15 p-3">
            <h2 className="font-game text-2xl text-white/90 leading-none mb-2.5 px-1">HOW LONG?</h2>
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map(len => {
                const selected = selectedDuration === len.value;
                return (
                  <button
                    key={len.value}
                    onClick={() => setSelectedDuration(len.value)}
                    aria-pressed={selected}
                    className={`rounded-2xl border-2 py-2 text-center transition-all active:translate-y-0.5 ${
                      selected ? 'border-[#FFD43B] bg-[#FFD43B] text-black' : 'border-white/15 bg-white/5 text-white'
                    }`}
                  >
                    <span className="block font-game text-4xl leading-none">{len.big}</span>
                    <span className="block text-[11px] font-black tracking-widest">{len.unit}</span>
                    <span className={`block text-[11px] font-semibold ${selected ? 'text-black/70' : 'text-white/55'}`}>{len.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={!selectedType}
          className="flex-none w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale"
        >
          {selectedType === 'jury' ? 'PICK YOUR JURY' : selectedType === 'judge' ? 'TO THE COURTROOM' : 'PICK A COURT'}
          {selectedType && <ArrowRight className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
