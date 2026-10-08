import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const speakAs = vi.fn();
const stopSpeaking = vi.fn();
let voiceOn = true;
vi.mock('../lib/speech', () => ({
  speakAs: (...a: unknown[]) => speakAs(...a),
  stopSpeaking: (...a: unknown[]) => stopSpeaking(...a),
  canSpeak: () => voiceOn,
  enterSpeechScope: () => () => {},
  isSpeechMuted: () => !voiceOn,
  subscribeSpeechMuted: () => () => {},
  setSpeechMuted: vi.fn()
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));

import PreTrialScript from './PreTrialScript';
import { LINGER_MS, readingTimeMs } from '../lib/pretrial';

const props = {
  caseTitle: 'State v. Rivera',
  userName: 'Ada',
  judgeName: 'Justice Sarah Williams',
  prosecutorName: 'DA Harrison',
  playerRole: 'defense' as const,
  sessionId: 's1',
  playerWins: 6
};

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/** The voice finishes the line it is reading, then the line stays up a moment. */
const finishLine = () => {
  const last = speakAs.mock.calls[speakAs.mock.calls.length - 1];
  act(() => last[2]());
  tick(LINGER_MS);
};
const enter = () => fireEvent.click(screen.getByRole('button', { name: /ENTER COURT/ }));

describe('PreTrialScript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    speakAs.mockReset();
    stopSpeaking.mockReset();
    voiceOn = true;
  });
  afterEach(() => vi.useRealTimers());

  it('starts idle with the case title and an ENTER COURT button', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    expect(screen.getByText('COURT IS IN SESSION')).toBeTruthy();
    expect(screen.getByText('State v. Rivera')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ENTER COURT/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mute voice' })).toBeTruthy();
  });

  it('only the bailiff speaks, and every line is read in his voice', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    for (let i = 0; i < 4; i++) finishLine();
    expect(speakAs.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(speakAs.mock.calls.every(c => c[0] === 'recorder')).toBe(true);
  });

  it('keeps each line on screen until it has been read out, then a moment longer', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    expect(screen.getByText(/All rise\. Court is now in session/)).toBeTruthy();

    tick(15000); // a slow voice: still reading, the text must not change
    expect(screen.queryByText(/will now hear the case/)).toBeNull();

    act(() => speakAs.mock.calls[0][2]()); // the voice finishes
    tick(LINGER_MS - 1);
    expect(screen.queryByText(/will now hear the case/)).toBeNull();
    tick(1);
    expect(screen.getByText(/The court will now hear the case of State v\. Rivera/)).toBeTruthy();
  });

  it('plays the whole script, then the defense player enters the plea', () => {
    const onComplete = vi.fn();
    render(<PreTrialScript {...props} onComplete={onComplete} />);
    enter();
    expect(screen.queryByRole('button', { name: 'NOT GUILTY' })).toBeNull();
    for (let i = 0; i < 5; i++) finishLine();
    expect(screen.getByText(/enter a plea/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'NOT GUILTY' }));
    expect(stopSpeaking).toHaveBeenCalledWith('discard'); // the voice stops the moment they answer
    expect(screen.getByText(/plea of not guilty/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /START TRIAL/ }));
    expect(onComplete).toHaveBeenCalledWith(false, 'Justice Sarah Williams', 'DA Harrison');
  });

  it('pleading cuts off anything still pending', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    for (let i = 0; i < 5; i++) finishLine();
    const spoken = speakAs.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'GUILTY' }));
    tick(60000);
    expect(speakAs.mock.calls.length).toBe(spoken);
  });

  it('a guilty plea continues without starting the trial', () => {
    const onComplete = vi.fn();
    render(<PreTrialScript {...props} onComplete={onComplete} />);
    enter();
    for (let i = 0; i < 5; i++) finishLine();
    fireEvent.click(screen.getByRole('button', { name: 'GUILTY' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(onComplete).toHaveBeenCalledWith(true, 'Justice Sarah Williams', 'DA Harrison');
  });

  it('when the player is the prosecution the AI defense pleads, and the player is never asked', () => {
    const onComplete = vi.fn();
    render(<PreTrialScript {...props} playerRole="prosecution" onComplete={onComplete} />);
    enter();
    for (let i = 0; i < 5; i++) finishLine();
    // the bailiff reports the plea, in his voice
    expect(screen.getByText(/The defendant, through counsel, pleads not guilty\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'NOT GUILTY' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'GUILTY' })).toBeNull();
    expect(speakAs.mock.calls.every(c => c[0] === 'recorder')).toBe(true);

    finishLine();
    fireEvent.click(screen.getByRole('button', { name: /START TRIAL/ }));
    expect(onComplete).toHaveBeenCalledWith(false, 'Justice Sarah Williams', 'DA Harrison');
  });

  it('muted or without a voice: no speech, and each line waits long enough to read', () => {
    voiceOn = false;
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    expect(speakAs).not.toHaveBeenCalled();
    const first = /All rise\. Court is now in session/;
    const wait = readingTimeMs('All rise. Court is now in session. The Honorable Justice Sarah Williams presiding.');
    tick(wait - 1);
    expect(screen.getByText(first)).toBeTruthy();
    tick(1);
    expect(screen.getByText(/will now hear the case/)).toBeTruthy();
  });

  it('Next skips to the following line right away and stops the voice', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    fireEvent.click(screen.getByRole('button', { name: 'Skip to the next line' }));
    expect(stopSpeaking).toHaveBeenCalledWith('discard');
    expect(screen.getByText(/will now hear the case/)).toBeTruthy();
  });

  it('keeps the full transcript behind a toggle', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    enter();
    finishLine();
    fireEvent.click(screen.getByRole('button', { name: /Show transcript \(2\)/ }));
    expect(screen.getByRole('button', { name: /Hide transcript/ })).toBeTruthy();
    expect(screen.getAllByText(/All rise/).length).toBeGreaterThan(0);
  });
});
