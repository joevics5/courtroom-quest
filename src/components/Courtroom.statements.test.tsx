import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../lib/database', () => {
  const method = (name: string) =>
    vi.fn(async () => {
      if (name === 'addEvent') return { id: `e${Math.random()}`, speaker_role: 'judge', event_type: 'statement', content: '' };
      return name.startsWith('get') && name !== 'getSession' ? [] : null;
    });
  const group = () => new Proxy({}, { get: (_t, name: string) => method(name) });
  return { db: new Proxy({}, { get: () => group() }) };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.c' } }) }));

import Courtroom from './Courtroom';

// Phase 7 is the prosecution's opening statement; its clock has run out and nothing has been said yet.
const session = (role: 'prosecution' | 'defense'): any => ({
  id: 's1',
  case_id: 'c1',
  user_id: 'u1',
  player_role: role,
  current_phase: 'trial',
  current_trial_phase: 7,
  trial_duration: 15,
  timer_paused_at: null,
  session_state: { playerRole: role, phaseTimeRemaining: { 7: 0 }, totalTimeRemaining: 800, judgeName: 'Justice Reed', prosecutorName: 'DA Holt' }
});

afterEach(() => cleanup());

describe('Courtroom opening statement that has run out of time', () => {
  it('tells the player whose statement it is that it is waiting for them, with the word minimum', async () => {
    render(<Courtroom session={session('prosecution')} onComplete={() => {}} onBack={() => {}} />);
    expect(await screen.findByText(/Waiting for your opening statement · at least 50 words \(0 so far\)/)).toBeTruthy();
  });

  it('tells the other side which statement it is waiting for', async () => {
    render(<Courtroom session={session('defense')} onComplete={() => {}} onBack={() => {}} />);
    expect(await screen.findByText(/Waiting for the prosecution's opening statement/)).toBeTruthy();
  });
});
