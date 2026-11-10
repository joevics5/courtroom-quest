import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseFeeTiles from './CaseFeeTiles';

describe('CaseFeeTiles', () => {
  it('shows both sides and marks the higher-paying one as the bonus side', () => {
    render(<CaseFeeTiles fee={{ prosecution: 60, defense: 40, repeat: false }} />);
    const group = screen.getByRole('group', { name: 'Coins paid for a win' });
    expect(group.textContent).toContain('Prosecution');
    expect(group.textContent).toContain('Defense');
    expect(screen.getAllByText('Bonus')).toHaveLength(1);
    const prosecutionTile = screen.getByText('Prosecution').closest('div')!.parentElement!;
    expect(prosecutionTile.textContent).toContain('Bonus');
    expect(prosecutionTile.textContent).toContain('60');
  });

  it('marks the defense when it pays more', () => {
    render(<CaseFeeTiles fee={{ prosecution: 40, defense: 75, repeat: false }} />);
    const defenseTile = screen.getByText('Defense').closest('div')!.parentElement!;
    expect(defenseTile.textContent).toContain('Bonus');
  });

  it('marks no bonus when both sides pay the same', () => {
    render(<CaseFeeTiles fee={{ prosecution: 40, defense: 40, repeat: false }} />);
    expect(screen.queryByText('Bonus')).toBeNull();
  });

  it('says so when the fee is the reduced repeat-win payment', () => {
    render(<CaseFeeTiles fee={{ prosecution: 10, defense: 8, repeat: true }} />);
    expect(screen.getByText(/repeat wins pay less/)).toBeTruthy();
  });
});
