import { describe, expect, it } from 'vitest';
import { defenceNote, reliefRows } from './requestedRelief';

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
