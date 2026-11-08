import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

// The voice "finishes" every line at once, so the script is paced by the on-screen linger only.
vi.mock('../lib/speech', () => ({
  speakAs: (_role: string, _text: string, onEnd?: () => void) => { onEnd?.(); return true; },
  stopSpeaking: vi.fn(),
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

const onCompleteProsecution = vi.fn();
const onCompleteDefense = vi.fn();

/** Two browsers, one shared game state (what the database holds); each re-reads it after every write. */
function TwoBrowsers() {
  const [state, setState] = useState<Record<string, unknown>>({ isMultiplayer: true });
  const patch = (p: Record<string, unknown>) => setState(prev => ({ ...prev, ...p }));
  const live = pretrialLive({ session_state: state } as any);
  const common = {
    caseTitle: 'State v. Rivera', judgeName: 'Justice Sarah Williams', prosecutorName: 'DA Harrison', sessionId: 's1',
    mode: 'online' as const, live, onLivePatch: patch
  };
  return (
    <>
      <div data-testid="defense">
        <PreTrialScript {...common} userName="Dele" playerRole="defense" opponent={{ name: 'Chidi', avatar: null, rank: 1 }} onComplete={onCompleteDefense} />
      </div>
      <div data-testid="prosecution">
        <PreTrialScript {...common} userName="Chidi" playerRole="prosecution" opponent={{ name: 'Dele', avatar: null, rank: 1 }} onComplete={onCompleteProsecution} />
      </div>
    </>
  );
}

describe('pre-trial between two players', () => {
  beforeEach(() => { vi.useFakeTimers(); onCompleteProsecution.mockReset(); onCompleteDefense.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it('both sit, the defense opens court, the prosecution watches the same lines, the defense pleads, the prosecution starts the trial', () => {
    render(<TwoBrowsers />);
    const defense = within(screen.getByTestId('defense'));
    const prosecution = within(screen.getByTestId('prosecution'));

    // Both are seated (no 3D here, so sitting is automatic); the prosecution can only wait.
    expect(prosecution.getByRole('button', { name: /WAITING FOR COURT TO OPEN/ })).toBeDisabled();
    fireEvent.click(defense.getByRole('button', { name: /ENTER COURT/ }));

    // The bailiff reads every line; the prosecution sees each one as the defense's screen does.
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      act(() => void vi.advanceTimersByTime(LINGER_MS + 50));
      const line = screen.getByTestId('defense').querySelector('[aria-live="polite"] p.text-white\\/95')?.textContent;
      if (line && seen[seen.length - 1] !== line) seen.push(line);
    }
    expect(seen.length).toBeGreaterThanOrEqual(4);
    const lastDefenseLine = seen[seen.length - 1];
    expect(within(screen.getByTestId('prosecution')).getByText(lastDefenseLine)).toBeTruthy();
    // The prosecution is named as a real person in the shared lines, never as an invented attorney.
    expect(seen.join(' ')).toMatch(/Chidi/);
    expect(seen.join(' ')).toMatch(/Dele/);
    expect(seen.join(' ')).not.toMatch(/Harrison/);

    // Plea time: only the defense has the buttons.
    expect(prosecution.getByText(/Waiting for Chidi to enter the plea|Waiting for Dele to enter the plea/)).toBeTruthy();
    expect(prosecution.queryByRole('button', { name: /NOT GUILTY/ })).toBeNull();
    fireEvent.click(defense.getByRole('button', { name: /^NOT GUILTY/ }));

    // The plea shows up for the prosecution, who alone can start the trial.
    expect(prosecution.getByText(/Not guilty, Your Honor/)).toBeTruthy();
    expect(defense.queryByRole('button', { name: /START TRIAL/ })).toBeNull();
    fireEvent.click(prosecution.getByRole('button', { name: /START TRIAL/ }));
    expect(onCompleteProsecution).toHaveBeenCalledWith(false, 'Justice Sarah Williams', expect.any(String));
    expect(onCompleteDefense).not.toHaveBeenCalled();
  });
});
