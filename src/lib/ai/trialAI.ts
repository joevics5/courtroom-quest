/**
 * Unified Trial AI Service
 * Each role (judge, prosecution, witness, verdict) acts as a separate AI agent
 * with distinct personality, temperature, and system prompt.
 */

import { getAIProvider } from './providerFactory';
import type { AIRequest, AIResponse } from './types';
import type { TurnState, AllowedAction } from '../trialTurnSystem';
import type { Witness, TrialEvent, Evidence } from '../../types';
import { getJudgeDifficultyModifier, getProsecutionDifficultyModifier } from '../trialConfig';
import { generateTranscript, extractEvidenceCitations } from '../transcriptGenerator';

// ============================================================================
// AGENT TEMPERATURE CONFIG
// Each agent has a distinct personality expressed through temperature
// ============================================================================

const AGENT_TEMPERATURES: Record<string, number> = {
  judge: 0.4,        // Formal, consistent, predictable rulings
  prosecution: 0.8,  // Aggressive, creative, strategic
  witness: 0.7,      // Natural, varied responses (overridden per-witness)
  verdict: 0.3,      // Most impartial, analytical, consistent
};

// ============================================================================
// JUDGE AI AGENT — Formal, authoritative, low temperature
// ============================================================================

export interface JudgeContext {
  caseTitle: string;
  judgeName: string;
  prosecutorName: string;
  phase: 'opening_request' | 'objection_ruling' | 'verdict' | 'general' | 'instruction';
  difficulty?: 'easy' | 'medium' | 'hard';
  practiceMode?: boolean;
  nextPhaseName?: string;
  nextPhaseType?: 'prosecution' | 'defense' | 'witness' | 'closing';
  objectionContext?: {
    objection_by: 'prosecution' | 'defense';
    objection_reason: string;
    questioned_statement: string;
    recent_transcript: string;
  };
  recent_transcript?: string;
}

export interface ObjectionRuling {
  ruling: 'sustained' | 'overruled';
  reasoning: string;
}

/**
 * Generate judge's opening statement request
 */
export async function generateJudgeOpeningRequest(
  context: JudgeContext
): Promise<string> {
  const prompt = buildJudgeOpeningPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: 'Generate the judge\'s request for the prosecution\'s opening statement.',
    temperature: AGENT_TEMPERATURES.judge,
    maxTokens: 200
  });

  return response.text;
}

/**
 * Generate judge instruction for next phase
 */
export async function generateJudgeInstruction(
  context: JudgeContext
): Promise<string> {
  const prompt = buildJudgeInstructionPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: 'Generate the judge\'s instruction for the next phase.',
    temperature: AGENT_TEMPERATURES.judge,
    maxTokens: 300
  });

  return response.text;
}

/**
 * Generate judge's objection ruling
 */
export async function generateJudgeObjectionRuling(
  context: JudgeContext
): Promise<ObjectionRuling> {
  if (!context.objectionContext) {
    throw new Error('Objection context required for ruling');
  }

  const prompt = buildJudgeObjectionPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: 'Rule on the objection.',
    responseFormat: 'json',
    temperature: AGENT_TEMPERATURES.judge,
    maxTokens: 500
  });

  return parseObjectionRuling(response.text);
}

/**
 * Generate objection ruling (legacy-compatible interface)
 */
export async function generateObjectionRuling(
  context: {
    objection_by: 'prosecution' | 'defense';
    objection_reason: string;
    questioned_statement: string;
    current_phase: string;
    recent_transcript: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    practiceMode?: boolean;
  }
): Promise<ObjectionRuling> {
  const judgeContext: JudgeContext = {
    caseTitle: '',
    judgeName: 'The Court',
    prosecutorName: 'Prosecution',
    phase: 'objection_ruling',
    difficulty: context.difficulty,
    practiceMode: context.practiceMode,
    objectionContext: {
      objection_by: context.objection_by,
      objection_reason: context.objection_reason,
      questioned_statement: context.questioned_statement,
      recent_transcript: context.recent_transcript,
    }
  };
  return generateJudgeObjectionRuling(judgeContext);
}

// ============================================================================
// PROSECUTION AI AGENT — Aggressive, strategic, high temperature
// ============================================================================

export interface ProsecutionContext {
  role: 'prosecution';
  side: 'prosecution' | 'defense';
  phase: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  time_remaining_seconds: number;
  current_witness: string | null;
  available_witnesses: Array<{ id: string; name: string }>;
  available_evidence: Array<{ id: string; exhibit_label?: string; title: string }>;
  recent_transcript: string;
  allowed_actions: AllowedAction[];
  trial_duration: number;
  witnesses_called_count: number;
}

export interface ProsecutionAction {
  action: string;
  content?: string;
  witness_name?: string;
  evidence_id?: string;
}

