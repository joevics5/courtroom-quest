import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import HeroBackground from './HeroBackground';

interface ScreenShellProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Buttons shown at the right of the header */
  right?: ReactNode;
  /** Tailwind max-width class for the content column */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * Light-touch version of the game look for the working screens (case lists,
 * forms, challenge board): same dimmed video/poster background, round back
 * button and gold comic-font title — body content keeps the normal font.
 */
export default function ScreenShell({ title, subtitle, onBack, right, maxWidth = 'max-w-3xl', children }: ScreenShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />
      <div
        className="relative z-10 min-h-[100dvh] px-4 sm:px-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className={`${maxWidth} mx-auto`}>
          <header className="flex items-center gap-3 mb-2">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="logo-gold font-game text-4xl leading-none flex-1 min-w-0 truncate">{title}</h1>
            {right}
          </header>
          {subtitle && <p className="text-white/60 text-sm mb-5 ml-1">{subtitle}</p>}
          {!subtitle && <div className="mb-4" />}
          {children}
        </div>
      </div>
    </div>
  );
}
