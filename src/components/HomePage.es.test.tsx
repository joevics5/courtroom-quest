import { render, screen, act } from '@testing-library/react';
import { vi, afterEach } from 'vitest';

vi.mock('../lib/soundEffects', () => ({ isSoundEnabled: () => false, setSoundEnabled: vi.fn(), playGavelTap: vi.fn() }));

import HomePage from './HomePage';
import { setLanguage } from '../i18n';

const props = {
  onPlay: vi.fn().mockResolvedValue(undefined), onOpenSettings: vi.fn().mockResolvedValue(undefined),
  onSignIn: vi.fn(), hasAccount: false, signedIn: false, waitingCount: 0, onOpenDashboard: vi.fn(),
};

describe('HomePage in Spanish', () => {
  afterEach(async () => {
    await act(async () => { await setLanguage('en'); });
  });

  it('shows the Spanish text and no English leftovers', async () => {
    await act(async () => { await setLanguage('es'); });
    render(<HomePage {...props} />);
    expect(screen.getByRole('button', { name: 'JUGAR' })).toBeInTheDocument();
    expect(screen.getByText('AJUSTES')).toBeInTheDocument();
    expect(screen.getByText('Elige un caso y tu parte')).toBeInTheDocument();
    expect(screen.getByText('¿YA TIENES CUENTA? INICIA SESIÓN')).toBeInTheDocument();
    expect(screen.queryByText('PLAY')).toBeNull();
    expect(screen.queryByText('SETTINGS')).toBeNull();
  });

  it('offers the language switch on the home page', () => {
    render(<HomePage {...props} />);
    expect(screen.getByRole('button', { name: 'Change language' })).toBeInTheDocument();
  });
});
