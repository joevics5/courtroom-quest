/**
 * Which witnesses a side has already called and which exhibits it has already submitted.
 *
 * Both counsel can call the same witness and submit the same exhibit, so "used" is tracked per side, never
 * across the whole trial: what the other side did must not take anything off your lists.
 */
export interface UsedEvent {
  event_type?: string | null;
  speaker_role?: string | null;
  metadata?: unknown;
}

function idsOf(events: UsedEvent[], type: string, field: 'witness_id' | 'evidence_id', side?: 'prosecution' | 'defense'): string[] {
  const ids: string[] = [];
  for (const e of events) {
    if (e.event_type !== type) continue;
    if (side && e.speaker_role !== side) continue;
    const id = (e.metadata as Record<string, unknown> | null | undefined)?.[field];
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** What this side has already used. */
export function usedBySide(events: UsedEvent[], side: 'prosecution' | 'defense') {
  return {
    witnesses: idsOf(events, 'witness_call', 'witness_id', side),
    evidence: idsOf(events, 'evidence_submission', 'evidence_id', side)
  };
}

/** Everything either side used (for the verdict and the closing arguments, which look at the whole trial). */
export function usedByEither(events: UsedEvent[]) {
  return {
    witnesses: idsOf(events, 'witness_call', 'witness_id'),
    evidence: idsOf(events, 'evidence_submission', 'evidence_id')
  };
}
