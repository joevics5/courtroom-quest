import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const speakAs = vi.fn();
vi.mock('../lib/speech', () => ({ speakAs: (...a: unknown[]) => speakAs(...a) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));

import PreTrialScript from './PreTrialScript';

const props = {
  caseTitle: 'State v. Rivera',
  userName: 'Ada',
  judgeName: 'Justice Sarah Williams',
  prosecutorName: 'DA Harrison',
  playerRole: 'defense' as const,
  sessionId: 's1',
  playerWins: 6
};

describe('PreTrialScript scene', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    speakAs.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('starts idle with the case title and an ENTER COURT button', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    expect(screen.getByText('COURT IS IN SESSION')).toBeTruthy();
    expect(screen.getByText('State v. Rivera')).toBeTruthy();
    expect(screen.getByRole('button', { name: /ENTER COURT/ })).toBeTruthy();
  });

  it('plays the opening script line by line and ends at the plea', () => {
    const onComplete = vi.fn();
    render(<PreTrialScript {...props} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /ENTER COURT/ }));
    expect(screen.getByText(/All rise\. Court is now in session/)).toBeTruthy();

    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByText(/This is the case of State v\. Rivera/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByText(/For the prosecution, DA Harrison/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByText(/For the defense, Ada/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByText(/how do you plead/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'NOT GUILTY' }));
    expect(screen.getByText(/plea of not guilty/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /START TRIAL/ }));
    expect(onComplete).toHaveBeenCalledWith(false, 'Justice Sarah Williams', 'DA Harrison');
    expect(speakAs).toHaveBeenCalled();
  });

  it('keeps the full transcript behind a toggle', () => {
    render(<PreTrialScript {...props} onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /ENTER COURT/ }));
    act(() => void vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: /Show transcript \(2\)/ }));
    expect(screen.getByRole('button', { name: /Hide transcript/ })).toBeTruthy();
    expect(screen.getAllByText(/All rise/).length).toBeGreaterThan(0);
  });

  it('a guilty plea continues without starting the trial', () => {
    const onComplete = vi.fn();
    render(<PreTrialScript {...props} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /ENTER COURT/ }));
    act(() => void vi.advanceTimersByTime(14000));
    fireEvent.click(screen.getByRole('button', { name: 'GUILTY' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(onComplete).toHaveBeenCalledWith(true, 'Justice Sarah Williams', 'DA Harrison');
  });
});