export interface ProsecutionOpeningContext {
  caseTitle: string;
  prosecutorName: string;
  side: 'prosecution' | 'defense';
  difficulty?: 'easy' | 'medium' | 'hard';
  defendantName?: string;
  caseDescription: string;
  timeLimitMinutes: number;
  availableEvidence: Array<{ id: string; title: string; description: string; exhibit_label?: string }>;
  availableWitnesses: Array<{ id: string; name: string; role: string }>;
  investigationEvidenceSummary: string;
  investigationWitnessTranscripts: string;
}

/**
 * Generate prosecution opening statement
 */
export async function generateProsecutionOpeningStatement(
  context: ProsecutionOpeningContext
): Promise<string> {
  const prompt = buildProsecutionOpeningPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: 'Deliver your opening statement. Begin directly without greetings - the judge has already spoken.',
    temperature: AGENT_TEMPERATURES.prosecution,
    maxTokens: Math.min(4000, Math.max(1500, context.timeLimitMinutes * 200))
  });

  return response.text;
}

export interface ClosingArgumentContext {
  caseTitle: string;
  prosecutorName: string;
  side: 'prosecution' | 'defense';
  difficulty?: 'easy' | 'medium' | 'hard';
  defendantName?: string;
  caseDescription: string;
  timeLimitMinutes: number;
  trialTranscriptSummary: string;
  evidenceSubmitted: Array<{ id: string; exhibit_label?: string; title: string }>;
  witnessesCalled: Array<{ id: string; name: string }>;
}

/**
 * Generate a closing argument. Unlike the opening statement (which argues
 * from the pre-trial investigation findings, since nothing has happened
 * yet), a closing argument has to reference what actually came out during
 * the trial — testimony, evidence submitted, objections sustained/overruled
 * — not just restate the pre-trial theory of the case.
 */
export async function generateClosingArgument(
  context: ClosingArgumentContext
): Promise<string> {
  const prompt = buildClosingArgumentPrompt(context);

  const response = await generateAIResponse({
    system: prompt,
    user: 'Deliver your closing argument. Begin directly without greetings - the judge has already spoken.',
    temperature: AGENT_TEMPERATURES.prosecution,
    maxTokens: Math.min(4000, Math.max(1500, context.timeLimitMinutes * 200))
  });

  return response.text;
}

/**
 * Generate prosecution action
 */
export async function generateProsecutionAction(
  context: ProsecutionContext
): Promise<ProsecutionAction> {
  const prompt = buildProsecutionPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: 'Select and execute one action.',
    responseFormat: 'json',
    temperature: AGENT_TEMPERATURES.prosecution,
    maxTokens: 500
  });

  return parseProsecutionAction(response.text, context.allowed_actions);
}

// ============================================================================
// WITNESS AI AGENT — Natural, personality-driven, variable temperature
// ============================================================================

export interface WitnessContext {
  witness: Witness;
  question: string;
  previousInteractions: Array<{ question: string; response: string }>;
}

/**
 * Generate witness response
 */
export async function generateWitnessResponse(
  context: WitnessContext
): Promise<string>;
export async function generateWitnessResponse(
  witness: Witness,
  question: string,
  previousInteractions?: Array<{ question: string; response: string }>
): Promise<string>;
export async function generateWitnessResponse(
  contextOrWitness: WitnessContext | Witness,
  question?: string,
  previousInteractions?: Array<{ question: string; response: string }>
): Promise<string> {
  // Handle both call signatures
  let witness: Witness;
  let q: string;
  let prev: Array<{ question: string; response: string }>;

  if ('witness' in contextOrWitness && 'question' in contextOrWitness) {
    witness = contextOrWitness.witness;
    q = contextOrWitness.question;
    prev = contextOrWitness.previousInteractions;
  } else {
    witness = contextOrWitness;
    q = question!;
    prev = previousInteractions || [];
  }

  const prompt = buildWitnessPrompt({ witness, question: q, previousInteractions: prev });
  
  // Adjust temperature based on witness personality
  const personality = witness.personality_traits as any;
  let witnessTemp = AGENT_TEMPERATURES.witness;
  if (personality?.defensive) witnessTemp = 0.9;  // More unpredictable
  if (personality?.cooperative === false) witnessTemp = 0.85;
  if (personality?.detail_oriented) witnessTemp = 0.5; // More precise

  const response = await generateAIResponse({
    system: prompt,
    user: q,
    temperature: witnessTemp,
    maxTokens: 800
  });

  return response.text;
}

// ============================================================================
// VERDICT AI AGENT — Impartial, analytical, lowest temperature
// ============================================================================

export interface VerdictResult {
  outcome: 'win' | 'lose' | 'partial';
  reasoning: string;
  evidence_cited: string[];
  score: number;
}

/**
 * Generate verdict based on transcript and evidence
 * Supports both jury trials and bench (judge-only) trials
 */
