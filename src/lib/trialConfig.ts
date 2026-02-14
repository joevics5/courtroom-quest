import type { TrialDuration } from '../types';

export interface TrialPhase {
  number: number;
  name: string;
  category: 'pre-trial' | 'trial' | 'post-trial';
  duration?: number;
  description?: string;
}

export interface TrialConfig {
  duration: TrialDuration;
  phases: TrialPhase[];
  phaseDurations: Record<number, number>;
  maxWitnesses: number;
}

// Base phases (before witness examination)
const BASE_PRE_TRIAL_PHASES: TrialPhase[] = [
  { number: 1, name: 'Court Idle', category: 'pre-trial' },
  { number: 2, name: 'Bailiff Calls Court to Order', category: 'pre-trial' },
  { number: 3, name: 'Judge Enters', category: 'pre-trial' },
  { number: 4, name: 'Case Announcement', category: 'pre-trial' },
  { number: 5, name: 'Counsel Appearances', category: 'pre-trial' },
  { number: 6, name: 'Defendant Plea', category: 'pre-trial' },
];

// Base trial phases (opening statements)
// Note: Judge instructions appear as sub-phases before each counsel action phase
const BASE_TRIAL_START_PHASES: TrialPhase[] = [
  { number: 7, name: 'Opening Statement - Prosecution', category: 'trial' },
  { number: 8, name: 'Opening Statement - Defense', category: 'trial' },
];

// Base trial phases (after witness examination)
const BASE_TRIAL_END_PHASES: TrialPhase[] = [
  { number: 0, name: 'Closing Statement - Prosecution', category: 'trial' }, // Will be renumbered
  { number: 0, name: 'Closing Statement - Defense', category: 'trial' }, // Will be renumbered
  { number: 0, name: 'Judge Deliberation', category: 'trial' }, // Will be renumbered
  { number: 0, name: 'Verdict Delivery', category: 'trial' }, // Will be renumbered
];

// Post-trial phases
const POST_TRIAL_PHASES: TrialPhase[] = [
  { number: 0, name: 'Trial Complete', category: 'post-trial' }, // Will be renumbered
  { number: 0, name: 'Session Archived', category: 'post-trial' }, // Will be renumbered
];

// Generate witness phases based on trial duration
function generateWitnessPhases(duration: TrialDuration): TrialPhase[] {
  const phases: TrialPhase[] = [];
  let phaseNumber = 9; // Start after opening statements (phases 7, 8)

  if (duration === 15) {
    // 1 prosecution witness, 1 defense witness
    phases.push(
      { number: phaseNumber++, name: 'Prosecution Witness 1 - Direct Examination', category: 'trial', duration: 1.5 },
      { number: phaseNumber++, name: 'Prosecution Witness 1 - Cross-Examination', category: 'trial', duration: 1.5 },
      { number: phaseNumber++, name: 'Defense Witness 1 - Direct Examination', category: 'trial', duration: 1.5 },
      { number: phaseNumber++, name: 'Defense Witness 1 - Cross-Examination', category: 'trial', duration: 1.5 }
    );
  } else if (duration === 30) {
    // 2 prosecution witnesses, 2 defense witnesses
    for (let i = 1; i <= 2; i++) {
      phases.push(
        { number: phaseNumber++, name: `Prosecution Witness ${i} - Direct Examination`, category: 'trial', duration: 2 },
        { number: phaseNumber++, name: `Prosecution Witness ${i} - Cross-Examination`, category: 'trial', duration: 2 }
      );
    }
    for (let i = 1; i <= 2; i++) {
      phases.push(
        { number: phaseNumber++, name: `Defense Witness ${i} - Direct Examination`, category: 'trial', duration: 2 },
        { number: phaseNumber++, name: `Defense Witness ${i} - Cross-Examination`, category: 'trial', duration: 2 }
      );
    }
  } else if (duration === 60) {
    // 3 prosecution witnesses, 3 defense witnesses (with redirect)
    for (let i = 1; i <= 3; i++) {
      phases.push(
        { number: phaseNumber++, name: `Prosecution Witness ${i} - Direct Examination`, category: 'trial', duration: 3 },
        { number: phaseNumber++, name: `Prosecution Witness ${i} - Cross-Examination`, category: 'trial', duration: 2 },
        { number: phaseNumber++, name: `Prosecution Witness ${i} - Redirect`, category: 'trial', duration: 0.5 }
      );
    }
    for (let i = 1; i <= 3; i++) {
      phases.push(
        { number: phaseNumber++, name: `Defense Witness ${i} - Direct Examination`, category: 'trial', duration: 3 },
        { number: phaseNumber++, name: `Defense Witness ${i} - Cross-Examination`, category: 'trial', duration: 2 },
        { number: phaseNumber++, name: `Defense Witness ${i} - Redirect`, category: 'trial', duration: 0.5 }
      );
    }
  }

  return phases;
}

// Generate complete phase list for a given duration
function generateTrialPhases(duration: TrialDuration): TrialPhase[] {
  const phases: TrialPhase[] = [];
  
  // Add pre-trial phases
  phases.push(...BASE_PRE_TRIAL_PHASES);
  
  // Add opening statements
  phases.push(...BASE_TRIAL_START_PHASES);
  
  // Add witness phases
  const witnessPhases = generateWitnessPhases(duration);
  phases.push(...witnessPhases);
  
  // Add closing phases (renumber them)
  let nextPhaseNumber = phases.length + 1;
  const closingPhases = BASE_TRIAL_END_PHASES.map(p => ({
    ...p,
    number: nextPhaseNumber++
  }));
  phases.push(...closingPhases);
  
  // Add post-trial phases
  const postTrialPhases = POST_TRIAL_PHASES.map(p => ({
    ...p,
    number: nextPhaseNumber++
  }));
  phases.push(...postTrialPhases);
  
  return phases;
}

