import { describe, expect, it } from 'vitest';
import { questionRestSeconds, questionRestLabel } from './questionRest';

describe('question rest time', () => {
  it('is between 10 and 20 seconds for every trial length, longer for longer trials', () => {
    const secs = [5, 15, 30, 60].map(d => questionRestSeconds(d));
    secs.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(10);
      expect(s).toBeLessThanOrEqual(20);
    });
    expect([...secs].sort((a, b) => a - b)).toEqual(secs);
  });

  it('falls back to a sensible default for unknown lengths', () => {
    expect(questionRestSeconds(null)).toBe(15);
    expect(questionRestSeconds(45)).toBe(15);
  });

  it('labels the wait, and nothing once it is over', () => {
    expect(questionRestLabel(12)).toBe('Next question in 0:12');
    expect(questionRestLabel(9)).toBe('Next question in 0:09');
    expect(questionRestLabel(0)).toBeNull();
    expect(questionRestLabel(null)).toBeNull();
  });
});
