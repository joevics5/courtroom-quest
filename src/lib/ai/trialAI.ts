/**
 * Unified Trial AI Service
 * Model-agnostic AI service for all trial roles (judge, prosecution, witness)
 */

import { getAIProvider } from './providerFactory';
import type { AIRequest, AIResponse } from './types';
import type { TurnState, AllowedAction } from '../trialTurnSystem';
import type { Witness } from '../../types';

// ============================================================================
// JUDGE AI
// ============================================================================

export interface JudgeContext {
  caseTitle: string;
  judgeName: string;
  prosecutorName: string;
  phase: 'opening_request' | 'objection_ruling' | 'verdict' | 'general' | 'instruction';
  nextPhaseName?: string; // For instruction phase
  nextPhaseType?: 'prosecution' | 'defense' | 'witness' | 'closing';
  objectionContext?: {
    objection_by: 'prosecution' | 'defense';
    objection_reason: string;
    questioned_statement: string;
    recent_transcript: string;
  };
  recent_transcript?: string; // Last 12 transcript entries
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
    temperature: 0.7,
    maxTokens: 50000 // Up to 50,000 tokens for comprehensive judge requests
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
    temperature: 0.7,
    maxTokens: 50000 // Up to 50,000 tokens for comprehensive judge instructions
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
    temperature: 0.6,
    maxTokens: 50000 // Up to 50,000 tokens for comprehensive objection rulings
  });

  return parseObjectionRuling(response.text);
}

// ============================================================================
// PROSECUTION AI
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
    temperature: 0.8,
    maxTokens: Math.min(50000, Math.max(3000, context.timeLimitMinutes * 200)) // Up to 50,000 tokens for comprehensive statements
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
    temperature: 0.7
  });

  return parseProsecutionAction(response.text, context.allowed_actions);
}

// ============================================================================
// WITNESS AI
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
): Promise<string> {
  const prompt = buildWitnessPrompt(context);
  
  const response = await generateAIResponse({
    system: prompt,
    user: context.question,
    temperature: 0.8,
    maxTokens: 50000 // Up to 50,000 tokens for comprehensive witness responses
  });

  return response.text;
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
  return `You are ${context.judgeName}, a Judge presiding over a courtroom trial.

CASE: ${context.caseTitle}
PROSECUTOR: ${context.prosecutorName}

Your task is to formally request the prosecution to deliver their opening statement.

Guidelines:
- Be formal and authoritative
- Keep it brief and professional
- Use proper courtroom language
- Address the prosecutor by name or title

Generate a single sentence requesting the prosecution's opening statement.`;
}

function buildJudgeInstructionPrompt(context: JudgeContext): string {
  const { judgeName, caseTitle, nextPhaseName, nextPhaseType, recent_transcript } = context;
  
  let instructionGuidance = '';
  if (nextPhaseType === 'prosecution') {
    instructionGuidance = 'Instruct the prosecution to proceed with their action. Be brief and direct.';
  } else if (nextPhaseType === 'defense') {
    instructionGuidance = 'Instruct the defense to proceed with their action. Be brief and direct.';
  } else if (nextPhaseType === 'witness') {
    instructionGuidance = 'Instruct counsel to call their witness or proceed with examination. Be brief and direct.';
  } else if (nextPhaseType === 'closing') {
    instructionGuidance = 'Instruct counsel to deliver their closing statement. Be brief and direct.';
  } else {
    instructionGuidance = 'Provide instruction for the next phase of the trial. Be brief and direct.';
  }
  
  return `You are ${judgeName}, a Judge presiding over a courtroom trial.

CASE: ${caseTitle}
NEXT PHASE: ${nextPhaseName || 'Next trial phase'}

${recent_transcript ? `RECENT TRANSCRIPT (last 12 entries):\n${recent_transcript}\n` : ''}

Your task: ${instructionGuidance}

Guidelines:
- Be formal and authoritative
- Keep it brief (1-2 sentences maximum)
- Use proper courtroom language
- Address counsel by their role (Prosecution/Defense)
- Be direct and clear about what action is expected

Examples:
- "Prosecution, you may proceed with your opening statement."
- "Prosecution, call your first witness."
- "Defense, you may cross-examine the witness."
- "Prosecution, you may deliver your closing argument."

Generate the judge's instruction now:`;
}

