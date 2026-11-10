import { Coins } from 'lucide-react';

/** A coin amount in the game's gold, e.g. the fee on a case or a balance. */
export default function CoinAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-black text-[#FFD43B] ${className}`}>
      <Coins className="w-4 h-4 flex-none" aria-hidden="true" />
      {amount.toLocaleString()}
    </span>
  );
}
