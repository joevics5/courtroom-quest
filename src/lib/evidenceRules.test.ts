import { describe, expect, it } from 'vitest';
import { getTrialConfig } from './trialConfig';
import { canSubmitEvidence, getAllowedActions, initializeTurnState } from './trialTurnSystem';

const config = getTrialConfig(30);
const phaseNamed = (part: string) => config.phases.find(p => p.name.toLowerCase().includes(part));

describe('evidence submission is only for witness phases', () => {
  it('is not allowed in opening or closing statements', () => {
    expect(canSubmitEvidence(phaseNamed('opening statement'))).toBe(false);
    expect(canSubmitEvidence(phaseNamed('closing statement'))).toBe(false);
  });

  it('is allowed while calling and examining witnesses', () => {
    expect(canSubmitEvidence(phaseNamed('direct examination'))).toBe(true);
    expect(canSubmitEvidence(phaseNamed('cross-examination'))).toBe(true);
    // Redirect only exists in the longer trial lengths.
    const redirect = getTrialConfig(60).phases.find(p => p.name.toLowerCase().includes('redirect'));
    expect(redirect).toBeDefined();
    expect(canSubmitEvidence(redirect)).toBe(true);
  });

  it('is offered to the AI when calling a witness, but never in a statement', () => {
    const direct = phaseNamed('direct examination')!;
    const state = initializeTurnState(direct, 30);
    const evidence = [{ id: 'e1', exhibit_label: 'A' }];
    const calling = getAllowedActions(state, direct, 30, [{ id: 'w1', name: 'W' }], evidence, true);
    expect(calling.map(a => a.action)).toContain('submit_evidence');

    const opening = phaseNamed('opening statement')!;
    const openState = initializeTurnState(opening, 30);
    const inOpening = getAllowedActions(openState, opening, 30, [{ id: 'w1', name: 'W' }], evidence, true);
    expect(inOpening.map(a => a.action)).not.toContain('submit_evidence');
  });
});