export async function generateVerdict(
  events: TrialEvent[],
  evidence: Evidence[],
  caseTitle: string,
  defendantName?: string,
  trialType: 'judge' | 'jury' = 'judge'
): Promise<VerdictResult> {
  const transcript = generateTranscript(events);
  const evidenceCitations = extractEvidenceCitations(events);
  const submittedEvidence = evidence.filter(e =>
    evidenceCitations.includes(e.exhibit_label || e.id)
  );

  const evidenceList = submittedEvidence
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}${e.description ? ` - ${e.description}` : ''}`)
    .join('\n');

  const isJuryTrial = trialType === 'jury';

  const roleDescription = isJuryTrial
    ? `You are the JURY FOREPERSON delivering the jury's unanimous verdict after deliberation.
You represent 12 jurors who have listened to all testimony and reviewed all evidence.
Your verdict must reflect the collective judgment of ordinary citizens, not legal experts.
Jurors are swayed by emotional appeals, witness credibility, and clear storytelling — not just legal technicalities.`
    : `You are a JUDGE delivering a bench trial verdict.
You are a seasoned legal professional who evaluates cases strictly on legal merit.
You focus on admissible evidence, legal standards, and procedural correctness.
You are not swayed by emotional appeals — only facts and law matter.`;

  const standardDescription = isJuryTrial
    ? `Apply the "beyond a reasonable doubt" standard as an ordinary citizen would understand it.
Consider: Did the prosecution tell a compelling, believable story? Were the witnesses credible?
Did the defense raise genuine doubt, or did they fail to challenge the prosecution's case?`
    : `Apply the "beyond a reasonable doubt" standard with legal precision.
Consider: Was each element of the charge proven? Was the evidence properly admitted?
Were there procedural issues that undermine the prosecution's case?`;

  const prompt = `${roleDescription}

CASE: ${caseTitle}
${defendantName ? `DEFENDANT: ${defendantName}` : ''}
TRIAL TYPE: ${isJuryTrial ? 'Jury Trial (12 jurors deliberating)' : 'Bench Trial (Judge decides)'}

COURT TRANSCRIPT:
${transcript.substring(0, 8000)}${transcript.length > 8000 ? '\n[... transcript continues ...]' : ''}

EVIDENCE SUBMITTED DURING TRIAL:
${evidenceList || 'No evidence was formally submitted.'}

DECISION STANDARD:
${standardDescription}

GUARD AGAINST UNSUPPORTED OR CONTRADICTORY CLAIMS — this applies to your entire review of the transcript above, whether you are the judge or the jury:
- Attorneys' statements — opening, closing, and the framing of their questions — are ARGUMENT, not evidence. Only witness testimony and submitted evidence in the transcript are evidence. Do not treat something as an established fact just because a lawyer asserted it or embedded it in a question; check whether it is actually backed by testimony or evidence in the transcript above.
- Check witness testimony against itself: if a witness's answer contradicts something they said earlier in their own testimony in this transcript, that contradiction damages their credibility — weigh it accordingly, whether or not either side raised an objection to it at the time.
- Check testimony against the submitted evidence: if an account conflicts with what an admitted exhibit actually shows, weigh that conflict against the account that conflicts with it.
- If a claim was never actually tested — no evidence or testimony in the transcript supports it, and no witness was asked about it — do not treat it as proven either way, no matter how confidently or repeatedly it was asserted by either side.
- You have access to nothing beyond the transcript and evidence reproduced above. Do not fill in gaps with outside assumptions about what "probably" happened.

INSTRUCTIONS:
1. Review ONLY the court transcript and evidence submitted during trial
2. Do NOT consider any information outside the transcript
3. ${isJuryTrial ? 'As the jury, determine if the prosecution proved its case beyond a reasonable doubt' : 'As the judge, determine if the prosecution met its burden of proof'}
4. Provide a clear verdict: "win" (guilty) or "lose" (not guilty) or "partial" (some charges)
5. ${isJuryTrial ? 'Explain the jury\'s reasoning — what convinced or failed to convince the jurors, including any contradictions or unsupported claims that affected how much weight testimony was given' : 'Explain your legal reasoning citing specific evidence and testimony, including any contradictions or unsupported claims that affected how much weight testimony was given'}
6. Cite specific evidence that influenced the decision
7. Assign a score (0-100) based on prosecution's case strength

RESPOND WITH VALID JSON:
{
  "outcome": "win" or "lose" or "partial",
  "reasoning": "${isJuryTrial ? 'The jury finds...' : 'The Court finds...'} [Detailed explanation]",
  "evidence_cited": ["Exhibit A", "Exhibit B"],
  "score": 75
}`;

  try {
    const response = await generateAIResponse({
      system: prompt,
      user: isJuryTrial ? 'Deliver the jury\'s verdict now.' : 'Deliver your verdict now.',
      responseFormat: 'json',
      temperature: isJuryTrial ? 0.5 : AGENT_TEMPERATURES.verdict, // Jury slightly more variable
      maxTokens: 2000
    });

    return parseVerdictResponse(response.text, evidenceCitations);
  } catch (error) {
    console.error('[Verdict AI] Error generating verdict:', error);
    return {
      // 'partial' keeps this neutral rather than silently defaulting to
      // "not guilty", which — via the player-relative win/loss mapping —
      // would always count as a win for defense players and a loss for
      // prosecution players on every AI failure.
      outcome: 'partial',
      reasoning: isJuryTrial
        ? 'The jury was unable to reach a verdict. A mistrial is declared.'
        : 'An error occurred while generating the verdict. The Court makes its ruling based on the available evidence.',
      evidence_cited: evidenceCitations,
      score: 50
    };
  }
}

