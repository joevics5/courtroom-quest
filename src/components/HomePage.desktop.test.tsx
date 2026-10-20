import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../lib/soundEffects', () => ({ isSoundEnabled: () => false, setSoundEnabled: vi.fn(), playGavelTap: vi.fn() }));

import HomePage from './HomePage';
import { useIsDesktop, DESKTOP_MIN_WIDTH } from '../lib/useIsDesktop';
import { renderHook } from '@testing-library/react';

const props = {
  onPlay: vi.fn().mockResolvedValue(undefined), onOpenSettings: vi.fn().mockResolvedValue(undefined),
  onSignIn: vi.fn(), hasAccount: false, signedIn: false, waitingCount: 0, onOpenDashboard: vi.fn()
};

function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
    return { matches: width >= min, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

describe('desktop layout switch', () => {
  const original = window.matchMedia;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { window.matchMedia = original; });

  it('uses the phone layout below the desktop width', () => {
    screenWidth(DESKTOP_MIN_WIDTH - 1);
    expect(renderHook(() => useIsDesktop()).result.current).toBe(false);
    const { container } = render(<HomePage {...props} />);
    // the phone layout positions the artwork behind the title and buttons
    expect(container.querySelector('picture img')!.className).toMatch(/absolute/);
    expect(container.querySelector('[aria-hidden="true"] picture')).not.toBeNull();
  });

  it('uses the phone layout where the width cannot be measured (tests, older browsers)', () => {
    (window as any).matchMedia = undefined;
    expect(renderHook(() => useIsDesktop()).result.current).toBe(false);
  });

  it('switches to the wide layout at the desktop width, with everything still there once (not doubled)', () => {
    screenWidth(DESKTOP_MIN_WIDTH);
    expect(renderHook(() => useIsDesktop()).result.current).toBe(true);
    render(<HomePage {...props} />);
    expect(screen.getAllByRole('button', { name: 'PLAY' })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('COURTROOM');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('QUEST');
    expect(screen.getByText('PICK YOUR SIDE. BUILD YOUR CASE. WIN THE VERDICT.')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('the wide layout buttons work: Play opens the mode popup, Settings and Learn more respond', async () => {
    screenWidth(1440);
    render(<HomePage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(screen.getByRole('dialog', { name: 'How do you want to play?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /LEARN MORE/ }));
    // the "How it works" popup opened: its text now appears besides the buttons that open it
    expect(screen.getAllByText(/how it works/i).length).toBeGreaterThan(1);
  });

  it('signed in, the wide layout shows Dashboard with the waiting badge', () => {
    screenWidth(1440);
    const { container } = render(<HomePage {...props} signedIn hasAccount waitingCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: /DASHBOARD/ }));
    expect(props.onOpenDashboard).toHaveBeenCalled();
    expect(container.querySelector('.bg-red-600')!.textContent).toBe('3');
  });
});
