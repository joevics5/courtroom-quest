import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ObjectionRuling {
  ruling: 'sustained' | 'overruled';
  reasoning: string;
}

interface ObjectionContext {
  objection_by: 'prosecution' | 'defense';
  objection_reason: string;
  questioned_statement: string;
  current_phase: string;
  recent_transcript: string;
}

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not found. Judge AI will not function.');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate judge ruling on an objection
 */
export async function generateObjectionRuling(
  context: ObjectionContext
): Promise<ObjectionRuling> {
  const client = getGeminiClient();

  if (!client) {
    // Fallback: 50/50 chance
    return {
      ruling: Math.random() > 0.5 ? 'sustained' : 'overruled',
      reasoning: 'The Court has considered the objection and makes its ruling.'
    };
  }

  try {
    const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
    let model;
    let text = '';

    for (const modelName of modelNames) {
      try {
        console.log(`[Judge AI] Attempting to use model: ${modelName}`);
        model = client.getGenerativeModel({ model: modelName });
        const prompt = buildJudgePrompt(context);
        const result = await model.generateContent(prompt);
        text = result.response.text();
        console.log(`[Judge AI] Successfully got response from ${modelName}`);
        break;
      } catch (error: any) {
        console.warn(`[Judge AI] Model ${modelName} failed: ${error.message}`);
        if (modelName === modelNames[modelNames.length - 1]) {
          throw new Error(`All model attempts failed. Last error: ${error.message}`);
        }
      }
    }

    // Parse JSON response
    const ruling = parseJudgeResponse(text);
    return ruling;
  } catch (error: any) {
    console.error('[Judge AI] Error generating ruling:', error);
    return {
      ruling: Math.random() > 0.5 ? 'sustained' : 'overruled',
      reasoning: 'The Court has considered the objection and makes its ruling.'
    };
  }
}

function buildJudgePrompt(context: ObjectionContext): string {
  return `You are a Judge presiding over a courtroom trial.

An objection has been raised during the trial. You must rule on it.

OBJECTION DETAILS:
- Objection by: ${context.objection_by}
- Reason: ${context.objection_reason}
- Questioned statement: "${context.questioned_statement}"
- Current phase: ${context.current_phase}

RECENT TRANSCRIPT:
${context.recent_transcript || 'No recent activity.'}

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
}

Respond now:`;
}

function parseJudgeResponse(text: string): ObjectionRuling {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate ruling
      if (parsed.ruling === 'sustained' || parsed.ruling === 'overruled') {
        return {
          ruling: parsed.ruling,
          reasoning: parsed.reasoning || 'The Court has considered the objection and makes its ruling.'
        };
      }
    } catch (error) {
      console.error('[Judge AI] Failed to parse JSON:', error);
    }
  }

  // Fallback: infer from text
  const lowerText = text.toLowerCase();
  const isSustained = lowerText.includes('sustained') || 
                      lowerText.includes('granted') ||
                      lowerText.includes('objection is valid');

  return {
    ruling: isSustained ? 'sustained' : 'overruled',
    reasoning: text.substring(0, 200) || 'The Court has considered the objection and makes its ruling.'
  };
}





