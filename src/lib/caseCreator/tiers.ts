// Counts per difficulty. Keep in sync with TIERS in supabase/functions/generate-case/schema.ts.
export type Tier = 'easy' | 'medium' | 'hard';
type Range = [number, number];

export const TIERS: Record<Tier, { witnesses: Range; evidence: Range; loopholes: Range }> = {
  easy: { witnesses: [2, 3], evidence: [2, 3], loopholes: [3, 4] },
  medium: { witnesses: [4, 6], evidence: [4, 6], loopholes: [5, 7] },
  hard: { witnesses: [7, 10], evidence: [7, 10], loopholes: [8, 12] },
};

export const tierOf = (d?: string): Tier => (d === 'easy' || d === 'hard' ? d : 'medium');
export const rangeText = (r: Range) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
