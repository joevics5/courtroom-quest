import { useTranslation } from 'react-i18next';
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
  titleKey: string;
  bodyKey: string;
}

const STEPS: Step[] = [
  {
    icon: Scale,
    accent: 'text-[#FFD43B]',
    ring: 'bg-[#FFD43B]/15 border-[#FFD43B]/50',
    titleKey: 'tutorial.s1Title',
    bodyKey: 'tutorial.s1Body'
  },
  {
    icon: Clock,
    accent: 'text-sky-300',
    ring: 'bg-sky-400/15 border-sky-300/50',
    titleKey: 'tutorial.s2Title',
    bodyKey: 'tutorial.s2Body'
  },
  {
    icon: AlertCircle,
    accent: 'text-red-300',
    ring: 'bg-red-400/15 border-red-300/50',
    titleKey: 'tutorial.s3Title',
    bodyKey: 'tutorial.s3Body'
  },
  {
    icon: Users,
    accent: 'text-purple-300',
    ring: 'bg-purple-400/15 border-purple-300/50',
    titleKey: 'tutorial.s4Title',
    bodyKey: 'tutorial.s4Body'
  },
  {
    icon: Mic,
    accent: 'text-green-300',
    ring: 'bg-green-400/15 border-green-300/50',
    titleKey: 'tutorial.s5Title',
    bodyKey: 'tutorial.s5Body'
  },
  {
    icon: PartyPopper,
    accent: 'text-white',
    ring: 'bg-white/10 border-white/40',
    titleKey: 'tutorial.s6Title',
    bodyKey: 'tutorial.s6Body'
  }
];

export default function Tutorial({ onComplete, onSkip }: Props) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

  return (
    // A light card over the page the player was heading to: the page behind stays visible and usable.
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/20 pointer-events-none">
      <div role="dialog" aria-label={t(step.titleKey)} className={`${PANEL} pointer-events-auto !bg-[#14161f]/95 sm:p-6 max-w-md w-full shadow-2xl`}>
        <div className="flex justify-center gap-1.5 mb-4" aria-hidden="true">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-[#FFD43B]' : i < stepIndex ? 'w-1.5 bg-[#FFD43B]/50' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        <div className={`w-12 h-12 mx-auto flex items-center justify-center rounded-full border-2 ${step.ring} mb-3`}>
          <Icon className={`w-6 h-6 ${step.accent}`} />
        </div>

        <h2 className="logo-gold font-game text-3xl leading-none mb-2 text-center uppercase">{t(step.titleKey)}</h2>
        <p className="text-white/75 text-sm leading-relaxed text-center mb-5">{t(step.bodyKey)}</p>

        <div className="flex items-center gap-3">
          {stepIndex > 0 ? (
            <button
              onClick={() => setStepIndex(i => i - 1)}
              className="flex items-center gap-1 px-3 py-3 text-white/60 active:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('tutorial.back')}
            </button>
          ) : (
            <button onClick={onSkip} className="px-3 py-3 text-white/45 active:text-white/80 transition-colors">
              {t('tutorial.skip')}
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStepIndex(i => i + 1)}
            className={`flex-1 ${gameButton('gold', 'md')}`}
          >
            {isLast ? t('tutorial.letsGo') : t('tutorial.next')}
            {!isLast && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
