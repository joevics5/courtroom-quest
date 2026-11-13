import { describe, expect, it } from 'vitest';
import { demandSummary, descriptionWithRelief, reliefRows } from './requestedRelief';

describe('reliefRows', () => {
  it('orders main request, money, penalty, then extras and skips empty parts', () => {
    const rows = reliefRows({ primary: 'A', financial: 'B', penalty: '', additional: ['C', ' ', 'D'] });
    expect(rows.map(r => r.text)).toEqual(['A', 'B', 'C', 'D']);
    expect(rows.map(r => r.kind)).toEqual(['main', 'money', 'also', 'also']);
  });
  it('is empty with no relief', () => {
    expect(reliefRows(null)).toEqual([]);
    expect(reliefRows(undefined)).toEqual([]);
  });
});

describe('descriptionWithRelief', () => {
  const relief = { primary: 'A conviction for theft', financial: '$640 restitution', penalty: '1 year in jail' };
  it('is the plain description when there is no demand', () => {
    expect(descriptionWithRelief('A parcel vanished.', null)).toBe('A parcel vanished.');
    expect(descriptionWithRelief('A parcel vanished.', {})).toBe('A parcel vanished.');
    expect(descriptionWithRelief(undefined, null)).toBe('');
  });
  it('writes the demand under the description', () => {
    const text = descriptionWithRelief('A parcel vanished.', relief);
    expect(text.startsWith('A parcel vanished.')).toBe(true);
    expect(text).toContain("PROSECUTION'S REQUESTED RELIEF");
    expect(text).toContain('Money: $640 restitution');
    expect(text).toContain('Penalty: 1 year in jail');
    expect(text).not.toContain('Why');
  });
});

describe('demandSummary', () => {
  it('a granted main request with something refused is a partial win', () => {
    expect(demandSummary([{ id: 'main', granted: true }, { id: 'money', granted: false }, { id: 'also1', granted: true }]))
      .toEqual({ mainGranted: true, granted: 2, total: 3, partial: true });
  });
  it('everything granted is a full win, not partial', () => {
    expect(demandSummary([{ id: 'main', granted: true }, { id: 'money', granted: true }]).partial).toBe(false);
  });
  it('a refused main request is a loss, never a partial win', () => {
    const s = demandSummary([{ id: 'main', granted: false }, { id: 'money', granted: true }]);
    expect(s.mainGranted).toBe(false);
    expect(s.partial).toBe(false);
  });
  it('has no main result when the case has no demand', () => {
    expect(demandSummary(null)).toEqual({ mainGranted: null, granted: 0, total: 0, partial: false });
  });
});
