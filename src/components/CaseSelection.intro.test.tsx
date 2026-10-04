import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const authState = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null }));

vi.mock('./ScreenShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('./CaseWinners', () => ({ default: () => null }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../contexts/SessionContext', () => ({ useSession: () => ({}) }));
vi.mock('../lib/database', () => ({ db: { cases: { getUserCasesWithSessionStatus: vi.fn().mockResolvedValue([]) } } }));

import CaseSelection from './CaseSelection';
import { hasSeen } from '../lib/firstVisit';

const props = { onSelectCase: vi.fn(), onContinueCase: vi.fn(), onCreateCustomCase: vi.fn(), onEditCustomCase: vi.fn() };
const dialog = () => screen.queryByRole('dialog');

beforeEach(() => { window.localStorage.clear(); authState.user = { id: 'user-1' }; });

describe('My Cases intro', () => {
  it('opens by itself the first time and explains the page', async () => {
    render(<CaseSelection {...props} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Welcome to My Cases')).toBeInTheDocument();
    expect(screen.getByText(/Parse with AI/)).toBeInTheDocument();
    expect(screen.getByText(/Fill in the form/)).toBeInTheDocument();
    expect(screen.getByText(/Go to trial\./)).toBeInTheDocument();
  });

  it('does not open again on later visits, but the small link reopens it', async () => {
    const first = render(<CaseSelection {...props} />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByText('Got it'));
    expect(dialog()).toBeNull();
    first.unmount();

    render(<CaseSelection {...props} />);
    await screen.findByText('How do custom cases work?');
    expect(dialog()).toBeNull();
    fireEvent.click(screen.getByText('How do custom cases work?'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('counts as seen even if the user just navigates away without closing it', async () => {
    const first = render(<CaseSelection {...props} />);
    await screen.findByRole('dialog');
    first.unmount();
    expect(hasSeen('custom-cases-intro', 'user-1')).toBe(true);
    render(<CaseSelection {...props} />);
    await screen.findByText('How do custom cases work?');
    expect(dialog()).toBeNull();
  });

  it('closes with the X button, Escape, or a tap on the backdrop', async () => {
    render(<CaseSelection {...props} />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByLabelText('Close'));
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByText('How do custom cases work?'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByText('How do custom cases work?'));
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement); // backdrop
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByText('How do custom cases work?'));
    fireEvent.click(screen.getByText('Welcome to My Cases')); // inside the card: stays open
    expect(dialog()).not.toBeNull();
  });

  it('is tracked per user, so another account on the same device still sees it once', async () => {
    const first = render(<CaseSelection {...props} />);
    await screen.findByRole('dialog');
    first.unmount();
    authState.user = { id: 'user-2' };
    render(<CaseSelection {...props} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('still works when browser storage is blocked (shows the help, never crashes)', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      render(<CaseSelection {...props} />);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Got it'));
      await waitFor(() => expect(dialog()).toBeNull());
      expect(screen.getByText('Create New Custom Case')).toBeInTheDocument();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it('does not show before the user is known', () => {
    authState.user = null;
    render(<CaseSelection {...props} />);
    expect(dialog()).toBeNull();
  });

  it('locks page scroll while open and restores it after', async () => {
    render(<CaseSelection {...props} />);
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByText('Got it'));
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
