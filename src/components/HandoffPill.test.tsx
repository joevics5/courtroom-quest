import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HandoffPill from './HandoffPill';

describe('HandoffPill', () => {
  it('shows the label and time, and SKIP ends the break', () => {
    const onSkip = vi.fn();
    render(<HandoffPill label="Reading the opening statement" timeLabel="0:20" skippable onSkip={onSkip} />);
    expect(screen.getByTestId('handoff-pill').textContent).toContain('Reading the opening statement · 0:20');
    fireEvent.click(screen.getByRole('button', { name: 'SKIP' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('accepts taps even though its overlay ignores them (the reason SKIP did nothing)', () => {
    render(<HandoffPill label="Up next" timeLabel="0:10" skippable onSkip={() => undefined} />);
    expect(screen.getByTestId('handoff-pill').className).toContain('pointer-events-auto');
  });

  it('has no SKIP for a break that cannot be skipped', () => {
    render(<HandoffPill label="Up next: Dr. Lee" timeLabel="0:10" onSkip={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'SKIP' })).toBeNull();
  });
});
