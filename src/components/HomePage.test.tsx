import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../lib/soundEffects', () => ({ isSoundEnabled: () => false, setSoundEnabled: vi.fn(), playGavelTap: vi.fn() }));

import HomePage from './HomePage';
import { HOME_ART } from '../lib/heroAssets';

const props = {
  onPlay: vi.fn().mockResolvedValue(undefined), onOpenSettings: vi.fn().mockResolvedValue(undefined),
  onSignIn: vi.fn(), hasAccount: false, signedIn: false, waitingCount: 0, onOpenDashboard: vi.fn(),
};

describe('HomePage', () => {
  it('shows the illustration under the title and above the play button', () => {
    render(<HomePage {...props} />);
    const title = screen.getByRole('heading', { level: 1 });
    const img = screen.getByAltText(HOME_ART.alt) as HTMLImageElement;
    const play = screen.getByRole('button', { name: 'PLAY' });
    expect(title).toHaveTextContent('COURTROOM');
    expect(title).toHaveTextContent('QUEST');
    const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(title, img)).toBe(true);
    expect(before(img, play)).toBe(true);
  });

  it('serves WebP with a JPEG fallback, with dimensions set so the page does not jump while it loads', () => {
    const { container } = render(<HomePage {...props} />);
    expect(container.querySelector('source')?.getAttribute('srcset')).toBe(HOME_ART.webp);
    const img = screen.getByAltText(HOME_ART.alt);
    expect(img).toHaveAttribute('src', HOME_ART.jpg);
    expect(img).toHaveAttribute('width', String(HOME_ART.width));
    expect(img).toHaveAttribute('height', String(HOME_ART.height));
  });

  it('shows an instant placeholder, then fades the real image in once it has loaded', () => {
    const { container } = render(<HomePage {...props} />);
    const img = screen.getByAltText(HOME_ART.alt);
    const figure = container.querySelector('figure') as HTMLElement;
    expect(figure.style.backgroundImage).toContain(HOME_ART.lqip.slice(0, 40)); // never an empty card
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
