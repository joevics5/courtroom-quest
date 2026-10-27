import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/database', () => ({
  db: {
    evidence: { getCaseEvidence: vi.fn(async () => [{ id: 'e1', title: 'Route sheet' }]) },
    witnesses: { getCaseWitnesses: vi.fn(async () => [{ id: 'w1', name: 'Bill Tanner' }]) }
  }
}));

import AppealResponseForm from './AppealResponseForm';
import type { Appeal } from '../lib/appeals';

const appeal: Appeal = {
  id: 'a1', number: 1, status: 'awaiting_response', reason: 'missed_witness', explanation: 'Bill knew the clerk swapped the digits and nobody asked him.',
  evidence_ids: [], witness_ids: ['w1'], created_at: '', response_due_at: ''
};
const text = 'The jury heard the route sheet already, so nothing was missed here.';

describe('AppealResponseForm', () => {
  it('shows the appeal being answered, with the witness it points to', async () => {
    render(<AppealResponseForm caseId="c1" appeal={appeal} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/clerk swapped the digits/)).toBeTruthy();
    await waitFor(() => screen.getByText(/Points to: Bill Tanner/));
  });

  it('offers only Accept and Oppose, and explains that accepting is not an admission', () => {
    render(<AppealResponseForm caseId="c1" appeal={appeal} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('ACCEPT')).toBeTruthy();
    expect(screen.getByText('OPPOSE')).toBeTruthy();
    expect(screen.queryByText(/partial/i)).toBeNull();
    expect(screen.getByText(/does not admit the verdict was wrong/)).toBeTruthy();
  });

  it('cannot be sent until a choice and an explanation are given, then sends the choice and the picked items', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AppealResponseForm caseId="c1" appeal={appeal} onSubmit={onSubmit} onClose={vi.fn()} />);
    const send = screen.getByText('SUBMIT RESPONSE') as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.click(screen.getByText('OPPOSE'));
    fireEvent.change(screen.getByLabelText('EXPLAIN YOUR POSITION'), { target: { value: text } });
    await waitFor(() => screen.getByText('Route sheet'));
    fireEvent.click(screen.getByText('Route sheet'));
    expect(send.disabled).toBe(false);

    fireEvent.click(send);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      decision: 'oppose', explanation: text, evidence_ids: ['e1'], witness_ids: []
    }));
  });

  it('shows an error and stays open when sending fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('This appeal has already been answered.'));
    render(<AppealResponseForm caseId="c1" appeal={appeal} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('ACCEPT'));
    fireEvent.change(screen.getByLabelText('EXPLAIN YOUR POSITION'), { target: { value: text } });
    fireEvent.click(screen.getByText('SUBMIT RESPONSE'));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByText(/already been answered/)).toBeTruthy();
  });
});
