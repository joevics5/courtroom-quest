import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AllowedAction } from './trialTurnSystem';

interface ProsecutionContext {
  role: 'prosecution';
  phase: string;
  time_remaining_seconds: number;
  current_witness: string | null;
  available_witnesses: Array<{ id: string; name: string }>;
  available_evidence: Array<{ id: string; exhibit_label?: string; title: string }>;
  recent_transcript: string; // Last 12 transcript entries summarized
  allowed_actions: AllowedAction[];
  trial_duration: number; // in minutes (15, 30, 60)
  witnesses_called_count: number; // how many witnesses have been called so far
}

interface ProsecutionAction {
  action: string;
  content?: string;
  witness_name?: string;
  evidence_id?: string;
}

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not found. Prosecution AI will not function.');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate prosecution action based on limited context
 */
export async function generateProsecutionAction(
  context: ProsecutionContext
): Promise<ProsecutionAction> {
  const client = getGeminiClient();

  if (!client) {
    // Fallback: return a default action
    return getFallbackAction(context);
  }

  try {
    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
    let model;
    let text = '';

    for (const modelName of modelNames) {
      try {
        console.log(`[Prosecution AI] Attempting to use model: ${modelName}`);
        model = client.getGenerativeModel({ model: modelName });
        const prompt = buildProsecutionPrompt(context);
        const result = await model.generateContent(prompt);
        text = result.response.text();
        console.log(`[Prosecution AI] Successfully got response from ${modelName}`);
        break;
      } catch (error: any) {
        console.warn(`[Prosecution AI] Model ${modelName} failed: ${error.message}`);
        if (modelName === modelNames[modelNames.length - 1]) {
          throw new Error(`All model attempts failed. Last error: ${error.message}`);
        }
      }
    }

    // Parse JSON response
    const action = parseProsecutionResponse(text, context.allowed_actions);
    return action;
  } catch (error: any) {
    console.error('[Prosecution AI] Error generating action:', error);
    return getFallbackAction(context);
  }
}

function buildProsecutionPrompt(context: ProsecutionContext): string {
  // Calculate how many witnesses prosecution should call based on trial duration
  const maxWitnesses = context.trial_duration === 15 ? 1 : context.trial_duration === 30 ? 2 : 3;

  let prompt = `You are the Prosecution in a courtroom trial.

Your objective is to strengthen your case using witness testimony and evidence.

TRIAL CONFIGURATION:
- Trial Duration: ${context.trial_duration} minutes
- Maximum Witnesses to Call: ${maxWitnesses}
- Witnesses Called So Far: ${context.witnesses_called_count}

WITNESS CALLING STRATEGY:
- For ${context.trial_duration}-minute trials, call up to ${maxWitnesses} witness(es)
- Call witnesses during "Direct Examination" phases when no witness is on stand
- After calling all witnesses, focus on asking questions and submitting evidence
- Don't call more witnesses than the trial duration allows

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

RESPOND WITH VALID JSON ONLY. Choose ONE of the allowed actions.

Response format examples:
{
  "action": "ask_question",
  "content": "Where were you on the night of July 4th?"
}

{
  "action": "submit_evidence",
  "evidence_id": "evidence-id-here"
}

{
  "action": "call_witness",
  "witness_name": "Witness Name"
}

{
  "action": "end_phase"
}

{
  "action": "rest"
}

Respond now:`;

  return prompt;
}

function parseProsecutionResponse(
  text: string,
  allowedActions: AllowedAction[]
): ProsecutionAction {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate action is allowed
      const isValidAction = allowedActions.some(a => a.action === parsed.action);
      if (!isValidAction) {
        console.warn(`[Prosecution AI] Invalid action: ${parsed.action}`);
        return getFallbackActionFromAllowed(allowedActions);
      }

      return parsed as ProsecutionAction;
    } catch (error) {
      console.error('[Prosecution AI] Failed to parse JSON:', error);
    }
  }

  // Fallback: try to infer action from text
  const lowerText = text.toLowerCase();
  if (lowerText.includes('question') || lowerText.includes('ask')) {
    return {
      action: 'ask_question',
      content: text.substring(0, 200) // Limit length
    };
  }
  if (lowerText.includes('evidence') || lowerText.includes('exhibit')) {
    return {
      action: 'submit_evidence',
      evidence_id: '' // Will need to be selected
    };
  }
  if (lowerText.includes('end') || lowerText.includes('conclude')) {
    return { action: 'end_phase' };
  }

  return getFallbackActionFromAllowed(allowedActions);
}

function getFallbackAction(context: ProsecutionContext): ProsecutionAction {
  return getFallbackActionFromAllowed(context.allowed_actions);
}

function getFallbackActionFromAllowed(allowedActions: AllowedAction[]): ProsecutionAction {
  // Prefer ask_question, then submit_evidence, then end_phase
  const preferredActions = ['ask_question', 'submit_evidence', 'end_phase', 'rest'];
  
  for (const preferred of preferredActions) {
    const action = allowedActions.find(a => a.action === preferred);
    if (action) {
      return { action: action.action };
    }
  }

  // Last resort: return first allowed action
  if (allowedActions.length > 0) {
    return { action: allowedActions[0].action };
  }

  return { action: 'end_phase' };
}

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





