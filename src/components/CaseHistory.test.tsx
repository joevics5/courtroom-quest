import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const getCaseHistory = vi.fn();
vi.mock('../lib/database', () => ({ db: { sessions: { getCaseHistory: (...a: unknown[]) => getCaseHistory(...a) } } }));
vi.mock('./ScreenShell', () => ({ default: ({ children, title }: any) => <div><h1>{title}</h1>{children}</div> }));

import CaseHistory from './CaseHistory';

const verdict = (outcome: string) => ({ id: 'v' + outcome, session_id: 's', outcome, reasoning: 'r', evidence_cited: [], delivered_at: '2026-10-20T10:00:00Z' });
const row = (id: string, title: string, outcome: string): any => ({
  id, user_id: 'me', case_id: 'c', session_state: { playerRole: 'defense' }, completed_at: '2026-10-20T10:05:00Z', updated_at: '',
  cases: { title, difficulty: 'easy' }, verdicts: [verdict(outcome)]
});

beforeEach(() => getCaseHistory.mockReset());

describe('CaseHistory', () => {
  it('lists won and lost cases, filters them, and opens one', async () => {
    getCaseHistory.mockResolvedValue([row('a', 'The Midnight Burglary', 'win'), row('b', 'The Bar Fight', 'lose')]);
    const onOpen = vi.fn();
    render(<CaseHistory userId="me" onBack={vi.fn()} onOpen={onOpen} />);

    await waitFor(() => screen.getByText('The Midnight Burglary'));
    expect(screen.getByText('The Bar Fight')).toBeTruthy();
    expect(screen.getByText('LOST')).toBeTruthy(); // defense vs a guilty verdict
    expect(screen.getByText('WON')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Won/ }));
    expect(screen.queryByText('The Midnight Burglary')).toBeNull();
    expect(screen.getByText('The Bar Fight')).toBeTruthy();

    fireEvent.click(screen.getByText('The Bar Fight'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'b', won: true }));
  });

  it('has a friendly empty state', async () => {
    getCaseHistory.mockResolvedValue([]);
    render(<CaseHistory userId="me" onBack={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() => screen.getByText('NO FINISHED CASES YET'));
  });

  it('lets the player retry when loading fails', async () => {
    getCaseHistory.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([row('a', 'The Bar Fight', 'win')]);
    render(<CaseHistory userId="me" onBack={vi.fn()} onOpen={vi.fn()} />);
    await waitFor(() => screen.getByRole('alert'));
    fireEvent.click(screen.getByText('TRY AGAIN'));
    await waitFor(() => screen.getByText('The Bar Fight'));
  });
});
