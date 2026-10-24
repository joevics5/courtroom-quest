import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const updateSession = vi.hoisted(() => vi.fn(async (..._args: any[]) => ({})));

vi.mock('../lib/database', () => {
  const method = (name: string) =>
    name === 'updateSession'
      ? updateSession
      : vi.fn(async () => {
          if (name === 'addEvent') return { id: `e${Math.random()}`, speaker_role: 'judge', event_type: 'statement', content: '' };
          return name.startsWith('get') && name !== 'getSession' ? [] : null;
        });
  const group = () => new Proxy({}, { get: (_t, name: string) => method(name) });
  return { db: new Proxy({}, { get: () => group() }) };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' } }) }));

import Courtroom from './Courtroom';

const baseSession: any = {
  id: 's1',
  case_id: 'c1',
  user_id: 'u1',
  player_role: 'defense',
  current_phase: 'trial',
  current_trial_phase: 1,
  trial_duration: 30,
  timer_paused_at: null,
  session_state: { phaseTimeRemaining: { 1: 120 }, totalTimeRemaining: 1500, judgeName: 'Justice Reed', prosecutorName: 'DA Holt' }
};

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Courtroom pause button and leaving the page', () => {
  beforeEach(() => updateSession.mockClear());
  afterEach(() => { cleanup(); setVisibility('visible'); });

  it('shows Pause on a running trial, and the Courtroom button hides and shows the avatars', async () => {
    render(<Courtroom session={baseSession} onComplete={() => {}} onBack={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /Judge|Prosecution|Defense/i }).length).toBeGreaterThan(0);
    const toggle = screen.getByTestId('scene-toggle');
    fireEvent.click(toggle);
    expect(screen.queryAllByRole('img', { name: /Judge|Prosecution|Defense/i }).length).toBe(0);
    expect(toggle.getAttribute('aria-label')).toBe('Show avatars');
    fireEvent.click(toggle);
    expect(screen.getAllByRole('img', { name: /Judge|Prosecution|Defense/i }).length).toBeGreaterThan(0);
    // only one such button: no separate Hide/Show Avatars button
    expect(screen.queryByTitle(/Hide Avatars|Show Avatars/)).toBeNull();
  });

  it('shows Resume when a trial comes back paused (it used to vanish)', async () => {
    render(<Courtroom session={{ ...baseSession, timer_paused_at: '2026-10-20T10:00:00Z' }} onComplete={() => {}} onBack={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  it('pressing Pause pauses and saves the exact time left', async () => {
    render(<Courtroom session={baseSession} onComplete={() => {}} onBack={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
    const saved = updateSession.mock.calls.map(c => c[1] as any).find(p => p.timer_paused_at);
    expect(saved).toBeTruthy();
    expect(saved.session_state.totalTimeRemaining).toBeGreaterThan(0);
  });

  it('leaving the page pauses on its own, without pressing Pause', async () => {
    render(<Courtroom session={baseSession} onComplete={() => {}} onBack={() => {}} />);
    await screen.findByRole('button', { name: 'Pause' });
    await act(async () => { setVisibility('hidden'); });
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(updateSession.mock.calls.some(c => (c[1] as any).timer_paused_at)).toBe(true);
  });
});
