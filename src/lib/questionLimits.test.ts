import { describe, it, expect } from 'vitest';
import { questionLimitFor, questionCounterLabel } from './questionLimits';

describe('question limits', () => {
  it('gives direct and cross the same cap and redirect half, growing with trial length', () => {
    expect(questionLimitFor(15, 'direct')).toBe(4);
    expect(questionLimitFor(15, 'cross')).toBe(4);
    expect(questionLimitFor(30, 'direct')).toBe(6);
    expect(questionLimitFor(60, 'cross')).toBe(8);
    expect(questionLimitFor(30, 'redirect')).toBe(3);
    expect(questionLimitFor(60, 'redirect')).toBe(4);
  });

  it('has no cap outside examinations', () => {
    expect(questionLimitFor(30, 'opening')).toBeNull();
    expect(questionLimitFor(30, 'closing')).toBeNull();
    expect(questionLimitFor(30, 'call_witness')).toBeNull();
    expect(questionLimitFor(30, null)).toBeNull();
    expect(questionLimitFor(null, 'direct')).toBeNull();
    expect(questionLimitFor(45, 'direct')).toBeNull();
  });

  it('labels the counter', () => {
    expect(questionCounterLabel(0, 6)).toBe('Question 1 of 6');
    expect(questionCounterLabel(4, 6)).toBe('Question 5 of 6');
    expect(questionCounterLabel(5, 6)).toBe('Last question');
    expect(questionCounterLabel(6, 6)).toBe('No questions left');
    expect(questionCounterLabel(2, null)).toBeNull();
  });
});
