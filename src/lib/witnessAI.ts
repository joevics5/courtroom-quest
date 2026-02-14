import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Witness } from '../types';

// Initialize Gemini AI
const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  console.log('Checking for Gemini API key...');
  console.log('API key exists:', !!apiKey);
  console.log('API key length:', apiKey ? apiKey.length : 0);
  
  if (!apiKey) {
    console.warn('Gemini API key not found. Witness AI responses will be limited.');
    console.warn('Please add VITE_GEMINI_API_KEY to your .env file');
    console.warn('Current env vars:', Object.keys(import.meta.env).filter(k => k.includes('GEMINI')));
    return null;
  }
  console.log('Gemini API key found, initializing client...');
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate a witness response using Gemini AI based on the witness's knowledge and information
 */
export async function generateWitnessResponse(
  witness: Witness,
  question: string,
  previousInteractions: Array<{ question: string; response: string }> = []
): Promise<string> {
  console.log('generateWitnessResponse called for:', witness.name);
  console.log('Question:', question);
  
  const client = getGeminiClient();
  
  // If no API key, fall back to basic response
  if (!client) {
    console.warn('No Gemini client available, using fallback response');
    return generateFallbackResponse(witness, question);
  }

  try {
    // Build the system prompt with witness information
    const systemPrompt = buildWitnessPrompt(witness, previousInteractions);
    
    // Combine system prompt and question
    const fullPrompt = `${systemPrompt}\n\nQuestion: ${question}\n\nAnswer as the witness:`;
    
    console.log('Calling Gemini API for witness response...');
    console.log('Prompt length:', fullPrompt.length);
    
    // Try different model names (newest first)
    let model;
    let text = '';
    
    // Try gemini-2.5-flash (latest, fastest)
    try {
      model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(fullPrompt);
      text = result.response.text();
      console.log('Successfully got response from gemini-2.5-flash');
    } catch (flash25Error: any) {
      console.log('gemini-2.5-flash failed, trying gemini-2.0-flash:', flash25Error.message);
      try {
        model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(fullPrompt);
        text = result.response.text();
        console.log('Successfully got response from gemini-2.0-flash');
      } catch (flash20Error: any) {
        console.log('gemini-2.0-flash also failed, trying gemini-2.5-flash-lite:', flash20Error.message);
        try {
          model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
          const result = await model.generateContent(fullPrompt);
          text = result.response.text();
          console.log('Successfully got response from gemini-2.5-flash-lite');
        } catch (finalError: any) {
          throw new Error(`All model attempts failed. Last error: ${finalError.message}`);
        }
      }
    }
    
    console.log('Gemini response received (first 200 chars):', text.substring(0, 200));
    return text.trim();
  } catch (error: any) {
    console.error('Error generating witness response with Gemini:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    // Fall back to basic response on error
    console.log('Falling back to basic response');
    return generateFallbackResponse(witness, question);
  }
}

/**
 * Build a comprehensive prompt for the witness based on their information
 */
function buildWitnessPrompt(
  witness: Witness,
  previousInteractions: Array<{ question: string; response: string }>
): string {
  const personality = witness.personality_traits || {};
  const knowledge = witness.knowledge_scope || {};
  
  let prompt = `You are ${witness.name}, a witness in a legal case. Your role is: ${witness.role}.\n\n`;
  
  // Add background information (for context only, not for adding facts)
  if (witness.background) {
    prompt += `Your background (for context only): ${witness.background}\n\n`;
  }
  
  // Add base testimony - THIS IS THE PRIMARY AND ONLY SOURCE OF INFORMATION
  if (witness.base_testimony) {
    prompt += `═══════════════════════════════════════════════════════════\n`;
    prompt += `YOUR WRITTEN TESTIMONY - THIS IS YOUR ONLY SOURCE OF INFORMATION\n`;
    prompt += `You CANNOT add facts, details, or information beyond what is written here.\n`;
    prompt += `═══════════════════════════════════════════════════════════\n`;
    prompt += `${witness.base_testimony}\n\n`;
  } else {
    prompt += `WARNING: You have no written testimony. You can only say "I don't recall" or "I'm not sure."\n\n`;
  }
  
  // Add personality traits
  prompt += `Your personality traits:\n`;
  prompt += `- Cooperative: ${personality.cooperative !== false ? 'Yes' : 'No'}\n`;
  if (personality.detail_oriented) {
    prompt += `- Detail-oriented: Yes\n`;
  }
  if (personality.defensive) {
    prompt += `- Defensive: Yes\n`;
  }
  if (personality.helpful) {
    prompt += `- Helpful: Yes\n`;
  }
  prompt += '\n';
  
  // Add previous interactions for context
  if (previousInteractions.length > 0) {
    prompt += `Previous questions and your answers:\n`;
    previousInteractions.forEach((interaction, index) => {
      prompt += `${index + 1}. Q: ${interaction.question}\n`;
      prompt += `   A: ${interaction.response}\n`;
    });
    prompt += '\n';
  }
  
  // Add instructions - STRICT: Only use testimony
  prompt += `CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE STRICTLY:\n`;
  prompt += `1. You can ONLY answer based on your WRITTEN TESTIMONY provided above. This is your ONLY source of information.\n`;
  prompt += `2. You CANNOT add new facts, details, or information that is NOT explicitly stated in your testimony.\n`;
  prompt += `3. If asked about something NOT in your testimony, you MUST say: "I don't recall that" or "That's not something I mentioned in my testimony" or "I'm not sure about that."\n`;
  prompt += `4. You can rephrase, explain, or clarify what is in your testimony, but you CANNOT add new information.\n`;
  prompt += `5. Stay in character as ${witness.name} with the personality traits described.\n`;
  prompt += `6. Be consistent with your previous answers - if you said something before, stick to it.\n`;
  prompt += `7. Keep your response concise and natural, as if speaking in a deposition.\n`;
  prompt += `8. If the question asks about something outside your testimony, you MUST decline to answer or say you don't recall.\n`;
  prompt += `9. DO NOT invent, speculate, or add details that are not in your written testimony.\n`;
  prompt += `10. Your testimony is the ONLY truth you know - stick to it strictly.\n`;
  
  return prompt;
}

/**
 * Fallback response generator when Gemini is not available
 */
function generateFallbackResponse(witness: Witness, question: string): string {
  const personalities = witness.personality_traits as any;
  const isCooperative = personalities?.cooperative !== false;
  const q = question.toLowerCase();

  if (q.includes('see') || q.includes('observe') || q.includes('witness')) {
    return `${witness.base_testimony.split('.')[0]}. ${isCooperative ? 'I can tell you more if you have specific questions.' : "That's all I remember clearly."}`;
  }

  if (q.includes('when') || q.includes('time')) {
    return isCooperative
      ? `Based on what I recall, ${witness.base_testimony.split('.')[0].toLowerCase()}.`
      : "I'm not entirely sure about the exact timing.";
  }

  if (q.includes('where') || q.includes('location')) {
    return isCooperative
      ? `From what I remember, ${witness.base_testimony.substring(0, 100)}...`
      : "I'd rather not get into specific locations.";
  }

  return isCooperative
    ? `Yes, regarding your question: ${witness.base_testimony.substring(0, 150)}${witness.base_testimony.length > 150 ? '...' : ''}`
    : `I can only tell you what I told the police: ${witness.base_testimony.substring(0, 50)}...`;
}

