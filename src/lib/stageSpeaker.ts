export type StageSpeaker = 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury' | 'bailiff';

/** Turns an event's speaker_role into a stage role. "counsel" means whoever holds the floor. */
export function normalizeRole(role: string | null | undefined, floor?: StageSpeaker): StageSpeaker | undefined {
  switch (role) {
    case 'judge':
    case 'prosecution':
    case 'defense':
    case 'witness':
    case 'jury':
    case 'bailiff':
      return role;
    case 'recorder':
      return 'bailiff';
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

/**
 * Whose turn it is, for the trial stage highlight. This is the "turn by turn switch":
 *  - the judge has it while giving an instruction or ruling;
 *  - opening and closing statements belong to the side named in the phase;
 *  - witness examination follows the trial's own turn tracker (counsel asking, then witness);
 *  - deliberation and the verdict belong to the judge.
 * Returns null when nothing says (the stage then falls back to the latest speaker).
 */
export function getTrialFloor(input: {
  phaseName?: string | null;
  /** turnState.current_turn: only tracked during witness examination. */
  currentTurn?: string | null;
  /** True while the judge's instruction for this phase is still being given. */
  judgeSpeaking?: boolean;
}): StageSpeaker | null {
  if (input.judgeSpeaking) return 'judge';
  const name = (input.phaseName ?? '').toLowerCase();

  if (name.includes('opening statement') || name.includes('closing statement')) {
    if (name.includes('prosecution')) return 'prosecution';
    if (name.includes('defense')) return 'defense';
    return null;
  }
  if (name.includes('deliberation') || name.includes('verdict')) return 'judge';

  const witnessPhase = name.includes('direct examination') || name.includes('cross-examination') || name.includes('redirect');
  if (witnessPhase) {
    const turn = input.currentTurn;
    return turn === 'prosecution' || turn === 'defense' || turn === 'witness' || turn === 'judge' ? turn : null;
  }
  return null;
}

/** What the "whose turn" badge says, from the same turn the stage highlight follows. */
export interface TurnBadge {
  /** "you": the player acts now. "other": the opponent or a witness. "judge": the judge. "none": unknown. */
  kind: 'you' | 'other' | 'judge' | 'none';
  label: string;
}

export function describeTurn(input: {
  floor: StageSpeaker | null;
  playerRole: 'prosecution' | 'defense';
  /** Two players share one device: there is no "you", just a side. */
  sameDevicePlay?: boolean;
}): TurnBadge {
  const { floor, playerRole, sameDevicePlay } = input;
  if (!floor) return { kind: 'none', label: '' };
  if (floor === 'judge' || floor === 'bailiff') return { kind: 'judge', label: floor === 'judge' ? "JUDGE'S TURN" : 'COURT IN SESSION' };
  if (floor === 'witness') return { kind: 'other', label: 'WITNESS ANSWERING' };
  if (floor === 'jury') return { kind: 'other', label: 'JURY DELIBERATING' };
  const side = floor === 'prosecution' ? 'PROSECUTION' : 'DEFENSE';
  if (sameDevicePlay) return { kind: 'you', label: `${side}'S TURN` };
  return floor === playerRole ? { kind: 'you', label: 'YOUR TURN' } : { kind: 'other', label: `${side}'S TURN` };
}
