import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import WinCelebration from './WinCelebration';

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }));
}

beforeEach(() => { vi.useFakeTimers(); stubMotion(false); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('WinCelebration', () => {
  it('shows balloons, confetti and the coins earned', () => {
    render(<WinCelebration coins={80} />);
    expect(screen.getAllByTestId('balloon').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByTestId('confetti').length).toBeGreaterThan(20);
    const toast = screen.getByRole('status');
    expect(toast.textContent).toContain('You earned');
    expect(toast.textContent).toContain('80');
  });

  it('never blocks taps on the screen underneath', () => {
    render(<WinCelebration coins={80} />);
    expect(screen.getByTestId('win-celebration').className).toContain('pointer-events-none');
  });

  it('removes the balloons after a few seconds and the coin message a little earlier', () => {
    render(<WinCelebration coins={80} />);
    act(() => { vi.advanceTimersByTime(3900); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByTestId('balloon').length).toBeGreaterThan(0);
    act(() => { vi.advanceTimersByTime(1700); });
    expect(screen.queryAllByTestId('balloon')).toHaveLength(0);
    expect(screen.queryAllByTestId('confetti')).toHaveLength(0);
  });

  it('shows the balloons but no coin message when nothing was paid', () => {
    render(<WinCelebration coins={null} />);
    expect(screen.getAllByTestId('balloon').length).toBeGreaterThan(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the coin message when the amount arrives a moment later', () => {
    const { rerender } = render(<WinCelebration coins={null} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<WinCelebration coins={95} />);
    expect(screen.getByRole('status').textContent).toContain('95');
  });

  it('keeps only the coin message for people who ask for less motion', () => {
    stubMotion(true);
    render(<WinCelebration coins={80} />);
    expect(screen.queryAllByTestId('balloon')).toHaveLength(0);
    expect(screen.queryAllByTestId('confetti')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toContain('80');
  });
});