// ============================================================================
// TRANSCRIPT UTILITIES
// ============================================================================

/**
 * Build recent transcript summary from trial events
 */
export function buildTranscriptSummary(
  events: Array<{ speaker_role: string; speaker_name?: string; content: string; timestamp: string }>,
  maxEntries: number = 12
): string {
  if (events.length === 0) return 'No recent activity.';

  const recentEvents = events.slice(-maxEntries);
  return recentEvents
    .map(e => {
      const speaker = e.speaker_name || e.speaker_role;
      return `[${speaker.toUpperCase()}] ${e.content.substring(0, 100)}${e.content.length > 100 ? '...' : ''}`;
    })
    .join('\n');
}

// ============================================================================
// CORE AI GENERATION
// ============================================================================

/**
 * Core AI response generator (model-agnostic)
 */
async function generateAIResponse(request: AIRequest): Promise<AIResponse> {
  const provider = getAIProvider();
  
  if (!provider) {
    throw new Error('No AI provider available. Please configure an AI provider in environment variables.');
  }

  if (!provider.isAvailable()) {
    throw new Error(`AI provider ${provider.name} is not available. Check API key configuration.`);
  }

  try {
    return await provider.generate(request);
  } catch (error: any) {
    console.error(`[TrialAI] Error generating response:`, error);
    throw error;
  }
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildJudgeOpeningPrompt(context: JudgeContext): string {
  return `You are ${context.judgeName}, a stern and formal Judge presiding over a courtroom trial.

PERSONALITY: You are authoritative, measured, and impartial. You speak with gravitas and economy of words. You do not tolerate disruption.

${getJudgeDifficultyModifier(context.difficulty)}

CASE: ${context.caseTitle}
PROSECUTOR: ${context.prosecutorName}

Your task is to formally request the prosecution to deliver their opening statement.

Guidelines:
- Be formal and authoritative
- Keep it brief (1-2 sentences)
- Use proper courtroom language
- Address the prosecutor by title

Generate a single sentence requesting the prosecution's opening statement.`;
}

function buildJudgeInstructionPrompt(context: JudgeContext): string {
  const { judgeName, caseTitle, nextPhaseName, nextPhaseType, recent_transcript, difficulty } = context;
  
  let instructionGuidance = '';
  if (nextPhaseType === 'prosecution') {
    instructionGuidance = 'Instruct the prosecution to proceed. Be brief and direct.';
  } else if (nextPhaseType === 'defense') {
    instructionGuidance = 'Instruct the defense to proceed. Be brief and direct.';
  } else if (nextPhaseType === 'witness') {
    instructionGuidance = 'Instruct counsel to call their witness or proceed with examination.';
  } else if (nextPhaseType === 'closing') {
    instructionGuidance = 'Instruct counsel to deliver their closing statement.';
  } else {
    instructionGuidance = 'Provide instruction for the next phase.';
  }
  
  return `You are ${judgeName}, a stern and formal Judge.

PERSONALITY: Authoritative, measured, impartial. You control the courtroom with economy of words.

${getJudgeDifficultyModifier(difficulty)}

CASE: ${caseTitle}
NEXT PHASE: ${nextPhaseName || 'Next trial phase'}

${recent_transcript ? `RECENT TRANSCRIPT (last 12 entries):\n${recent_transcript}\n` : ''}

Your task: ${instructionGuidance}

Keep it to 1-2 sentences. Use proper courtroom language. Address counsel by role.`;
}

function buildJudgeObjectionPrompt(context: JudgeContext): string {
  const obj = context.objectionContext!;
  
  return `You are ${context.judgeName}, a stern and impartial Judge.

PERSONALITY: You rule consistently based on legal standards. You do not explain at length — your rulings are decisive.

${getJudgeDifficultyModifier(context.difficulty)}

An objection has been raised during the trial. You must rule on it.

OBJECTION DETAILS:
- Objection by: ${obj.objection_by}
- Reason: ${obj.objection_reason}
- Questioned statement: "${obj.questioned_statement}"

RECENT TRANSCRIPT:
${obj.recent_transcript || 'No recent activity.'}

COMMON OBJECTION TYPES:
- Leading question: Questions that suggest the answer
- Hearsay: Out-of-court statements offered for truth
- Speculation: Witness guessing or speculating
- Relevance: Question not relevant to the case
- Argumentative: Question is argumentative rather than seeking facts

RULES:
- Rule either "sustained" or "overruled"
- Provide brief reasoning (1-2 sentences max)
- Be fair and consistent with legal standards
- Respond ONLY in valid JSON format${context.practiceMode ? `

PRACTICE MODE: This player is learning. Instead of 1-2 sentences, give a
teaching-oriented explanation (3-4 sentences): name the underlying rule
of evidence or procedure, explain in plain English why it applies (or
doesn't) here, and note what the objecting side would need to show for
a different outcome next time.` : ''}

RESPOND WITH VALID JSON:
{
  "ruling": "sustained" or "overruled",
  "reasoning": "Brief explanation"
}`;
}

function buildProsecutionOpeningPrompt(context: ProsecutionOpeningContext): string {
  const timeLimit = context.timeLimitMinutes;
  const isDefense = context.side === 'defense';
  const evidenceList = context.availableEvidence
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}${e.description ? ` - ${e.description}` : ''}`)
    .join('\n');
  const witnessList = context.availableWitnesses
    .map(w => `- ${w.name} (${w.role})`)
    .join('\n');

  return `You are ${context.prosecutorName}, ${isDefense ? 'a sharp and confident Defense Attorney' : 'an aggressive and confident Prosecutor'}.

PERSONALITY: ${isDefense
    ? 'You are composed, persuasive, and protective of your client. You speak with conviction and build a compelling counter-narrative that raises reasonable doubt. You are strategic about which facts to emphasize.'
    : 'You are forceful, persuasive, and relentless. You speak with conviction and build a compelling narrative. You are strategic about which facts to emphasize.'}

${getProsecutionDifficultyModifier(context.difficulty)}

CASE: ${context.caseTitle}
${context.defendantName ? `DEFENDANT: ${context.defendantName}` : ''}

CASE DESCRIPTION:
${context.caseDescription}

CRITICAL INVESTIGATION FINDINGS - YOU MUST USE THIS INFORMATION:
${context.investigationEvidenceSummary}

CRITICAL INVESTIGATION FINDINGS - WITNESS STATEMENTS YOU MUST REFERENCE:
${context.investigationWitnessTranscripts}

YOUR TASK: Deliver a comprehensive opening statement that SPECIFICALLY REFERENCES the investigation findings above.

TIME LIMIT: ${timeLimit} ${timeLimit === 1 ? 'minute' : 'minutes'}

AVAILABLE EVIDENCE:
${evidenceList || 'No evidence listed yet.'}

AVAILABLE WITNESSES:
${witnessList || 'No witnesses listed yet.'}

MANDATORY REQUIREMENTS:
${isDefense
    ? '- DO NOT use generic statements like "my client is innocent"\n- SPECIFICALLY REFERENCE evidence from the INVESTIGATION FINDINGS section that supports your client\n- MENTION specific witness statements and what they said\n- Begin directly with substantive content (no greetings)\n- Be professional but composed and persuasive\n- Outline the defense\'s theory of the case using SPECIFIC investigation details, focused on reasonable doubt'
    : '- DO NOT use generic statements like "we will show the defendant is guilty"\n- SPECIFICALLY REFERENCE evidence from the INVESTIGATION FINDINGS section\n- MENTION specific witness statements and what they said\n- Begin directly with substantive content (no greetings)\n- Be professional but forceful and persuasive\n- Outline the prosecution\'s theory of the case using SPECIFIC investigation details'}
- Keep it comprehensive but focused — aim for 2-4 paragraphs`;
}

function buildClosingArgumentPrompt(context: ClosingArgumentContext): string {
  const timeLimit = context.timeLimitMinutes;
  const isDefense = context.side === 'defense';
  const evidenceList = context.evidenceSubmitted
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}`)
    .join('\n');
  const witnessList = context.witnessesCalled
    .map(w => `- ${w.name}`)
    .join('\n');

  return `You are ${context.prosecutorName}, ${isDefense ? 'a sharp and confident Defense Attorney' : 'an aggressive and confident Prosecutor'}, delivering your CLOSING ARGUMENT.

PERSONALITY: ${isDefense
    ? 'You are composed, persuasive, and protective of your client. You speak with conviction, arguing that the prosecution failed to meet its burden of proof.'
    : 'You are forceful, persuasive, and relentless. You speak with conviction, arguing that the evidence and testimony together prove guilt beyond a reasonable doubt.'}

${getProsecutionDifficultyModifier(context.difficulty)}

CASE: ${context.caseTitle}
${context.defendantName ? `DEFENDANT: ${context.defendantName}` : ''}

CASE DESCRIPTION:
${context.caseDescription}

WHAT ACTUALLY HAPPENED AT TRIAL — YOU MUST BUILD YOUR ARGUMENT FROM THIS, NOT FROM THE PRE-TRIAL THEORY OF THE CASE:
${context.trialTranscriptSummary || 'No trial activity was recorded.'}

EVIDENCE ACTUALLY SUBMITTED AT TRIAL:
${evidenceList || 'No evidence was formally submitted during the trial.'}

WITNESSES WHO ACTUALLY TESTIFIED:
${witnessList || 'No witnesses were called during the trial.'}

TIME LIMIT: ${timeLimit} ${timeLimit === 1 ? 'minute' : 'minutes'}

YOUR TASK: Deliver a closing argument that argues from what actually happened at trial above — this is a summation, not a preview. Do not say things like "we will show" or "we will prove"; the evidence and testimony have already been presented. Reference specific testimony and evidence from the transcript above.

MANDATORY REQUIREMENTS:
${isDefense
    ? '- SPECIFICALLY REFERENCE testimony and evidence from the trial transcript above\n- Point out gaps, inconsistencies, or reasonable doubt raised during the actual testimony\n- If a witness said something damaging to the defense, address it directly rather than ignoring it\n- Begin directly with substantive content (no greetings)\n- Be professional but composed and persuasive\n- Do not introduce new evidence or witnesses that were not part of the trial'
    : '- SPECIFICALLY REFERENCE testimony and evidence from the trial transcript above\n- Tie the actual testimony and evidence together into a coherent case for guilt beyond a reasonable doubt\n- If a witness said something damaging to the prosecution, address it directly rather than ignoring it\n- Begin directly with substantive content (no greetings)\n- Be professional but forceful and persuasive\n- Do not introduce new evidence or witnesses that were not part of the trial'}
- Keep it comprehensive but focused — aim for 2-4 paragraphs`;
}

