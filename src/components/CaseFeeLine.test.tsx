import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseFeeLine from './CaseFeeLine';

describe('CaseFeeLine', () => {
  it('shows each side and its fee on one line', () => {
    render(<CaseFeeLine fee={{ prosecution: 50, defense: 35, repeat: false }} />);
    const line = screen.getByRole('group', { name: 'Coins paid for a win' });
    // The coin icon's embossed "C" is part of the text content, so match the order, not the exact string.
    expect(line.textContent).toMatch(/^Prosecution:50.*Defense:35/);
    expect(line.className).toContain('whitespace-nowrap');
  });

  it('adds nothing else, even for a repeat win', () => {
    render(<CaseFeeLine fee={{ prosecution: 10, defense: 8, repeat: true }} />);
    expect(screen.queryByText(/Bonus/)).toBeNull();
    expect(screen.queryByText(/repeat/i)).toBeNull();
  });
});
