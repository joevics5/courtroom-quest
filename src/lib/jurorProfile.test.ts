import { describe, it, expect } from 'vitest';
import { describeJurorTraits } from './jurorProfile';

describe('describeJurorTraits', () => {
  it('passes string arrays through', () => {
    expect(describeJurorTraits(['methodical', ' by-the-book '])).toEqual(['methodical', 'by-the-book']);
  });

  it('turns the object form into readable phrases', () => {
    expect(describeJurorTraits({ patient: true, methodical: true })).toEqual(['patient', 'methodical']);
    expect(describeJurorTraits({ defense_sympathy: 'high', system_skepticism: 'medium' }))
      .toEqual(['defense sympathy (high)', 'system skepticism (medium)']);
  });

  it('skips false and empty values', () => {
    expect(describeJurorTraits({ vocal: false, calm: true, x: '', y: null })).toEqual(['calm']);
  });

  it('handles empty and missing input', () => {
    expect(describeJurorTraits(null)).toEqual([]);
    expect(describeJurorTraits(undefined)).toEqual([]);
    expect(describeJurorTraits({})).toEqual([]);
    expect(describeJurorTraits([])).toEqual([]);
  });
});
