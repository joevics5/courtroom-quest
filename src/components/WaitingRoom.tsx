import { ArrowLeft } from 'lucide-react';
import HeroBackground from './HeroBackground';

interface Props {
  title: string;
  message: string;
  onBack?: () => void;
}

/** Shown to the player who is waiting while the other one does their part; it moves on by itself. */
export default function WaitingRoom({ title, message, onBack }: Props) {
  return (
    <div className="relative min-h-[100dvh] bg-[#0b0d14] flex items-center justify-center px-6">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute z-10 left-4 flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          style={{ top: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div role="status" aria-live="polite" className="relative z-10 text-center max-w-sm">
        <h1 className="logo-gold font-game text-5xl leading-none">{title}</h1>
        <p className="mt-4 text-white/75 leading-snug">{message}</p>
        <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-3 h-3 rounded-full bg-[#FFD43B] animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
