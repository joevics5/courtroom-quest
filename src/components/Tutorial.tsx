import { useState } from 'react';
import { Scale, Clock, AlertCircle, Users, Mic, PartyPopper, ChevronRight, ChevronLeft } from 'lucide-react';
import { PANEL, gameButton } from './ui';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

interface Step {
  icon: typeof Scale;
  /** Colour of the icon and its glow ring. */
  accent: string;
  ring: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Scale,
    accent: 'text-[#FFD43B]',
    ring: 'bg-[#FFD43B]/15 border-[#FFD43B]/50',
    title: 'Welcome to the Courtroom',
    body: "You're about to argue a real case. A judge presides, an opposing counsel argues against you, and witnesses testify — all played by AI, reacting to what you actually say and do. Let's walk through the basics first."
  },
  {
    icon: Clock,
    accent: 'text-sky-300',
    ring: 'bg-sky-400/15 border-sky-300/50',
    title: 'Turns & the Clock',
    body: "The trial moves through phases — opening statements, witness examinations, closing arguments. Each phase has a timer, and the header always shows whose turn it is. When it's your turn, the input box at the bottom lights up and waits for you."
  },
  {
    icon: AlertCircle,
    accent: 'text-red-300',
    ring: 'bg-red-400/15 border-red-300/50',
    title: 'Objections',
    body: 'If the other side says something improper — leading a witness, asking about something irrelevant, badgering — tap Object and pick a reason. The judge rules immediately: sustained or overruled. You can object even outside your own turn.'
  },
  {
    icon: Users,
    accent: 'text-purple-300',
    ring: 'bg-purple-400/15 border-purple-300/50',
    title: 'Witnesses & Evidence',
    body: "During examination phases, call a witness and ask them questions — they'll answer based on their actual testimony, not scripted lines. You can also submit evidence exhibits to support your questions or arguments."
  },
  {
    icon: Mic,
    accent: 'text-green-300',
    ring: 'bg-green-400/15 border-green-300/50',
    title: 'Talk Instead of Type',
    body: 'See the microphone icon in the input box? Tap it and just speak — your statement or question gets transcribed automatically. Handy for opening statements or when typing feels slow.'
  },
  {
    icon: PartyPopper,
    accent: 'text-white',
    ring: 'bg-white/10 border-white/40',
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label={step.title} className={`${PANEL} !bg-[#14161f] sm:p-8 max-w-md w-full shadow-2xl`}>
        <div className="flex justify-center gap-1.5 mb-6" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-[#FFD43B]' : i < stepIndex ? 'w-1.5 bg-[#FFD43B]/50' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        <div className={`w-16 h-16 mx-auto flex items-center justify-center rounded-full border-2 ${step.ring} mb-5`}>
          <Icon className={`w-8 h-8 ${step.accent}`} />
        </div>

        <h2 className="logo-gold font-game text-3xl leading-none mb-3 text-center uppercase">{step.title}</h2>
        <p className="text-white/75 leading-relaxed text-center mb-8">{step.body}</p>

        <div className="flex items-center gap-3">
          {stepIndex > 0 ? (
            <button
              onClick={() => setStepIndex(i => i - 1)}
              className="flex items-center gap-1 px-3 py-3 text-white/60 active:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button onClick={onSkip} className="px-3 py-3 text-white/45 active:text-white/80 transition-colors">
              Skip
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStepIndex(i => i + 1)}
            className={`flex-1 ${gameButton('gold', 'md')}`}
          >
            {isLast ? "Let's Go" : 'Next'}
            {!isLast && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
