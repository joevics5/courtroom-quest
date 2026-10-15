import { Pause, Play } from 'lucide-react';

interface AutoRestChipProps {
  /** The side the AI is playing. */
  side: 'prosecution' | 'defense';
  /** Time left, already formatted (e.g. "1:28"). */
  timeLabel: string;
  paused: boolean;
  onTogglePause: () => void;
  /** Rest the AI now instead of waiting for the countdown. */
  onRestNow: () => void;
}

/**
 * The small countdown shown while the AI's statement is read: when it hits zero the AI rests
 * automatically. Players can pause it, or rest the AI early (e.g. if they muted the voice and
 * have read it already). A compact chip so it sits in a corner and never covers the text.
 */
export default function AutoRestChip({ side, timeLabel, paused, onTogglePause, onRestNow }: AutoRestChipProps) {
  const who = side === 'prosecution' ? 'Prosecution' : 'Defense';
  return (
    <div
      data-testid="auto-rest-chip"
      className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg p-1 text-white/90"
    >
      <button
        type="button"
        onClick={onTogglePause}
        className="flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-xs sm:text-sm active:bg-white/10"
        title={paused ? 'Tap to resume the timer' : 'Tap to pause the timer'}
        aria-label={paused ? 'Resume the rest timer' : 'Pause the rest timer'}
      >
        {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        <span className="tabular-nums">{paused ? 'Paused' : `${who} rests in`} {timeLabel}</span>
      </button>
      <button
        type="button"
        onClick={onRestNow}
        className="rounded-full bg-[#FFD43B] text-black font-semibold text-xs sm:text-sm px-3 py-1 active:bg-[#e6bd2c]"
        aria-label={`Rest the ${side} now`}
      >
        Rest now
      </button>
    </div>
  );
}
