import CoinIcon from './CoinIcon';

/** A coin amount: the gold coin, then the number. */
export default function CoinAmount({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black text-[#FFD43B] ${className}`}>
      <CoinIcon size={18} />
      {amount.toLocaleString()}
    </span>
  );
}
