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

/**
 * The demand as text for an AI prompt. `audience` decides the closing instruction:
 * the prosecuting side argues for it, the defending side argues against it, the judge weighs it.
 * Empty when the case has no demand, so prompts stay unchanged.
 */
export function reliefPromptBlock(relief: RequestedRelief | null | undefined, audience: 'prosecution' | 'defense' | 'judge'): string {
  const rows = reliefRows(relief);
  if (rows.length === 0) return '';
  const lines = rows.map(r => `- ${r.label.charAt(0)}${r.label.slice(1).toLowerCase()}: ${r.text}`).join('\n');
  const basis = relief?.basis?.trim() ? `\nLegal basis given for the demand: ${relief.basis.trim()}` : '';
  const closing =
    audience === 'prosecution'
      ? 'You are arguing for exactly this relief. Tie your case to it. Do not ask for anything that is not listed here.'
      : audience === 'defense'
        ? 'The prosecution is asking for exactly this relief. Challenge it: dispute the amounts, argue against each order, and argue that the penalty is too harsh or unjustified. Do not invent other demands.'
        : 'This is what the prosecution is asking the court to grant. These demands are not evidence and not binding on you. Decide whether the case is proven first; if it is, you decide what to grant, and you may grant less than asked.';
  return `WHAT THE PROSECUTION IS ASKING THE COURT TO GRANT:\n${lines}${basis}\n${closing}`;
}
