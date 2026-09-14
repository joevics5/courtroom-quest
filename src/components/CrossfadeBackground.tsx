import { useEffect, useState } from 'react';

interface CrossfadeBackgroundProps {
  images: string[];
  /** How long each image stays fully visible before the next fades in, in ms */
  intervalMs?: number;
  /** How long the crossfade transition itself takes, in ms */
  transitionMs?: number;
  className?: string;
}

/**
 * Slowly crossfades between a set of background images, stacked and
 * absolutely positioned so the transition is a pure opacity fade with no
 * layout shift. Used for the landing page hero instead of a video —
 * lighter to load, and lets each image be a deliberate, still "beat"
 * (witness stand / gavel / jury box) rather than continuous motion
 * fighting with the text on top of it.
 */
export default function CrossfadeBackground({
  images,
  intervalMs = 7000,
  transitionMs = 2000,
  className = ''
}: CrossfadeBackgroundProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [images.length, intervalMs]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {images.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: index === activeIndex ? 1 : 0,
            transition: `opacity ${transitionMs}ms ease-in-out`
          }}
        />
      ))}
    </div>
  );
}
