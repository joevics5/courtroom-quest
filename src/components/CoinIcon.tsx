import { useId } from 'react';

/** A small gold coin with an embossed C. Drawn inline so it stays crisp at any size. */
export default function CoinIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`flex-none ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id={`coin-${id}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFF0A6" />
          <stop offset="55%" stopColor="#FFD43B" />
          <stop offset="100%" stopColor="#D99A0B" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#coin-${id})`} stroke="#B97A06" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#B97A06" strokeOpacity="0.55" strokeWidth="1" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="800" fill="#9A6504" fontFamily="system-ui, sans-serif">C</text>
    </svg>
  );
}
