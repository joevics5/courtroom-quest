import { describe, expect, it } from 'vitest';
import { withCaseSuffix } from './caseName';

describe('withCaseSuffix', () => {
  it('adds "case" after the name', () => expect(withCaseSuffix('The Conspiracy')).toBe('The Conspiracy case'));
  it('does not double it', () => {
    expect(withCaseSuffix('The Harbor Case')).toBe('The Harbor Case');
    expect(withCaseSuffix('the harbor case')).toBe('the harbor case');
  });
  it('keeps names that merely contain the word', () => expect(withCaseSuffix('Casework Murders')).toBe('Casework Murders case'));
  it('copes with an empty title', () => expect(withCaseSuffix('  ')).toBe('the case'));
});
