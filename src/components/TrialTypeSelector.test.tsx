import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import TrialTypeSelector from './TrialTypeSelector';

const setup = () => {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<TrialTypeSelector onSelect={onSelect} onCancel={onCancel} />);
  return { onSelect, onCancel, ...utils };
};

describe('TrialTypeSelector', () => {
  it('shows both courts, all four lengths and the confirm button together on one screen', () => {
    const { container } = setup();
    expect(screen.getByText('BENCH TRIAL')).toBeInTheDocument();
    expect(screen.getByText('JURY TRIAL')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Quick Play')).toBeInTheDocument();
    expect(screen.getByText('Short')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.queryByText('Full trial')).toBeNull();
    expect(screen.getByRole('button', { name: /PICK A COURT/ })).toBeInTheDocument();
    // the page itself never scrolls: it is exactly one viewport tall and clips overflow
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-[100dvh]');
    expect(root.className).toContain('overflow-hidden');
  });

  it('cannot be confirmed until a court is chosen', () => {
    const { onSelect } = setup();
    const confirm = screen.getByRole('button', { name: /PICK A COURT/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('defaults to 30 minutes and sends the chosen court', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText('BENCH TRIAL'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenCalledWith('judge', 30);
  });

  it('sends a jury trial with the chosen length', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText('JURY TRIAL'));
    fireEvent.click(screen.getByText('Short'));
    fireEvent.click(screen.getByRole('button', { name: /PICK YOUR JURY/ }));
    expect(onSelect).toHaveBeenCalledWith('jury', 20);
  });

  it('marks the chosen court and length as pressed, and back cancels', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByText('JURY TRIAL'));
    fireEvent.click(screen.getByText('Short'));
    expect(screen.getByText('JURY TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('BENCH TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Short').closest('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('offers 5, 10, 20 and 30 minutes in one row, with no 15 or 60', () => {
    const { onSelect } = setup();
    const row = screen.getByText('Quick Play').closest('button')!.parentElement as HTMLElement;
    expect(row.className).toContain('grid-cols-4');
    expect(row.querySelectorAll('button')).toHaveLength(4);
    const labels = Array.from(row.querySelectorAll('button')).map(b => b.textContent);
    expect(labels).toEqual(['5MINLightning', '10MINQuick Play', '20MINShort', '30MINStandard']);
    expect(screen.queryByText('60')).toBeNull();
    expect(screen.queryByText('15')).toBeNull();
    fireEvent.click(screen.getByText('BENCH TRIAL'));
    fireEvent.click(screen.getByText('Quick Play'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenCalledWith('judge', 10);
    fireEvent.click(screen.getByText('Lightning'));
    fireEvent.click(screen.getByRole('button', { name: /TO THE COURTROOM/ }));
    expect(onSelect).toHaveBeenLastCalledWith('judge', 5);
  });
});
