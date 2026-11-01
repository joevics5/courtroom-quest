import { describe, expect, it } from 'vitest';
import { questionRestSeconds, questionRestLabel } from './questionRest';

describe('question rest time', () => {
  it('is a fixed 20 seconds in every mode, never unlimited', () => {
    expect([5, 15, 30, 60].map(d => questionRestSeconds(d))).toEqual([20, 20, 20, 20]);
    expect(questionRestSeconds(null)).toBe(20);
    expect(questionRestSeconds(45)).toBe(20);
  });

  it('labels the wait, and nothing once it is over', () => {
    expect(questionRestLabel(12)).toBe('Next question in 0:12');
    expect(questionRestLabel(9)).toBe('Next question in 0:09');
    expect(questionRestLabel(0)).toBeNull();
    expect(questionRestLabel(null)).toBeNull();
  });
});
