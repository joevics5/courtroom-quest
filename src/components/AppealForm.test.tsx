import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/database', () => ({
  db: {
    evidence: { getCaseEvidence: vi.fn(async () => [{ id: 'e1', title: 'Route sheet', exhibit_label: 'Exhibit A' }]) },
    witnesses: { getCaseWitnesses: vi.fn(async () => [{ id: 'w1', name: 'Bill Tanner' }]) }
  }
}));

import AppealForm from './AppealForm';

const text = 'Bill knew the clerk swapped the digits, and nobody asked him about the route sheet.';

describe('AppealForm', () => {
  it('offers exactly the three reasons and no way to add new material', async () => {
    render(<AppealForm caseId="c1" appealNumber={1} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Missed Evidence')).toBeTruthy();
    expect(screen.getByText('Missed Witness Insight')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.queryByText(/new evidence/i)).toBeNull();
    expect(screen.queryByText(/partial/i)).toBeNull();
  });

  it('cannot be sent until the reason, explanation and supporting item are filled in', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AppealForm caseId="c1" appealNumber={1} onSubmit={onSubmit} onClose={vi.fn()} />);
    const send = screen.getByText('SUBMIT APPEAL') as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.click(screen.getByText('Missed Witness Insight'));
    fireEvent.change(screen.getByLabelText('EXPLAIN YOUR APPEAL'), { target: { value: text } });
    expect(send.disabled).toBe(true); // still needs the witness

    await waitFor(() => screen.getByText('Bill Tanner'));
    fireEvent.click(screen.getByText('Bill Tanner'));
    expect(send.disabled).toBe(false);
    expect(screen.queryByText('Route sheet')).toBeNull(); // evidence list is not offered for a witness appeal

    fireEvent.click(send);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      reason: 'missed_witness', explanation: text, evidence_ids: [], witness_ids: ['w1']
    }));
  });

  it('shows both lists, optional, for "Other"', async () => {
    render(<AppealForm caseId="c1" appealNumber={2} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('SECOND APPEAL')).toBeTruthy();
    fireEvent.click(screen.getByText('Other'));
    await waitFor(() => screen.getByText(/Exhibit A: Route sheet/));
    expect(screen.getByText('Bill Tanner')).toBeTruthy();
  });

  it('shows an error and lets the player try again when sending fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network down'));
    render(<AppealForm caseId="c1" appealNumber={1} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Other'));
    fireEvent.change(screen.getByLabelText('EXPLAIN YOUR APPEAL'), { target: { value: text } });
    fireEvent.click(screen.getByText('SUBMIT APPEAL'));
    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByText('Network down')).toBeTruthy();
    expect((screen.getByText('SUBMIT APPEAL') as HTMLButtonElement).disabled).toBe(false);
  });
});