function buildProsecutionPrompt(context: ProsecutionContext): string {
  const maxWitnesses = context.trial_duration === 15 ? 1 : context.trial_duration === 30 ? 2 : 3;
  const isDefense = context.side === 'defense';

  return `You are the ${isDefense ? 'Defense' : 'Prosecution'} in a courtroom trial.

PERSONALITY: ${isDefense
    ? 'You are sharp, protective, and methodical. Your goal is to create reasonable doubt and protect your client — you look for weaknesses in the case against them and use evidence to support their innocence.'
    : 'You are aggressive, strategic, and thorough. You press advantages relentlessly and use evidence methodically to build your case.'}

${getProsecutionDifficultyModifier(context.difficulty)}

TRIAL CONFIGURATION:
- Trial Duration: ${context.trial_duration} minutes
- Maximum Witnesses to Call: ${maxWitnesses}
- Witnesses Called So Far: ${context.witnesses_called_count}

WITNESS CALLING STRATEGY:
- For ${context.trial_duration}-minute trials, call up to ${maxWitnesses} witness(es)
- Call witnesses during "Direct Examination" phases when no witness is on stand
- After calling all witnesses, focus on asking questions and submitting evidence

RULES:
- You may perform ONE action at a time.
- Ask ONE question per action, but there is NO limit on how many questions you may ask in total. Keep asking follow-up questions on successive actions for as long as time remains and your line of questioning is productive.
- During witness examination, use the time you have: probe inconsistencies, pin down details, and follow up on the witness's last answer. Only choose "rest" (or "end_phase") once you genuinely have nothing further worth asking or time is nearly out. Do not repeat a question you already asked.
- You may submit only evidence listed as available.
- Respond ONLY in valid JSON format.

CURRENT CONTEXT:
- Phase: ${context.phase}
- Time Remaining: ${Math.floor(context.time_remaining_seconds / 60)}m ${context.time_remaining_seconds % 60}s
${context.current_witness ? `- Current Witness: ${context.current_witness}` : '- No witness currently on stand'}

AVAILABLE WITNESSES:
${context.available_witnesses.map(w => `- ${w.name} (ID: ${w.id})`).join('\n')}

AVAILABLE EVIDENCE:
${context.available_evidence.map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title} (ID: ${e.id})`).join('\n')}

