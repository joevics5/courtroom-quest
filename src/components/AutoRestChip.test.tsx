import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AutoRestChip from './AutoRestChip';

const setup = (over: Partial<React.ComponentProps<typeof AutoRestChip>> = {}) => {
  const props = { side: 'prosecution' as const, timeLabel: '1:28', paused: false, onTogglePause: vi.fn(), onRestNow: vi.fn(), ...over };
  render(<AutoRestChip {...props} />);
  return props;
};

describe('AutoRestChip', () => {
  it('shows who rests and when, in a compact chip (not a full-width banner)', () => {
    setup();
    expect(screen.getByText(/Prosecution rests in/)).toBeTruthy();
    expect(screen.getByText(/1:28/)).toBeTruthy();
    const chip = screen.getByTestId('auto-rest-chip');
    expect(chip.className).not.toMatch(/\bw-full\b/);
    expect(chip.className).toMatch(/rounded-full/);
  });

  it('tapping the timer pauses it, and shows Paused while frozen', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pause the rest timer' }));
    expect(props.onTogglePause).toHaveBeenCalledTimes(1);
  });

  it('shows Paused with the time left when paused', () => {
    setup({ paused: true, timeLabel: '0:42' });
    expect(screen.getByText(/Paused/)).toBeTruthy();
    expect(screen.getByText(/0:42/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume the rest timer' })).toBeTruthy();
  });

  it('Rest now rests the AI early', () => {
    const props = setup({ side: 'defense' });
    fireEvent.click(screen.getByRole('button', { name: 'Rest the defense now' }));
    expect(props.onRestNow).toHaveBeenCalledTimes(1);
  });
});
