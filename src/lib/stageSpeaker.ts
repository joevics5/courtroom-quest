export type StageSpeaker = 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury';

/** Turns an event's speaker_role into a stage role. "counsel" means whoever holds the floor. */
export function normalizeRole(role: string | null | undefined, floor?: StageSpeaker): StageSpeaker | undefined {
  switch (role) {
    case 'judge':
    case 'prosecution':
    case 'defense':
    case 'witness':
    case 'jury':
      return role;
    case 'counsel':
      return floor === 'prosecution' || floor === 'defense' ? floor : 'defense';
    default:
      return undefined;
  }
}

/**
 * Who is highlighted on the trial stage.
 *  - While someone is being read aloud, it is the person who wrote the latest message.
 *  - Otherwise it is whoever has the turn (the side to speak next), so after the judge
 *    says "Defense, you may proceed" the glow moves to the defense.
 * Falls back to the latest speaker, then the judge, when the turn is unknown.
 */
export function pickActiveSpeaker(input: {
  lastRole?: string | null;
  floor?: StageSpeaker | null;
  ttsSpeaking: boolean;
}): StageSpeaker {
  const floor = input.floor ?? undefined;
  const spoken = normalizeRole(input.lastRole, floor);
  if (input.ttsSpeaking && spoken) return spoken;
  if (floor) return floor;
  return spoken ?? 'judge';
}
