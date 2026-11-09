import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// A tiny in-memory game that both "screens" share: this test is the defense; the other player writes into the store.
const store = vi.hoisted(() => ({ session: null as any, events: [] as any[], added: [] as any[], updates: [] as any[] }));
const speakAs = vi.hoisted(() => vi.fn((_role?: string, _text?: string) => true));

vi.mock('../lib/speech', () => ({
  speakAs, stopSpeaking: vi.fn(), stopSpeakingRole: vi.fn(), canSpeak: () => true, enterSpeechScope: () => () => {},
  isSpeechMuted: () => false, subscribeSpeechMuted: () => () => {}, setSpeechMuted: vi.fn()
}));

vi.mock('../lib/database', () => {
  const base: Record<string, Record<string, any>> = {
    sessions: {
      getSession: async () => store.session,
      updateSession: async (_id: string, patch: any) => { store.updates.push(patch); store.session = { ...store.session, ...patch }; return store.session; },
      mergeState: async (_id: string, patch: any, _phase?: string, trialPhase?: number) => {
        store.session = { ...store.session, current_trial_phase: trialPhase ?? store.session.current_trial_phase, session_state: { ...store.session.session_state, ...patch } };
        return store.session;
      }
    },
    trialEvents: {
      getSessionEvents: async () => [...store.events],
      addEvent: async (e: any) => { const ev = { id: `e${store.events.length + store.added.length + 1}`, timestamp: new Date().toISOString(), ...e }; store.added.push(ev); store.events.push(ev); return ev; }
    }
  };
  const group = (g: string) => new Proxy({}, {
    get: (_t, name: string) => base[g]?.[name] ?? (async () => (name.startsWith('get') ? [] : null))
  });
  return { db: new Proxy({}, { get: (_t, g: string) => group(g) }) };
});
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.y', user_metadata: { full_name: 'Dele Ade' } } }) }));

import Courtroom from './Courtroom';

const online = (over: Record<string, unknown> = {}) => ({
  id: 's1', case_id: 'c1', user_id: 'u2', opposing_counsel_user_id: 'u1', current_phase: 'trial', current_trial_phase: 7,
  trial_duration: 30, trial_type: 'judge', timer_paused_at: null,
  session_state: {
    isMultiplayer: true, prosecutionUserId: 'u2', defenseUserId: 'u1', judgeName: 'Justice Reed',
    nameProsecution: 'Chidi Okafor', nameDefense: 'Dele Ade', phaseTimeRemaining: { 7: 300 }, totalTimeRemaining: 1500
  },
  ...over
}) as any;

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('Courtroom, two players on two devices (I am the defense)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    store.session = online(); store.events = []; store.added = []; store.updates = []; speakAs.mockClear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('reads the other player\'s lines out and shows them, as soon as they arrive', async () => {
    render(<Courtroom session={store.session} onComplete={() => {}} onBack={() => {}} />);
    await advance(500);
    store.events.push(
      { id: 'j1', session_id: 's1', event_type: 'opening', speaker_role: 'judge', speaker_name: 'Justice Reed', content: 'Counsel for the prosecution, you may proceed with your opening.', timestamp: 't', metadata: { by: 'u2', instruction_for_phase: 7, phase: 7 } },
      { id: 'p1', session_id: 's1', event_type: 'opening', speaker_role: 'prosecution', speaker_name: 'Chidi Okafor', content: 'Ladies and gentlemen, the evidence will show who did this.', timestamp: 't', metadata: { by: 'u2', phase: 7 } }
    );
    await advance(2500);
    expect(speakAs).toHaveBeenCalledWith('judge', 'Counsel for the prosecution, you may proceed with your opening.');
    expect(speakAs).toHaveBeenCalledWith('counsel', 'Ladies and gentlemen, the evidence will show who did this.');
    // Each line is read out once, however many times the game is checked.
    await advance(6000);
    expect(speakAs.mock.calls.filter(c => c[1] === 'Ladies and gentlemen, the evidence will show who did this.')).toHaveLength(1);
  });

  it('does not read out my own lines back to me', async () => {
    render(<Courtroom session={store.session} onComplete={() => {}} onBack={() => {}} />);
    await advance(500);
    store.events.push({ id: 'd1', session_id: 's1', event_type: 'opening', speaker_role: 'defense', speaker_name: 'Dele Ade', content: 'My own words.', timestamp: 't', metadata: { by: 'u1', phase: 7 } });
    await advance(2500);
    expect(speakAs).not.toHaveBeenCalledWith('counsel', 'My own words.');
  });

  it('shows when the other player is typing, and drops it when they stop', async () => {
    render(<Courtroom session={store.session} onComplete={() => {}} onBack={() => {}} />);
    await advance(500);
    store.session = { ...store.session, session_state: { ...store.session.session_state, activityProsecution: { kind: 'typing', seq: 1 } } };
    await advance(2500);
    expect(screen.getByText('Chidi Okafor is typing…')).toBeTruthy();
    store.session = { ...store.session, session_state: { ...store.session.session_state, activityProsecution: { kind: 'idle', seq: 2 } } };
    await advance(2500);
    expect(screen.queryByText('Chidi Okafor is typing…')).toBeNull();
  });

  it('never tells the player the opponent is away, however long they are quiet', async () => {
    render(<Courtroom session={store.session} onComplete={() => {}} onBack={() => {}} />);
    await advance(120000);
    expect(screen.queryByText(/opponent is away/i)).toBeNull();
  });

  it('does not write the judge\'s line or the trial\'s phase for the other player\'s turn', async () => {
    render(<Courtroom session={store.session} onComplete={() => {}} onBack={() => {}} />);
    await advance(10000);
    // Phase 7 is the prosecution's opening: the prosecution's screen introduces it, not mine.
    expect(store.added.filter(e => e.speaker_role === 'judge')).toHaveLength(0);
    // And the periodic whole-state save that let a screen push the trial backwards is gone.
    expect(store.updates.filter(u => 'current_trial_phase' in u && u.current_trial_phase < 7)).toHaveLength(0);
    expect(store.updates.filter(u => u.session_state && 'turnState' in u.session_state)).toHaveLength(0);
  });
});