RECENT TRANSCRIPT:
${context.recent_transcript || 'No recent activity.'}

ALLOWED ACTIONS:
${context.allowed_actions.map(a => `- ${a.action}: ${a.description}`).join('\n')}

RESPOND WITH VALID JSON ONLY. Choose ONE of the allowed actions.
Response format examples:
{"action": "ask_question", "content": "Where were you on the night of July 4th?"}
{"action": "submit_evidence", "evidence_id": "evidence-id-here"}
{"action": "call_witness", "witness_name": "Witness Name"}
{"action": "end_phase"}
{"action": "rest"}`;
}

function buildWitnessPrompt(context: WitnessContext): string {
  const { witness, previousInteractions } = context;
  const personality = witness.personality_traits as any || {};
  
  let prompt = `You are ${witness.name}, a witness in a legal case. Your role is: ${witness.role}.

PERSONALITY: `;

  // Build personality description
  const traits: string[] = [];
  if (personality.cooperative !== false) traits.push('cooperative');
  if (personality.defensive) traits.push('defensive and guarded');
  if (personality.detail_oriented) traits.push('precise and detail-oriented');
  if (personality.helpful) traits.push('helpful and forthcoming');
  if (personality.nervous) traits.push('nervous and fidgety');
  if (personality.hostile) traits.push('hostile and reluctant');
  const isDeceptive = personality.deceptive === true;
  prompt += traits.length > 0 ? traits.join(', ') : 'neutral';
  prompt += '.\n\n';

  if (witness.background) {
    prompt += `Your background (for context only): ${witness.background}\n\n`;
  }

  const scope = witness.knowledge_scope;
  const scopeCount = scope
    ? (scope.known_facts?.length ?? 0) + (scope.hidden_knowledge?.length ?? 0) +
      (scope.partial_knowledge?.length ?? 0) + (scope.unknown_information?.length ?? 0) +
      (scope.incorrect_beliefs?.length ?? 0) + (scope.secrets?.length ?? 0) +
      (scope.motivated_omissions?.length ?? 0) + (scope.personal_opinions?.length ?? 0) +
      (scope.suspicions?.length ?? 0)
    : 0;
  const hasStructuredScope = scopeCount > 0;

  if (hasStructuredScope && scope) {
    // Structured knowledge model — testimony is generated from distinct
    // knowledge states rather than one flat block of text, so what comes
    // out under questioning depends on HOW something is asked, not just
    // WHETHER it's covered.
    prompt += `═══════════════════════════════════════════════════════════
