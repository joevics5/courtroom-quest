import { describe, expect, it } from 'vitest';
import {
  drivesPretrial, isAhead, isOnlineTwoPlayer, isSessionHost, jurorTurn, mySideIn, opponentUserIdIn,
  otherSide, phaseRank, playMode, pretrialLive, readyState
} from './liveGame';

const online = (extra: Record<string, unknown> = {}) =>
  ({ user_id: 'creator', session_state: { isMultiplayer: true, prosecutionUserId: 'p1', defenseUserId: 'd1', ...extra } }) as any;

describe('who is who in a game', () => {
  it('tells the three play modes apart', () => {
    expect(playMode({ session_state: { playerRole: 'defense' } } as any)).toBe('ai');
    expect(playMode(online())).toBe('online');
    expect(playMode(online({ sameDevicePlay: true }))).toBe('device');
    expect(isOnlineTwoPlayer(online())).toBe(true);
  });

  it('puts each online player on their own side, never both on the defense', () => {
    const s = online();
    expect(mySideIn(s, 'p1')).toBe('prosecution');
    expect(mySideIn(s, 'd1')).toBe('defense');
    expect(opponentUserIdIn(s, 'p1')).toBe('d1');
    expect(opponentUserIdIn(s, 'd1')).toBe('p1');
    expect(opponentUserIdIn({ session_state: { playerRole: 'prosecution' } } as any, 'p1')).toBeNull();
    expect(otherSide('defense')).toBe('prosecution');
  });

  it('the player who opened the challenge is the host', () => {
    expect(isSessionHost(online(), 'creator')).toBe(true);
    expect(isSessionHost(online(), 'p1')).toBe(false);
    expect(isSessionHost(null, 'p1')).toBe(false);
  });
});

describe('phases', () => {
  it('only moves people forward', () => {
    expect(isAhead('jury-selection', 'trial-type-selection')).toBe(true);
    expect(isAhead('investigation', 'jury-selection')).toBe(false);
    expect(isAhead('pre-trial', 'pre-trial')).toBe(false);
    expect(isAhead('trial', 'pre-trial')).toBe(true);
    expect(isAhead(undefined, 'investigation')).toBe(false);
    expect(phaseRank('difficulty-selection')).toBe(phaseRank('trial-type-selection'));
  });
});

describe('investigation readiness', () => {
  it('shows each player whether they and their opponent are ready', () => {
    const s = online({ readyProsecution: true });
    expect(readyState(s, 'defense')).toEqual({ iAmReady: false, opponentReady: true });
    expect(readyState(s, 'prosecution')).toEqual({ iAmReady: true, opponentReady: false });
    expect(readyState(online(), 'defense')).toEqual({ iAmReady: false, opponentReady: false });
  });
});

describe('jury turns', () => {
  const pick = (selected_by: string) => ({ selected_by });
  it('defense first, then they alternate', () => {
    expect(jurorTurn([], 6)).toBe('defense');
    expect(jurorTurn([pick('defense')], 6)).toBe('prosecution');
    expect(jurorTurn([pick('defense'), pick('prosecution')], 6)).toBe('defense');
  });
  it('skips a full side and stops when both are full', () => {
    const six = Array.from({ length: 6 }, () => pick('defense'));
    expect(jurorTurn(six, 6)).toBe('prosecution');
    expect(jurorTurn([...six, ...Array.from({ length: 5 }, () => pick('prosecution'))], 6)).toBe('prosecution');
    expect(jurorTurn([...six, ...Array.from({ length: 6 }, () => pick('prosecution'))], 6)).toBeNull();
    expect(jurorTurn(Array.from({ length: 6 }, () => pick('prosecution')), 6)).toBe('defense');
  });
  it('lets a side that struck a juror pick again', () => {
    expect(jurorTurn([pick('defense'), pick('defense'), pick('prosecution'), pick('prosecution'), pick('prosecution')], 6)).toBe('defense');
  });
});

describe('pre-trial state', () => {
  it('reads seats, progress and plea', () => {
    expect(pretrialLive(online())).toEqual({ seatedProsecution: false, seatedDefense: false, bothSeated: false, started: false, step: -1, plea: null, script: null });
    const live = pretrialLive(online({ seatedProsecution: true, seatedDefense: true, pretrialStarted: true, pretrialStep: 2, pretrialPlea: 'not_guilty' }));
    expect(live).toMatchObject({ bothSeated: true, started: true, step: 2, plea: 'not_guilty' });
    expect(pretrialLive(online({ seatedDefense: true })).bothSeated).toBe(false);
    expect(pretrialLive(online({ pretrialPlea: 'bogus' })).plea).toBeNull();
    const script = [{ phase: 'bailiff_call', text: 'All rise.' }, { nope: 1 }];
    expect(pretrialLive(online({ pretrialScript: script })).script).toEqual([{ phase: 'bailiff_call', text: 'All rise.' }]);
  });
  it('the defense runs the script', () => {
    expect(drivesPretrial('defense')).toBe(true);
    expect(drivesPretrial('prosecution')).toBe(false);
  });
});
