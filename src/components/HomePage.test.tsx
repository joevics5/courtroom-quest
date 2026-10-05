import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../lib/soundEffects', () => ({ isSoundEnabled: () => false, setSoundEnabled: vi.fn(), playGavelTap: vi.fn() }));

import HomePage from './HomePage';
import { HOME_ART } from '../lib/heroAssets';
import { computeArtShift } from '../lib/homeArt';

const props = {
  onPlay: vi.fn().mockResolvedValue(undefined), onOpenSettings: vi.fn().mockResolvedValue(undefined),
  onSignIn: vi.fn(), hasAccount: false, signedIn: false, waitingCount: 0, onOpenDashboard: vi.fn(),
};

describe('HomePage', () => {
  const art = (container: HTMLElement) => container.querySelector('picture img') as HTMLImageElement;

  it('uses the artwork as the full-screen background: no framed card, decorative, behind the title and buttons', () => {
    const { container } = render(<HomePage {...props} />);
    const img = art(container);
    expect(container.querySelector('figure')).toBeNull();            // the gold framed container is gone
    expect(img.closest('[class*="border"]')).toBeNull();             // and nothing with a border wraps the picture
    expect(img.className).toMatch(/absolute/);
    expect(img.className).toMatch(/object-cover/);
    expect(img).toHaveAttribute('alt', '');                          // decorative: screen readers skip it
    expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('COURTROOM');
    expect(title).toHaveTextContent('QUEST');
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeInTheDocument();
  });

  it('groups the play button and everything below it in one block (the dark covering), leaving the logo outside it', () => {
    render(<HomePage {...props} />);
    // The covering is a CSS gradient on this block; jsdom cannot evaluate gradients, so the browser check lives in the layout screenshots.
    let block = screen.getByRole('button', { name: 'PLAY' }).parentElement as HTMLElement;
    while (block && !block.contains(screen.getByText('Pick a case and your side'))) block = block.parentElement as HTMLElement;
    expect(block.contains(screen.getByText('SETTINGS'))).toBe(true);
    expect(block.contains(screen.getByText('HAVE AN ACCOUNT? SIGN IN'))).toBe(true);
    expect(block.contains(screen.getByRole('heading', { level: 1 }))).toBe(false);
    expect(block.contains(screen.getByText('EVERY CASE HAS A LOOPHOLE'))).toBe(false);
  });

  it('raises the picture by the amount computed for this screen, so the judge and gavel clear the PLAY button', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const rect = (o: Partial<DOMRect>) => ({ x: 0, y: 0, left: 0, right: 0, width: 0, height: 0, top: 0, bottom: 0, toJSON() {}, ...o }) as DOMRect;
      if (this.textContent?.trim() === 'PLAY') return rect({ top: 483, bottom: 557 });
      if (this.tagName === 'P' && this.textContent?.includes('LOOPHOLE')) return rect({ top: 126, bottom: 153 });
      if (this.dataset?.testPage === '1') return rect({ width: 411, height: 778 });
      return rect({});
    });
    try {
      const { container } = render(<HomePage {...props} />);
      const page = container.firstElementChild as HTMLElement;
      page.dataset.testPage = '1';
      act(() => { window.dispatchEvent(new Event('resize')); });
      const layer = container.querySelector('picture')?.parentElement as HTMLElement;
      const expected = computeArtShift({ width: 411, height: 778, controlsTop: 483, taglineBottom: 153 });
      expect(expected).toBeGreaterThan(100);
      expect(layer.style.top).toBe(`-${expected}px`);
      expect(layer.style.height).toBe(`calc(100% + ${expected}px)`);
    } finally {
      spy.mockRestore();
    }
  });

  it('hides the three step pills on short screens so the picture gets the room, and keeps them on normal phones', () => {
    render(<HomePage {...props} />);
    const steps = screen.getByText('Pick a case and your side').closest('ol') as HTMLElement;
    expect(steps.className).toContain('[@media(max-height:700px)]:hidden');
  });

  it('serves WebP with a JPEG fallback, with dimensions set so the page does not jump while it loads', () => {
    const { container } = render(<HomePage {...props} />);
    expect(container.querySelector('source')?.getAttribute('srcset')).toBe(HOME_ART.webp);
    const img = art(container);
    expect(img).toHaveAttribute('src', HOME_ART.jpg);
    expect(img).toHaveAttribute('width', String(HOME_ART.width));
    expect(img).toHaveAttribute('height', String(HOME_ART.height));
  });

  it('shows an instant placeholder, then fades the real image in once it has loaded', () => {
    const { container } = render(<HomePage {...props} />);
    const img = art(container);
    const placeholder = img.closest('picture')?.parentElement as HTMLElement;
    expect(placeholder.style.backgroundImage).toContain(HOME_ART.lqip.slice(0, 40)); // never an empty screen
    expect(img.className).toContain('opacity-0');
    fireEvent.load(img);
    expect(img.className).toContain('opacity-100');
  });

  it('keeps the tagline, how-it-works steps and the existing actions', () => {
    render(<HomePage {...props} />);
    expect(screen.getByText('EVERY CASE HAS A LOOPHOLE')).toBeInTheDocument();
    expect(screen.getByText('Grill witnesses. Catch the lie.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('HAVE AN ACCOUNT? SIGN IN'));
    expect(props.onSignIn).toHaveBeenCalled();
    fireEvent.click(screen.getByText('LEARN MORE'));
    expect(screen.getByText('HOW IT WORKS', { selector: 'h2' })).toBeInTheDocument();
  });

  it('still opens the play modes and the sound toggle still works', () => {
    render(<HomePage {...props} signedIn hasAccount />);
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    expect(screen.queryByText('HAVE AN ACCOUNT? SIGN IN')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(document.body.textContent).toMatch(/AI|opponent|player/i);
    expect(screen.getByLabelText('Enable sound')).toBeInTheDocument();
  });

  it('Play popup offers My games to signed-in players, with the count, and opens it', () => {
    const onPlay = vi.fn().mockResolvedValue(undefined);
    render(<HomePage {...props} onPlay={onPlay} signedIn hasAccount myGamesCount={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(screen.getByText('3 ACTIVE')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MY GAMES'));
    expect(onPlay).toHaveBeenCalledWith('games');
  });

  it('Play popup has no My games for brand-new visitors', () => {
    render(<HomePage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(screen.queryByText('MY GAMES')).toBeNull();
    expect(screen.getByText('VS AI')).toBeInTheDocument();
  });
});
