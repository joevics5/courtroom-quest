interface Props {
  /** What the other player is doing, e.g. "Chidi is looking through the evidence". Nothing is shown without it. */
  text: string | null;
}

/** A small notice at the top of the screen so each player always knows what the other one is up to. */
export default function LiveStatusBar({ text }: Props) {
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none px-3"
      style={{ top: 'calc(max(env(safe-area-inset-top), 8px) + 56px)' }}
    >
      <div className="max-w-full truncate rounded-full border border-white/20 bg-black/80 backdrop-blur-md px-3 py-1.5 text-xs text-white/90 shadow-lg">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2 align-middle animate-pulse" aria-hidden="true" />
        {text}
      </div>
    </div>
  );
}
