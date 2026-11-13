import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DemandRulings, { type DemandRulingRow } from './DemandRulings';

const jury: DemandRulingRow[] = [
  { id: 'main', label: 'MAIN REQUEST', text: 'Order Tyler to pay for the steak', grant: 8, deny: 4, granted: true },
  { id: 'money', label: 'MONEY', text: '$300 plus $200 in legal costs', grant: 5, deny: 7, granted: false },
  { id: 'also1', label: 'ALSO ASKS', text: 'Order Tyler to leave within 14 days', grant: 9, deny: 3, granted: true }
];

describe('DemandRulings', () => {
  it('shows each request as granted or not, with the jury count', () => {
    render(<DemandRulings results={jury} playerRole="prosecution" />);
    expect(screen.getAllByText('GRANTED')).toHaveLength(2);
    expect(screen.getAllByText('NOT GRANTED')).toHaveLength(1);
    expect(screen.getByText('8–4')).toBeTruthy();
    expect(screen.getByText('5–7')).toBeTruthy();
    expect(screen.getByText(/MAIN REQUEST · DECIDES THE VERDICT/)).toBeTruthy();
    expect(screen.getByText('$300 plus $200 in legal costs')).toBeTruthy();
  });

  it('shows no count for a judge, who is a single ruling', () => {
    const bench = jury.map(r => ({ ...r, grant: r.granted ? 1 : 0, deny: r.granted ? 0 : 1 }));
    render(<DemandRulings results={bench} playerRole="defense" />);
    expect(screen.queryByText('8–4')).toBeNull();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('is good news when granted for the prosecution, and bad news for the defence', () => {
    const { container, rerender } = render(<DemandRulings results={jury} playerRole="prosecution" />);
    const chip = () => container.querySelector('[data-demand="main"] .font-black.tracking-wide');
    expect(chip()!.className).toContain('#5EEAD4');
    rerender(<DemandRulings results={jury} playerRole="defense" />);
    expect(chip()!.className).toContain('#FF9A9D');
  });

  it('shows nothing when there is only one request, which is just the verdict', () => {
    const { container } = render(<DemandRulings results={[jury[0]]} playerRole="prosecution" />);
    expect(container.firstChild).toBeNull();
  });
});
