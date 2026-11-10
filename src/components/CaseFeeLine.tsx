import CoinIcon from './CoinIcon';
import type { CaseFee } from '../lib/coins';

/** What a win pays on each side, on one line: "Prosecution: 50 🪙  Defense: 35 🪙". */
export default function CaseFeeLine({ fee, className = '' }: { fee: CaseFee; className?: string }) {
  const parts = [
    { label: 'Prosecution', amount: fee.prosecution },
    { label: 'Defense', amount: fee.defense }
  ];
  return (
    <div
      className={`flex items-center gap-x-4 whitespace-nowrap text-sm text-white/60 ${className}`}
      role="group"
      aria-label="Coins paid for a win"
    >
      {parts.map(part => (
        <span key={part.label} className="inline-flex items-center gap-1.5">
          {part.label}:
          <span className="font-black text-[#FFD43B]">{part.amount}</span>
          <CoinIcon size={16} />
        </span>
      ))}
    </div>
  );
}
