import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
let rows: Record<string, any> = {};
vi.mock('./supabase', () => {
  const builder = (table: string) => {
    const b: any = {
      select: () => b, eq: () => b, order: () => b, insert: () => b, update: () => b, delete: () => b,
      single: () => Promise.resolve({ data: rows[table], error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[table], error: null }),
      then: (res: any) => res({ data: Array.isArray(rows[table]) ? rows[table] : [rows[table]], error: null })
    };
    return b;
  };
  return { supabase: { from: (t: string) => { calls.push(t); return builder(t); } } };
});

import { db } from './database';
import { invalidate } from './dataCache';

const count = (t: string) => calls.filter(c => c === t).length;

describe('case data caching in the database layer', () => {
  beforeEach(() => {
    calls.length = 0;
    invalidate();
    rows = { cases: [{ id: 'c1', title: 'A' }], witnesses: [{ id: 'w1' }], evidence: [{ id: 'e1' }] };
  });

  it('asks for the preset cases once, however many screens need them', async () => {
    await db.cases.getPresetCases();
    await db.cases.getPresetCases();
    await db.cases.getPresetCases();
    expect(count('cases')).toBe(1);
  });

  it('editors can read fresh', async () => {
    await db.cases.getPresetCases();
    await db.cases.getPresetCases({ fresh: true });
    expect(count('cases')).toBe(2);
  });

  it('saving a case clears the cached list', async () => {
    rows.cases = { id: 'c1', title: 'A' };
    await db.cases.getPresetCases();
    await db.cases.updateCase('c1', { title: 'B' } as any);
    await db.cases.getPresetCases();
    expect(count('cases')).toBe(3); // list, the update, the list again
  });

  it('case details reuse the cached case and witnesses but always re-read evidence', async () => {
    rows.cases = { id: 'c1', title: 'A' };
    await db.cases.getCaseWithDetails('c1');
    await db.cases.getCaseWithDetails('c1');
    expect(count('cases')).toBe(1);
    expect(count('witnesses')).toBe(1);
    expect(count('evidence')).toBe(2);
  });

  it('editing a witness clears cached witnesses', async () => {
    rows.witnesses = [{ id: 'w1' }];
    await db.witnesses.getCaseWitnesses('c1');
    rows.witnesses = { id: 'w1' };
    await db.witnesses.updateWitness('w1', { name: 'x' } as any);
    rows.witnesses = [{ id: 'w1' }];
    await db.witnesses.getCaseWitnesses('c1');
    expect(count('witnesses')).toBe(3);
  });
});