YOUR KNOWLEDGE — THIS IS YOUR ONLY SOURCE OF INFORMATION
You CANNOT add facts beyond what is listed here, under any category.
═══════════════════════════════════════════════════════════

`;

    const section = (label: string, items?: string[]) => {
      if (items && items.length > 0) {
        prompt += `${label}:\n${items.map(i => `- ${i}`).join('\n')}\n\n`;
      }
    };

    section('THINGS YOU KNOW AND WILL SAY NATURALLY when relevantly asked', scope.known_facts);
    section('THINGS YOU KNOW BUT WILL ONLY REVEAL IF SPECIFICALLY, SKILLFULLY ASKED — do not volunteer these from a general or open-ended question', scope.hidden_knowledge);
    section('THINGS YOU ONLY PARTLY KNOW — answer with only the part you actually know; do not fill in the rest', scope.partial_knowledge);
    section('THINGS YOU SINCERELY BELIEVE BUT ARE ACTUALLY WRONG ABOUT — state these with genuine confidence, you do not know you are mistaken', scope.incorrect_beliefs);
    section('YOUR PERSONAL OPINIONS about what happened — offer these as opinion ("I think", "it seemed to me"), never as established fact', scope.personal_opinions);
    section('THINGS YOU SUSPECT BUT CANNOT PROVE — hedge if you raise these at all ("I couldn\'t say for sure, but...")', scope.suspicions);
    section('SECRETS YOU ARE RELUCTANT TO REVEAL — when approached, evade, deflect, or minimize rather than confirming outright, unless directly and convincingly confronted', scope.secrets);
    section('THINGS YOU ARE DELIBERATELY LEAVING OUT — do not mention unless directly confronted with evidence or a very pointed question that leaves no room to avoid it', scope.motivated_omissions);
    section('THINGS YOU GENUINELY DO NOT KNOW — this is the ONLY category where "I don\'t know" is the honest, correct answer', scope.unknown_information);
    section('EVIDENCE YOU RECOGNIZE and can speak to if shown', scope.evidence_recognized);
    section('EVIDENCE YOU CAN AUTHENTICATE', scope.evidence_can_authenticate);

    if (witness.base_testimony) {
      prompt += `ADDITIONAL CONTEXT / STYLE (not a source of new facts beyond what's listed above):\n${witness.base_testimony}\n\n`;
    }
  } else if (witness.base_testimony) {
    // Fallback for witnesses without a structured knowledge_scope — the
    // flat testimony is the only source of truth.
    prompt += `═══════════════════════════════════════════════════════════
YOUR WRITTEN TESTIMONY — THIS IS YOUR ONLY SOURCE OF INFORMATION
You CANNOT add facts or details beyond what is written here.
═══════════════════════════════════════════════════════════
${witness.base_testimony}\n\n`;
  } else {
    prompt += `WARNING: You have no written testimony or knowledge on record. You genuinely have nothing to add beyond what's already been said in court.\n\n`;
  }

  if (previousInteractions.length > 0) {
    prompt += `Previous questions and your answers:\n`;
    previousInteractions.forEach((interaction, index) => {
      prompt += `${index + 1}. Q: ${interaction.question}\n   A: ${interaction.response}\n`;
    });
    prompt += '\n';
  }

  prompt += `CRITICAL INSTRUCTIONS:
1. ONLY answer based on the knowledge above. No new facts, ever — not even small, plausible-sounding filler details.
2. Match your answer to the RIGHT category above — don't treat hidden knowledge or secrets as freely offerable, and don't treat something you only partly know as something you know in full.
3. "I don't know" / "I don't recall" is ONLY the honest answer for things in your genuinely-unknown category. It is NOT a catch-all for anything inconvenient or anything not explicitly listed — for hidden knowledge or secrets, evade or deflect in character instead of flatly denying knowledge; for things outside your knowledge entirely, say plainly that you can't speak to that and why (wasn't there, not your area, etc.).
4. If a question contains a false premise or misstates a fact, correct the premise rather than answering as if it were true.
5. If a question mischaracterizes something you said earlier, correct the characterization rather than letting it stand.
${isDeceptive ? '6. You are willing to actively mislead, not just withhold, when it serves you — but stay internally consistent with anything you\'ve already said.' : '6. You may be reluctant or evasive about secrets and hidden knowledge, but you do not state things you know to be false.'}
7. Stay in character with your personality traits throughout.
8. Be consistent with your own previous answers in this trial.
9. Keep responses concise and natural, as if speaking in court — not a list, a spoken answer.`;

  return prompt;
}

