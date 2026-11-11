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

const CIVIL_TYPES = new Set(['civil', 'constitutional']);

/** What the demands mean for the defence, in plain words. */
export function defenceNote(caseType?: string): string {
  return CIVIL_TYPES.has(caseType ?? '')
    ? 'You now know exactly what you are fighting. Challenge the allegations, dispute the amounts claimed, argue against the other orders, or persuade the court the remedies are not justified.'
    : 'You now know what the prosecution wants. Challenge the evidence, or argue that the penalty it asks for is too harsh. The judge, not the prosecution, decides the actual sentence.';
}
