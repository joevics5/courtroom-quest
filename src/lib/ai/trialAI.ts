/**
 * Unified Trial AI Service
 * Each role (judge, prosecution, witness, verdict) acts as a separate AI agent
 * with distinct personality, temperature, and system prompt.
 */

import { getAIProvider } from './providerFactory';
import type { AIRequest, AIResponse } from './types';
import type { TurnState, AllowedAction } from '../trialTurnSystem';
import type { Witness, TrialEvent, Evidence } from '../../types';
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
  }
): Promise<ObjectionRuling> {
  const judgeContext: JudgeContext = {
    caseTitle: '',
    judgeName: 'The Court',
    prosecutorName: 'Prosecution',
    phase: 'objection_ruling',
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
  phase: string;
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
 */
export async function generateVerdict(
  events: TrialEvent[],
  evidence: Evidence[],
  caseTitle: string,
  defendantName?: string
): Promise<VerdictResult> {
  const transcript = generateTranscript(events);
  const evidenceCitations = extractEvidenceCitations(events);
  const submittedEvidence = evidence.filter(e =>
    evidenceCitations.includes(e.exhibit_label || e.id)
  );

  const evidenceList = submittedEvidence
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}${e.description ? ` - ${e.description}` : ''}`)
    .join('\n');

  const prompt = `You are a Judge delivering a verdict in a courtroom trial.

CASE: ${caseTitle}
${defendantName ? `DEFENDANT: ${defendantName}` : ''}

COURT TRANSCRIPT:
${transcript.substring(0, 8000)}${transcript.length > 8000 ? '\n[... transcript continues ...]' : ''}

EVIDENCE SUBMITTED DURING TRIAL:
${evidenceList || 'No evidence was formally submitted.'}

INSTRUCTIONS:
1. Review ONLY the court transcript and evidence submitted during trial
2. Do NOT consider any information outside the transcript
3. Determine if the prosecution has proven its case beyond a reasonable doubt
4. Provide a clear verdict: "win" (guilty) or "lose" (not guilty) or "partial" (some charges)
5. Explain your reasoning based on the transcript
6. Cite specific evidence that influenced your decision
7. Assign a score (0-100) based on prosecution's case strength

RESPOND WITH VALID JSON:
{
  "outcome": "win" or "lose" or "partial",
  "reasoning": "Detailed explanation of your verdict based on the transcript and evidence",
  "evidence_cited": ["Exhibit A", "Exhibit B"],
  "score": 75
}`;

  try {
    const response = await generateAIResponse({
      system: prompt,
      user: 'Deliver your verdict now.',
      responseFormat: 'json',
      temperature: AGENT_TEMPERATURES.verdict,
      maxTokens: 2000
    });

    return parseVerdictResponse(response.text, evidenceCitations);
  } catch (error) {
    console.error('[Verdict AI] Error generating verdict:', error);
    return {
      outcome: 'lose',
      reasoning: 'An error occurred while generating the verdict. The Court makes its ruling based on the available evidence.',
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
  const { judgeName, caseTitle, nextPhaseName, nextPhaseType, recent_transcript } = context;
  
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
- Respond ONLY in valid JSON format

RESPOND WITH VALID JSON:
{
  "ruling": "sustained" or "overruled",
  "reasoning": "Brief explanation"
}`;
}

function buildProsecutionOpeningPrompt(context: ProsecutionOpeningContext): string {
  const timeLimit = context.timeLimitMinutes;
  const evidenceList = context.availableEvidence
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}${e.description ? ` - ${e.description}` : ''}`)
    .join('\n');
  const witnessList = context.availableWitnesses
    .map(w => `- ${w.name} (${w.role})`)
    .join('\n');

  return `You are ${context.prosecutorName}, an aggressive and confident Prosecutor.

PERSONALITY: You are forceful, persuasive, and relentless. You speak with conviction and build a compelling narrative. You are strategic about which facts to emphasize.

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
- DO NOT use generic statements like "we will show the defendant is guilty"
- SPECIFICALLY REFERENCE evidence from the INVESTIGATION FINDINGS section
- MENTION specific witness statements and what they said
- Begin directly with substantive content (no greetings)
- Be professional but forceful and persuasive
- Outline the prosecution's theory of the case using SPECIFIC investigation details
- Keep it comprehensive but focused — aim for 2-4 paragraphs`;
}

function buildProsecutionPrompt(context: ProsecutionContext): string {
  const maxWitnesses = context.trial_duration === 15 ? 1 : context.trial_duration === 30 ? 2 : 3;

  return `You are the Prosecution in a courtroom trial.

PERSONALITY: You are aggressive, strategic, and thorough. You press advantages relentlessly and use evidence methodically to build your case.

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
- You may ask only ONE question per turn.
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
  prompt += traits.length > 0 ? traits.join(', ') : 'neutral';
  prompt += '.\n\n';

  if (witness.background) {
    prompt += `Your background (for context only): ${witness.background}\n\n`;
  }

  if (witness.base_testimony) {
    prompt += `═══════════════════════════════════════════════════════════
YOUR WRITTEN TESTIMONY — THIS IS YOUR ONLY SOURCE OF INFORMATION
You CANNOT add facts or details beyond what is written here.
═══════════════════════════════════════════════════════════
${witness.base_testimony}\n\n`;
  } else {
    prompt += `WARNING: You have no written testimony. You can only say "I don't recall."\n\n`;
  }

  if (previousInteractions.length > 0) {
    prompt += `Previous questions and your answers:\n`;
    previousInteractions.forEach((interaction, index) => {
      prompt += `${index + 1}. Q: ${interaction.question}\n   A: ${interaction.response}\n`;
    });
    prompt += '\n';
  }

  prompt += `CRITICAL INSTRUCTIONS:
1. ONLY answer based on your WRITTEN TESTIMONY above. No new facts.
2. If asked about something NOT in your testimony: "I don't recall that."
3. You can rephrase or clarify testimony, but CANNOT add information.
4. Stay in character with your personality traits.
5. Be consistent with previous answers.
6. Keep responses concise and natural, as if speaking in court.
7. DO NOT invent or speculate beyond your testimony.`;

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
      const outcome = validOutcomes.includes(parsed.outcome) ? parsed.outcome : 'lose';

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
  let outcome: 'win' | 'lose' | 'partial' = 'lose';
  if (lowerText.includes('guilty') || lowerText.includes('proven')) outcome = 'win';
  else if (lowerText.includes('partial')) outcome = 'partial';

  return {
    outcome,
    reasoning: text.substring(0, 1000) || 'The Court has reviewed the evidence and testimony.',
    evidence_cited: evidenceCitations,
    score: 50
  };
}
