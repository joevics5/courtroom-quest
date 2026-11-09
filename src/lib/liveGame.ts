/**
 * Two people, two browsers, one game.
 *
 * Everything that has to look the same to both players before the trial (who is ready, who is seated,
 * whose turn it is to pick a juror, where the bailiff's script has got to, the plea) lives in
 * case_sessions.session_state and is read back by polling, the same way the trial itself stays in sync.
 * This file holds the pure rules; nothing here touches the network.
 */
import type { CaseSession, PlayerRole } from '../types';
import { getSessionPlayerRole } from './verdictUtils';

export type Side = 'prosecution' | 'defense';
export type PlayMode = 'ai' | 'online' | 'device';

export const LIVE_POLL_MS = 2000;

type StateBag = Record<string, any>;
const stateOf = (session: Pick<CaseSession, 'session_state'> | null | undefined): StateBag =>
  ((session?.session_state as StateBag | null | undefined) ?? {}) as StateBag;

/** ai = against the computer, device = two people on one phone, online = two people on two devices. */
export function playMode(session: Pick<CaseSession, 'session_state'> | null | undefined): PlayMode {
  const s = stateOf(session);
  if (!s.isMultiplayer) return 'ai';
  return s.sameDevicePlay ? 'device' : 'online';
}

export const isOnlineTwoPlayer = (session: Pick<CaseSession, 'session_state'> | null | undefined) =>
  playMode(session) === 'online';

/** Which side this signed-in person plays (never guesses "defense" for a prosecutor in an online game). */
export function mySideIn(session: Pick<CaseSession, 'session_state'> | null | undefined, userId: string | undefined): Side {
  return getSessionPlayerRole(session, userId) as Side;
}

export const otherSide = (side: Side): Side => (side === 'prosecution' ? 'defense' : 'prosecution');

/** The player who opened the challenge sets the trial up for both. */
export const isSessionHost = (session: Pick<CaseSession, 'user_id'> | null | undefined, userId: string | undefined) =>
  !!session && !!userId && session.user_id === userId;

/** The other human's user id in an online game, or null. */
export function opponentUserIdIn(session: Pick<CaseSession, 'session_state'> | null | undefined, userId: string | undefined): string | null {
  if (!isOnlineTwoPlayer(session) || !userId) return null;
  const s = stateOf(session);
  const id = mySideIn(session, userId) === 'prosecution' ? s.defenseUserId : s.prosecutionUserId;
  return typeof id === 'string' ? id : null;
}

// ---- phases ----

export const PHASE_ORDER = ['role-selection', 'investigation', 'trial-type-selection', 'jury-selection', 'pre-trial', 'trial', 'completed'] as const;

/** Position of a phase in the game; unknown/legacy phases count as the start so they never push anyone forward. */
export function phaseRank(phase: string | null | undefined): number {
  if (phase === 'difficulty-selection') return PHASE_ORDER.indexOf('trial-type-selection');
  const i = PHASE_ORDER.indexOf((phase ?? '') as (typeof PHASE_ORDER)[number]);
  return i < 0 ? 0 : i;
}

/** The game moved on without me: true only for a phase that is further along than the one I am looking at. */
export const isAhead = (remotePhase: string | null | undefined, myPhase: string | null | undefined) =>
  phaseRank(remotePhase) > phaseRank(myPhase);

// ---- investigation: "ready for trial" ----

export const readyKey = (side: Side) => (side === 'prosecution' ? 'readyProsecution' : 'readyDefense');

export function readyState(session: Pick<CaseSession, 'session_state'> | null | undefined, mySide: Side) {
  const s = stateOf(session);
  return { iAmReady: !!s[readyKey(mySide)], opponentReady: !!s[readyKey(otherSide(mySide))] };
}

// ---- jury selection: take turns ----

export interface PickLike { selected_by: string }

/** Defense picks first, then the sides alternate; a side that is already full is skipped. */
export function jurorTurn(picks: PickLike[], perSide: number): Side | null {
  const def = picks.filter(p => p.selected_by === 'defense').length;
  const pros = picks.filter(p => p.selected_by === 'prosecution').length;
  if (def >= perSide && pros >= perSide) return null;
  if (def >= perSide) return 'prosecution';
  if (pros >= perSide) return 'defense';
  return def > pros ? 'prosecution' : 'defense';
}

// ---- pre-trial ----

export const seatedKey = (side: Side) => (side === 'prosecution' ? 'seatedProsecution' : 'seatedDefense');

export interface PretrialLive {
  seatedProsecution: boolean;
  seatedDefense: boolean;
  bothSeated: boolean;
  started: boolean;
  /** Index of the last bailiff line that has been read out (-1 = none yet). */
  step: number;
  plea: 'guilty' | 'not_guilty' | null;
  /** The bailiff's lines, published once by the defense so both players read exactly the same words. */
  script: Array<{ phase: string; text: string }> | null;
}

export function pretrialLive(session: Pick<CaseSession, 'session_state'> | null | undefined): PretrialLive {
  const s = stateOf(session);
  const seatedProsecution = !!s.seatedProsecution;
  const seatedDefense = !!s.seatedDefense;
  return {
    seatedProsecution,
    seatedDefense,
    bothSeated: seatedProsecution && seatedDefense,
    started: !!s.pretrialStarted,
    step: typeof s.pretrialStep === 'number' ? s.pretrialStep : -1,
    plea: s.pretrialPlea === 'guilty' || s.pretrialPlea === 'not_guilty' ? s.pretrialPlea : null,
    script: Array.isArray(s.pretrialScript)
      ? s.pretrialScript.filter((l: any) => l && typeof l.text === 'string' && typeof l.phase === 'string')
      : null
  };
}

/** Who runs the bailiff's script and enters the plea: the defense. The prosecution watches, then starts the trial. */
export const drivesPretrial = (side: PlayerRole | Side) => side === 'defense';

/** What the pre-trial screen tells a player about the seats, before court opens. */
export function seatNotice(input: { mySeated: boolean; opponentSeated: boolean; iDrive: boolean; opponentName: string }): string {
  const { mySeated, opponentSeated, iDrive, opponentName } = input;
  if (!mySeated) return opponentSeated ? `${opponentName} is seated. Take a seat.` : 'Walk to your chair at the counsel table to begin.';
  if (!opponentSeated) return 'Waiting for opposing counsel…';
  return iDrive ? 'Both counsel are seated. Press Start when you are ready.' : `Both counsel are seated. Waiting for ${opponentName} to open court…`;
}

// ---- "what is my opponent doing" before the trial ----

export const statusKey = (side: Side) => (side === 'prosecution' ? 'statusProsecution' : 'statusDefense');

export interface LiveStatus { text: string; seq: number }

export function parseStatus(session: Pick<CaseSession, 'session_state'> | null | undefined, side: Side): LiveStatus | null {
  const raw = stateOf(session)[statusKey(side)];
  return raw && typeof raw.text === 'string' && raw.text.trim() && typeof raw.seq === 'number' ? { text: raw.text, seq: raw.seq } : null;
}

/** "Chidi is looking through the evidence", or null when there is nothing to say. */
export const statusLine = (name: string, status: LiveStatus | null): string | null => (status ? `${name} ${status.text}` : null);
