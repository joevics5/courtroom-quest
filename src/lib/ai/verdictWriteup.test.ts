import { describe, expect, it } from 'vitest';
import { composeJuryWriteup, extractLooseReasoning, isThinWriteup, MIN_WRITEUP_CHARS } from './verdictWriteup';

const vote = (name: string, v: 'GUILTY' | 'NOT_GUILTY', reason: string) => ({ jurorId: name, name, occupation: 'Teacher', vote: v, reason });
const result = (over: Record<string, unknown> = {}) => ({
  outcome: 'lose', guiltyVotes: 3, notGuiltyVotes: 9, unanimous: false,
  rounds: [{ round: 2, guilty: 3, notGuilty: 9, votes: [
    vote('Ada', 'NOT_GUILTY', 'The key witness contradicted herself on the stand.'),
    vote('Bo', 'NOT_GUILTY', 'No exhibit tied the defendant to the scene.'),
    vote('Cy', 'GUILTY', 'The timeline fits the prosecution story.')
  ] }], ...over
}) as any;

describe('thin write-ups', () => {
  it('flags a one-line decision and accepts a real one', () => {
    expect(isThinWriteup('The jury finds the defendant not guilty by a vote of 9 to 3.')).toBe(true);
    expect(isThinWriteup(null)).toBe(true);
    expect(isThinWriteup('x'.repeat(MIN_WRITEUP_CHARS))).toBe(false);
  });
});

describe('composeJuryWriteup', () => {
  const text = composeJuryWriteup({ juryResult: result(), caseTitle: 'State v. Rivera', defendantName: 'Marco Rivera', evidenceCited: ['Exhibit A'] });

  it('is a real, multi-paragraph decision, not just the tally', () => {
    expect(text.split('\n\n').length).toBeGreaterThanOrEqual(4);
    expect(isThinWriteup(text)).toBe(false);
    expect(text).toMatch(/not guilty by a vote of 9 to 3/);
  });

  it('gives the majority\'s reasons, the dissent and the exhibits', () => {
    expect(text).toMatch(/contradicted herself/);
    expect(text).toMatch(/3 jurors disagreed and voted guilty/);
    expect(text).toMatch(/timeline fits/);
    expect(text).toMatch(/Exhibit A/);
  });

  it('handles a unanimous guilty verdict with no exhibits', () => {
    const t = composeJuryWriteup({ juryResult: result({ outcome: 'win', guiltyVotes: 12, notGuiltyVotes: 0, unanimous: true, rounds: [{ round: 1, guilty: 12, notGuilty: 0, votes: [vote('Ada', 'GUILTY', 'The fingerprints were on the weapon.')] }] }), caseTitle: 'State v. Rivera' });
    expect(t).toMatch(/guilty, and the verdict is unanimous/);
    expect(t).toMatch(/fingerprints/);
    expect(t).toMatch(/testimony alone/);
    expect(t).not.toMatch(/disagreed/);
  });
});

describe('extractLooseReasoning', () => {
  it('rescues the reasoning from a reply whose JSON is broken by raw line breaks', () => {
    const raw = '{\n  "outcome": "lose",\n  "reasoning": "The jury finds the defendant not guilty.\n\nThe witness contradicted herself.",\n  "evidence_cited": ["Exhibit A"],\n  "score": 40\n}';
    expect(() => JSON.parse(raw)).toThrow();
    expect(extractLooseReasoning(raw)).toBe('The jury finds the defendant not guilty.\n\nThe witness contradicted herself.');
  });
  it('returns null when there is no reasoning field', () => {
    expect(extractLooseReasoning('no json here')).toBeNull();
  });
});
