import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Verdict } from '../types';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));
vi.mock('../lib/database', () => ({
  db: {
    sessions: { getSession: vi.fn().mockResolvedValue(null), updateSession: vi.fn().mockResolvedValue({}) },
    trialEvents: { getSessionEvents: vi.fn().mockResolvedValue([]) }
  }
}));
vi.mock('./TranscriptViewer', () => ({ default: () => <div>TRANSCRIPT OPEN</div> }));

import VerdictDisplay from './VerdictDisplay';

const verdict = (over: Partial<Verdict> = {}): Verdict => ({
  id: 'v1',
  session_id: 's1',
  outcome: 'lose',
  reasoning: 'The prosecution did not prove its case.',
  evidence_cited: ['Exhibit A'],
  missed_opportunities: ['Challenge the timeline'],
  score: 82,
  delivered_at: '2026-10-09T00:00:00Z',
  ...over
});

const base = { caseTitle: 'State v. Rivera', currentLevel: 'Junior Counsel', playerRole: 'defense' as const, onReturnHome: () => {} };

describe('VerdictDisplay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a win shows VICTORY, the score and the share button', () => {
    render(<VerdictDisplay verdict={verdict()} {...base} wins={1} />);
    expect(screen.getByText('VICTORY')).toBeTruthy();
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByRole('button', { name: /SHARE VICTORY/ })).toBeTruthy();
    expect(screen.getByText(/You Won/)).toBeTruthy();
    expect(screen.getByText('Exhibit A')).toBeTruthy();
    expect(screen.getByText('Challenge the timeline')).toBeTruthy();
  });

  it('a loss shows DEFEAT and offers no victory share', () => {
    render(<VerdictDisplay verdict={verdict({ outcome: 'win' })} {...base} wins={1} />);
    expect(screen.getByText('DEFEAT')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /SHARE VICTORY/ })).toBeNull();
    expect(screen.getByText(/You Lost/)).toBeTruthy();
  });

  it('judges the result from the player\'s side: guilty is a win for the prosecution', () => {
    render(<VerdictDisplay verdict={verdict({ outcome: 'win' })} {...base} playerRole="prosecution" wins={1} />);
    expect(screen.getByText('VICTORY')).toBeTruthy();
  });

  it('a score of 0 shows as 0, not as stray text', () => {
    const { container } = render(<VerdictDisplay verdict={verdict({ score: 0, outcome: 'win' })} {...base} />);
    expect(screen.getByText('PERFORMANCE SCORE')).toBeTruthy();
    expect(container.textContent).toContain('0');
  });

  it('no score, no score section', () => {
    render(<VerdictDisplay verdict={verdict({ score: undefined })} {...base} />);
    expect(screen.queryByText('PERFORMANCE SCORE')).toBeNull();
  });

  it('shows rank progress, and NEW RANK when a win lands exactly on a rank', () => {
    const { rerender } = render(<VerdictDisplay verdict={verdict()} {...base} wins={3} />);
    expect(screen.getByText(/2 more wins to Associate Attorney/)).toBeTruthy();
    expect(screen.queryByText('NEW RANK!')).toBeNull();

    rerender(<VerdictDisplay verdict={verdict()} {...base} currentLevel="Associate Attorney" wins={5} />);
    expect(screen.getByText('NEW RANK!')).toBeTruthy();
    expect(screen.getByText('Associate Attorney')).toBeTruthy();
  });

  it('no NEW RANK after a loss, even on a threshold', () => {
    render(<VerdictDisplay verdict={verdict({ outcome: 'win' })} {...base} currentLevel="Associate Attorney" wins={5} />);
    expect(screen.queryByText('NEW RANK!')).toBeNull();
  });

  it('works without a win count (older callers)', () => {
    render(<VerdictDisplay verdict={verdict()} {...base} currentLevel="Trial Lawyer" />);
    expect(screen.getByText('Trial Lawyer')).toBeTruthy();
    expect(screen.queryByText(/more win/)).toBeNull();
  });

  it('returns to cases and opens the transcript', async () => {
    const onReturnHome = vi.fn();
    render(<VerdictDisplay verdict={verdict()} {...base} onReturnHome={onReturnHome} />);
    fireEvent.click(screen.getByRole('button', { name: /RETURN TO CASES/ }));
    expect(onReturnHome).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /VIEW TRANSCRIPT/ }));
    await waitFor(() => expect(screen.getByText('TRANSCRIPT OPEN')).toBeTruthy());
  });
});
