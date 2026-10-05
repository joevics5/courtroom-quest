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
  it('shows both courts, all three lengths and the confirm button together on one screen', () => {
    const { container } = setup();
    expect(screen.getByText('BENCH TRIAL')).toBeInTheDocument();
    expect(screen.getByText('JURY TRIAL')).toBeInTheDocument();
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Full trial')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Full trial'));
    fireEvent.click(screen.getByRole('button', { name: /PICK YOUR JURY/ }));
    expect(onSelect).toHaveBeenCalledWith('jury', 60);
  });

  it('marks the chosen court and length as pressed, and back cancels', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByText('JURY TRIAL'));
    fireEvent.click(screen.getByText('Quick'));
    expect(screen.getByText('JURY TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('BENCH TRIAL').closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Quick').closest('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
