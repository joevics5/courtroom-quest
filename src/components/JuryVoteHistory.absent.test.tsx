import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JuryVoteHistory } from './JuryDeliberation';

const vote = (n: number, v: 'GUILTY' | 'NOT_GUILTY') => ({ jurorId: `j${n}`, name: `Juror ${n}`, vote: v, reason: '' });

describe('JuryVoteHistory with jurors who could not be reached', () => {
  it('shows a grey dot for each and explains it', () => {
    const rounds = [{ round: 1, votes: [vote(1, 'GUILTY'), vote(2, 'NOT_GUILTY')], guilty: 1, notGuilty: 1, absent: 2 }] as any;
    const { container } = render(<JuryVoteHistory rounds={rounds} />);
    expect(container.querySelectorAll('[data-absent="true"]')).toHaveLength(2);
    expect(screen.getByText('Not reached')).toBeTruthy();
  });

  it('shows no such dots or key when everyone voted', () => {
    const rounds = [{ round: 1, votes: [vote(1, 'GUILTY')], guilty: 1, notGuilty: 0 }] as any;
    const { container } = render(<JuryVoteHistory rounds={rounds} />);
    expect(container.querySelectorAll('[data-absent="true"]')).toHaveLength(0);
    expect(screen.queryByText('Not reached')).toBeNull();
  });
});