// Generate phase durations based on trial duration
function generatePhaseDurations(duration: TrialDuration, phases: TrialPhase[]): Record<number, number> {
  const durations: Record<number, number> = {};
  
  // Opening statements
  if (duration === 15) {
    durations[7] = 2; // Opening - Prosecution
    durations[8] = 2; // Opening - Defense
  } else if (duration === 30) {
    durations[7] = 3;
    durations[8] = 3;
  } else if (duration === 60) {
    durations[7] = 5;
    durations[8] = 5;
  }
  
  // Witness phases (from generated phases)
  phases.forEach(phase => {
    if (phase.category === 'trial' && phase.duration && phase.number >= 9) {
      durations[phase.number] = phase.duration;
    }
  });
  
  // Find closing phases and set durations
  const closingProsecution = phases.find(p => p.name === 'Closing Statement - Prosecution');
  const closingDefense = phases.find(p => p.name === 'Closing Statement - Defense');
  const deliberation = phases.find(p => p.name === 'Judge Deliberation');
  const verdict = phases.find(p => p.name === 'Verdict Delivery');
  
  if (closingProsecution) {
    durations[closingProsecution.number] = duration === 15 ? 2 : duration === 30 ? 3 : 5;
  }
  if (closingDefense) {
    durations[closingDefense.number] = duration === 15 ? 2 : duration === 30 ? 3 : 5;
  }
  if (deliberation) {
    durations[deliberation.number] = duration === 15 ? 1 : duration === 30 ? 3 : 5;
  }
  if (verdict) {
    durations[verdict.number] = 0; // No strict limit
  }
  
  return durations;
}

// Generate trial configs
const TRIAL_CONFIGS_15 = (() => {
  const phases = generateTrialPhases(15);
  return {
    duration: 15 as TrialDuration,
    phases,
    phaseDurations: generatePhaseDurations(15, phases),
    maxWitnesses: 2 // Total witnesses: 1 prosecution + 1 defense
  };
})();

const TRIAL_CONFIGS_30 = (() => {
  const phases = generateTrialPhases(30);
  return {
    duration: 30 as TrialDuration,
    phases,
    phaseDurations: generatePhaseDurations(30, phases),
    maxWitnesses: 4 // Total witnesses: 2 prosecution + 2 defense
  };
})();

const TRIAL_CONFIGS_60 = (() => {
  const phases = generateTrialPhases(60);
  return {
    duration: 60 as TrialDuration,
    phases,
    phaseDurations: generatePhaseDurations(60, phases),
    maxWitnesses: 6 // Total witnesses: 3 prosecution + 3 defense
  };
})();

export const TRIAL_CONFIGS: Record<TrialDuration, TrialConfig> = {
  15: TRIAL_CONFIGS_15,
  30: TRIAL_CONFIGS_30,
  60: TRIAL_CONFIGS_60
};

export function getTrialConfig(duration: TrialDuration): TrialConfig {
  return TRIAL_CONFIGS[duration];
}

export function getPhaseInfo(phaseNumber: number, duration?: TrialDuration): TrialPhase | undefined {
  if (duration) {
    const config = TRIAL_CONFIGS[duration];
    return config.phases.find(p => p.number === phaseNumber);
  }
  // Fallback: search all configs
  for (const config of Object.values(TRIAL_CONFIGS)) {
    const phase = config.phases.find(p => p.number === phaseNumber);
    if (phase) return phase;
  }
  return undefined;
}

export function getTotalTrialTime(duration: TrialDuration): number {
  const config = TRIAL_CONFIGS[duration];
  return Object.values(config.phaseDurations).reduce((sum, time) => sum + time, 0);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const BAILIFF_PROMPTS = {
  callToOrder: "All rise. The Court is now in session. The Honorable Justice presiding.",
  beSeated: "Please be seated.",
  recess: "Court is now in recess."
};

export const JUDGE_NAMES = [
  'Justice Patricia Morrison',
  'Justice Michael Chen',
  'Justice Sarah Williams',
  'Justice David Thompson',
  'Justice Rebecca Martinez'
];

export const PROSECUTOR_NAMES = [
  'District Attorney James Harrison',
  'Prosecutor Emily Rodriguez',
  'State Attorney Marcus Webb',
  'District Attorney Lisa Chang',
  'Prosecutor Thomas Bennett',
  'State Attorney Karen Foster',
  'District Attorney Robert Klein',
  'Prosecutor Jennifer Wallace',
  'State Attorney David Morgan',
  'District Attorney Amanda Peters'
];

export function getRandomJudgeName(): string {
  return JUDGE_NAMES[Math.floor(Math.random() * JUDGE_NAMES.length)];
}

export function getRandomProsecutorName(): string {
  return PROSECUTOR_NAMES[Math.floor(Math.random() * PROSECUTOR_NAMES.length)];
}

export const JUDGE_PROMPTS = {
  caseAnnouncement: "This is the case of {caseTitle}. Counsel, please state your appearances.",
  plea: "Defendant, how do you plead to the charges before this court?",
  openingStatement: "You may proceed with your opening statement.",
  callWitness: "Call your next witness.",
  witnessAnswer: "The witness will answer the question.",
  moveAlong: "Move along, counsel.",
  objectionSustained: "Sustained.",
  objectionOverruled: "Overruled.",
  rephraseQuestion: "Counsel, rephrase the question.",
  closingArgument: "You may proceed with your closing argument.",
  deliberation: "The Court has heard sufficient argument. I will now render my decision.",
  verdict: "After reviewing the evidence and testimony, the Court finds the defendant {verdict}."
};
