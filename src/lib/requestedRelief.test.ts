import { describe, expect, it } from 'vitest';
import { defenceNote, reliefPromptBlock, reliefRows } from './requestedRelief';

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

describe('reliefPromptBlock', () => {
  const relief = { primary: 'A conviction for theft', financial: '$640 restitution', penalty: '1 year in jail', basis: 'Photo shows another porch.' };
  it('is empty without a demand', () => {
    expect(reliefPromptBlock(null, 'judge')).toBe('');
    expect(reliefPromptBlock({}, 'prosecution')).toBe('');
  });
  it('lists the demands for everyone', () => {
    for (const who of ['prosecution', 'defense', 'judge'] as const) {
      const text = reliefPromptBlock(relief, who);
      expect(text).toContain('$640 restitution');
      expect(text).toContain('1 year in jail');
      expect(text).toContain('Photo shows another porch.');
    }
  });
  it('tells each side what to do with it', () => {
    expect(reliefPromptBlock(relief, 'prosecution')).toContain('arguing for exactly this relief');
    expect(reliefPromptBlock(relief, 'defense')).toContain('Challenge it');
    expect(reliefPromptBlock(relief, 'judge')).toContain('you may grant less than asked');
  });
});
