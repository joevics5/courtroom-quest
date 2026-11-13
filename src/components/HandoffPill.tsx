/**
 * The pill shown during a break between counsel and while an opening or closing statement is read out.
 * It sits in an overlay that ignores taps, so it has to switch taps back on or its SKIP button never fires.
 */
export default function HandoffPill({
  label,
  timeLabel,
  skippable,
  onSkip
}: {
  label: string;
  timeLabel: string;
  skippable?: boolean;
  onSkip: () => void;
}) {
  return (
    <div
      data-testid="handoff-pill"
      className="pointer-events-auto rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-white/85 tabular-nums"
    >
      {label} · {timeLabel}
      {skippable && (
        <button
          type="button"
          onClick={onSkip}
          className="ml-2 rounded-full bg-[#FFD43B] px-2.5 py-0.5 text-[11px] font-black text-black"
        >
          SKIP
        </button>
      )}
    </div>
  );
}
