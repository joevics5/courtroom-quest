import { didPlayerWin, getSessionPlayerRole, verdictLabel } from './verdictUtils';
import { appealsRemaining, getAppeals, isVerdictAccepted } from './appeals';
import { appealsSupported } from './appealFlow';
import type { HistorySession } from './database';
import type { PlayerRole, Verdict } from '../types';

export interface HistoryEntry {
  sessionId: string;
  title: string;
  difficulty: string | null;
  role: PlayerRole;
  won: boolean;
  verdictWord: string;
  finishedAt: string;
  verdict: Verdict;
  appealsUsed: number;
  /** True when this game is a loss that can still be appealed (games against the AI, appeals left, not accepted). */
  appealable: boolean;
  /** Short line for the list: "Appeal denied", "2 appeals used"... or null. */
  appealNote: string | null;
}

function pickVerdict(v: HistorySession['verdicts']): Verdict | null {
  if (!v) return null;
  const list = Array.isArray(v) ? v : [v];
  if (list.length === 0) return null;
  return [...list].sort((a, b) => (b.delivered_at || '').localeCompare(a.delivered_at || ''))[0];
}

/** Turns the raw rows into what the history screen shows. Games with no verdict (like a guilty plea) are left out. */
export function buildHistory(rows: HistorySession[], userId: string): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const row of rows) {
    const verdict = pickVerdict(row.verdicts);
    if (!verdict) continue;
    const state = (row.session_state ?? {}) as Record<string, any>;
    const role = getSessionPlayerRole(row, userId);
    const won = didPlayerWin(verdict.outcome, role);
    const appeals = getAppeals(state);
    const last = appeals[appeals.length - 1];
    const pending = last && (last.status === 'awaiting_response' || last.status === 'awaiting_ruling' || (last.status === 'granted' && !last.reopened));
    let appealNote: string | null = null;
    if (pending) appealNote = 'Appeal in progress';
    else if (appeals.length > 0) appealNote = `${appeals.length} ${appeals.length === 1 ? 'appeal' : 'appeals'} used`;
    else if ((state.appealRound as number | undefined) && won) appealNote = 'Won on appeal';

    out.push({
      sessionId: row.id,
      title: row.cases?.title ?? 'Untitled case',
      difficulty: row.cases?.difficulty ?? null,
      role,
      won,
      verdictWord: verdictLabel(verdict.outcome),
      finishedAt: row.completed_at ?? row.updated_at,
      verdict,
      appealsUsed: appeals.length,
      appealable: !won && appealsSupported(state) && !isVerdictAccepted(state) && appealsRemaining(state) > 0 && !pending,
      appealNote
    });
  }
  return out.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export type HistoryFilter = 'all' | 'won' | 'lost';

export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  if (filter === 'won') return entries.filter(e => e.won);
  if (filter === 'lost') return entries.filter(e => !e.won);
  return entries;
}