// ============================================================================
// RESPONSE PARSERS
// ============================================================================

function parseObjectionRuling(text: string): ObjectionRuling {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.ruling === 'sustained' || parsed.ruling === 'overruled') {
        return {
          ruling: parsed.ruling,
          reasoning: parsed.reasoning || 'The Court has considered the objection and makes its ruling.'
        };
      }
    } catch (error) {
      console.error('[Judge AI] Failed to parse objection ruling JSON:', error);
    }
  }

  const lowerText = text.toLowerCase();
  const isSustained = lowerText.includes('sustained') || 
                      lowerText.includes('granted') ||
                      lowerText.includes('objection is valid');

  return {
    ruling: isSustained ? 'sustained' : 'overruled',
    reasoning: text.substring(0, 200) || 'The Court has considered the objection and makes its ruling.'
  };
}

function parseProsecutionAction(text: string, allowedActions: AllowedAction[]): ProsecutionAction {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const isValidAction = allowedActions.some(a => a.action === parsed.action);
      if (isValidAction) {
        return parsed as ProsecutionAction;
      }
    } catch (error) {
      console.error('[Prosecution AI] Failed to parse action JSON:', error);
    }
  }

  // Fallback: infer from text
  const lowerText = text.toLowerCase();
  if (lowerText.includes('question') || lowerText.includes('ask')) {
    return { action: 'ask_question', content: text.substring(0, 200) };
  }
  if (lowerText.includes('evidence') || lowerText.includes('exhibit')) {
    return { action: 'submit_evidence', evidence_id: '' };
  }
  if (lowerText.includes('end') || lowerText.includes('conclude')) {
    return { action: 'end_phase' };
  }

  // Prefer ask_question > submit_evidence > end_phase
  const preferredActions = ['ask_question', 'submit_evidence', 'end_phase', 'rest'];
  for (const preferred of preferredActions) {
    const action = allowedActions.find(a => a.action === preferred);
    if (action) return { action: action.action };
  }

  return { action: allowedActions[0]?.action || 'end_phase' };
}

function parseVerdictResponse(text: string, evidenceCitations: string[]): VerdictResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const validOutcomes = ['win', 'lose', 'partial'];
      const outcome = validOutcomes.includes(parsed.outcome) ? parsed.outcome : 'partial';

      return {
        outcome: outcome as 'win' | 'lose' | 'partial',
        reasoning: parsed.reasoning || 'The Court has reviewed the evidence and testimony.',
        evidence_cited: Array.isArray(parsed.evidence_cited) ? parsed.evidence_cited : evidenceCitations,
        score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50
      };
    } catch (error) {
      console.error('[Verdict AI] Failed to parse JSON:', error);
    }
  }

  const lowerText = text.toLowerCase();
  let outcome: 'win' | 'lose' | 'partial' = 'partial';
  if (lowerText.includes('not guilty') || lowerText.includes('not proven')) outcome = 'lose';
  else if (lowerText.includes('guilty') || lowerText.includes('proven')) outcome = 'win';
  else if (lowerText.includes('partial')) outcome = 'partial';

  return {
    outcome,
    reasoning: text.substring(0, 1000) || 'The Court has reviewed the evidence and testimony.',
    evidence_cited: evidenceCitations,
    score: 50
  };
}
