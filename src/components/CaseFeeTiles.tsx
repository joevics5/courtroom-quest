import CoinAmount from './CoinAmount';
import type { CaseFee } from '../lib/coins';

/** What a win pays on each side, as two tiles. The side that pays more is the harder one and is marked. */
export default function CaseFeeTiles({ fee, className = '' }: { fee: CaseFee; className?: string }) {
  const bonusSide = fee.prosecution === fee.defense ? null : fee.prosecution > fee.defense ? 'prosecution' : 'defense';
  const tiles = [
    { side: 'prosecution', label: 'Prosecution', amount: fee.prosecution },
    { side: 'defense', label: 'Defense', amount: fee.defense }
  ] as const;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Coins paid for a win">
        {tiles.map(tile => {
          const bonus = bonusSide === tile.side;
          return (
            <div
              key={tile.side}
              className={`rounded-xl border px-3 py-2 ${bonus ? 'border-[#FFD43B]/70 bg-[#FFD43B]/10' : 'border-white/15 bg-white/5'}`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] uppercase tracking-widest text-white/60">
                <span>{tile.label}</span>
                {bonus && (
                  <span className="rounded bg-[#FFD43B] px-1.5 py-px text-[10px] font-bold tracking-wide text-black">
                    Bonus
                  </span>
                )}
              </div>
              <CoinAmount amount={tile.amount} className="mt-0.5 text-xl" />
            </div>
          );
        })}
      </div>
      {fee.repeat && <p className="mt-1.5 text-xs text-white/45">Already won: repeat wins pay less</p>}
    </div>
  );
}
