import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));
const getCaseEvidence = vi.fn();
const getCaseWitnesses = vi.fn();
vi.mock('../lib/database', () => ({
  db: {
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
});
