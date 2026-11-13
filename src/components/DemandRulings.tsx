import { CheckCircle, XCircle } from 'lucide-react';
import type { PlayerRole } from '../types';

export interface DemandRulingRow {
  id: string;
  label: string;
  text: string;
  grant: number;
  deny: number;
  granted: boolean;
}

interface Props {
  results: DemandRulingRow[];
  playerRole: PlayerRole;
}

/**
 * The court's ruling on each thing the prosecution asked for. The main request decides the verdict;
 * the others are simply granted or not. A jury shows its count (9-3); a judge is a single ruling.
 * Granted is good news for the prosecution and bad news for the defence, so the colour follows the player.
 */
export default function DemandRulings({ results, playerRole }: Props) {
  if (results.length < 2) return null; // one demand is just the verdict itself
  return (
    <ul className="space-y-2" aria-label="Ruling on each request">
      {results.map(r => {
        const good = r.granted === (playerRole === 'prosecution');
        const showCount = r.grant + r.deny > 1;
        return (
          <li
            key={r.id}
            data-demand={r.id}
            data-granted={r.granted ? 'true' : 'false'}
            className="flex items-start gap-3 rounded-xl bg-black/35 border border-white/10 p-3"
          >
            <span className="flex-none mt-0.5">
              {r.granted ? (
                <CheckCircle className={`w-5 h-5 ${good ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`} aria-hidden="true" />
              ) : (
                <XCircle className={`w-5 h-5 ${good ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`} aria-hidden="true" />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] font-black tracking-wider text-[#FFD43B]">
                {r.label}{r.id === 'main' ? ' · DECIDES THE VERDICT' : ''}
              </span>
              <span className="block text-white/90 text-sm leading-snug">{r.text}</span>
            </span>
            <span className="flex-none text-right">
              <span className={`block text-xs font-black tracking-wide ${good ? 'text-[#5EEAD4]' : 'text-[#FF9A9D]'}`}>
                {r.granted ? 'GRANTED' : 'NOT GRANTED'}
              </span>
              {showCount && <span className="block text-xs text-white/55">{r.grant}–{r.deny}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
