import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TrialEvent, Evidence } from '../types';
import { generateTranscript, extractEvidenceCitations } from './transcriptGenerator';

export interface VerdictResult {
  outcome: 'win' | 'lose' | 'partial';
  reasoning: string;
  evidence_cited: string[];
  score: number;
}

interface VerdictContext {
  caseTitle: string;
  transcript: string;
  evidenceSubmitted: Evidence[];
  defendantName?: string;
}

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not found. Verdict AI will not function.');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate verdict based on transcript and evidence
 */
export async function generateVerdict(
  events: TrialEvent[],
  evidence: Evidence[],
  caseTitle: string,
  defendantName?: string
): Promise<VerdictResult> {
  const client = getGeminiClient();

  if (!client) {
    // Fallback verdict
    return {
      outcome: 'lose',
      reasoning: 'Unable to generate AI verdict. Default ruling based on available evidence.',
      evidence_cited: extractEvidenceCitations(events),
      score: 50
    };
  }

  try {
    const transcript = generateTranscript(events);
    const evidenceCitations = extractEvidenceCitations(events);
    const submittedEvidence = evidence.filter(e => 
      evidenceCitations.includes(e.exhibit_label || e.id)
    );

    const context: VerdictContext = {
      caseTitle,
      transcript,
      evidenceSubmitted: submittedEvidence,
      defendantName
    };

    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
    let model;
    let text = '';

    for (const modelName of modelNames) {
      try {
        console.log(`[Verdict AI] Attempting to use model: ${modelName}`);
        model = client.getGenerativeModel({ model: modelName });
        const prompt = buildVerdictPrompt(context);
        const result = await model.generateContent(prompt);
        text = result.response.text();
        console.log(`[Verdict AI] Successfully got response from ${modelName}`);
        break;
      } catch (error: any) {
        console.warn(`[Verdict AI] Model ${modelName} failed: ${error.message}`);
        if (modelName === modelNames[modelNames.length - 1]) {
          throw new Error(`All model attempts failed. Last error: ${error.message}`);
        }
      }
    }

    // Parse JSON response
    const verdict = parseVerdictResponse(text, evidenceCitations);
    return verdict;
  } catch (error: any) {
    console.error('[Verdict AI] Error generating verdict:', error);
    return {
      outcome: 'lose',
      reasoning: 'An error occurred while generating the verdict. The Court makes its ruling based on the available evidence.',
      evidence_cited: extractEvidenceCitations(events),
      score: 50
    };
  }
}

function buildVerdictPrompt(context: VerdictContext): string {
  const evidenceList = context.evidenceSubmitted
    .map(e => `- ${e.exhibit_label || 'Evidence'}: ${e.title}${e.description ? ` - ${e.description}` : ''}`)
    .join('\n');

  return `You are a Judge delivering a verdict in a courtroom trial.

CASE: ${context.caseTitle}
${context.defendantName ? `DEFENDANT: ${context.defendantName}` : ''}

COURT TRANSCRIPT:
${context.transcript.substring(0, 8000)}${context.transcript.length > 8000 ? '\n[... transcript continues ...]' : ''}

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
}

Respond now:`;
}

function parseVerdictResponse(text: string, evidenceCitations: string[]): VerdictResult {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate outcome
      const validOutcomes = ['win', 'lose', 'partial'];
      const outcome = validOutcomes.includes(parsed.outcome) 
        ? parsed.outcome 
        : 'lose';

      return {
        outcome: outcome as 'win' | 'lose' | 'partial',
        reasoning: parsed.reasoning || 'The Court has reviewed the evidence and testimony.',
        evidence_cited: Array.isArray(parsed.evidence_cited) 
          ? parsed.evidence_cited 
          : evidenceCitations,
        score: typeof parsed.score === 'number' 
          ? Math.max(0, Math.min(100, parsed.score)) 
          : 50
      };
    } catch (error) {
      console.error('[Verdict AI] Failed to parse JSON:', error);
    }
  }

  // Fallback: infer from text
  const lowerText = text.toLowerCase();
  let outcome: 'win' | 'lose' | 'partial' = 'lose';
  if (lowerText.includes('guilty') || lowerText.includes('proven') || lowerText.includes('convict')) {
    outcome = 'win';
  } else if (lowerText.includes('partial') || lowerText.includes('some')) {
    outcome = 'partial';
  }

  return {
    outcome,
    reasoning: text.substring(0, 1000) || 'The Court has reviewed the evidence and testimony.',
    evidence_cited: evidenceCitations,
    score: 50
  };
}





