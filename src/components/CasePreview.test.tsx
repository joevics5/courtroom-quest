import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));
const getCaseEvidence = vi.fn();
const getCaseWitnesses = vi.fn();
const getFeeBoard = vi.fn();
vi.mock('../lib/database', () => ({
  db: {
    coins: { getFeeBoard: (...a: unknown[]) => getFeeBoard(...a) },
    evidence: { getCaseEvidence: (...a: unknown[]) => getCaseEvidence(...a) },
    witnesses: { getCaseWitnesses: (...a: unknown[]) => getCaseWitnesses(...a) }
  }
}));

import CasePreview from './CasePreview';

const props = {
  caseId: 'c1',
  caseTitle: 'State v. Rivera',
  caseText: 'A warehouse fire.',
  defendantName: 'Sam Rivera',
  onSelect: vi.fn(),
  onCancel: vi.fn()
};

describe('CasePreview (accept the case)', () => {
  beforeEach(() => {
    props.onSelect.mockReset();
    props.onCancel.mockReset();
    getCaseEvidence.mockReset();
    getCaseWitnesses.mockReset();
    getFeeBoard.mockReset();
    getFeeBoard.mockResolvedValue({});
    getCaseEvidence.mockResolvedValue([{ id: 'e1', exhibit_label: 'Exhibit A', title: 'Receipt', description: 'Bought gas', content: '' }]);
    getCaseWitnesses.mockResolvedValue([{ id: 'w1', name: 'Maria Lopez', role: 'Neighbor', background: 'Lives next door', base_testimony: 'Saw smoke' }]);
  });

  it('shows the case file and both sides', () => {
    render(<CasePreview {...props} />);
    expect(screen.getByText('CASE FILE')).toBeTruthy();
    expect(screen.getByText('State v. Rivera')).toBeTruthy();
    expect(screen.getByText('A warehouse fire.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /PROSECUTE/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /DEFEND/ })).toBeTruthy();
  });

  it('briefs you with your own avatar, and Accept takes the case on that side', () => {
    render(<CasePreview {...props} playerWins={6} />);
    fireEvent.click(screen.getByRole('button', { name: /DEFEND/ }));
    expect(screen.getByRole('dialog', { name: /DEFENSE COUNSEL briefing/ })).toBeTruthy();
    expect(screen.getByText(/Sam Rivera has asked you to defend them/)).toBeTruthy();
    expect(screen.getByLabelText('Your avatar')).toBeTruthy();
    expect(screen.getByText('Associate Attorney')).toBeTruthy(); // 6 wins
    fireEvent.click(screen.getByRole('button', { name: 'ACCEPT CASE' }));
    expect(props.onSelect).toHaveBeenCalledWith('defense');
  });

  it('prosecution briefing, and Reject goes back to the case file', () => {
    render(<CasePreview {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /PROSECUTE/ }));
    expect(screen.getByRole('dialog', { name: /PROSECUTION COUNSEL briefing/ })).toBeTruthy();
    expect(screen.getByText(/lead the prosecution in State v\. Rivera/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'REJECT' }));
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('CASE FILE')).toBeTruthy();
  });

  it('loads the evidence and witnesses only when asked', async () => {
    render(<CasePreview {...props} />);
    expect(getCaseEvidence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /View evidence & witnesses/ }));
    await waitFor(() => expect(screen.getByText('Receipt')).toBeTruthy());
    expect(screen.getByText('Maria Lopez')).toBeTruthy();
    expect(screen.getByText(/Evidence \(1\)/)).toBeTruthy();
  });

  it('offers to switch to a two-player mode, and to pick another case', () => {
    const onSwitchMode = vi.fn();
    render(<CasePreview {...props} onSwitchMode={onSwitchMode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Online player' }));
    expect(onSwitchMode).toHaveBeenCalledWith('online');
    fireEvent.click(screen.getByRole('button', { name: 'Same device' }));
    expect(onSwitchMode).toHaveBeenCalledWith('local');
    fireEvent.click(screen.getByRole('button', { name: /Choose a different case/ }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('hides online play for custom cases', () => {
    render(<CasePreview {...props} onSwitchMode={() => {}} onlineDisabled />);
    expect(screen.queryByRole('button', { name: 'Online player' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Same device' })).toBeTruthy();
  });

  it('has a Close button that closes the case file', () => {
    render(<CasePreview {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('names the case with "case" after it in both briefings', () => {
    const { unmount } = render(<CasePreview {...props} caseTitle="The Conspiracy" />);
    fireEvent.click(screen.getByRole('button', { name: /PROSECUTE/ }));
    expect(screen.getByText(/lead the prosecution in The Conspiracy case\./)).toBeTruthy();
    unmount();
    render(<CasePreview {...props} caseTitle="The Conspiracy" />);
    fireEvent.click(screen.getByRole('button', { name: /DEFEND/ }));
    expect(screen.getByText(/defend them in The Conspiracy case\./)).toBeTruthy();
  });
  it('shows what each side pays for a win, and the fee again when accepting', async () => {
    getFeeBoard.mockResolvedValue({ c1: { prosecution: 95, defense: 80, repeat: false } });
    render(<CasePreview {...props} />);
    expect(await screen.findByLabelText('95 coins for a win')).toBeTruthy();
    expect(screen.getByLabelText('80 coins for a win')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /DEFEND/ }));
    expect(screen.getByText(/Win this case as defense and earn/)).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    expect(screen.queryByText(/repeat win/)).toBeNull();
  });

  it('says so when the fee is the reduced repeat-win payment', async () => {
    getFeeBoard.mockResolvedValue({ c1: { prosecution: 24, defense: 20, repeat: true } });
    render(<CasePreview {...props} />);
    await screen.findByLabelText('24 coins for a win');
    fireEvent.click(screen.getByRole('button', { name: /PROSECUTE/ }));
    expect(screen.getByText(/repeat win/)).toBeTruthy();
  });

  it('shows no coins when the case pays nothing or the board is unavailable', async () => {
    getFeeBoard.mockResolvedValue({ c1: { prosecution: 0, defense: 0, repeat: false } });
    const { rerender } = render(<CasePreview {...props} />);
    await waitFor(() => expect(getFeeBoard).toHaveBeenCalled());
    expect(screen.queryByLabelText(/coins for a win/)).toBeNull();
    getFeeBoard.mockRejectedValue(new Error('no function'));
    rerender(<CasePreview {...props} caseId="c2" />);
    await waitFor(() => expect(getFeeBoard).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText(/coins for a win/)).toBeNull();
  });
  it('keeps the requested relief closed until opened, then lists the demands and what they mean for the defence', () => {
    const relief = {
      primary: 'Order Tyler Brandt to pay for the wagyu steak',
      financial: '$300 plus $200 in legal costs',
      additional: ['Order Tyler to leave the apartment within 14 days'],
      basis: 'He ate food that was not his.'
    };
    render(<CasePreview {...props} relief={relief} caseType="civil" />);
    const toggle = screen.getByRole('button', { name: /requested relief/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('$300 plus $200 in legal costs')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('$300 plus $200 in legal costs')).toBeTruthy();
    expect(screen.getByText('Order Tyler to leave the apartment within 14 days')).toBeTruthy();
    expect(screen.getByText(/WHAT THIS MEANS FOR THE DEFENCE/)).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByText('$300 plus $200 in legal costs')).toBeNull();
  });

  it('shows nothing when the case has no requested relief', () => {
    const { rerender } = render(<CasePreview {...props} relief={null} />);
    expect(screen.queryByRole('button', { name: /requested relief/i })).toBeNull();
    rerender(<CasePreview {...props} relief={{}} />);
    expect(screen.queryByRole('button', { name: /requested relief/i })).toBeNull();
  });
});
