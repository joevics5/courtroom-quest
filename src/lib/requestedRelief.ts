import type { RequestedRelief } from '../types';

export interface ReliefRow {
  kind: 'main' | 'money' | 'penalty' | 'also';
  label: string;
  text: string;
}

/** One thing the prosecution asks for, with a stable id so votes and rulings can point at it. */
export interface Demand extends ReliefRow {
  /** 'main', 'money', 'penalty', 'also1', 'also2' ... */
  id: string;
}

/** The demands with ids. The main request is the deciding issue; the rest are voted on alongside it. */
export function reliefDemands(relief?: RequestedRelief | null): Demand[] {
  let extra = 0;
  return reliefRows(relief).map(r => ({ ...r, id: r.kind === 'also' ? `also${++extra}` : r.kind }));
}

/** The demands in reading order: the main request, money, the penalty, then everything else asked for. */
export function reliefRows(relief?: RequestedRelief | null): ReliefRow[] {
  if (!relief) return [];
  const rows: ReliefRow[] = [];
  const add = (kind: ReliefRow['kind'], label: string, text?: string) => {
    if (text && text.trim()) rows.push({ kind, label, text: text.trim() });
  };
  add('main', 'MAIN REQUEST', relief.primary);
  add('money', 'MONEY', relief.financial);
  add('penalty', 'PENALTY', relief.penalty);
  (relief.additional ?? []).forEach(a => add('also', 'ALSO ASKS', a));
  return rows;
}

/**
 * The case description with the demand written under it, so everything that reads the description
 * (the AI counsel, the judge) gets the demand in the same text. Unchanged when there is no demand.
 */
export function descriptionWithRelief(description: string | null | undefined, relief?: RequestedRelief | null): string {
  const base = description ?? '';
  const rows = reliefRows(relief);
  if (rows.length === 0) return base;
  const lines = rows.map(r => `- ${r.label.charAt(0)}${r.label.slice(1).toLowerCase()}: ${r.text}`).join('\n');
  return `${base}\n\nPROSECUTION'S REQUESTED RELIEF (what the prosecution asks the court to grant):\n${lines}`;
}

/** A demand and how it was ruled on. The judge counts as one vote (1-0 or 0-1). */
export interface DemandRuling extends Demand {
  grant: number;
  deny: number;
  granted: boolean;
}

/**
 * Turns a judge's rulings into one result per demand. The main request decides the verdict:
 * granted = win, refused = lose. The other demands follow it: if the main request is refused
 * they fail too, and a demand the judge left out counts as refused.
 */
export function benchRulings(
  demands: Demand[],
  rulings: Record<string, boolean> | undefined,
  outcome: 'win' | 'lose' | 'partial'
): { outcome: 'win' | 'lose' | 'partial'; demands: DemandRuling[] } {
  const hasMain = demands.some(d => d.id === 'main');
  const mainGranted = outcome === 'win' ? true : outcome === 'lose' ? false : rulings?.main === true;
  const results = demands.map((d): DemandRuling => {
    const granted = d.id === 'main' ? mainGranted : (hasMain && !mainGranted ? false : rulings?.[d.id] === true);
    return { ...d, grant: granted ? 1 : 0, deny: granted ? 0 : 1, granted };
  });
  return { outcome: hasMain ? (mainGranted ? 'win' : 'lose') : outcome, demands: results };
}

/**
 * Summary of how the demands were ruled on. The verdict follows the main request alone;
 * `partial` is true when the main request was granted but something else asked for was refused
 * (a win, shown as a partial win).
 */
export function demandSummary(results: { id: string; granted: boolean }[] | null | undefined): {
  mainGranted: boolean | null;
  granted: number;
  total: number;
  partial: boolean;
} {
  const list = results ?? [];
  const main = list.find(r => r.id === 'main');
  const granted = list.filter(r => r.granted).length;
  return {
    mainGranted: main ? main.granted : null,
    granted,
    total: list.length,
    partial: !!main?.granted && granted < list.length
  };
}
