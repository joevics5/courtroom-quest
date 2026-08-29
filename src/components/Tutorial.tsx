import { useState } from 'react';
import { Scale, Clock, AlertCircle, Users, Mic, PartyPopper, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

interface Step {
  icon: typeof Scale;
  accent: string;
  glow: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Scale,
    accent: 'text-amber-400',
    glow: 'from-amber-500/20 to-orange-500/20',
    title: 'Welcome to the Courtroom',
    body: "You're about to argue a real case. A judge presides, an opposing counsel argues against you, and witnesses testify — all played by AI, reacting to what you actually say and do. Let's walk through the basics first."
  },
  {
    icon: Clock,
    accent: 'text-blue-400',
    glow: 'from-blue-500/20 to-cyan-500/20',
    title: 'Turns & the Clock',
    body: "The trial moves through phases — opening statements, witness examinations, closing arguments. Each phase has a timer, and the header always shows whose turn it is. When it's your turn, the input box at the bottom lights up and waits for you."
  },
  {
    icon: AlertCircle,
    accent: 'text-red-400',
    glow: 'from-red-500/20 to-rose-500/20',
    title: 'Objections',
    body: 'If the other side says something improper — leading a witness, asking about something irrelevant, badgering — tap Object and pick a reason. The judge rules immediately: sustained or overruled. You can object even outside your own turn.'
  },
  {
    icon: Users,
    accent: 'text-purple-400',
    glow: 'from-purple-500/20 to-fuchsia-500/20',
    title: 'Witnesses & Evidence',
    body: "During examination phases, call a witness and ask them questions — they'll answer based on their actual testimony, not scripted lines. You can also submit evidence exhibits to support your questions or arguments."
  },
  {
    icon: Mic,
    accent: 'text-green-400',
    glow: 'from-green-500/20 to-emerald-500/20',
    title: 'Talk Instead of Type',
    body: 'See the microphone icon in the input box? Tap it and just speak — your statement or question gets transcribed automatically. Handy for opening statements or when typing feels slow.'
  },
  {
    icon: PartyPopper,
    accent: 'text-white',
    glow: 'from-slate-500/20 to-slate-400/20',
    title: "You're Ready",
    body: "That's everything you need. Pick your case, choose your side, and make your argument — the verdict is based entirely on how the trial actually goes."
  }
];

export default function Tutorial({ onComplete, onSkip }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-white/10 shadow-2xl">
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-white' : i < stepIndex ? 'w-1.5 bg-white/50' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        <div className={`w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br ${step.glow} mb-5`}>
          <Icon className={`w-8 h-8 ${step.accent}`} />
        </div>

        <h2 className="text-xl font-bold text-white mb-3 text-center">{step.title}</h2>
        <p className="text-white/70 text-sm leading-relaxed text-center mb-8">{step.body}</p>

        <div className="flex items-center gap-3">
          {stepIndex > 0 ? (
            <button
              onClick={() => setStepIndex(i => i - 1)}
              className="flex items-center gap-1 px-4 py-3 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              onClick={onSkip}
              className="px-4 py-3 text-white/40 hover:text-white/70 transition-colors text-sm"
            >
              Skip
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStepIndex(i => i + 1)}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-semibold"
          >
            {isLast ? "Let's Go" : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
