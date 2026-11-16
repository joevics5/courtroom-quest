// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayModePopup from './PlayModePopup';

describe('PlayModePopup', () => {
  it('offers every way to play to signed-in players', () => {
    render(<PlayModePopup onSelect={vi.fn()} onClose={vi.fn()} showMyGames />);
    for (const title of ['QUICK START', 'SOLO', 'VS PLAYER ONLINE', 'SAME DEVICE', 'MY GAMES']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('shows signed-out players only Quick Start and Solo', () => {
    render(<PlayModePopup onSelect={vi.fn()} onClose={vi.fn()} limited />);
    expect(screen.getByText('QUICK START')).toBeTruthy();
    expect(screen.getByText('SOLO')).toBeTruthy();
    expect(screen.queryByText('VS PLAYER ONLINE')).toBeNull();
    expect(screen.queryByText('SAME DEVICE')).toBeNull();
  });
});
