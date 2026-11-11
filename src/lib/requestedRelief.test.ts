import { describe, expect, it } from 'vitest';
import { defenceNote, descriptionWithRelief, reliefRows } from './requestedRelief';

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

describe('defenceNote', () => {
  it('differs for civil and criminal cases', () => {
    expect(defenceNote('civil')).toContain('amounts claimed');
    expect(defenceNote('theft')).toContain('judge');
  });
});

describe('descriptionWithRelief', () => {
  const relief = { primary: 'A conviction for theft', financial: '$640 restitution', penalty: '1 year in jail', basis: 'Photo shows another porch.' };
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
    expect(text).toContain('Why: Photo shows another porch.');
  });
});