function buildJudgeObjectionPrompt(context: JudgeContext): string {
  const obj = context.objectionContext!;
  
  return `You are ${context.judgeName}, a Judge presiding over a courtroom trial.

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
- You must rule either "sustained" (objection granted) or "overruled" (objection denied)
- Provide brief reasoning for your ruling
- Be fair and consistent with legal standards
- Respond ONLY in valid JSON format

RESPOND WITH VALID JSON:
{
  "ruling": "sustained" or "overruled",
  "reasoning": "Brief explanation of your ruling"
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

  return `You are ${context.prosecutorName}, the Prosecution in a courtroom trial.

CASE: ${context.caseTitle}
${context.defendantName ? `DEFENDANT: ${context.defendantName}` : ''}

CASE DESCRIPTION:
${context.caseDescription}

CRITICAL INVESTIGATION FINDINGS - YOU MUST USE THIS INFORMATION:
${context.investigationEvidenceSummary}

CRITICAL INVESTIGATION FINDINGS - WITNESS STATEMENTS YOU MUST REFERENCE:
${context.investigationWitnessTranscripts}

YOUR TASK: Deliver a comprehensive opening statement that SPECIFICALLY REFERENCES the investigation findings above. You MUST mention specific evidence and witness statements from the investigation data provided.

TIME LIMIT: ${timeLimit} ${timeLimit === 1 ? 'minute' : 'minutes'}

AVAILABLE EVIDENCE (you will present these during trial):
${evidenceList || 'No evidence listed yet.'}

AVAILABLE WITNESSES (you will call these during trial):
${witnessList || 'No witnesses listed yet.'}

MANDATORY REQUIREMENTS:
- DO NOT use generic statements like "we will show the defendant is guilty"
- SPECIFICALLY REFERENCE evidence from the INVESTIGATION FINDINGS section
- MENTION specific witness statements and what they said from the WITNESS INTERVIEWS section
- BASE your entire opening statement on the investigation data provided
- If investigation data is empty, then use generic statements, but it should NOT be empty
- Begin directly with substantive content (no greetings)
- Be professional and formal
- Outline the prosecution's theory of the case using SPECIFIC investigation details
- Reference particular evidence exhibits and witness testimony details
- Keep it comprehensive but focused - aim for 2-4 paragraphs
- Be persuasive and evidence-based

Generate your opening statement now. It MUST incorporate the investigation findings:`;
}

function buildProsecutionPrompt(context: ProsecutionContext): string {
  return `You are the Prosecution in a courtroom trial.

Your objective is to strengthen your case using witness testimony and evidence.

RULES:
- You may perform ONE action at a time.
- You may ask only ONE question per turn.
- You may submit only evidence listed as available.
- You may end your phase at any time.
- Do NOT speak outside your role.
- You must respond ONLY in valid JSON format.

CURRENT CONTEXT:
- Phase: ${context.phase}
- Time Remaining: ${Math.floor(context.time_remaining_seconds / 60)} minutes ${context.time_remaining_seconds % 60} seconds
${context.current_witness ? `- Current Witness: ${context.current_witness}` : '- No witness currently on stand'}

AVAILABLE WITNESSES:
${context.available_witnesses.map(w => `- ${w.name} (ID: ${w.id})`).join('\n')}

AVAILABLE EVIDENCE:
${context.available_evidence.map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title} (ID: ${e.id})`).join('\n')}

RECENT TRANSCRIPT:
${context.recent_transcript || 'No recent activity.'}

ALLOWED ACTIONS:
${context.allowed_actions.map(a => `- ${a.action}: ${a.description}`).join('\n')}

RESPOND WITH VALID JSON ONLY. Choose ONE of the allowed actions.`;
}

function buildWitnessPrompt(context: WitnessContext): string {
  const { witness, question, previousInteractions } = context;
  
  let prompt = `You are ${witness.name}, a witness in a legal case. Your role is: ${witness.role}.\n\n`;

  if (witness.background) {
    prompt += `Your background: ${witness.background}\n\n`;
  }

  if (witness.base_testimony) {
    prompt += `Your written testimony: "${witness.base_testimony}"\n\n`;
  }

  prompt += `You must ONLY answer questions based on your provided written testimony. Do NOT introduce any new facts or details not explicitly stated in your testimony. If a question asks for information not in your testimony, respond with "I don't recall" or "That information is not part of my testimony." You can rephrase or clarify parts of your testimony if asked, but do not add new information.\n\n`;

  if (previousInteractions.length > 0) {
    prompt += `Previous questions and your answers:\n`;
    previousInteractions.forEach((interaction, index) => {
      prompt += `Q: ${interaction.question}\n`;
      prompt += `A: ${interaction.response}\n`;
    });
    prompt += '\n';
  }

  prompt += `Current Question: ${question}\n\nAnswer as the witness:`;
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
      console.error('[TrialAI] Failed to parse objection ruling JSON:', error);
    }
  }

  // Fallback
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
      console.error('[TrialAI] Failed to parse prosecution action JSON:', error);
    }
  }

  // Fallback
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

  // Last resort: return first allowed action
  if (allowedActions.length > 0) {
    return { action: allowedActions[0].action };
  }

  return { action: 'end_phase' };
}

