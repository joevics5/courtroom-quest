import { useEffect, useState } from 'react';

interface CaseThumbProps {
  /** The case's image URL. With no image (or one that fails to load) nothing is drawn at all. */
  src?: string | null;
  className?: string;
}

/** Small thumbnail on a case card to make the case look more inviting. Hidden when there is no image. */
export default function CaseThumb({ src, className = '' }: CaseThumbProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const url = src?.trim();
  if (!url || failed) return null;

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      data-testid="case-thumb"
      className={`flex-none w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-white/15 bg-white/5 ${className}`}
    />
  );
}
