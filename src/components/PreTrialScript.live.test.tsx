import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const speakAs = vi.fn();
const stopSpeaking = vi.fn();
vi.mock('../lib/speech', () => ({
  speakAs: (...a: unknown[]) => speakAs(...a),
  stopSpeaking: (...a: unknown[]) => stopSpeaking(...a),
  canSpeak: () => true,
  enterSpeechScope: () => () => {},
  isSpeechMuted: () => false,
  subscribeSpeechMuted: () => () => {},
  setSpeechMuted: vi.fn()
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));

import PreTrialScript from './PreTrialScript';
import { pretrialLive } from '../lib/liveGame';
import { LINGER_MS } from '../lib/pretrial';

const base = {
  caseTitle: 'State v. Rivera',
  userName: 'Ada',
  judgeName: 'Justice Sarah Williams',
  prosecutorName: 'DA Harrison',
  sessionId: 's1',
  playerWins: 0,
  mode: 'online' as const,
  opponent: { name: 'Chidi', avatar: null, rank: 1 }
};
const live = (state: Record<string, unknown> = {}) => pretrialLive({ session_state: { isMultiplayer: true, ...state } } as any);
const SCRIPT = [
  { phase: 'bailiff_call', text: 'All rise. Court is now in session.' },
  { phase: 'case_announcement', text: 'The court will now hear the case of State v. Rivera.' },
  { phase: 'defendant_plea', text: 'The defendant will now enter a plea.' }
];

describe('PreTrialScript, two real players', () => {
  beforeEach(() => { vi.useFakeTimers(); speakAs.mockReset(); stopSpeaking.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('tells the other player I am seated, and holds court until both are', () => {
    const onLivePatch = vi.fn();
    render(<PreTrialScript {...base} playerRole="defense" live={live()} onLivePatch={onLivePatch} onComplete={() => {}} />);
    expect(onLivePatch).toHaveBeenCalledWith({ seatedDefense: true });
    expect(screen.getByText(/Waiting for Chidi to take their seat/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ENTER COURT/ })).toBeDisabled();
  });

  it('the defense can open court once both are seated, and publishes the bailiff\'s lines', () => {
    const onLivePatch = vi.fn();
    render(<PreTrialScript {...base} playerRole="defense" live={live({ seatedDefense: true, seatedProsecution: true })} onLivePatch={onLivePatch} onComplete={() => {}} />);
    const start = screen.getByRole('button', { name: /ENTER COURT/ });
    expect(start).not.toBeDisabled();
    fireEvent.click(start);
    const started = onLivePatch.mock.calls.find(c => c[0].pretrialStarted)![0];
    expect(started.pretrialScript[0].text).toMatch(/All rise/);
    // The opponent is named in the script (a real person, not an invented attorney).
    expect(started.pretrialScript.some((l: any) => /Chidi/.test(l.text))).toBe(true);
    expect(onLivePatch).toHaveBeenCalledWith({ pretrialStep: 0 });
  });

  it('before court opens, the prosecution can only wait for the defense to start', () => {
    render(<PreTrialScript {...base} playerRole="prosecution" live={live({ seatedDefense: true, seatedProsecution: true })} onLivePatch={() => {}} onComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /WAITING FOR COURT TO OPEN/ })).toBeDisabled();
    expect(screen.getByText(/Waiting for Chidi to open court/)).toBeTruthy();
  });

  it('the prosecution only watches: same lines, no plea buttons, no AI plea', () => {
    const onLivePatch = vi.fn();
    const state = { seatedDefense: true, seatedProsecution: true, pretrialStarted: true, pretrialScript: SCRIPT };
    const { rerender } = render(<PreTrialScript {...base} playerRole="prosecution" live={live({ ...state, pretrialStep: 0 })} onLivePatch={onLivePatch} onComplete={() => {}} />);
    expect(screen.getByText('All rise. Court is now in session.')).toBeTruthy();

    // The defense's next line arrives on the next poll.
    rerender(<PreTrialScript {...base} playerRole="prosecution" live={live({ ...state, pretrialStep: 1 })} onLivePatch={onLivePatch} onComplete={() => {}} />);
    expect(screen.getByText(/will now hear the case/)).toBeTruthy();
    expect(speakAs).toHaveBeenCalledWith('recorder', 'The court will now hear the case of State v. Rivera.');

    rerender(<PreTrialScript {...base} playerRole="prosecution" live={live({ ...state, pretrialStep: 2 })} onLivePatch={onLivePatch} onComplete={() => {}} />);
    expect(screen.getByText(/Waiting for Chidi to enter the plea/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /NOT GUILTY/ })).toBeNull();
    // Nothing is entered on the defense's behalf, however long the prosecution waits.
    act(() => void vi.advanceTimersByTime(60000));
    expect(onLivePatch).not.toHaveBeenCalledWith(expect.objectContaining({ pretrialPlea: expect.anything() }));
  });

  it('once the defense pleads, the prosecution sees it and can start the trial; the defense waits', () => {
    const onComplete = vi.fn();
    const state = { seatedDefense: true, seatedProsecution: true, pretrialStarted: true, pretrialScript: SCRIPT, pretrialStep: 2, pretrialPlea: 'not_guilty' };
    const { unmount } = render(<PreTrialScript {...base} playerRole="prosecution" live={live(state)} onLivePatch={() => {}} onComplete={onComplete} />);
    expect(screen.getByText(/Not guilty, Your Honor/)).toBeTruthy();
    expect(screen.getByText(/defendant's plea of not guilty/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /START TRIAL/ }));
    expect(onComplete).toHaveBeenCalledWith(false, 'Justice Sarah Williams', expect.any(String));
    unmount();

    render(<PreTrialScript {...base} playerRole="defense" live={live(state)} onLivePatch={() => {}} onComplete={onComplete} />);
    expect(screen.getByText(/Waiting for Chidi to start the trial/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /START TRIAL/ })).toBeNull();
  });

  it('the defense enters the plea and publishes it', () => {
    const onLivePatch = vi.fn();
    const FIVE = [...SCRIPT, { phase: 'counsel_appearances', text: 'Appearing for the prosecution.' }, { phase: 'counsel_appearances', text: 'Appearing for the defense.' }, { phase: 'defendant_plea', text: 'The defendant will now enter a plea.' }];
    const state = { seatedDefense: true, seatedProsecution: true, pretrialStarted: true, pretrialScript: FIVE, pretrialStep: 5 };
    // A defense player who reloaded after the last line resumes at the plea.
    render(<PreTrialScript {...base} playerRole="defense" live={live(state)} onLivePatch={onLivePatch} onComplete={() => {}} />);
    act(() => void vi.advanceTimersByTime(LINGER_MS + 100));
    fireEvent.click(screen.getByRole('button', { name: /^NOT GUILTY/ }));
    expect(onLivePatch).toHaveBeenCalledWith({ pretrialPlea: 'not_guilty' });
  });
});
