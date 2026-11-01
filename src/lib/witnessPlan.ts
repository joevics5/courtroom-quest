import type { TrialConfig } from './trialConfig';
import { isWitnessPhase, getExaminationType } from './trialTurnSystem';
import {
  POOL_KEY, startPool, settlePhase, releaseDefenseHalf, beginDirect, beginCross, beginRedirect, type Clocks
} from './witnessPool';

export interface PlanInput {
  config: TrialConfig;
  duration: number;
  currentPhase: number;
  clocks: Clocks;
  /** Phase numbers during which a witness was actually called. */
  witnessCalledPhases: Set<number>;
}

/**
 * Where the trial goes after the current phase, and what the witness-stage clocks look like once it gets there.
 * Pure: nothing is changed, so the break between counsel can say where it is heading before anything moves.
 *
 * - The unused time of a witness phase that is ending goes back into the shared pool.
 * - A direct examination gets its clock from the pool, keeping the cross-examination reserve back.
 * - Cross-examination and redirect only happen for a witness who was actually called.
 * - A side that let a witness slot go by without calling anyone has rested its case, and a side with no
 *   time left for another witness is done too: both skip to the end of that side's witness phases.
 */
export function planNextPhase(input: PlanInput): { nextPhase: number; clocks: Clocks } | 'verdict' {
  const { config, duration, currentPhase, witnessCalledPhases } = input;
  let clocks: Clocks = { ...input.clocks };
  const current = config.phases.find(p => p.number === currentPhase);
  if (isWitnessPhase(current)) clocks = settlePhase(clocks, currentPhase);

  // After a side's case: the first phase that is not one of that side's witness phases.
  const firstPhaseAfterCase = (side: 'prosecution' | 'defense', from: number) => {
    let k = from;
    while (true) {
      const p = config.phases.find(x => x.number === k);
      if (!p || !isWitnessPhase(p) || !p.name.toLowerCase().startsWith(side)) return k;
      k += 1;
    }
  };

  let nextPhase = currentPhase + 1;
  while (true) {
    const candidate = config.phases.find(p => p.number === nextPhase);
    if (!candidate || !isWitnessPhase(candidate)) break;

    // The witness stage runs on one pool of time; the first witness phase sets it up.
    if (clocks[POOL_KEY] === undefined) clocks = startPool(clocks, duration, [7, 8]);
    const side: 'prosecution' | 'defense' = candidate.name.toLowerCase().startsWith('defense') ? 'defense' : 'prosecution';
    if (side === 'defense') clocks = releaseDefenseHalf(clocks);
    const type = getExaminationType(candidate);
    const slotPrefix = candidate.name.split(' - ')[0]; // e.g. "Prosecution Witness 1"
    const directPhase = config.phases.find(p => p.name === `${slotPrefix} - Direct Examination`);

    if (type === 'direct') {
      const slotNumber = Number(slotPrefix.match(/(\d+)$/)?.[1] ?? 1);
      const previousDirect = slotNumber > 1
        ? config.phases.find(p => p.name === `${side === 'defense' ? 'Defense' : 'Prosecution'} Witness ${slotNumber - 1} - Direct Examination`)
        : undefined;
      const caseRested = !!previousDirect && !witnessCalledPhases.has(previousDirect.number);
      const started = caseRested ? null : beginDirect(clocks, nextPhase, duration);
      if (!started) {
        nextPhase = firstPhaseAfterCase(side, nextPhase);
        continue;
      }
      clocks = started;
      break;
    }

    // Cross-examination and redirect only happen for a witness who was actually called.
    if (directPhase && !witnessCalledPhases.has(directPhase.number)) {
      nextPhase += 1;
      continue;
    }
    if (type === 'cross') {
      clocks = beginCross(clocks, nextPhase);
      break;
    }
    const redirect = beginRedirect(clocks, nextPhase);
    if (!redirect) {
      nextPhase += 1;
      continue;
    }
    clocks = redirect;
    break;
  }

  // Heading into "Judge Deliberation" starts the real deliberation straight away, then the verdict.
  const verdictPhase = config.phases.find(p => p.name === 'Verdict Delivery');
  const deliberationPhase = config.phases.find(p => p.name === 'Judge Deliberation');
  const endOfTrialPhase = deliberationPhase ?? verdictPhase;
  if (endOfTrialPhase && nextPhase >= endOfTrialPhase.number) return 'verdict';
  const lastPhase = config.phases[config.phases.length - 1];
  if (nextPhase > lastPhase.number) return 'verdict';
  return { nextPhase, clocks };
}
