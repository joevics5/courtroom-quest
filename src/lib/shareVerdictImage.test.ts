import { describe, expect, it } from 'vitest';
import { SHARE_CAPTION, wrapLines } from './shareVerdictImage';

const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('keeps short text on one line', () => {
    expect(wrapLines(measure, 'The Missing Ledger', 400, 2)).toEqual(['The Missing Ledger']);
  });
  it('wraps long text and cuts the rest with an ellipsis', () => {
    const lines = wrapLines(measure, 'The People versus the Gentleman Who Borrowed the Lighthouse Without Asking', 250, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(lines.every(l => measure(l) <= 250)).toBe(true);
  });
});

describe('caption', () => {
  it('is the invitation under the image', () => {
    expect(SHARE_CAPTION).toBe('Can you do better? >> Play Courtroom Quest www.courtroomquest.app');
  });
});
