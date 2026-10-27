import { useEffect, useMemo, useState } from 'react';
import { Gavel, Loader2, ScrollText, Trophy } from 'lucide-react';
import ScreenShell from './ScreenShell';
import { PANEL_SOFT, gameButton } from './ui';
import { db } from '../lib/database';
import { buildHistory, filterHistory, type HistoryEntry, type HistoryFilter } from '../lib/caseHistory';
import { appealsEnabled } from '../lib/appeals';

interface CaseHistoryProps {
  userId: string;
  onBack: () => void;
  /** Open a finished case on its verdict screen (where it can be appealed). */
  onOpen: (entry: HistoryEntry) => void;
}

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' }
];

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Every case the player has finished, won or lost. Open one to see the verdict again, and to appeal a loss. */
export default function CaseHistory({ userId, onBack, onOpen }: CaseHistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const appealsOn = useMemo(() => appealsEnabled(), []);

  const load = () => {
    setError(false);
    setEntries(null);
    db.sessions.getCaseHistory(userId)
      .then(rows => setEntries(buildHistory(rows, userId)))
      .catch(() => setError(true));
  };
  useEffect(load, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = entries ? filterHistory(entries, filter) : [];
  const won = entries?.filter(e => e.won).length ?? 0;
  const lost = (entries?.length ?? 0) - won;

  return (
    <ScreenShell title="CASE HISTORY" subtitle="Every case you have finished, won or lost." onBack={onBack}>
      {entries && entries.length > 0 && (
        <div className="flex items-center gap-2 mb-4" role="tablist" aria-label="Filter cases">
          {FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                filter === f.id ? 'bg-[#FFD43B] text-black' : 'bg-white/10 text-white/80 border border-white/15'
              }`}
            >
              {f.label} ({f.id === 'all' ? entries.length : f.id === 'won' ? won : lost})
            </button>
          ))}
        </div>
      )}

      {!entries && !error && (
        <p role="status" className="flex items-center gap-2 text-white/70"><Loader2 className="w-5 h-5 animate-spin" /> Loading your cases…</p>
      )}

      {error && (
        <div className={`${PANEL_SOFT} p-5 space-y-3`}>
          <p role="alert" className="text-[#FF9A9D]">Could not load your case history.</p>
          <button onClick={load} className={gameButton('outline', 'sm')}>TRY AGAIN</button>
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className={`${PANEL_SOFT} p-6 text-center space-y-2`}>
          <ScrollText className="w-10 h-10 mx-auto text-white/40" />
          <h2 className="font-game text-3xl text-white">NO FINISHED CASES YET</h2>
          <p className="text-white/60">Win or lose, every case you finish will be kept here.</p>
        </div>
      )}

      {entries && entries.length > 0 && shown.length === 0 && (
        <p className="text-white/60 text-center py-6">No {filter} cases yet.</p>
      )}

      <ul className="space-y-3">
        {shown.map(e => (
          <li key={e.sessionId}>
            <button
              onClick={() => onOpen(e)}
              className={`${PANEL_SOFT} w-full text-left p-4 transition-colors active:bg-white/10 touch-manipulation ${
                e.won ? 'border-[#FFD43B]/40' : 'border-[#E5484D]/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-game text-2xl leading-tight text-white truncate">{e.title}</h2>
                  <p className="text-sm text-white/60 mt-0.5">
                    {e.role === 'prosecution' ? 'Prosecution' : 'Defense'} · Verdict: {e.verdictWord}
                    {e.difficulty ? ` · ${e.difficulty}` : ''} · {dateLabel(e.finishedAt)}
                  </p>
                </div>
                <span
                  className={`flex-none inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black tracking-wide ${
                    e.won ? 'bg-[#FFD43B] text-black' : 'bg-[#E5484D]/20 text-[#FF9A9D] border border-[#E5484D]/50'
                  }`}
                >
                  {e.won && <Trophy className="w-3.5 h-3.5" />}
                  {e.won ? 'WON' : 'LOST'}
                </span>
              </div>
              {(e.appealNote || (appealsOn && e.appealable)) && (
                <p className="mt-2 text-sm flex items-center gap-1.5 text-white/70">
                  <Gavel className="w-4 h-4 text-[#FFD43B]" />
                  {e.appealNote ?? 'You can appeal this verdict'}
                  {appealsOn && e.appealable && e.appealNote ? ' · can still appeal' : ''}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </ScreenShell>
  );
}
