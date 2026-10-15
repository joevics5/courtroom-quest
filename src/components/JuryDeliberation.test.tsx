import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import JuryDeliberation, { type DeliberationState } from './JuryDeliberation';
import { JUDGE_AVATARS } from '../lib/avatars';

const jurors = Array.from({ length: 12 }, (_, i) => ({ id: `j${i}`, name: `Juror Name ${i}`, occupation: 'Teacher' }));
const base: DeliberationState = { mode: 'jury', jurors, rounds: [], votingRound: 1, stage: 'voting' };

describe('JuryDeliberation', () => {
  it('shows the judge avatar and name while the judge deliberates', () => {
    render(<JuryDeliberation state={{ ...base, mode: 'judge', jurors: [] }} judge={{ name: 'Justice Martinez', avatar: JUDGE_AVATARS[0], rank: 6 }} onContinue={() => {}} />);
    expect(screen.getByTestId('judge-avatar')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Judge Justice Martinez' })).toBeTruthy();
    expect(screen.getByText('Justice Martinez is deliberating')).toBeTruthy();
  });

  it('keeps the plain heading when no judge is given', () => {
    render(<JuryDeliberation state={{ ...base, mode: 'judge', jurors: [] }} onContinue={() => {}} />);
    expect(screen.getByText('The Judge is deliberating')).toBeTruthy();
  });

  it('shows an avatar for every one of the 12 jurors while they deliberate', () => {
    render(<JuryDeliberation state={base} onContinue={() => {}} />);
    expect(screen.getAllByRole('img', { name: /^Juror portrait: Juror Name/ })).toHaveLength(12);
  });
});
