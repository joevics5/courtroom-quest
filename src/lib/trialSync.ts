/**
 * The trial between two people on two devices.
 *
 * Every line of the trial is a row in trial_events that both screens read, so these rules decide what a
 * screen does with a line the OTHER player's screen wrote: read it out, put the witness on the stand,
 * show that the other player is typing. Pure functions, no network.
 */
import type { TrialEvent } from '../types';
import type { TurnState } from './trialTurnSystem';

type Side = 'prosecution' | 'defense';

// ---- who wrote a line ----

/** Stamped on every line a player's screen writes, so the other screen knows the line is not its own. */
export const authorTag = (userId: string | undefined) => (userId ? { by: userId } : {});

/** A line written by the other player's screen. (Lines with no stamp are never treated as remote.) */
export function isRemoteEvent(event: Pick<TrialEvent, 'metadata'>, myUserId: string | undefined): boolean {
  const by = event.metadata?.by;
  return typeof by === 'string' && !!myUserId && by !== myUserId;
}

/** Which voice reads a line out, or null when it is not spoken (a "rests" line, an exhibit being filed…). */
export function voiceRoleFor(event: Pick<TrialEvent, 'speaker_role' | 'event_type' | 'metadata'>): 'judge' | 'witness' | 'counsel' | null {
  if (event.metadata?.rested) return null;
  if (event.speaker_role === 'judge') return 'judge';
  if (event.speaker_role === 'witness') return 'witness';
  if (event.speaker_role === 'prosecution' || event.speaker_role === 'defense') {
    return event.event_type === 'opening' || event.event_type === 'closing' || event.event_type === 'witness_examination' || event.event_type === 'cross_examination'
      ? 'counsel'
      : null;
  }
  return null;
}

// ---- the witness on the stand ----

/** The witness most recently called, by either side: who is on the stand now. */
export function witnessOnStand(events: Array<Pick<TrialEvent, 'event_type' | 'content' | 'metadata'>>): { id: string; name: string } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event_type === 'witness_call' && typeof e.metadata?.witness_id === 'string') {
      return { id: e.metadata.witness_id, name: e.content };
    }
  }
  return null;
}

/** Brings this screen's turn state up to date with lines the other screen wrote in the current phase. */
export function applyRemoteEvents(turn: TurnState, events: Array<Pick<TrialEvent, 'event_type' | 'speaker_role' | 'content' | 'metadata'>>): TurnState {
  let next = turn;
  let answers = 0;
  for (const e of events) {
    if (e.metadata?.phase !== turn.current_phase_number) continue;
    if (e.event_type === 'witness_call' && typeof e.metadata?.witness_id === 'string') {
      const id = e.metadata.witness_id as string;
      next = {
        ...next,
        current_witness_id: id,
        current_witness_name: e.content,
        witnesses_called: next.witnesses_called.includes(id) ? next.witnesses_called : [...next.witnesses_called, id]
      };
    } else if (e.event_type === 'evidence_submission' && typeof e.metadata?.evidence_id === 'string') {
      const id = e.metadata.evidence_id as string;
      if (!next.evidence_submitted.includes(id)) next = { ...next, evidence_submitted: [...next.evidence_submitted, id] };
    } else if (e.speaker_role === 'witness' && (e.event_type === 'witness_examination' || e.event_type === 'cross_examination')) {
      answers += 1;
    }
  }
  if (answers > (next.questions_asked ?? 0)) next = { ...next, questions_asked: answers };
  return next;
}

// ---- "is typing…" / "is speaking…" ----

export type ActivityKind = 'typing' | 'speaking' | 'idle';
export const activityKey = (side: Side) => (side === 'prosecution' ? 'activityProsecution' : 'activityDefense');

/** How long after the last sign of life a "typing" / "speaking" notice stays up. */
export const ACTIVITY_FRESH_MS = 6000;

export interface ActivityRaw { kind: ActivityKind; seq: number }

export function parseActivity(state: Record<string, any> | null | undefined, side: Side): ActivityRaw | null {
  const raw = state?.[activityKey(side)];
  if (!raw || typeof raw.seq !== 'number') return null;
  const kind: ActivityKind = raw.kind === 'typing' || raw.kind === 'speaking' ? raw.kind : 'idle';
  return { kind, seq: raw.seq };
}

export interface ActivityWatch { kind: ActivityKind; seq: number; changedAt: number }

/**
 * Follows the other player's activity using THIS device's clock: a notice is live while its counter
 * keeps moving, so two phones whose clocks disagree still agree on who is typing.
 */
export function observeActivity(prev: ActivityWatch | null, raw: ActivityRaw | null, now: number): ActivityWatch | null {
  if (!raw) return prev;
  if (prev && prev.seq === raw.seq && prev.kind === raw.kind) return prev;
  return { kind: raw.kind, seq: raw.seq, changedAt: now };
}

export function currentActivity(watch: ActivityWatch | null, now: number): 'typing' | 'speaking' | null {
  if (!watch || watch.kind === 'idle') return null;
  return now - watch.changedAt <= ACTIVITY_FRESH_MS ? watch.kind : null;
}

/** What to show under the turn badge for the other player, or null for nothing. */
export function activityLine(name: string, activity: 'typing' | 'speaking' | null): string | null {
  if (activity === 'typing') return `${name} is typing…`;
  if (activity === 'speaking') return `${name} is speaking…`;
  return null;
}
