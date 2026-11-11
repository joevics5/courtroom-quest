import type { RequestedRelief } from '../types';

export interface ReliefRow {
  kind: 'main' | 'money' | 'penalty' | 'also';
  label: string;
  text: string;
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
  const why = relief?.basis?.trim() ? `\nWhy: ${relief.basis.trim()}` : '';
  return `${base}\n\nPROSECUTION'S REQUESTED RELIEF (what the prosecution asks the court to grant):\n${lines}${why}`;
}
