import i18n from '../i18n';
/**
 * Pre-trial script: the bailiff reads out the opening proceedings, and who pleads for the defendant.
 * Kept free of React so the wording and timing rules are easy to test.
 */

/**
 * What the AI defense pleads when the human plays the prosecution. Not guilty keeps the trial going:
 * a guilty plea ends the case before it starts (see handlePreTrialComplete), so a prosecutor would
 * never get to play. Change this one line to 'guilty' to flip it.
 */
export const AI_DEFENSE_PLEA: 'guilty' | 'not_guilty' = 'not_guilty';

/** After a line has been read aloud, how long it stays on screen before the next one replaces it. */
export const LINGER_MS = 1800;

/** How long a line should stay up when nothing reads it aloud (muted, or no speech support). */
export function readingTimeMs(text: string): number {
  return Math.min(14000, Math.max(3500, 1500 + text.length * 65));
}

export type ScriptPhase = 'bailiff_call' | 'case_announcement' | 'counsel_appearances' | 'defendant_plea';

export interface ScriptStep {
  phase: ScriptPhase;
  text: string;
}

/** Every line is the bailiff's: nobody else speaks in the pre-trial. */
export function pretrialSteps(input: {
  judgeName: string;
  caseTitle: string;
  prosecutorName: string;
  defenseName: string;
}): ScriptStep[] {
  return [
    { phase: 'bailiff_call', text: i18n.t('pretrial.bailiffCall', { judge: input.judgeName }) },
    { phase: 'case_announcement', text: i18n.t('pretrial.caseAnnouncement', { title: input.caseTitle }) },
    { phase: 'counsel_appearances', text: i18n.t('pretrial.prosecutionAppears', { name: input.prosecutorName }) },
    { phase: 'counsel_appearances', text: i18n.t('pretrial.defenseAppears', { name: input.defenseName }) },
    { phase: 'defendant_plea', text: i18n.t('pretrial.pleaPrompt') }
  ];
}

/** The bailiff reports the plea when the AI defense makes it. */
export function aiPleaLine(guilty: boolean): string {
  return i18n.t(guilty ? 'pretrial.aiPleaGuilty' : 'pretrial.aiPleaNotGuilty');
}
